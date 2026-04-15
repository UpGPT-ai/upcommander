#!/usr/bin/env python3
"""
Pharma Regulatory RAG Index Builder
=====================================
Builds a BM25 full-text index over master-knowledge-base.json.
Zero external dependencies — pure Python stdlib.

Index is saved as training/rag-index/index.json (compact binary-free format).

Usage:
    python3 training/build-rag-index.py

Output:
    training/rag-index/index.json   — BM25 inverted index + document store
    training/rag-index/meta.json    — Index metadata/stats
"""

import json
import math
import re
import time
from pathlib import Path
from collections import defaultdict

BASE_DIR = Path(__file__).parent
KB_FILE = BASE_DIR / "master-knowledge-base.json"
INDEX_DIR = BASE_DIR / "rag-index"
INDEX_FILE = INDEX_DIR / "index.json"
META_FILE = INDEX_DIR / "meta.json"

# BM25 parameters
BM25_K1 = 1.5   # term frequency saturation
BM25_B  = 0.75  # length normalization

# Fields to index (in priority order — higher-weight fields get repeated tokens)
FIELD_WEIGHTS = {
    "rule_text":      3,   # primary content — triple weight
    "source_quote":   2,   # verbatim regulatory text — double weight
    "guideline":      2,   # guideline name — double weight
    "source_section": 1,
    "category":       1,
    "thresholds":     2,   # numeric thresholds — double weight
}

# Regulatory stopwords (common but low-signal)
STOPWORDS = {
    "the", "a", "an", "and", "or", "of", "in", "to", "for", "is", "are",
    "be", "been", "was", "were", "has", "have", "had", "that", "this",
    "with", "as", "at", "by", "from", "on", "not", "may", "shall", "should",
    "must", "will", "when", "where", "which", "who", "how", "what", "if",
    "can", "also", "its", "it", "all", "any", "each", "per", "than",
    "into", "such", "used", "use", "used", "using", "used", "both",
}


def tokenize(text: str) -> list[str]:
    """Lowercase, split on non-alphanumeric boundaries, remove stopwords."""
    if not text:
        return []
    text = str(text).lower()
    # Keep numbers with decimal points and hyphens (thresholds like "80.00-125.00")
    tokens = re.findall(r"[a-z0-9]+(?:[.\-][a-z0-9]+)*", text)
    # Also extract pure numbers (e.g. "10", "1.25", "80.00")
    return [t for t in tokens if t and t not in STOPWORDS and len(t) >= 2]


def doc_to_text(rule: dict) -> list[str]:
    """Convert a rule dict to a weighted token list for indexing."""
    tokens = []
    for field, weight in FIELD_WEIGHTS.items():
        val = rule.get(field, "")
        if isinstance(val, dict):
            # thresholds dict — serialize all values
            val = " ".join(f"{k} {v}" for k, v in val.items())
        elif isinstance(val, list):
            val = " ".join(str(v) for v in val)
        field_tokens = tokenize(str(val))
        tokens.extend(field_tokens * weight)  # repeat for weighting
    return tokens


def build_index(rules: list[dict]) -> dict:
    """Build BM25 inverted index from rules list."""
    N = len(rules)

    # Document store (minimal fields for result display)
    docs = []
    doc_tokens = []

    for rule in rules:
        doc = {
            "rule_id":       rule.get("rule_id", ""),
            "rule_text":     rule.get("rule_text", ""),
            "guideline":     rule.get("guideline", ""),
            "source_section":rule.get("source_section", ""),
            "source_quote":  rule.get("source_quote", ""),
            "verification_status": rule.get("verification_status", ""),
            "severity":      rule.get("severity", ""),
            "category":      rule.get("category", ""),
            "source_file":   rule.get("source_file", ""),
            "thresholds":    rule.get("thresholds"),
            "regional_applicability": rule.get("regional_applicability"),
        }
        docs.append(doc)
        doc_tokens.append(doc_to_text(rule))

    # Compute avg doc length
    dl = [len(t) for t in doc_tokens]
    avgdl = sum(dl) / N if N else 1.0

    # Build inverted index: term → {doc_idx: tf}
    inverted: dict[str, dict[int, int]] = defaultdict(lambda: defaultdict(int))
    for idx, tokens in enumerate(doc_tokens):
        for token in tokens:
            inverted[token][idx] += 1

    # Compute IDF for each term
    idf: dict[str, float] = {}
    for term, postings in inverted.items():
        df = len(postings)
        idf[term] = math.log((N - df + 0.5) / (df + 0.5) + 1)

    # Serialize inverted index (convert defaultdict to plain dict)
    inverted_plain = {term: dict(postings) for term, postings in inverted.items()}

    return {
        "N": N,
        "avgdl": avgdl,
        "dl": dl,
        "docs": docs,
        "inverted": inverted_plain,
        "idf": idf,
    }


def bm25_search(query: str, index: dict, top_k: int = 10,
                filter_guideline: str | None = None,
                filter_severity: str | None = None,
                filter_jurisdiction: str | None = None) -> list[dict]:
    """BM25 search over the index. Returns top_k results."""
    query_tokens = tokenize(query)
    if not query_tokens:
        return []

    inverted = index["inverted"]
    idf = index["idf"]
    dl = index["dl"]
    avgdl = index["avgdl"]
    docs = index["docs"]
    N = index["N"]

    scores: dict[int, float] = defaultdict(float)

    for term in query_tokens:
        if term not in inverted:
            continue
        term_idf = idf.get(term, 0.0)
        for doc_idx, tf in inverted[term].items():
            doc_len = dl[doc_idx]
            # BM25 score contribution
            numerator = tf * (BM25_K1 + 1)
            denominator = tf + BM25_K1 * (1 - BM25_B + BM25_B * doc_len / avgdl)
            scores[doc_idx] += term_idf * (numerator / denominator)

    # Apply filters
    filtered_scores = {}
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
        filtered_scores[doc_idx] = score

    # Sort by score descending
    ranked = sorted(filtered_scores.items(), key=lambda x: -x[1])[:top_k]

    results = []
    for doc_idx, score in ranked:
        result = dict(docs[doc_idx])
        result["_score"] = round(score, 4)
        result["_rank"] = len(results) + 1
        results.append(result)

    return results


def main():
    start = time.time()

    print("Loading knowledge base...")
    with open(KB_FILE, "r", encoding="utf-8") as f:
        kb = json.load(f)

    rules = kb.get("rules", [])
    print(f"  Rules: {len(rules)}")

    print("Building BM25 index...")
    index = build_index(rules)

    elapsed = time.time() - start
    print(f"  Indexed {index['N']} documents in {elapsed:.2f}s")
    print(f"  Vocabulary: {len(index['inverted'])} terms")
    print(f"  Avg doc length: {index['avgdl']:.1f} tokens")

    # Save index
    INDEX_DIR.mkdir(exist_ok=True)
    print(f"\nSaving index to {INDEX_FILE}...")
    with open(INDEX_FILE, "w", encoding="utf-8") as f:
        json.dump(index, f, separators=(",", ":"))  # compact — no whitespace

    index_size_mb = INDEX_FILE.stat().st_size / 1024 / 1024
    print(f"  Index size: {index_size_mb:.1f} MB")

    # Save metadata
    meta = {
        "built_at": "2026-03-23T23:00:00Z",
        "source_kb": str(KB_FILE.relative_to(BASE_DIR.parent)),
        "total_rules": index["N"],
        "vocabulary_size": len(index["inverted"]),
        "avg_doc_length_tokens": round(index["avgdl"], 1),
        "bm25_k1": BM25_K1,
        "bm25_b": BM25_B,
        "field_weights": FIELD_WEIGHTS,
        "index_size_mb": round(index_size_mb, 1),
    }
    with open(META_FILE, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    # Quick smoke test
    print("\n--- Smoke test: 'hERG temperature 37 degrees' ---")
    test_results = bm25_search("hERG temperature 37 degrees", index, top_k=3)
    for r in test_results:
        print(f"  [{r['_rank']}] score={r['_score']} [{r['rule_id']}] {r['rule_text'][:80]}")

    print("\n--- Smoke test: '80.00 125.00 bioequivalence confidence interval' ---")
    test_results = bm25_search("80.00 125.00 bioequivalence confidence interval", index, top_k=3)
    for r in test_results:
        print(f"  [{r['_rank']}] score={r['_score']} [{r['rule_id']}] {r['rule_text'][:80]}")

    print("\n--- Smoke test: 'ALCOA+ data integrity audit trail 21 CFR Part 11' ---")
    test_results = bm25_search("ALCOA+ data integrity audit trail 21 CFR Part 11", index, top_k=3)
    for r in test_results:
        print(f"  [{r['_rank']}] score={r['_score']} [{r['rule_id']}] {r['rule_text'][:80]}")

    total_elapsed = time.time() - start
    print(f"\nTotal build time: {total_elapsed:.2f}s")
    print(f"\nIndex ready at: {INDEX_FILE}")
    print(f"Metadata at:    {META_FILE}")
    print("Done.")


if __name__ == "__main__":
    main()
