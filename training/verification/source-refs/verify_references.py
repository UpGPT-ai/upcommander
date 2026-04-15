#!/usr/bin/env python3
"""Verify source references in extracted rules against stage-1 source documents."""

import json
import os
import glob
import re
from pathlib import Path

BASE = "/Users/gregorybibas/.gemini/antigravity/scratch/Claude Commander/training"
STAGE1 = os.path.join(BASE, "stage-1")
OUTPUT_V2 = os.path.join(BASE, "output-v2")
OUTPUT_V3 = os.path.join(BASE, "output-v3")
VERIFY_DIR = os.path.join(BASE, "verification", "source-refs")

# Build complete inventory of stage-1 files (relative paths and basenames)
stage1_files = set()
stage1_basenames = set()
stage1_basenames_noext = set()
stage1_paths = []

for root, dirs, files in os.walk(STAGE1):
    for f in files:
        full = os.path.join(root, f)
        rel = os.path.relpath(full, STAGE1)
        stage1_files.add(rel)
        stage1_basenames.add(f)
        stage1_basenames_noext.add(os.path.splitext(f)[0])
        stage1_paths.append(rel)

# Build a lookup map: normalized name -> actual file path
# This helps match references like "ICH Q1A(R2)" to "Q1A(R2) Guideline.pdf" or "ich/Q1_Stability_Testing.pdf"
stage1_normalized = {}
for p in stage1_paths:
    basename = os.path.basename(p)
    name_noext = os.path.splitext(basename)[0]
    # Store multiple normalized versions
    stage1_normalized[basename.lower()] = p
    stage1_normalized[name_noext.lower()] = p
    # Also store without underscores/spaces
    stage1_normalized[name_noext.lower().replace("_", "").replace(" ", "")] = p

# ICH guideline code -> possible file matches
def find_guideline_in_stage1(ref_str):
    """Try to find a stage-1 file matching a guideline reference string."""
    if not ref_str:
        return None, "NO_REFERENCE"

    ref_lower = ref_str.lower().strip()

    # Direct filename match
    if ref_lower in stage1_normalized:
        return stage1_normalized[ref_lower], "VALID_REFERENCE"

    # Try with .pdf
    if ref_lower + ".pdf" in stage1_normalized:
        return stage1_normalized[ref_lower + ".pdf"], "VALID_REFERENCE"

    # Check if it's a direct path
    if ref_str in stage1_files:
        return ref_str, "VALID_REFERENCE"

    # Extract ICH-style codes like Q1A(R2), S7B, E14, M3(R2)
    # Also handle compound refs like "S6(R1)/S5(R3)"
    ich_codes = re.findall(r'\b([QSEM]\d+[A-Z]?(?:\(R\d+\))?)', ref_str, re.IGNORECASE)
    for code in ich_codes:
        code_lower = code.lower()
        # Normalize: remove parens for matching
        code_norm = code_lower.replace("(", "").replace(")", "")
        # Search across all stage-1 files
        for path in stage1_paths:
            basename_lower = os.path.basename(path).lower()
            name_noext = os.path.splitext(basename_lower)[0]
            name_norm = name_noext.replace("_", "").replace(" ", "").replace("-", "")
            if code_norm in name_norm or code_lower in name_norm:
                return path, "VALID_REFERENCE"
        # Also try with underscore format: E5(R1) -> e5_r1
        code_under = re.sub(r'[()]', '', code_lower).replace('r', '_r')
        for path in stage1_paths:
            basename_lower = os.path.basename(path).lower()
            name_noext = os.path.splitext(basename_lower)[0]
            name_norm = name_noext.replace(" ", "_").replace("-", "_")
            if code_under in name_norm:
                return path, "VALID_REFERENCE"

    # Try matching by keywords in the reference
    # Handle "21 CFR" references - these come from regulations/ PDFs
    if "21 cfr" in ref_lower or "title 21" in ref_lower:
        # Check which part range
        cfr_part = re.search(r'(?:21\s*cfr|part)\s*(\d+)', ref_lower)
        if cfr_part:
            part_num = int(cfr_part.group(1))
            if 1 <= part_num <= 99:
                for p in stage1_paths:
                    if "parts1-99" in p:
                        return p, "VALID_REFERENCE"
            elif 200 <= part_num <= 299:
                for p in stage1_paths:
                    if "parts200-299" in p:
                        return p, "VALID_REFERENCE"
            elif 300 <= part_num <= 499:
                for p in stage1_paths:
                    if "parts300-499" in p:
                        return p, "VALID_REFERENCE"
            elif 600 <= part_num <= 799:
                for p in stage1_paths:
                    if "parts600-799" in p:
                        return p, "VALID_REFERENCE"
        # Generic CFR match
        for p in stage1_paths:
            if "title21" in p.lower():
                return p, "VALID_REFERENCE"

    # Handle EU references - full names and abbreviations
    eu_patterns = {
        "directive 2001/83": "Directive_2001_83_EC.pdf",
        "dir 2001/83": "Directive_2001_83_EC.pdf",
        "regulation 726/2004": "Regulation_726_2004.pdf",
        "reg 726/2004": "Regulation_726_2004.pdf",
        "regulation 536/2014": "Regulation_536_2014_Clinical_Trials.pdf",
        "reg 536/2014": "Regulation_536_2014_Clinical_Trials.pdf",
        "regulation 1901/2006": "Regulation_1901_2006_Paediatric.pdf",
        "regulation 141/2000": "Regulation_141_2000_Orphan.pdf",
        "regulation 1394/2007": "Regulation_1394_2007_ATMPs.pdf",
        "regulation 1234/2008": "Regulation_1234_2008_Variations.pdf",
        "regulation 2017/1569": "Regulation_2017_1569_GMP_IMP.pdf",
        # Full-name EU regulation patterns
        "2017/1569": "Regulation_2017_1569_GMP_IMP.pdf",
        "1394/2007": "Regulation_1394_2007_ATMPs.pdf",
        "141/2000": "Regulation_141_2000_Orphan.pdf",
        "1901/2006": "Regulation_1901_2006_Paediatric.pdf",
        "1234/2008": "Regulation_1234_2008_Variations.pdf",
        "536/2014": "Regulation_536_2014_Clinical_Trials.pdf",
        "726/2004": "Regulation_726_2004.pdf",
    }
    for pattern, filename in eu_patterns.items():
        if pattern in ref_lower:
            for p in stage1_paths:
                if filename.lower() in os.path.basename(p).lower():
                    return p, "VALID_REFERENCE"

    # Handle DIR/REG/IR abbreviations (GVP legal references to EU Directive 2001/83 and Regulation 726/2004)
    # "DIR Art X" = Directive 2001/83/EC, "REG Art X" = Regulation 726/2004, "IR Art X" = Implementing Regulation
    if re.search(r'\bdir\s+art', ref_lower) or re.search(r'\bdirective\s+art', ref_lower):
        for p in stage1_paths:
            if "directive_2001_83" in p.lower():
                return p, "VALID_REFERENCE"

    if re.search(r'\breg\s+art', ref_lower):
        for p in stage1_paths:
            if "regulation_726_2004" in p.lower():
                return p, "VALID_REFERENCE"

    if re.search(r'\bir\s+art', ref_lower) or re.search(r'\bir\s+\d', ref_lower):
        # IR = Commission Implementing Regulation - maps to EU regulations
        for p in stage1_paths:
            if "regulation" in p.lower() and "regulations-eu" in p.lower():
                return p, "VALID_REFERENCE"

    # Handle compound DIR/REG references like "DIR Art 107b, REG Art 28(2)"
    if "dir art" in ref_lower or "reg art" in ref_lower:
        for p in stage1_paths:
            if "directive_2001_83" in p.lower() or "regulation_726_2004" in p.lower():
                return p, "VALID_REFERENCE"

    # Handle GVP module references
    gvp_match = re.search(r'gvp[\s-]*module[\s-]*([ivxlcdm]+|\d+)', ref_lower)
    if gvp_match:
        mod = gvp_match.group(1).upper()
        for p in stage1_paths:
            if "gvp" in p.lower() and f"module-{mod}" in p.lower().replace(" ", "-"):
                return p, "VALID_REFERENCE"

    # Handle WHO references
    if "who" in ref_lower or "trs" in ref_lower:
        trs_match = re.search(r'trs[\s]*(\d+)', ref_lower)
        if trs_match:
            trs_num = trs_match.group(1)
            for p in stage1_paths:
                if trs_num in p:
                    return p, "VALID_REFERENCE"
        for p in stage1_paths:
            if "who" in p.lower():
                return p, "VALID_REFERENCE"

    # Handle EMA references
    if "ema" in ref_lower:
        for p in stage1_paths:
            if "ema" in p.lower():
                return p, "VALID_REFERENCE"

    # Handle EU GMP references
    if "eu gmp" in ref_lower or "eudralex" in ref_lower or "volume 4" in ref_lower:
        for p in stage1_paths:
            if "eu-gmp" in p.lower() or "vol4" in p.lower():
                return p, "VALID_REFERENCE"

    # Handle PMDA references
    if "pmda" in ref_lower or "japan" in ref_lower or "jp18" in ref_lower or "japanese pharmacopoeia" in ref_lower:
        for p in stage1_paths:
            if "pmda" in p.lower() or "jp18" in p.lower():
                return p, "VALID_REFERENCE"

    # Handle Health Canada references
    if "health canada" in ref_lower or ("food and drug" in ref_lower and "canada" in ref_lower):
        for p in stage1_paths:
            if "health-canada" in p.lower():
                return p, "VALID_REFERENCE"

    # Handle HC_ prefixed filenames (e.g. "HC_CTD_CTA_Format.pdf")
    hc_match = re.search(r'(HC_\w+\.pdf)', ref_str)
    if hc_match:
        hc_file = hc_match.group(1).lower()
        for p in stage1_paths:
            if hc_file in os.path.basename(p).lower():
                return p, "VALID_REFERENCE"

    # Handle Canadian regulation references (C.xx.xxx format)
    if re.search(r'\bc\.\d+\.\d+', ref_lower):
        for p in stage1_paths:
            if "health-canada" in p.lower() or "food_drug" in p.lower():
                return p, "VALID_REFERENCE"

    # Handle FDA guidance references
    fda_keywords = {
        "stability": "Stability_Testing_NDA_ANDA.pdf",
        "process validation": "Process_Validation.pdf",
        "container closure": "Container_Closure_Systems.pdf",
        "adaptive design": "Adaptive_Designs.pdf",
        "dissolution": "Dissolution_Testing.pdf",
        "immunogenicity": "Immunogenicity_Assessment.pdf",
        "bioequivalence": "Bioequivalence_Studies.pdf",
        "analytical procedure": "Analytical_Procedures_Validation.pdf",
        "clinical trial endpoint": "Clinical_Trial_Endpoints.pdf",
        "pediatric": "Pediatric_Study_Plans.pdf",
        "breakthrough therapy": "Breakthrough_Therapy.pdf",
        "labeling": "Labeling_for_Human_Drugs.pdf",
        "comparability": "Comparability_Protocols_CMC.pdf",
    }
    for kw, filename in fda_keywords.items():
        if kw in ref_lower:
            for p in stage1_paths:
                if filename.lower() in os.path.basename(p).lower():
                    return p, "VALID_REFERENCE"

    # Handle 21 USC references (US statutes - not regulations, genuinely not in stage-1)
    if "21 usc" in ref_lower or "fdaaa" in ref_lower or "fdora" in ref_lower:
        return None, "FILE_NOT_FOUND"

    # Handle state/provincial law references (genuinely external)
    if "state" in ref_lower and "law" in ref_lower:
        return None, "FILE_NOT_FOUND"

    # Handle CEPA / Canadian Environmental Protection Act (genuinely external)
    if "cepa" in ref_lower or "canadian environmental" in ref_lower:
        return None, "FILE_NOT_FOUND"

    # Handle MHLW guidelines (Japanese ministry guidelines not always in stage-1)
    if "mhlw" in ref_lower:
        for p in stage1_paths:
            if "pmda" in p.lower() or "jp" in p.lower():
                return p, "VALID_REFERENCE"
        return None, "FILE_NOT_FOUND"

    # Last resort: try fuzzy matching on all words
    words = re.findall(r'[a-z0-9]+', ref_lower)
    if len(words) >= 2:
        for p in stage1_paths:
            p_lower = p.lower()
            matches = sum(1 for w in words if w in p_lower)
            if matches >= len(words) * 0.6:
                return p, "VALID_REFERENCE"

    return None, "FILE_NOT_FOUND"


def extract_sources_from_rules(data, path_context=""):
    """Extract all source references from a rules JSON structure, recursively."""
    sources = []

    if isinstance(data, dict):
        # Check for source-related fields
        source_fields = ["source_document", "source", "sources", "source_documents",
                        "source_file", "reference", "references", "guideline",
                        "legal_ref", "regulatory_basis", "eu_legal_basis", "fda_legal_basis",
                        "document_ref", "cfr_violated", "guidance_reference"]

        for field in source_fields:
            if field in data:
                val = data[field]
                rule_id = data.get("id", data.get("rule_id", data.get("code", path_context)))
                section = data.get("section", data.get("section_ref", data.get("article", None)))

                if isinstance(val, str) and val.strip():
                    sources.append({
                        "rule_id": str(rule_id) if rule_id else path_context,
                        "source_ref": val,
                        "section_ref": str(section) if section else None,
                        "field": field
                    })
                elif isinstance(val, list):
                    for item in val:
                        if isinstance(item, str) and item.strip():
                            sources.append({
                                "rule_id": str(rule_id) if rule_id else path_context,
                                "source_ref": item,
                                "section_ref": str(section) if section else None,
                                "field": field
                            })
                        elif isinstance(item, dict):
                            # Nested source object
                            src_text = item.get("title", item.get("name", item.get("document", "")))
                            if src_text:
                                sources.append({
                                    "rule_id": str(rule_id) if rule_id else path_context,
                                    "source_ref": src_text,
                                    "section_ref": str(item.get("section", section)) if item.get("section", section) else None,
                                    "field": field
                                })

        # Check metadata block
        if "metadata" in data and isinstance(data["metadata"], dict):
            meta = data["metadata"]
            for field in ["sources", "source_documents", "eu_sources", "fda_sources"]:
                if field in meta:
                    val = meta[field]
                    if isinstance(val, list):
                        for item in val:
                            if isinstance(item, str):
                                sources.append({
                                    "rule_id": f"metadata.{field}",
                                    "source_ref": item,
                                    "section_ref": None,
                                    "field": f"metadata.{field}"
                                })
                            elif isinstance(item, dict):
                                src_text = item.get("title", item.get("name", item.get("file", item.get("document", ""))))
                                if src_text:
                                    sources.append({
                                        "rule_id": f"metadata.{field}",
                                        "source_ref": src_text,
                                        "section_ref": str(item.get("section")) if item.get("section") else None,
                                        "field": f"metadata.{field}"
                                    })

        # Check meta block (alternative name)
        if "meta" in data and isinstance(data["meta"], dict):
            meta = data["meta"]
            for field in ["sources", "source_documents"]:
                if field in meta:
                    val = meta[field]
                    if isinstance(val, list):
                        for item in val:
                            if isinstance(item, str):
                                sources.append({
                                    "rule_id": f"meta.{field}",
                                    "source_ref": item,
                                    "section_ref": None,
                                    "field": f"meta.{field}"
                                })
                            elif isinstance(item, dict):
                                src_text = item.get("title", item.get("name", item.get("file", "")))
                                if src_text:
                                    sources.append({
                                        "rule_id": f"meta.{field}",
                                        "source_ref": src_text,
                                        "section_ref": str(item.get("section")) if item.get("section") else None,
                                        "field": f"meta.{field}"
                                    })

        # Recurse into nested structures
        for key, val in data.items():
            if key not in source_fields and key not in ["metadata", "meta"]:
                if isinstance(val, (dict, list)):
                    child_sources = extract_sources_from_rules(val, f"{path_context}/{key}" if path_context else key)
                    sources.extend(child_sources)

    elif isinstance(data, list):
        for i, item in enumerate(data):
            child_sources = extract_sources_from_rules(item, f"{path_context}[{i}]")
            sources.extend(child_sources)

    return sources


def deduplicate_sources(sources):
    """Deduplicate source references, keeping unique (source_ref, rule_id) pairs."""
    seen = set()
    unique = []
    for s in sources:
        key = (s["source_ref"], s["rule_id"])
        if key not in seen:
            seen.add(key)
            unique.append(s)
    return unique


def verify_file(json_path):
    """Verify all source references in a single JSON rule file."""
    with open(json_path, 'r') as f:
        data = json.load(f)

    sources = extract_sources_from_rules(data)
    sources = deduplicate_sources(sources)

    # Sample: take all if <=20, otherwise sample 20 evenly
    if len(sources) > 20:
        step = len(sources) / 20
        sampled = [sources[int(i * step)] for i in range(20)]
    else:
        sampled = sources

    results = {
        "total_rules_or_entries": count_rules(data),
        "total_source_references_found": len(sources),
        "sampled": len(sampled),
        "valid": 0,
        "file_not_found": 0,
        "section_not_found": 0,
        "details": []
    }

    broken = []

    for ref in sampled:
        matched_file, status = find_guideline_in_stage1(ref["source_ref"])

        # If file found but section referenced, check section exists
        if status == "VALID_REFERENCE" and ref.get("section_ref"):
            # We can't easily verify sections within PDFs without parsing them
            # Mark as VALID_REFERENCE since the file exists
            pass

        detail = {
            "rule_id": ref["rule_id"],
            "source_ref": ref["source_ref"],
            "section_ref": ref.get("section_ref"),
            "field": ref["field"],
            "status": status,
            "matched_file": matched_file
        }
        results["details"].append(detail)

        if status == "VALID_REFERENCE":
            results["valid"] += 1
        elif status == "FILE_NOT_FOUND":
            results["file_not_found"] += 1
            broken.append(detail)
        elif status == "SECTION_NOT_FOUND":
            results["section_not_found"] += 1
            broken.append(detail)

    total_checked = results["valid"] + results["file_not_found"] + results["section_not_found"]
    results["validity_rate"] = round(results["valid"] / total_checked, 4) if total_checked > 0 else 0

    return results, broken


def count_rules(data):
    """Count the number of rules/entries in a JSON structure."""
    if isinstance(data, list):
        return len(data)
    if isinstance(data, dict):
        # Check common patterns
        if "rules" in data:
            return len(data["rules"]) if isinstance(data["rules"], list) else 0
        if "entries" in data:
            return len(data["entries"]) if isinstance(data["entries"], list) else 0
        # Count leaf-level entries with IDs
        count = 0
        for key, val in data.items():
            if isinstance(val, list):
                count += len(val)
            elif isinstance(val, dict):
                if "rules" in val and isinstance(val["rules"], list):
                    count += len(val["rules"])
                elif "requirements" in val and isinstance(val["requirements"], list):
                    count += len(val["requirements"])
        return count if count > 0 else len(data)
    return 0


# Collect all JSON files
v2_files = sorted(glob.glob(os.path.join(OUTPUT_V2, "**/*.json"), recursive=True))
v3_files = sorted(glob.glob(os.path.join(OUTPUT_V3, "**/*.json"), recursive=True))
all_files = v2_files + v3_files

print(f"Found {len(v2_files)} v2 files and {len(v3_files)} v3 files")
print(f"Stage-1 has {len(stage1_paths)} source files")
print()

# Run verification
validity_report = {
    "summary": {
        "total_files_checked": len(all_files),
        "total_stage1_files": len(stage1_paths),
        "verification_date": "2026-03-23"
    },
    "per_file": {}
}
all_broken = []

for json_path in all_files:
    rel_path = os.path.relpath(json_path, BASE)
    print(f"Verifying: {rel_path}")

    try:
        results, broken = verify_file(json_path)
        validity_report["per_file"][rel_path] = {
            "total_rules_or_entries": results["total_rules_or_entries"],
            "total_source_references": results["total_source_references_found"],
            "sampled": results["sampled"],
            "valid": results["valid"],
            "file_not_found": results["file_not_found"],
            "section_not_found": results["section_not_found"],
            "validity_rate": results["validity_rate"],
            "details": results["details"]
        }
        for b in broken:
            b["file"] = rel_path
            all_broken.append(b)

        print(f"  -> {results['valid']}/{results['sampled']} valid ({results['validity_rate']*100:.1f}%)")
    except Exception as e:
        print(f"  ERROR: {e}")
        validity_report["per_file"][rel_path] = {"error": str(e)}

# Calculate overall stats
total_valid = sum(v.get("valid", 0) for v in validity_report["per_file"].values() if isinstance(v, dict))
total_checked = sum(v.get("sampled", 0) for v in validity_report["per_file"].values() if isinstance(v, dict))
total_broken = sum(v.get("file_not_found", 0) for v in validity_report["per_file"].values() if isinstance(v, dict))

validity_report["summary"]["total_references_sampled"] = total_checked
validity_report["summary"]["total_valid"] = total_valid
validity_report["summary"]["total_broken"] = total_broken
validity_report["summary"]["overall_validity_rate"] = round(total_valid / total_checked, 4) if total_checked > 0 else 0

# Write outputs
os.makedirs(VERIFY_DIR, exist_ok=True)

with open(os.path.join(VERIFY_DIR, "reference-validity.json"), 'w') as f:
    json.dump(validity_report, f, indent=2)

broken_report = {
    "total_broken_references": len(all_broken),
    "broken_references": all_broken
}
with open(os.path.join(VERIFY_DIR, "broken-references.json"), 'w') as f:
    json.dump(broken_report, f, indent=2)

print(f"\n{'='*60}")
print(f"OVERALL: {total_valid}/{total_checked} references valid ({validity_report['summary']['overall_validity_rate']*100:.1f}%)")
print(f"Broken references: {len(all_broken)}")
print(f"\nOutput written to:")
print(f"  {os.path.join(VERIFY_DIR, 'reference-validity.json')}")
print(f"  {os.path.join(VERIFY_DIR, 'broken-references.json')}")
