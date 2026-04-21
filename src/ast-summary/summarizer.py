#!/usr/bin/env python3
"""
AST-based file summarizer for UpCommander worker-runtime.
Port of agora-code/summarizer.py pattern.

Usage (single file):
  python3 summarizer.py <file_path> [repo_root]

Usage (batch via stdin):
  echo '{"files": ["path1", "path2"], "repo_root": "/repo"}' | python3 summarizer.py --batch

Output: JSON FileSummary or list of FileSummary.
"""

from __future__ import annotations

import ast
import json
import os
import re
import sys
import textwrap
from pathlib import Path
from typing import Any

FILE_SUMMARY_TOKEN_BUDGET = int(os.environ.get("FILE_SUMMARY_TOKEN_BUDGET", "1000"))
SMALL_FILE_LINES = 100  # files smaller than this pass through as-is


def _est_tokens(text: str) -> int:
    return max(1, len(text) // 4)


def _slugify_path(path: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]", "_", path)[:120]


def _detect_language(path: str) -> str:
    ext = Path(path).suffix.lower()
    mapping = {
        ".py": "python",
        ".ts": "typescript", ".tsx": "typescript",
        ".js": "javascript", ".jsx": "javascript", ".mjs": "javascript",
        ".go": "go",
        ".rs": "rust",
        ".java": "java",
        ".rb": "ruby",
        ".kt": "kotlin",
        ".swift": "swift",
        ".cs": "csharp",
        ".cpp": "cpp", ".cc": "cpp", ".cxx": "cpp",
        ".c": "c",
        ".php": "php",
        ".scala": "scala",
        ".lua": "lua",
        ".sh": "bash", ".bash": "bash",
        ".sql": "sql",
        ".json": "json",
        ".yaml": "yaml", ".yml": "yaml",
        ".md": "markdown", ".mdx": "markdown",
    }
    return mapping.get(ext, "unknown")


# ---------------------------------------------------------------------------
# Python summarizer (uses stdlib ast — no tree-sitter needed)
# ---------------------------------------------------------------------------

def _summarize_python(content: str, path: str, sha: str) -> dict[str, Any]:
    lines = content.splitlines()
    imports: list[str] = []
    classes: list[dict] = []
    functions: list[dict] = []

    try:
        tree = ast.parse(content)
    except SyntaxError:
        return _regex_fallback(content, path, sha, "python")

    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            try:
                imports.append(ast.unparse(node))
            except Exception:
                pass
        elif isinstance(node, ast.ClassDef):
            classes.append({
                "name": node.name,
                "line": node.lineno,
                "kind": "class",
            })
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            # Only top-level and class-level functions (depth 1)
            try:
                sig = ast.unparse(node.args)
                prefix = "async def" if isinstance(node, ast.AsyncFunctionDef) else "def"
                signature = f"{prefix} {node.name}({sig})"
                docstring: str | None = None
                if (node.body and isinstance(node.body[0], ast.Expr)
                        and isinstance(node.body[0].value, ast.Constant)):
                    docstring = textwrap.shorten(str(node.body[0].value.value), width=120)
                functions.append({
                    "name": node.name,
                    "line": node.lineno,
                    "signature": signature,
                    **({"docstring": docstring} if docstring else {}),
                })
            except Exception:
                pass

    return _build_summary(path, sha, "python", imports[:200], classes, functions, content)


# ---------------------------------------------------------------------------
# Tree-sitter summarizers
# ---------------------------------------------------------------------------

_TS_QUERIES: dict[str, str] = {
    "typescript": """
(import_statement) @import
(class_declaration name: (type_identifier) @class_name) @class
(interface_declaration name: (type_identifier) @iface_name) @interface
(type_alias_declaration name: (type_identifier) @type_name) @type
(function_declaration name: (identifier) @fn_name) @function
(method_definition name: (property_identifier) @method_name) @method
(lexical_declaration
  (variable_declarator
    name: (identifier) @arrow_name
    value: (arrow_function))) @arrow
""",
    "javascript": """
(import_statement) @import
(class_declaration name: (identifier) @class_name) @class
(function_declaration name: (identifier) @fn_name) @function
(method_definition name: (property_identifier) @method_name) @method
(lexical_declaration
  (variable_declarator
    name: (identifier) @arrow_name
    value: (arrow_function))) @arrow
""",
    "sql": """
(create_table_statement
  name: (_) @table_name) @create_table
(create_index_statement
  name: (_) @index_name) @create_index
""",
    "go": """
(import_declaration) @import
(type_declaration (type_spec name: (type_identifier) @type_name)) @type
(function_declaration name: (identifier) @fn_name) @function
(method_declaration name: (field_identifier) @method_name) @method
""",
    "rust": """
(use_declaration) @import
(struct_item name: (type_identifier) @struct_name) @struct
(trait_item name: (type_identifier) @trait_name) @trait
(function_item name: (identifier) @fn_name) @function
(impl_item) @impl
""",
    "java": """
(import_declaration) @import
(class_declaration name: (identifier) @class_name) @class
(method_declaration name: (identifier) @method_name) @method
(interface_declaration name: (identifier) @iface_name) @interface
""",
}


def _try_tree_sitter_parse(language: str, content: str) -> tuple[Any, bytes] | None:
    """Returns (tree, content_bytes) so callers can use byte slices for node_text."""
    try:
        import tree_sitter_language_pack as lang_pack
        import tree_sitter

        lang_name_map = {
            "typescript": "typescript",
            "javascript": "javascript",
            "go": "go",
            "rust": "rust",
            "java": "java",
            "ruby": "ruby",
            "kotlin": "kotlin",
            "swift": "swift",
            "csharp": "c_sharp",
            "cpp": "cpp",
            "c": "c",
            "php": "php",
            "scala": "scala",
            "lua": "lua",
            "bash": "bash",
            "sql": "sql",
        }

        ts_lang_name = lang_name_map.get(language)
        if ts_lang_name is None:
            return None

        lang = lang_pack.get_language(ts_lang_name)
        parser = tree_sitter.Parser(lang)
        content_bytes = content.encode("utf-8", errors="replace")
        return (parser.parse(content_bytes), content_bytes)
    except Exception:
        return None


def _summarize_ts_js(content: str, path: str, sha: str, language: str) -> dict[str, Any]:
    imports: list[str] = []
    classes: list[dict] = []
    functions: list[dict] = []

    result = _try_tree_sitter_parse(language, content)
    if result is None:
        return _regex_fallback(content, path, sha, language)

    tree, cb = result  # cb = content as bytes for correct byte-offset slicing

    try:
        def node_text(node: Any) -> str:
            return cb[node.start_byte:node.end_byte].decode("utf-8", errors="replace")

        def node_line(node: Any) -> int:
            return node.start_point[0] + 1

        def walk(node: Any) -> None:
            t = node.type
            # export_statement wraps declarations — descend transparently
            if t == "export_statement":
                for child in node.children:
                    walk(child)
                return
            if t == "import_statement":
                line = node_text(node).split("\n")[0].strip()
                if len(imports) < 200:
                    imports.append(line)
            elif t in ("class_declaration", "class"):
                name = ""
                for child in node.children:
                    if child.type in ("type_identifier", "identifier") and not name:
                        name = node_text(child)
                if name:
                    classes.append({"name": name, "line": node_line(node), "kind": "class"})
            elif t == "interface_declaration":
                name = ""
                for child in node.children:
                    if child.type == "type_identifier":
                        name = node_text(child)
                        break
                if name:
                    classes.append({"name": name, "line": node_line(node), "kind": "interface"})
            elif t == "type_alias_declaration":
                name = ""
                for child in node.children:
                    if child.type == "type_identifier":
                        name = node_text(child)
                        break
                if name:
                    classes.append({"name": name, "line": node_line(node), "kind": "type"})
            elif t in ("function_declaration", "method_definition", "function"):
                name = ""
                for child in node.children:
                    if child.type in ("identifier", "property_identifier", "type_identifier") and not name:
                        name = node_text(child)
                raw = node_text(node)
                brace = raw.find("{")
                sig = raw[:brace].strip() if brace > 0 else raw.split("\n")[0]
                if name:
                    functions.append({
                        "name": name,
                        "line": node_line(node),
                        "signature": sig[:200],
                    })
            elif t == "lexical_declaration":
                for vd in node.children:
                    if vd.type == "variable_declarator":
                        vname = ""
                        has_arrow = False
                        for ch in vd.children:
                            if ch.type in ("identifier",) and not vname:
                                vname = node_text(ch)
                            if ch.type in ("arrow_function", "function"):
                                has_arrow = True
                        if vname and has_arrow:
                            sig = node_text(vd)[:200]
                            functions.append({
                                "name": vname,
                                "line": node_line(vd),
                                "signature": sig,
                            })
            for child in node.children:
                walk(child)

        walk(tree.root_node)
    except Exception:
        return _regex_fallback(content, path, sha, language)

    return _build_summary(path, sha, language, imports, classes, functions, content)


def _summarize_sql(content: str, path: str, sha: str) -> dict[str, Any]:
    result = _try_tree_sitter_parse("sql", content)
    if result is not None:
        try:
            tree, cb = result
            classes: list[dict] = []
            functions: list[dict] = []

            def node_text(node: Any) -> str:
                return cb[node.start_byte:node.end_byte].decode("utf-8", errors="replace")

            def walk(node: Any) -> None:
                t = node.type
                if "create_table" in t:
                    for child in node.children:
                        if child.type in ("identifier", "table_reference", "object_reference"):
                            name = node_text(child)
                            classes.append({"name": name, "line": child.start_point[0]+1, "kind": "type"})
                            break
                for child in node.children:
                    walk(child)

            walk(tree.root_node)
            return _build_summary(path, sha, "sql", [], classes, functions, content)
        except Exception:
            pass

    # Native regex fallback for SQL
    classes = []
    for m in re.finditer(r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s(]+)', content, re.IGNORECASE):
        line = content[:m.start()].count("\n") + 1
        classes.append({"name": m.group(1).strip('"').strip("'"), "line": line, "kind": "type"})
    return _build_summary(path, sha, "sql", [], classes, [], content)


def _summarize_markdown(content: str, path: str, sha: str) -> dict[str, Any]:
    lines = content.splitlines()
    headings: list[dict] = []
    opening_para: list[str] = []
    in_code = False
    para_done = False

    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith("```"):
            in_code = not in_code
            continue
        if in_code:
            continue
        if stripped.startswith("#"):
            depth = len(stripped) - len(stripped.lstrip("#"))
            name = stripped.lstrip("#").strip()
            kind: str = "class" if depth == 1 else "interface" if depth == 2 else "type"
            headings.append({"name": name, "line": i + 1, "kind": kind})
        elif stripped and not para_done and not headings:
            opening_para.append(stripped)
            if len(opening_para) >= 3:
                para_done = True

    functions: list[dict] = []
    if opening_para:
        functions.append({
            "name": "_intro",
            "line": 1,
            "signature": " ".join(opening_para)[:200],
        })

    return _build_summary(path, sha, "markdown", [], headings, functions, content)


def _summarize_json(content: str, path: str, sha: str) -> dict[str, Any]:
    try:
        data = json.loads(content)
        if isinstance(data, dict):
            keys = list(data.keys())[:50]
            classes = [{"name": k, "line": 1, "kind": "type"} for k in keys]
            return _build_summary(path, sha, "json", [], classes, [], content)
    except Exception:
        pass
    return _regex_fallback(content, path, sha, "json")


def _summarize_yaml(content: str, path: str, sha: str) -> dict[str, Any]:
    lines = content.splitlines()
    classes: list[dict] = []
    for i, line in enumerate(lines):
        if line and not line.startswith(" ") and not line.startswith("#") and ":" in line:
            key = line.split(":")[0].strip()
            if key:
                classes.append({"name": key, "line": i + 1, "kind": "type"})
    return _build_summary(path, sha, "yaml", [], classes[:50], [], content)


def _regex_fallback(content: str, path: str, sha: str, language: str) -> dict[str, Any]:
    lines = content.splitlines()[:100]
    imports: list[str] = []
    functions: list[dict] = []
    classes: list[dict] = []

    for i, line in enumerate(lines):
        stripped = line.strip()
        if re.match(r'^(import|from|require|#include|using)\b', stripped):
            imports.append(stripped[:200])
        elif re.match(r'^(export\s+)?(async\s+)?function\s+\w+', stripped):
            m = re.match(r'^(?:export\s+)?(?:async\s+)?function\s+(\w+)', stripped)
            if m:
                functions.append({"name": m.group(1), "line": i + 1, "signature": stripped[:200]})
        elif re.match(r'^(?:export\s+)?(?:abstract\s+)?class\s+\w+', stripped):
            m = re.match(r'^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)', stripped)
            if m:
                classes.append({"name": m.group(1), "line": i + 1, "kind": "class"})
        elif re.match(r'^(?:export\s+)?interface\s+\w+', stripped):
            m = re.match(r'^(?:export\s+)?interface\s+(\w+)', stripped)
            if m:
                classes.append({"name": m.group(1), "line": i + 1, "kind": "interface"})

    return _build_summary(path, sha, language, imports[:200], classes, functions, content)


def _build_summary(
    path: str, sha: str, language: str,
    imports: list[str], classes: list[dict], functions: list[dict],
    content: str
) -> dict[str, Any]:
    from datetime import datetime, timezone
    original_tokens = _est_tokens(content)
    summary_text = json.dumps({
        "imports": imports,
        "classes": classes,
        "functions": functions,
    })
    summary_tokens = _est_tokens(summary_text)
    return {
        "path": path,
        "sha": sha,
        "language": language,
        "imports": imports,
        "classes": classes,
        "functions": functions,
        "tokens": summary_tokens,
        "originalTokens": original_tokens,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }


def summarize_file(file_path: str, repo_root: str = "", sha: str = "") -> dict[str, Any]:
    abs_path = Path(file_path) if os.path.isabs(file_path) else Path(repo_root) / file_path
    try:
        content = abs_path.read_text(errors="replace")
    except Exception as e:
        return {
            "path": file_path, "sha": sha, "language": "unknown",
            "imports": [], "classes": [], "functions": [],
            "tokens": 0, "originalTokens": 0,
            "generatedAt": "",
            "error": str(e),
        }

    lines = content.splitlines()
    if not os.path.isabs(file_path):
        rel_path = file_path
    elif repo_root:
        try:
            rel_path = str(abs_path.relative_to(Path(repo_root).resolve()))
        except ValueError:
            rel_path = str(abs_path)
    else:
        rel_path = str(abs_path)
    language = _detect_language(file_path)

    # Small files pass through (contract §6)
    if len(lines) < SMALL_FILE_LINES:
        return _build_summary(rel_path, sha, language, [], [], [], content)

    if language == "python":
        return _summarize_python(content, rel_path, sha)
    elif language in ("typescript", "javascript"):
        return _summarize_ts_js(content, rel_path, sha, language)
    elif language == "sql":
        return _summarize_sql(content, rel_path, sha)
    elif language == "markdown":
        return _summarize_markdown(content, rel_path, sha)
    elif language == "json":
        return _summarize_json(content, rel_path, sha)
    elif language in ("yaml",):
        return _summarize_yaml(content, rel_path, sha)
    elif language in ("go", "rust", "java", "ruby", "kotlin", "swift", "csharp", "cpp", "c", "php", "scala", "lua", "bash"):
        result = _try_tree_sitter_parse(language, content)
        if result is not None:
            tree, cb = result
            return _generic_tree_sitter_summary(content, cb, rel_path, sha, language, tree)
        return _regex_fallback(content, rel_path, sha, language)
    else:
        return _regex_fallback(content, rel_path, sha, language)


def _generic_tree_sitter_summary(content: str, cb: bytes, path: str, sha: str, language: str, tree: Any) -> dict[str, Any]:
    imports: list[str] = []
    classes: list[dict] = []
    functions: list[dict] = []

    def node_text(node: Any) -> str:
        return cb[node.start_byte:node.end_byte].decode("utf-8", errors="replace")

    def walk(node: Any) -> None:
        t = node.type
        if t in ("import_declaration", "use_declaration", "import_statement", "preproc_include"):
            line = node_text(node).split("\n")[0].strip()
            if len(imports) < 200:
                imports.append(line)
        elif t in ("class_declaration", "struct_item", "struct_declaration",
                   "interface_declaration", "trait_item", "type_declaration"):
            for child in node.children:
                if child.type in ("type_identifier", "identifier"):
                    classes.append({
                        "name": node_text(child),
                        "line": child.start_point[0] + 1,
                        "kind": "class" if "class" in t or "struct" in t else "interface",
                    })
                    break
        elif t in ("function_declaration", "method_declaration", "function_definition",
                   "function_item", "method_definition"):
            name = ""
            for child in node.children:
                if child.type in ("identifier", "field_identifier", "type_identifier") and not name:
                    name = node_text(child)
            if name:
                raw = node_text(node)
                brace = raw.find("{")
                sig = raw[:brace].strip() if brace > 0 else raw.split("\n")[0]
                functions.append({
                    "name": name,
                    "line": node.start_point[0] + 1,
                    "signature": sig[:200],
                })
        for child in node.children:
            walk(child)

    walk(tree.root_node)
    return _build_summary(path, sha, language, imports[:200], classes, functions, content)


def main() -> None:
    if "--batch" in sys.argv or (not sys.stdin.isatty() and len(sys.argv) == 1):
        try:
            batch = json.loads(sys.stdin.read())
            results = []
            for f in batch.get("files", []):
                sha = batch.get("shas", {}).get(f, "")
                results.append(summarize_file(f, batch.get("repo_root", ""), sha))
            print(json.dumps(results))
        except Exception as e:
            print(json.dumps({"error": str(e)}))
        return

    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: summarizer.py <file_path> [repo_root] [sha]"}))
        sys.exit(1)

    file_path = sys.argv[1]
    repo_root = sys.argv[2] if len(sys.argv) > 2 else ""
    sha = sys.argv[3] if len(sys.argv) > 3 else ""
    result = summarize_file(file_path, repo_root, sha)
    print(json.dumps(result))


if __name__ == "__main__":
    main()
