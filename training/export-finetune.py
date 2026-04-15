#!/usr/bin/env python3
"""
Pharma Regulatory Fine-Tuning Data Exporter
============================================
Converts master-knowledge-base.json into JSONL fine-tuning format.

Each rule generates up to 3 QA pair types:
  1. Direct recall: "What does [guideline] require regarding [topic]?"
  2. Threshold recall: for rules with numeric thresholds
  3. Verbatim quote: for rules with source_quote >= 30 chars

Output:
  training/finetune-dataset.jsonl   (90% train)
  training/finetune-validation.jsonl (10% validation)

Format: OpenAI Chat JSONL
  {"messages": [{"role": "system", ...}, {"role": "user", ...}, {"role": "assistant", ...}]}

Usage:
  python3 training/export-finetune.py
"""

import json
import random
import re
from pathlib import Path

BASE_DIR = Path(__file__).parent
KB_FILE = BASE_DIR / "master-knowledge-base.json"
TRAIN_FILE = BASE_DIR / "finetune-dataset.jsonl"
VAL_FILE = BASE_DIR / "finetune-validation.jsonl"
REPORT_FILE = BASE_DIR / "finetune-export-report.json"

SYSTEM_PROMPT = (
    "You are an expert pharmaceutical regulatory affairs specialist with deep knowledge of "
    "ICH, FDA, EMA, PMDA, Health Canada, and WHO guidelines. Answer regulatory questions "
    "accurately, citing the specific guideline section and jurisdiction where applicable. "
    "For numerical thresholds, state the exact value and its regulatory context. "
    "For cross-jurisdiction questions, clearly distinguish requirements by region."
)

VALIDATION_FRACTION = 0.10
RANDOM_SEED = 42

# Templates for QA type 1: direct recall
DIRECT_TEMPLATES = [
    "What does {guideline} require regarding {topic}?",
    "Per {guideline}, what is the requirement for {topic}?",
    "What is the regulatory requirement under {guideline} for {topic}?",
    "Describe the {guideline} rule for {topic}.",
    "According to {guideline}, what must sponsors do regarding {topic}?",
]

# Templates for QA type 2: threshold recall
THRESHOLD_TEMPLATES = [
    "What is the specific threshold/limit for {param} per {guideline}?",
    "What numerical value does {guideline} specify for {param}?",
    "Per {guideline}, what is the cutoff for {param}?",
    "What is the {guideline} {param} threshold?",
]

# Templates for QA type 3: verbatim quote
QUOTE_TEMPLATES = [
    "What verbatim language does {guideline} use regarding {topic}?",
    "Quote the exact regulatory text from {guideline} about {topic}.",
    "What does {guideline} state verbatim about {topic}?",
]

# Templates for jurisdiction divergence rules
DIVERGENCE_TEMPLATES = [
    "How does {guideline} approach {topic} compared to the other jurisdiction?",
    "What is the {jurisdiction} requirement for {topic} per {guideline}?",
    "Describe the cross-jurisdiction difference for {topic} covered in {guideline}.",
    "What does {guideline} specify about {topic} for this jurisdiction?",
]


def clean_guideline(guideline: str) -> str:
    """Normalize guideline name for natural-language use."""
    return guideline.replace("_", " ").strip()[:80]


def extract_topic(rule: dict) -> str:
    """Extract a concise topic from the rule for use in templates."""
    # Prefer source_section — but skip pure section codes (e.g. "IX.C.3", "4.1.1", "Section 3.2")
    section = rule.get("source_section", "")
    if section and len(section) > 5:
        # Strip leading numbering patterns
        cleaned = re.sub(r"^[\d\.]+\s*[-–—]?\s*", "", section)
        cleaned = re.sub(r"^(Section|Clause|Article|Annex)\s+[\d\.]+\s*[-–—]?\s*", "", cleaned, flags=re.I)
        # Skip if remaining is a bare section code (roman numerals, dots, letters only, short)
        if cleaned and not re.match(r"^[IVXivx\d\.\s]+$", cleaned) and len(cleaned) > 5:
            return cleaned[:60].rstrip(".")

    # Fall back to category (convert underscores and skip if too generic)
    cat = rule.get("category", "").replace("_", " ").strip()
    generic_cats = {"mandatory", "definitions", "general", "requirements", "rules", "other", ""}
    if cat and len(cat) > 3 and cat.lower() not in generic_cats:
        return cat[:50]

    # Fall back to first 8 words of rule_text (most specific)
    words = rule.get("rule_text", "").split()[:8]
    return " ".join(words)


def format_thresholds(thresholds) -> str:
    """Convert threshold dict or scalar to a human-readable string."""
    if isinstance(thresholds, dict):
        parts = []
        for k, v in thresholds.items():
            if k == "note":
                continue
            label = k.replace("_", " ").replace("-", " ")
            parts.append(f"{label}: {v}")
        return "; ".join(parts)
    return str(thresholds)


def make_direct_qa(rule: dict, rng: random.Random) -> dict | None:
    """Generate a direct recall QA pair."""
    rule_text = rule.get("rule_text", "").strip()
    if not rule_text or len(rule_text) < 20:
        return None

    guideline = clean_guideline(rule.get("guideline", "the applicable guideline"))
    topic = extract_topic(rule)
    if not topic or len(topic) < 5:
        return None

    template = rng.choice(DIRECT_TEMPLATES)
    question = template.format(guideline=guideline, topic=topic)

    # Build answer
    answer_parts = [rule_text]

    # Add source citation if available
    section = rule.get("source_section", "")
    if section and len(section) > 5:
        answer_parts.append(f"\n\nSource: {section}")

    # Add jurisdiction note if applicable
    regional = rule.get("regional_applicability", [])
    if regional and isinstance(regional, list):
        juris = ", ".join(regional)
        answer_parts.append(f"\nJurisdiction: {juris}")

    answer = "".join(answer_parts)

    return {
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": question},
            {"role": "assistant", "content": answer},
        ]
    }


def make_threshold_qa(rule: dict, rng: random.Random) -> dict | None:
    """Generate a threshold recall QA pair (only for rules with thresholds)."""
    thresholds = rule.get("thresholds")
    if not thresholds:
        return None

    guideline = clean_guideline(rule.get("guideline", "the applicable guideline"))
    topic = extract_topic(rule)

    # Pick the most specific threshold key if dict
    if isinstance(thresholds, dict):
        # Filter out meta keys
        real_keys = [k for k in thresholds if k not in ("note", "comment")]
        if not real_keys:
            return None
        param_key = rng.choice(real_keys[:3])  # pick from first few keys
        param = param_key.replace("_", " ").replace("-", " ")
        threshold_val = thresholds[param_key]
    else:
        param = topic
        threshold_val = thresholds

    if not threshold_val or str(threshold_val).strip() in ("", "null", "None"):
        return None

    template = rng.choice(THRESHOLD_TEMPLATES)
    question = template.format(guideline=guideline, param=param)

    # Build answer
    full_thresholds = format_thresholds(thresholds)
    answer = (
        f"{param.capitalize()}: {threshold_val}\n\n"
        f"Full threshold context per {guideline}:\n{full_thresholds}\n\n"
        f"Regulatory context: {rule.get('rule_text', '')[:300]}"
    )

    section = rule.get("source_section", "")
    if section:
        answer += f"\n\nSource: {section}"

    return {
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": question},
            {"role": "assistant", "content": answer},
        ]
    }


def make_quote_qa(rule: dict, rng: random.Random) -> dict | None:
    """Generate a verbatim quote QA pair (only for rules with source_quote >= 30 chars)."""
    quote = rule.get("source_quote", "").strip()
    if not quote or len(quote) < 30:
        return None

    guideline = clean_guideline(rule.get("guideline", "the applicable guideline"))
    topic = extract_topic(rule)
    if not topic or len(topic) < 5:
        return None

    template = rng.choice(QUOTE_TEMPLATES)
    question = template.format(guideline=guideline, topic=topic)

    section = rule.get("source_section", "")
    answer = (
        f'"{quote}"\n\n'
        f"Context: {rule.get('rule_text', '')[:200]}"
    )
    if section:
        answer += f"\n\nSource: {section}"

    return {
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": question},
            {"role": "assistant", "content": answer},
        ]
    }


def make_divergence_qa(rule: dict, rng: random.Random) -> dict | None:
    """Generate a cross-jurisdiction divergence QA pair."""
    if "jurisdiction" not in rule.get("guideline", "").lower() and \
       "divergen" not in rule.get("guideline", "").lower() and \
       "divergence_topic" not in rule:
        return None

    guideline = clean_guideline(rule.get("guideline", ""))
    topic = rule.get("divergence_topic", "") or extract_topic(rule)
    jurisdiction = ""
    regional = rule.get("regional_applicability", [])
    if regional and isinstance(regional, list):
        jurisdiction = regional[0]

    if not topic or len(topic) < 5:
        return None

    template = rng.choice(DIVERGENCE_TEMPLATES)
    question = template.format(guideline=guideline, topic=topic, jurisdiction=jurisdiction)

    answer = rule.get("rule_text", "").strip()
    section = rule.get("source_section", "")
    if section:
        answer += f"\n\nSource: {section}"
    if regional:
        answer += f"\nApplies to: {', '.join(regional)}"

    ich_alignment = rule.get("ich_alignment", "")
    if ich_alignment:
        answer += f"\nICH Alignment: {ich_alignment}"

    return {
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": question},
            {"role": "assistant", "content": answer},
        ]
    }


def export(rules: list[dict], rng: random.Random) -> list[dict]:
    """Generate all QA pairs from a rule list."""
    pairs = []

    for rule in rules:
        # Always try direct recall
        direct = make_direct_qa(rule, rng)
        if direct:
            pairs.append(direct)

        # Threshold recall (only if thresholds present)
        threshold = make_threshold_qa(rule, rng)
        if threshold:
            pairs.append(threshold)

        # Verbatim quote (only if quote present and sufficient length)
        quote = make_quote_qa(rule, rng)
        if quote:
            pairs.append(quote)

        # Divergence supplemental (jurisdiction divergence rules only)
        divergence = make_divergence_qa(rule, rng)
        if divergence:
            pairs.append(divergence)

    return pairs


def main():
    print("Loading knowledge base...")
    with open(KB_FILE, "r", encoding="utf-8") as f:
        kb = json.load(f)

    rules = kb.get("rules", [])
    print(f"  Rules: {len(rules)}")

    rng = random.Random(RANDOM_SEED)

    print("Generating QA pairs...")
    all_pairs = export(rules, rng)
    print(f"  Total QA pairs generated: {len(all_pairs)}")

    # Shuffle for train/val split
    rng.shuffle(all_pairs)
    split_idx = int(len(all_pairs) * (1 - VALIDATION_FRACTION))
    train_pairs = all_pairs[:split_idx]
    val_pairs = all_pairs[split_idx:]

    print(f"  Train: {len(train_pairs)} | Validation: {len(val_pairs)}")

    # Write JSONL files
    with open(TRAIN_FILE, "w", encoding="utf-8") as f:
        for pair in train_pairs:
            f.write(json.dumps(pair) + "\n")

    with open(VAL_FILE, "w", encoding="utf-8") as f:
        for pair in val_pairs:
            f.write(json.dumps(pair) + "\n")

    # Count by QA type
    def qa_type(pair):
        q = pair["messages"][1]["content"]
        if "verbatim" in q.lower() or "quote" in q.lower() or "exact" in q.lower():
            return "verbatim_quote"
        if "threshold" in q.lower() or "cutoff" in q.lower() or "numerical" in q.lower() or "specific" in q.lower():
            return "threshold_recall"
        if "compared" in q.lower() or "divergen" in q.lower() or "jurisdiction" in q.lower():
            return "divergence"
        return "direct_recall"

    type_counts = {}
    for p in all_pairs:
        t = qa_type(p)
        type_counts[t] = type_counts.get(t, 0) + 1

    # Compute stats
    avg_q_len = sum(len(p["messages"][1]["content"]) for p in all_pairs) / len(all_pairs)
    avg_a_len = sum(len(p["messages"][2]["content"]) for p in all_pairs) / len(all_pairs)

    report = {
        "exported_at": "2026-03-23T22:30:00Z",
        "source_rules": len(rules),
        "total_qa_pairs": len(all_pairs),
        "train_pairs": len(train_pairs),
        "validation_pairs": len(val_pairs),
        "validation_fraction": VALIDATION_FRACTION,
        "qa_type_breakdown": type_counts,
        "avg_question_chars": round(avg_q_len),
        "avg_answer_chars": round(avg_a_len),
        "output_files": {
            "train": str(TRAIN_FILE.relative_to(BASE_DIR.parent)),
            "validation": str(VAL_FILE.relative_to(BASE_DIR.parent)),
        }
    }

    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print("\n==================================================")
    print(f"Total QA pairs: {len(all_pairs)}")
    print(f"  Train:      {len(train_pairs)}")
    print(f"  Validation: {len(val_pairs)}")
    print(f"\nQA type breakdown:")
    for t, c in sorted(type_counts.items(), key=lambda x: -x[1]):
        print(f"  {t}: {c}")
    print(f"\nAvg question length: {avg_q_len:.0f} chars")
    print(f"Avg answer length:   {avg_a_len:.0f} chars")
    print(f"\nTrain:      {TRAIN_FILE}")
    print(f"Validation: {VAL_FILE}")
    print(f"Report:     {REPORT_FILE}")
    print("Done.")


if __name__ == "__main__":
    main()
