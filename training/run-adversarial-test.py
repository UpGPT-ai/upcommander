#!/usr/bin/env python3
"""
Adversarial Test Runner
=======================
Evaluates the master knowledge base against the 100-question adversarial test set.
For each question, searches the KB for rules that contain the key fact.
Reports retrieval accuracy by domain, difficulty, and question type.

Usage:
    python3 training/run-adversarial-test.py

Output:
    training/adversarial-test-results.json
    training/adversarial-test-report.md
"""

import json
import re
import math
from pathlib import Path
from datetime import datetime

BASE = Path(__file__).parent
KB_FILE = BASE / "master-knowledge-base.json"
TEST_FILE = BASE / "adversarial-test-set.json"
RESULTS_FILE = BASE / "adversarial-test-results.json"
REPORT_FILE = BASE / "adversarial-test-report.md"


def tokenize(text: str) -> set[str]:
    """Extract meaningful tokens from text for matching."""
    text = text.lower()
    # Extract numbers (including decimals and ranges)
    nums = set(re.findall(r'\d+\.?\d*', text))
    # Extract words > 3 chars
    words = set(w for w in re.findall(r'[a-z]{4,}', text) if w not in STOPWORDS)
    return nums | words


STOPWORDS = {
    'with', 'that', 'this', 'from', 'have', 'been', 'when', 'which',
    'should', 'must', 'will', 'than', 'such', 'also', 'does', 'used',
    'each', 'more', 'most', 'both', 'into', 'some', 'only', 'after',
    'before', 'study', 'studies', 'drug', 'drugs', 'data', 'test',
    'required', 'requires', 'based', 'using', 'further', 'those',
    'their', 'they', 'then', 'them', 'where', 'what', 'following',
}


def score_rule_against_question(rule: dict, question: dict) -> float:
    """Score a rule's relevance to a question (0.0–1.0)."""
    # Build searchable text from the rule
    rule_text = " ".join([
        rule.get("rule_text", ""),
        rule.get("source_quote", ""),
        rule.get("source_section", ""),
        rule.get("guideline", ""),
        str(rule.get("thresholds", "")),
    ]).lower()

    # Build query from the question's key fact and correct answer
    key_fact = question.get("key_fact", "") or question.get("correct_answer", "")
    domain = question.get("domain", "")
    query_tokens = tokenize(key_fact + " " + domain)

    if not query_tokens:
        return 0.0

    rule_tokens = tokenize(rule_text)
    matched = query_tokens & rule_tokens
    score = len(matched) / len(query_tokens)

    # Boost score if rule's guideline matches question's domain
    domain_lower = domain.lower().replace(" ", "")
    guideline_lower = (rule.get("guideline", "") + rule.get("source_section", "")).lower().replace(" ", "")
    domain_parts = re.findall(r'[a-z0-9]+', domain_lower)
    if any(p in guideline_lower for p in domain_parts if len(p) >= 2):
        score = min(1.0, score * 1.5)

    return score


def evaluate_question(question: dict, all_rules: list[dict]) -> dict:
    """Find the best matching rules for a question and determine if KB covers it."""
    scores = []
    for rule in all_rules:
        s = score_rule_against_question(rule, question)
        if s > 0:
            scores.append((s, rule))

    scores.sort(key=lambda x: -x[0])
    top_matches = scores[:5]

    best_score = top_matches[0][0] if top_matches else 0.0
    top_rules = [
        {
            "score": round(m[0], 3),
            "rule_text": m[1].get("rule_text", "")[:150],
            "source_section": m[1].get("source_section", ""),
            "guideline": m[1].get("guideline", ""),
            "verification_status": m[1].get("verification_status", ""),
        }
        for m in top_matches
    ]

    # Coverage determination
    # COVERED: best match >= 0.4 (key fact tokens well represented in a rule)
    # PARTIAL: best match 0.2-0.4 (some terms found but not key fact)
    # MISSING: best match < 0.2 (KB doesn't seem to contain this knowledge)
    if best_score >= 0.4:
        coverage = "COVERED"
    elif best_score >= 0.2:
        coverage = "PARTIAL"
    else:
        coverage = "MISSING"

    return {
        "id": question["id"],
        "domain": question["domain"],
        "type": question["type"],
        "difficulty": question.get("difficulty", "medium"),
        "question": question["question"][:200],
        "correct_answer": question.get("correct_answer", "")[:200],
        "key_fact": question.get("key_fact", "")[:200],
        "coverage": coverage,
        "best_score": round(best_score, 3),
        "top_rules": top_rules,
    }


def main():
    print("Loading knowledge base...")
    with open(KB_FILE) as f:
        kb = json.load(f)
    rules = kb.get("rules", [])
    print(f"  {len(rules)} rules loaded")

    print("Loading test set...")
    with open(TEST_FILE) as f:
        tests = json.load(f)
    questions = tests.get("questions", [])
    print(f"  {len(questions)} questions loaded")

    print(f"\nEvaluating {len(questions)} questions...")
    results = []
    for i, q in enumerate(questions):
        r = evaluate_question(q, rules)
        results.append(r)
        status = {"COVERED": "✓", "PARTIAL": "~", "MISSING": "✗"}[r["coverage"]]
        if (i + 1) % 10 == 0 or r["coverage"] == "MISSING":
            print(f"  [{i+1:03d}] {status} {r['id']} {r['domain'][:30]:30s} score={r['best_score']:.2f} [{r['coverage']}]")

    # Aggregate stats
    by_coverage = {"COVERED": 0, "PARTIAL": 0, "MISSING": 0}
    by_domain = {}
    by_difficulty = {"easy": {"COVERED": 0, "PARTIAL": 0, "MISSING": 0},
                     "medium": {"COVERED": 0, "PARTIAL": 0, "MISSING": 0},
                     "hard": {"COVERED": 0, "PARTIAL": 0, "MISSING": 0}}
    by_type = {}

    for r in results:
        by_coverage[r["coverage"]] += 1
        d = r["domain"]
        if d not in by_domain:
            by_domain[d] = {"COVERED": 0, "PARTIAL": 0, "MISSING": 0}
        by_domain[d][r["coverage"]] += 1
        diff = r.get("difficulty", "medium")
        if diff in by_difficulty:
            by_difficulty[diff][r["coverage"]] += 1
        t = r["type"]
        if t not in by_type:
            by_type[t] = {"COVERED": 0, "PARTIAL": 0, "MISSING": 0}
        by_type[t][r["coverage"]] += 1

    total = len(results)
    covered_pct = round(by_coverage["COVERED"] / total * 100, 1)
    partial_pct = round(by_coverage["PARTIAL"] / total * 100, 1)
    missing_pct = round(by_coverage["MISSING"] / total * 100, 1)
    coverage_pct = round((by_coverage["COVERED"] + by_coverage["PARTIAL"]) / total * 100, 1)

    output = {
        "meta": {
            "date": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "kb_rules": len(rules),
            "questions_evaluated": total,
            "scoring_method": "Token overlap between question key_fact+domain and rule_text+source_quote. COVERED>=0.4, PARTIAL 0.2-0.4, MISSING<0.2.",
        },
        "summary": {
            "COVERED": by_coverage["COVERED"],
            "PARTIAL": by_coverage["PARTIAL"],
            "MISSING": by_coverage["MISSING"],
            "covered_pct": covered_pct,
            "partial_pct": partial_pct,
            "missing_pct": missing_pct,
            "full_or_partial_coverage_pct": coverage_pct,
        },
        "by_domain": by_domain,
        "by_difficulty": by_difficulty,
        "by_type": by_type,
        "missing_questions": [r for r in results if r["coverage"] == "MISSING"],
        "partial_questions": [r for r in results if r["coverage"] == "PARTIAL"],
        "all_results": results,
    }

    with open(RESULTS_FILE, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\nResults saved to {RESULTS_FILE}")

    # Write markdown report
    missing_list = [r for r in results if r["coverage"] == "MISSING"]
    partial_list = [r for r in results if r["coverage"] == "PARTIAL"]

    domain_rows = []
    for domain, counts in sorted(by_domain.items()):
        total_d = sum(counts.values())
        cov = counts["COVERED"] + counts["PARTIAL"]
        domain_rows.append(f"| {domain} | {counts['COVERED']} | {counts['PARTIAL']} | {counts['MISSING']} | {round(cov/total_d*100)}% |")

    report = f"""# Commander KB — Adversarial Test Report

**Date:** {datetime.utcnow().strftime('%Y-%m-%d')}
**KB size:** {len(rules):,} rules
**Questions evaluated:** {total}

---

## Summary

| Metric | Count | % |
|--------|-------|---|
| COVERED (score ≥ 0.4) | {by_coverage['COVERED']} | {covered_pct}% |
| PARTIAL (score 0.2–0.4) | {by_coverage['PARTIAL']} | {partial_pct}% |
| MISSING (score < 0.2) | {by_coverage['MISSING']} | {missing_pct}% |
| **Full or partial coverage** | **{by_coverage['COVERED'] + by_coverage['PARTIAL']}** | **{coverage_pct}%** |

**Pass criteria:** ≥90% full/partial coverage. **Result: {"PASS ✓" if coverage_pct >= 90 else "FAIL ✗"}** ({coverage_pct}%)

---

## By Domain

| Domain | Covered | Partial | Missing | Coverage |
|--------|---------|---------|---------|----------|
{chr(10).join(domain_rows)}

---

## By Difficulty

| Difficulty | Covered | Partial | Missing |
|------------|---------|---------|---------|
| Easy | {by_difficulty['easy']['COVERED']} | {by_difficulty['easy']['PARTIAL']} | {by_difficulty['easy']['MISSING']} |
| Medium | {by_difficulty['medium']['COVERED']} | {by_difficulty['medium']['PARTIAL']} | {by_difficulty['medium']['MISSING']} |
| Hard | {by_difficulty['hard']['COVERED']} | {by_difficulty['hard']['PARTIAL']} | {by_difficulty['hard']['MISSING']} |

---

## MISSING Questions ({len(missing_list)} — require KB gap-fill)

{"No missing questions — full coverage!" if not missing_list else ""}
"""
    for r in missing_list:
        report += f"""
### {r['id']} [{r['domain']}] — {r['difficulty']}
**Q:** {r['question']}
**Expected:** {r['correct_answer']}
**Key fact:** {r['key_fact']}
**Best score:** {r['best_score']} (threshold = 0.2)
"""

    report += f"""
---

## PARTIAL Questions ({len(partial_list)} — weak coverage, verify)

"""
    for r in partial_list[:10]:
        report += f"- **{r['id']}** [{r['domain']}] score={r['best_score']}: {r['question'][:100]}...\n"
    if len(partial_list) > 10:
        report += f"- *(+{len(partial_list)-10} more — see adversarial-test-results.json)*\n"

    with open(REPORT_FILE, "w") as f:
        f.write(report)
    print(f"Report saved to {REPORT_FILE}")

    print(f"\n{'='*50}")
    print(f"COVERED: {by_coverage['COVERED']} ({covered_pct}%)")
    print(f"PARTIAL: {by_coverage['PARTIAL']} ({partial_pct}%)")
    print(f"MISSING: {by_coverage['MISSING']} ({missing_pct}%)")
    print(f"Coverage: {coverage_pct}% — {'PASS ✓' if coverage_pct >= 90 else 'FAIL ✗'} (threshold 90%)")


if __name__ == "__main__":
    main()
