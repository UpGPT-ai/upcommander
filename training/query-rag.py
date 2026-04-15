#!/usr/bin/env python3
"""
Pharma Regulatory RAG Query CLI
=================================
Query the BM25 index built by build-rag-index.py.

Usage:
    python3 training/query-rag.py "hERG temperature requirement"
    python3 training/query-rag.py "BE 80-125% confidence interval" --top 5
    python3 training/query-rag.py "ICSR 15 day expedited" --guideline "EMA GVP"
    python3 training/query-rag.py "audit trail" --severity critical
    python3 training/query-rag.py "QTc threshold" --jurisdiction EU
    python3 training/query-rag.py  (interactive mode)

Options:
    --top N          Return N results (default: 5)
    --guideline STR  Filter by guideline substring (e.g. "ICH M12", "EMA GVP")
    --severity STR   Filter by severity: critical|high|medium|low
    --jurisdiction   Filter by jurisdiction: EU|FDA|Japan|Canada
    --json           Output raw JSON instead of formatted text
"""

import json
import sys
import re
import math
import argparse
from pathlib import Path
from collections import defaultdict

BASE_DIR = Path(__file__).parent
INDEX_FILE = BASE_DIR / "rag-index" / "index.json"

# BM25 parameters (must match build script)
BM25_K1 = 1.5
BM25_B  = 0.75

STOPWORDS = {
    "the", "a", "an", "and", "or", "of", "in", "to", "for", "is", "are",
    "be", "been", "was", "were", "has", "have", "had", "that", "this",
    "with", "as", "at", "by", "from", "on", "not", "may", "shall", "should",
    "must", "will", "when", "where", "which", "who", "how", "what", "if",
    "can", "also", "its", "it", "all", "any", "each", "per", "than",
    "into", "such", "used", "use", "used", "using", "used", "both",
}

_INDEX_CACHE: dict | None = None


def load_index() -> dict:
    global _INDEX_CACHE
    if _INDEX_CACHE is not None:
        return _INDEX_CACHE
    if not INDEX_FILE.exists():
        print(f"ERROR: Index not found at {INDEX_FILE}")
        print("Run: python3 training/build-rag-index.py")
        sys.exit(1)
    with open(INDEX_FILE, "r", encoding="utf-8") as f:
        _INDEX_CACHE = json.load(f)
    return _INDEX_CACHE


def tokenize(text: str) -> list[str]:
    if not text:
        return []
    text = str(text).lower()
    tokens = re.findall(r"[a-z0-9]+(?:[.\-][a-z0-9]+)*", text)
    return [t for t in tokens if t and t not in STOPWORDS and len(t) >= 2]


def search(query: str, top_k: int = 5,
           filter_guideline: str | None = None,
           filter_severity: str | None = None,
           filter_jurisdiction: str | None = None) -> list[dict]:
    index = load_index()
    query_tokens = tokenize(query)
    if not query_tokens:
        return []

    inverted = index["inverted"]
    idf = index["idf"]
    dl = index["dl"]
    avgdl = index["avgdl"]
    docs = index["docs"]

    scores: dict[int, float] = defaultdict(float)

    for term in query_tokens:
        if term not in inverted:
            continue
        term_idf = idf.get(term, 0.0)
        for doc_idx_str, tf in inverted[term].items():
            doc_idx = int(doc_idx_str)
            doc_len = dl[doc_idx]
            numerator = tf * (BM25_K1 + 1)
            denominator = tf + BM25_K1 * (1 - BM25_B + BM25_B * doc_len / avgdl)
            scores[doc_idx] += term_idf * (numerator / denominator)

    # Apply filters
    filtered = {}
    for doc_idx, score in scores.items():
        doc = docs[doc_idx]
        if filter_guideline and filter_guideline.lower() not in doc["guideline"].lower():
            continue
        if filter_severity and doc["severity"] != filter_severity.lower():
            continue
        if filter_jurisdiction:
            regional = doc.get("regional_applicability") or []
            if not any(filter_jurisdiction.lower() in r.lower() for r in regional):
                continue
        filtered[doc_idx] = score

    ranked = sorted(filtered.items(), key=lambda x: -x[1])[:top_k]

    results = []
    for rank, (doc_idx, score) in enumerate(ranked, 1):
        result = dict(docs[doc_idx])
        result["_score"] = round(score, 4)
        result["_rank"] = rank
        results.append(result)

    return results


def format_result(r: dict, query: str) -> str:
    """Format a single result for terminal display."""
    lines = []

    sev = r.get("severity", "medium").upper()
    sev_colors = {"CRITICAL": "\033[91m", "HIGH": "\033[93m", "MEDIUM": "\033[96m", "LOW": "\033[92m"}
    reset = "\033[0m"
    sev_color = sev_colors.get(sev, "")

    lines.append(f"\n{'─' * 70}")
    lines.append(f"#{r['_rank']}  {sev_color}[{sev}]{reset}  {r['rule_id']}  (score: {r['_score']})")
    lines.append(f"Guideline: {r['guideline']}")
    if r.get("source_section"):
        lines.append(f"Section:   {r['source_section']}")
    if r.get("regional_applicability"):
        lines.append(f"Region:    {', '.join(r['regional_applicability'])}")

    lines.append(f"\nRule:")
    # Word-wrap rule text at 70 chars
    rule_text = r.get("rule_text", "")
    words = rule_text.split()
    line_buf, wrapped = [], []
    for word in words:
        if sum(len(w) + 1 for w in line_buf) + len(word) > 70:
            wrapped.append("  " + " ".join(line_buf))
            line_buf = [word]
        else:
            line_buf.append(word)
    if line_buf:
        wrapped.append("  " + " ".join(line_buf))
    lines.extend(wrapped)

    if r.get("source_quote") and len(r["source_quote"]) > 20:
        quote = r["source_quote"][:300]
        if len(r["source_quote"]) > 300:
            quote += "…"
        lines.append(f'\nVerbatim: "{quote}"')

    if r.get("thresholds"):
        t = r["thresholds"]
        if isinstance(t, dict):
            thresh_str = "; ".join(f"{k}: {v}" for k, v in t.items() if k != "note")
        else:
            thresh_str = str(t)
        lines.append(f"\nThresholds: {thresh_str}")

    lines.append(f"\nVerified: {r.get('verification_status', 'unknown')}  |  File: {r.get('source_file', '')}")

    return "\n".join(lines)


def interactive_mode():
    """Run interactive query session."""
    print("\n" + "=" * 70)
    print("  Pharma Regulatory RAG — Interactive Query")
    print("  Type a question. Prefix with flags:")
    print("    --top N  --guideline STR  --severity critical|high  --jurisdiction EU|FDA")
    print("    Type 'quit' or Ctrl+C to exit")
    print("=" * 70)

    # Preload index
    load_index()
    print(f"  Index loaded: {load_index()['N']} rules\n")

    while True:
        try:
            raw = input("\nQuery> ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nExiting.")
            break

        if not raw or raw.lower() in ("quit", "exit", "q"):
            break

        # Parse inline flags
        top_k = 5
        filter_guideline = None
        filter_severity = None
        filter_jurisdiction = None

        # Extract --flag value pairs from query
        query = raw
        for flag, var in [("--top", "top"), ("--guideline", "guideline"),
                           ("--severity", "severity"), ("--jurisdiction", "jurisdiction")]:
            m = re.search(rf"{re.escape(flag)}\s+(\S+)", query)
            if m:
                val = m.group(1)
                query = query[:m.start()] + query[m.end():]
                if flag == "--top":
                    top_k = int(val)
                elif flag == "--guideline":
                    filter_guideline = val
                elif flag == "--severity":
                    filter_severity = val
                elif flag == "--jurisdiction":
                    filter_jurisdiction = val

        query = query.strip()
        if not query:
            continue

        results = search(query, top_k=top_k,
                         filter_guideline=filter_guideline,
                         filter_severity=filter_severity,
                         filter_jurisdiction=filter_jurisdiction)

        if not results:
            print("  No matching rules found.")
            continue

        print(f"\n  Found {len(results)} results for: '{query}'")
        for r in results:
            print(format_result(r, query))
        print()


def main():
    parser = argparse.ArgumentParser(description="Pharma Regulatory RAG Query")
    parser.add_argument("query", nargs="?", default=None, help="Query string (omit for interactive mode)")
    parser.add_argument("--top", type=int, default=5, help="Number of results (default: 5)")
    parser.add_argument("--guideline", type=str, default=None, help="Filter by guideline substring")
    parser.add_argument("--severity", type=str, default=None, help="Filter: critical|high|medium|low")
    parser.add_argument("--jurisdiction", type=str, default=None, help="Filter: EU|FDA|Japan|Canada")
    parser.add_argument("--json", action="store_true", help="Output raw JSON")

    args = parser.parse_args()

    if args.query is None:
        interactive_mode()
        return

    results = search(
        args.query,
        top_k=args.top,
        filter_guideline=args.guideline,
        filter_severity=args.severity,
        filter_jurisdiction=args.jurisdiction,
    )

    if args.json:
        print(json.dumps(results, indent=2))
        return

    if not results:
        print("No matching rules found.")
        return

    print(f"\nQuery: '{args.query}'  |  {len(results)} results")
    for r in results:
        print(format_result(r, args.query))
    print()


if __name__ == "__main__":
    main()
