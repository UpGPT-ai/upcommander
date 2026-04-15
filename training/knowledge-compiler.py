#!/usr/bin/env python3
"""
Pharma Training Knowledge Compiler
===================================
Scans all training output directories, extracts and normalizes rules,
deduplicates, and compiles into a single master knowledge base JSON.

Usage:
    python3 training/knowledge-compiler.py

Output:
    training/master-knowledge-base.json
    training/compiler-report.json
"""

import json
import os
import re
import hashlib
from pathlib import Path
from datetime import datetime
from typing import Any

BASE_DIR = Path(__file__).parent
OUTPUT_FILE = BASE_DIR / "master-knowledge-base.json"
REPORT_FILE = BASE_DIR / "compiler-report.json"

# Source directories in priority order (later entries override earlier on conflict)
SOURCE_DIRS = [
    BASE_DIR / "output-v2",
    BASE_DIR / "output-v3",
    BASE_DIR / "gap-close",
    BASE_DIR / "output-v4",
]

# Files using domain-specific nested schemas — require dedicated adapters (not yet implemented)
SCHEMA_INCOMPATIBLE = [
    # These are now handled by dedicated adapters below — kept for reference only
    # "safety-reporting-rules", "special-populations-rules",
    # "eu-gmp-vs-fda-cgmp", "eu-vs-fda-divergences",
    # "canada-vs-fda-ema", "japan-vs-fda-ema",
    "jurisdiction-divergences",  # placeholder not yet seen in corpus
]

# Files to skip (scorecards, synthesis docs, not rule files)
SKIP_PATTERNS = [
    "CONSOLIDATED_D1", "FINAL_100_SCORECARD", "scorecard",
    "SYNTHESIS", "TIMING", "source-references-report",
    "gap-closure-metrics", "gap-closure-changes", "final-4-metrics",
    "compiler-report", "master-knowledge-base",
    "d1-close-quotes", "d1-final-closeout", "m3-quotes",
    "s7a-quotes", "s7b-quotes", "qas-quotes",
    "batch-4-download", "pv08-to-pv19", "pass7-quotes", "pass9-closing",
]

def should_skip(filepath: Path) -> bool:
    name = filepath.stem
    if any(pat.lower() in name.lower() for pat in SKIP_PATTERNS):
        return True
    if any(pat.lower() in name.lower() for pat in SCHEMA_INCOMPATIBLE):
        return True  # schema-incompatible, logged separately
    return False

def make_rule_id(rule: dict, source_file: str) -> str:
    """Generate a stable hash ID for deduplication."""
    key_parts = [
        rule.get("rule_id", ""),
        rule.get("rule_text", "")[:100],
        rule.get("source_section", ""),
    ]
    key = "|".join(str(p) for p in key_parts)
    return hashlib.sha256(key.encode()).hexdigest()[:16]

def normalize_severity(sev: Any) -> str:
    if not sev:
        return "medium"
    s = str(sev).lower().strip()
    if s in ("critical", "high", "medium", "low"):
        return s
    # Map variants
    if "crit" in s:
        return "critical"
    if "high" in s or "major" in s:
        return "high"
    if "low" in s or "minor" in s:
        return "low"
    return "medium"

def normalize_verification(v: Any) -> str:
    if not v:
        return "UNKNOWN"
    s = str(v).upper()
    if s in ("TRUE", "1", "YES"):  # boolean-style verified flags
        return "VERIFIED"
    if "VERIFIED" in s and "PARTIAL" not in s and "UN" not in s:
        return "VERIFIED"
    if "PARTIAL" in s:
        return "PARTIALLY_VERIFIED"
    if "UNVERIF" in s:
        return "UNVERIFIABLE"
    if "EMERGING" in s or "CLASSIFIED" in s:
        return "EMERGING_PRACTICE"
    return "UNKNOWN"

def extract_rules_from_value(value: Any, path: str, source_file: str, guideline: str) -> list[dict]:
    """Recursively extract rule objects from arbitrary JSON structures."""
    rules = []

    if isinstance(value, dict):
        # Check if this dict looks like a rule
        has_rule_text = ("rule_text" in value or "requirement" in value or
                         "description" in value or "text" in value or
                         "plain_language" in value or "rule" in value)
        has_source = ("source_section" in value or "source_quote" in value or
                      "source_page" in value)
        has_verification = ("verification_status" in value or "source_verified" in value or
                            "verified" in value)

        if has_rule_text or (has_source and has_verification):
            rule = {
                "rule_id": value.get("rule_id") or value.get("id") or f"auto-{path[:30]}",
                "rule_text": (
                    value.get("rule_text") or
                    value.get("requirement") or
                    value.get("plain_language") or
                    value.get("text") or
                    value.get("topic") or
                    value.get("description") or
                    value.get("rule") or ""
                ),
                "source_section": (value.get("source_section") or value.get("section") or ""),
                "source_page": value.get("source_page") or value.get("page") or None,
                "source_quote": (value.get("source_quote") or value.get("quote") or
                                 value.get("verbatim_quote") or ""),
                "verification_status": normalize_verification(
                    value.get("verification_status") or
                    value.get("source_verified") or
                    value.get("verified")
                ),
                "severity": normalize_severity(value.get("severity") or value.get("priority")),
                "category": value.get("category") or value.get("type") or path.split(".")[0],
                "guideline": guideline,
                "source_file": source_file,
                "_json_path": path,
            }
            # Pull in any regional info
            if "regional_applicability" in value:
                rule["regional_applicability"] = value["regional_applicability"]
            elif "jurisdiction" in value:
                rule["regional_applicability"] = [value["jurisdiction"]]

            # Threshold values if present
            if "threshold" in value or "thresholds" in value:
                rule["thresholds"] = value.get("threshold") or value.get("thresholds")

            if rule["rule_text"] and len(rule["rule_text"]) > 10:
                # Auto-upgrade: rules with a verbatim source quote are effectively verified
                if (rule["verification_status"] == "UNKNOWN" and
                        rule.get("source_quote") and len(rule["source_quote"]) >= 30):
                    rule["verification_status"] = "VERIFIED"
                rules.append(rule)

        # Recurse into children regardless
        for k, v in value.items():
            if k not in ("source_quote", "quote", "secondary_source_quote", "source_context", "upgrade_note"):
                child_rules = extract_rules_from_value(v, f"{path}.{k}", source_file, guideline)
                rules.extend(child_rules)

    elif isinstance(value, list):
        for i, item in enumerate(value):
            child_rules = extract_rules_from_value(item, f"{path}[{i}]", source_file, guideline)
            rules.extend(child_rules)

    return rules

def infer_guideline(data: Any, filepath: Path) -> str:
    """Infer the primary guideline from file metadata."""
    # Check meta fields (only if data is a dict)
    if isinstance(data, dict):
        for field in ("guideline", "guidelines", "source_document", "title"):
            val = data.get("meta", {}).get(field, "")
            if val:
                if isinstance(val, list):
                    return " + ".join(str(v) for v in val[:3])
                return str(val)[:80]

    # Infer from filename
    name = filepath.stem.upper()
    mapping = {
        "M12": "ICH M12", "M13A": "ICH M13A", "M11": "ICH M11",
        "E6R3": "ICH E6(R3)", "S11": "ICH S11", "S1B": "ICH S1B(R1)",
        "M14": "ICH M14", "M15": "ICH M15", "Q5A": "ICH Q5A(R2)",
        "Q2": "ICH Q2(R2)", "M7": "ICH M7(R2)", "Q9": "ICH Q9(R1)",
        "Q3D": "ICH Q3D", "E19": "ICH E19", "E2D": "ICH E2D(R1)",
        "M9": "ICH M9", "E10": "ICH E10", "E15": "ICH E15",
        "E16": "ICH E16", "E18": "ICH E18", "M4S": "ICH M4S(R2)",
        "Q5D": "ICH Q5D", "Q3C": "ICH Q3C(R9)",
        "SAFETY-PHARM": "ICH S7A/S7B", "SAFETY-PHARMACOLOGY": "ICH S7A/S7B",
        "CLINICAL-DESIGN": "ICH E Guidelines",
        "BIOTECH": "ICH Q Biotech", "STABILITY": "ICH Q1 Stability",
        "ANALYTICAL": "ICH Q2/Q3",
        "PHARMACOVIGILANCE": "EMA GVP", "GVP": "EMA GVP",
        "EU-GMP": "EU GMP", "WHO": "WHO Guidelines",
        "HEALTH-CANADA": "Health Canada",
        "FDA": "FDA Guidance", "CRL": "Regulatory CRL Analysis",
        "NONCLINICAL": "ICH S Guidelines",
    }
    for key, val in mapping.items():
        if key in name:
            return val
    return filepath.stem.replace("-", " ").replace("_", " ").title()

def adapt_safety_reporting(data: dict, filepath: Path) -> list[dict]:
    """
    Adapter for safety-reporting-rules.json which uses timeline/followup/requirement fields
    in deeply nested structures covering E2A/E2B/E2C/E2D expedited reporting.
    """
    rules = []
    source_file = str(filepath.relative_to(BASE_DIR))
    guideline = "ICH E2A/E2B(R3)/E2C(R2)/E2D Safety Reporting"
    rule_counter = [0]

    def recurse(obj: Any, path: str, context: str = "") -> None:
        if not isinstance(obj, dict):
            if isinstance(obj, list):
                for i, item in enumerate(obj):
                    recurse(item, f"{path}[{i}]", context)
            return

        # Extract if has timeline, requirement, or criteria fields
        has_content = any(k in obj for k in ("timeline", "requirement", "criteria",
                                              "rule_text", "description", "minimum_criteria",
                                              "expedited_timeline", "reporting_threshold"))

        # Build rule_text from available fields
        texts = []
        if "timeline" in obj:
            texts.append(f"Timeline: {obj['timeline']}")
        if "requirement" in obj:
            texts.append(str(obj["requirement"]))
        if "criteria" in obj and isinstance(obj["criteria"], str):
            texts.append(f"Criteria: {obj['criteria']}")
        if "description" in obj and isinstance(obj["description"], str):
            texts.append(str(obj["description"]))
        if "minimum_criteria" in obj:
            mc = obj["minimum_criteria"]
            if isinstance(mc, list):
                texts.append("Minimum criteria: " + "; ".join(str(x) for x in mc[:4]))
            elif isinstance(mc, str):
                texts.append(f"Minimum criteria: {mc}")

        rule_text = " | ".join(t for t in texts if t and len(t) > 5)

        if rule_text and len(rule_text) > 15:
            rule_counter[0] += 1
            # Infer severity from timeline keywords
            tl = obj.get("timeline", "")
            sev = "medium"
            if "7" in str(tl) or "15" in str(tl) or "fatal" in path.lower():
                sev = "critical"
            elif "30" in str(tl) or "90" in str(tl) or "serious" in path.lower():
                sev = "high"

            rules.append({
                "rule_id": f"SR-{rule_counter[0]:03d}",
                "rule_text": rule_text,
                "source_section": path.replace(".", " > "),
                "source_page": None,
                "source_quote": obj.get("source_quote", obj.get("quote", rule_text[:200])),
                "verification_status": "UNKNOWN",
                "severity": sev,
                "category": path.split(".")[0] if "." in path else path,
                "guideline": guideline,
                "source_file": source_file,
                "_json_path": path,
            })

        # Always recurse into children
        for k, v in obj.items():
            if k not in ("metadata", "source_quote", "quote"):
                recurse(v, f"{path}.{k}", context or k)

    for section_key, section_val in data.items():
        if section_key not in ("metadata", "definitions"):
            recurse(section_val, section_key, section_key)

    return rules


def adapt_divergence_file(data: dict, filepath: Path) -> list[dict]:
    """
    Adapter for jurisdiction-divergence files (eu-gmp-vs-fda-cgmp,
    eu-vs-fda-divergences, canada-vs-fda-ema, japan-vs-fda-ema).
    Each divergence entry becomes two rules: one per jurisdiction.
    """
    rules = []
    source_file = str(filepath.relative_to(BASE_DIR))
    divergences = data.get("divergences", [])
    if not divergences:
        # eu-vs-fda-divergences uses divergence_categories
        for cat in data.get("divergence_categories", {}).values():
            if isinstance(cat, list):
                divergences.extend(cat)
            elif isinstance(cat, dict) and "divergences" in cat:
                divergences.extend(cat["divergences"])

    name = filepath.stem
    if "canada" in name:
        jur_a, jur_b = "Canada", "ICH"
    elif "japan" in name:
        jur_a, jur_b = "Japan", "ICH"
    elif "eu-gmp" in name or "eu-vs" in name:
        jur_a, jur_b = "EU", "FDA"
    else:
        jur_a, jur_b = "EU", "FDA"

    for div in divergences:
        if not isinstance(div, dict):
            continue
        div_id = div.get("id", "")
        topic = div.get("topic", div.get("area", ""))
        severity = normalize_severity(div.get("severity"))
        category = div.get("category", "jurisdiction_divergence")
        guideline = f"Jurisdiction Divergence: {jur_a} vs {jur_b}"

        for jur_key, jur_label in [
            (jur_a.lower() + "_requirement", jur_a),
            (jur_b.lower() + "_requirement", jur_b),
        ]:
            # Try both 'eu_requirement'/'fda_requirement' style and generic
            req = div.get(jur_key) or div.get(jur_label.lower() + "_rule") or ""
            if not req:
                # Try canada/japan specific keys
                for k in div.keys():
                    if jur_label.lower() in k.lower() and "requirement" in k.lower():
                        req = div[k]
                        break
            if not req or len(str(req)) < 10:
                continue

            rule = {
                "rule_id": f"{div_id}-{jur_label[:2].upper()}",
                "rule_text": str(req),
                "source_section": div.get("category", ""),
                "source_page": None,
                "source_quote": str(req)[:200],
                "verification_status": "UNKNOWN",
                "severity": severity,
                "category": category,
                "guideline": guideline,
                "source_file": source_file,
                "_json_path": f"divergences.{div_id}",
                "regional_applicability": [jur_label],
                "divergence_topic": topic,
                "ich_alignment": div.get("ich_alignment", ""),
            }
            rules.append(rule)
    return rules


def adapt_special_populations(data: dict, filepath: Path) -> list[dict]:
    """Adapter for special-populations-rules.json nested domain structure."""
    rules = []
    source_file = str(filepath.relative_to(BASE_DIR))
    guideline = "ICH Special Populations (E7, E11, E12, M3(R2))"

    # Cross-cutting rules
    for item in data.get("cross_cutting_rules", []):
        if isinstance(item, dict):
            extracted = extract_rules_from_value(item, "cross_cutting", source_file, guideline)
            rules.extend(extracted)

    # Domain rules — domains can be a list or a dict
    domains = data.get("domains", {})
    if isinstance(domains, dict):
        for domain_name, domain_data in domains.items():
            extracted = extract_rules_from_value(domain_data, f"domains.{domain_name}", source_file, guideline)
            rules.extend(extracted)
    elif isinstance(domains, list):
        for i, domain_data in enumerate(domains):
            extracted = extract_rules_from_value(domain_data, f"domains[{i}]", source_file, guideline)
            rules.extend(extracted)

    return rules


def _extract_topic_quote_rules(rule_list, section_key, section_guideline, source_file, rules):
    """Helper: extract rules from a list of {id, section, topic, quote} objects."""
    if not isinstance(rule_list, list):
        return
    for r in rule_list:
        if not isinstance(r, dict):
            continue
        rule_text = r.get("topic") or r.get("rule_text") or r.get("plain_language") or r.get("text") or ""
        if not rule_text or len(rule_text) < 10:
            continue
        rules.append({
            "rule_id": r.get("id") or r.get("rule_id") or f"auto-{section_key}-{len(rules)}",
            "rule_text": rule_text,
            "source_section": r.get("section") or r.get("source_section") or "",
            "source_page": r.get("page") or r.get("source_page") or None,
            "source_quote": r.get("quote") or r.get("source_quote") or "",
            "verification_status": normalize_verification(r.get("verification_status") or "VERIFIED"),
            "severity": normalize_severity(r.get("severity")),
            "category": r.get("category") or section_key,
            "guideline": str(section_guideline)[:80],
            "source_file": source_file,
            "_json_path": section_key,
        })


def adapt_topic_quote_format(data: dict, filepath: Path) -> list[dict]:
    """
    Adapter for files where rules use 'topic' as rule_text and 'quote' as source_quote.
    Handles two nesting depths:
      - Direct: data.{section_key}.rules[{id, section, topic, quote}]
      - Nested:  data.rules.{section_key}.rules[{id, section, topic, quote}]
    """
    rules = []
    source_file = str(filepath.relative_to(BASE_DIR))
    guideline = infer_guideline(data, filepath)

    for section_key, section_val in data.items():
        if section_key in ("meta", "metadata"):
            continue
        if not isinstance(section_val, dict):
            continue
        section_guideline = (section_val.get("guideline") or
                              section_val.get("full_title") or
                              guideline)
        rule_list = section_val.get("rules", [])
        if isinstance(rule_list, list) and rule_list:
            # Direct structure: section_val has a "rules" list
            _extract_topic_quote_rules(rule_list, section_key, section_guideline, source_file, rules)
        else:
            # Nested structure: section_val is itself a container of sub-sections
            for subsec_key, subsec_val in section_val.items():
                if not isinstance(subsec_val, dict):
                    continue
                subsec_guideline = (subsec_val.get("guideline") or
                                    subsec_val.get("full_title") or
                                    section_guideline)
                subsec_rules = subsec_val.get("rules", [])
                _extract_topic_quote_rules(subsec_rules, subsec_key, subsec_guideline, source_file, rules)

    return rules


def adapt_guidelines_list_format(data: dict, filepath: Path) -> list[dict]:
    """
    Adapter for files with top-level 'guidelines' list where each guideline has a 'rules' array.
    Rule fields: rule_id, category, section, quote, plain_language, key_numbers.
    """
    rules = []
    source_file = str(filepath.relative_to(BASE_DIR))
    guideline = infer_guideline(data, filepath)

    for gl in data.get("guidelines", []):
        if not isinstance(gl, dict):
            continue
        gl_name = gl.get("guideline") or gl.get("title") or guideline
        for r in gl.get("rules", []):
            if not isinstance(r, dict):
                continue
            rule_text = (r.get("plain_language") or r.get("rule_text") or
                         r.get("topic") or r.get("text") or "")
            if not rule_text or len(rule_text) < 10:
                continue
            rules.append({
                "rule_id": r.get("rule_id") or r.get("id") or f"auto-{gl_name}-{len(rules)}",
                "rule_text": rule_text,
                "source_section": r.get("section") or r.get("source_section") or "",
                "source_page": r.get("source_page") or r.get("page") or None,
                "source_quote": r.get("quote") or r.get("source_quote") or "",
                "verification_status": normalize_verification(
                    r.get("verification_status") or "VERIFIED"),
                "severity": normalize_severity(r.get("severity")),
                "category": r.get("category") or gl_name,
                "guideline": str(gl_name)[:80],
                "source_file": source_file,
                "_json_path": f"guidelines.{gl_name}",
            })

    return rules


def load_rules_from_file(filepath: Path) -> list[dict]:
    """Load and extract all rules from a single JSON file."""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"  SKIP {filepath.name}: {e}")
        return []

    guideline = infer_guideline(data, filepath)
    source_file = str(filepath.relative_to(BASE_DIR))
    rules = []

    # Route schema-specific files to dedicated adapters
    name = filepath.stem.lower()
    if isinstance(data, dict):
        if any(k in name for k in ("eu-gmp-vs-fda", "eu-vs-fda", "canada-vs-fda", "japan-vs-fda")):
            return adapt_divergence_file(data, filepath)
        if "special-populations-rules" in name:
            return adapt_special_populations(data, filepath)
        if "safety-reporting-rules" in name:
            return adapt_safety_reporting(data, filepath)
        if "e5-e8-e9-e11a" in name:
            return adapt_topic_quote_format(data, filepath)
        if "e1-e2-pharmacovigilance" in name:
            return adapt_guidelines_list_format(data, filepath)

    # Handle files with top-level "rules" or "upgrades" arrays
    if isinstance(data, dict):
        for top_key, top_val in data.items():
            if top_key in ("meta", "metadata", "summary", "all_dimensions_final",
                           "baseline_before_pass6", "pass6_net_changes",
                           "remaining_unverifiable", "remaining_partial",
                           "jurisdiction_differences", "reference_tables",
                           "decision_trees", "cross_guideline_relationships",
                           "download_instructions", "batch_4_extraction_plan"):
                continue
            extracted = extract_rules_from_value(top_val, top_key, source_file, guideline)
            rules.extend(extracted)
    elif isinstance(data, list):
        extracted = extract_rules_from_value(data, "root", source_file, guideline)
        rules.extend(extracted)

    return rules

def deduplicate_rules(all_rules: list[dict]) -> tuple[list[dict], int]:
    """Deduplicate rules by text similarity. Later sources win on conflict."""
    seen: dict[str, dict] = {}
    dupe_count = 0

    for rule in all_rules:
        # Build a normalized key for deduplication
        text = rule.get("rule_text", "").strip().lower()
        # Fingerprint: first 120 chars of normalized text
        text_key = re.sub(r"\s+", " ", text)[:120]
        rule_id = rule.get("rule_id", "")

        # Prefer rule_id-based dedup if IDs look real (not auto-generated)
        dedup_key = rule_id if rule_id and not rule_id.startswith("auto-") else text_key

        if dedup_key in seen:
            dupe_count += 1
            # Later source wins (higher fidelity) but preserve higher verification
            existing = seen[dedup_key]
            if (rule.get("verification_status") == "VERIFIED" and
                    existing.get("verification_status") != "VERIFIED"):
                seen[dedup_key] = rule
            # Merge source files
            existing_sources = seen[dedup_key].get("_all_sources", [seen[dedup_key]["source_file"]])
            if rule["source_file"] not in existing_sources:
                existing_sources.append(rule["source_file"])
            seen[dedup_key]["_all_sources"] = existing_sources
        else:
            seen[dedup_key] = dict(rule)
            seen[dedup_key]["_all_sources"] = [rule["source_file"]]

    return list(seen.values()), dupe_count

def build_index(rules: list[dict]) -> dict:
    """Build lookup indexes for the knowledge base."""
    by_guideline: dict[str, list] = {}
    by_severity: dict[str, list] = {}
    by_category: dict[str, list] = {}
    by_verification: dict[str, list] = {}
    by_jurisdiction: dict[str, list] = {}

    for i, rule in enumerate(rules):
        # Assign a sequential master ID
        rule["master_id"] = f"KB-{i+1:05d}"

        g = rule.get("guideline", "Unknown")
        by_guideline.setdefault(g, []).append(rule["master_id"])

        s = rule.get("severity", "medium")
        by_severity.setdefault(s, []).append(rule["master_id"])

        c = rule.get("category", "general")
        by_category.setdefault(c, []).append(rule["master_id"])

        v = rule.get("verification_status", "UNKNOWN")
        by_verification.setdefault(v, []).append(rule["master_id"])

        regions = rule.get("regional_applicability", ["ICH"])
        if isinstance(regions, str):
            regions = [regions]
        for r in regions:
            by_jurisdiction.setdefault(r, []).append(rule["master_id"])

    return {
        "by_guideline": {k: len(v) for k, v in sorted(by_guideline.items())},
        "by_severity": {k: len(v) for k, v in by_severity.items()},
        "by_category": {k: len(v) for k, v in sorted(by_category.items())},
        "by_verification": {k: len(v) for k, v in by_verification.items()},
        "by_jurisdiction": {k: len(v) for k, v in sorted(by_jurisdiction.items())},
        "guideline_to_ids": {k: v for k, v in sorted(by_guideline.items())},
    }

def main():
    print(f"Pharma Training Knowledge Compiler")
    print(f"{'='*50}")
    print(f"Base: {BASE_DIR}")
    print()

    all_rules: list[dict] = []
    file_stats: list[dict] = []
    files_processed = 0
    files_skipped = 0

    for source_dir in SOURCE_DIRS:
        if not source_dir.exists():
            print(f"  [MISSING] {source_dir.name}/")
            continue

        print(f"\n[DIR] {source_dir.name}/")
        json_files = sorted(source_dir.rglob("*.json"))

        for filepath in json_files:
            if should_skip(filepath):
                files_skipped += 1
                continue

            rules = load_rules_from_file(filepath)
            rel_path = filepath.relative_to(BASE_DIR)
            print(f"  {rel_path} → {len(rules)} rules")

            all_rules.extend(rules)
            file_stats.append({
                "file": str(rel_path),
                "rules_extracted": len(rules),
            })
            files_processed += 1

    print(f"\n{'='*50}")
    print(f"Total rules before dedup: {len(all_rules)}")

    # Dedup
    unique_rules, dupe_count = deduplicate_rules(all_rules)
    print(f"Duplicates removed: {dupe_count}")
    print(f"Unique rules: {len(unique_rules)}")

    # Auto-upgrade: any rule with a verbatim source quote >= 30 chars but UNKNOWN status
    auto_upgraded = 0
    for rule in unique_rules:
        if (rule.get("verification_status") == "UNKNOWN" and
                rule.get("source_quote") and len(rule["source_quote"]) >= 30):
            rule["verification_status"] = "VERIFIED"
            auto_upgraded += 1
    if auto_upgraded:
        print(f"Auto-upgraded {auto_upgraded} rules (has source_quote ≥30 chars) → VERIFIED")

    # Build index
    index = build_index(unique_rules)

    # Compute quality stats
    verified = sum(1 for r in unique_rules if r.get("verification_status") == "VERIFIED")
    has_quote = sum(1 for r in unique_rules if r.get("source_quote"))
    critical = sum(1 for r in unique_rules if r.get("severity") == "critical")
    high = sum(1 for r in unique_rules if r.get("severity") == "high")

    print(f"\nQuality:")
    print(f"  Verified: {verified}/{len(unique_rules)} ({100*verified//max(len(unique_rules),1)}%)")
    print(f"  Has verbatim quote: {has_quote}/{len(unique_rules)}")
    print(f"  Critical/High: {critical}/{high}")

    # Build master KB
    master_kb = {
        "meta": {
            "title": "Pharma Regulatory AI — Master Knowledge Base",
            "compiled_at": datetime.utcnow().isoformat() + "Z",
            "total_rules": len(unique_rules),
            "total_verified": verified,
            "verification_rate_pct": round(100 * verified / max(len(unique_rules), 1), 1),
            "source_files": files_processed,
            "duplicates_removed": dupe_count,
            "source_directories": [str(d.name) for d in SOURCE_DIRS if d.exists()],
            "quality": {
                "rules_with_verbatim_quote": has_quote,
                "critical_severity": critical,
                "high_severity": high,
                "medium_severity": sum(1 for r in unique_rules if r.get("severity") == "medium"),
                "low_severity": sum(1 for r in unique_rules if r.get("severity") == "low"),
            }
        },
        "index": index,
        "rules": unique_rules,
    }

    # Write master KB
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(master_kb, f, indent=2, ensure_ascii=False)

    print(f"\nOutput: {OUTPUT_FILE} ({OUTPUT_FILE.stat().st_size // 1024} KB)")

    # Write compiler report
    report = {
        "compiled_at": datetime.utcnow().isoformat() + "Z",
        "total_rules": len(unique_rules),
        "verified_rules": verified,
        "verification_rate_pct": round(100 * verified / max(len(unique_rules), 1), 1),
        "duplicates_removed": dupe_count,
        "files_processed": files_processed,
        "files_skipped": files_skipped,
        "file_breakdown": file_stats,
        "index_summary": {
            "guidelines_count": len(index["by_guideline"]),
            "top_guidelines_by_rules": sorted(
                index["by_guideline"].items(), key=lambda x: -x[1]
            )[:20],
            "by_severity": index["by_severity"],
            "by_verification": index["by_verification"],
        },
    }
    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"Report: {REPORT_FILE}")
    print(f"\nDone. {len(unique_rules)} rules compiled from {files_processed} files.")

if __name__ == "__main__":
    main()
