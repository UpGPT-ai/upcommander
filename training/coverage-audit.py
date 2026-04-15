#!/usr/bin/env python3
"""
Pharma Regulatory KB Coverage Audit
=====================================
Analyzes master-knowledge-base.json by guideline domain to identify
areas with weakest rule density, lowest verification rates, and sparse
verbatim quote coverage.

Usage:
    python3 training/coverage-audit.py

Output:
    Console report + training/coverage-audit-report.json
"""

import json
from pathlib import Path
from collections import defaultdict

BASE_DIR = Path(__file__).parent
KB_FILE = BASE_DIR / "master-knowledge-base.json"
REPORT_FILE = BASE_DIR / "coverage-audit-report.json"


def main():
    with open(KB_FILE) as f:
        kb = json.load(f)

    rules = kb["rules"]
    total = len(rules)

    # Group by guideline
    by_guideline: dict[str, list[dict]] = defaultdict(list)
    for r in rules:
        gl = r.get("guideline", "Unknown").strip()
        by_guideline[gl].append(r)

    # Compute stats per guideline
    stats = []
    for gl, gl_rules in by_guideline.items():
        n = len(gl_rules)
        verified = sum(1 for r in gl_rules if r.get("verification_status") == "VERIFIED")
        has_quote = sum(1 for r in gl_rules if r.get("source_quote") and len(r.get("source_quote", "")) >= 30)
        has_threshold = sum(1 for r in gl_rules if r.get("thresholds"))
        sevs = defaultdict(int)
        for r in gl_rules:
            sevs[r.get("severity", "medium")] += 1

        stats.append({
            "guideline": gl,
            "rule_count": n,
            "verified": verified,
            "verification_rate": round(verified / n * 100, 1) if n else 0,
            "has_quote": has_quote,
            "quote_rate": round(has_quote / n * 100, 1) if n else 0,
            "has_threshold": has_threshold,
            "threshold_rate": round(has_threshold / n * 100, 1) if n else 0,
            "severity_critical": sevs["critical"],
            "severity_high": sevs["high"],
            "severity_medium": sevs["medium"],
            "severity_low": sevs["low"],
        })

    # Sort by rule count descending
    stats_by_count = sorted(stats, key=lambda x: -x["rule_count"])
    # Sort by verification rate ascending (weakest first)
    stats_by_verif = sorted(stats, key=lambda x: x["verification_rate"])
    # Low rule count but high critical/high severity ratio (coverage gaps that matter most)
    def priority_score(s):
        """Higher = more urgent to fix. Low rules + high critical/high = urgent."""
        n = s["rule_count"]
        critical_high = s["severity_critical"] + s["severity_high"]
        verif_gap = 100 - s["verification_rate"]
        return (critical_high / max(n, 1)) * verif_gap
    stats_by_priority = sorted(stats, key=lambda x: -priority_score(x))

    # Print report
    print("=" * 80)
    print("PHARMA REGULATORY KB COVERAGE AUDIT")
    print(f"Total rules: {total} | Unique guidelines: {len(stats)}")
    print("=" * 80)

    print("\n--- TOP 20 BY RULE COUNT ---")
    print(f"{'Guideline':<45} {'Rules':>5} {'Verified':>8} {'Quotes':>7} {'Thresh':>6}")
    print("-" * 75)
    for s in stats_by_count[:20]:
        print(f"{s['guideline'][:44]:<45} {s['rule_count']:>5} {s['verification_rate']:>7.0f}% {s['quote_rate']:>6.0f}% {s['threshold_rate']:>5.0f}%")

    print("\n--- TOP 15 WEAKEST VERIFICATION RATES (>= 5 rules) ---")
    print(f"{'Guideline':<45} {'Rules':>5} {'Verified':>8} {'Crit+High':>9}")
    print("-" * 75)
    weak_verif = [s for s in stats_by_verif if s["rule_count"] >= 5][:15]
    for s in weak_verif:
        ch = s["severity_critical"] + s["severity_high"]
        print(f"{s['guideline'][:44]:<45} {s['rule_count']:>5} {s['verification_rate']:>7.0f}% {ch:>9}")

    print("\n--- TOP 10 COVERAGE GAPS BY PRIORITY (low rules + unverified + high severity) ---")
    print(f"{'Guideline':<45} {'Rules':>5} {'Verified':>8} {'Crit+High':>9} {'Priority':>8}")
    print("-" * 80)
    for s in stats_by_priority[:10]:
        ch = s["severity_critical"] + s["severity_high"]
        p = priority_score(s)
        print(f"{s['guideline'][:44]:<45} {s['rule_count']:>5} {s['verification_rate']:>7.0f}% {ch:>9} {p:>8.1f}")

    # Overall stats
    total_verified = sum(s["verified"] for s in stats)
    total_quotes = sum(s["has_quote"] for s in stats)
    total_thresholds = sum(s["has_threshold"] for s in stats)
    print(f"\n--- OVERALL ---")
    print(f"Total rules:        {total:,}")
    print(f"Total verified:     {total_verified:,} ({total_verified/total*100:.1f}%)")
    print(f"Has verbatim quote: {total_quotes:,} ({total_quotes/total*100:.1f}%)")
    print(f"Has thresholds:     {total_thresholds:,} ({total_thresholds/total*100:.1f}%)")

    # Save JSON report
    report = {
        "total_rules": total,
        "unique_guidelines": len(stats),
        "by_rule_count": stats_by_count,
        "weakest_verification": weak_verif,
        "top_priority_gaps": stats_by_priority[:15],
    }
    with open(REPORT_FILE, "w") as f:
        json.dump(report, f, indent=2)
    print(f"\nFull report saved: {REPORT_FILE}")


if __name__ == "__main__":
    main()
