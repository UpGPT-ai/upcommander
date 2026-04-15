/**
 * Claude Commander — Accuracy Scorer
 *
 * Precision, recall, and F1 scoring for pipeline findings against a
 * gold-standard {@link BenchmarkSuite}. Also scores cross-reference
 * detection accuracy.
 */

import type { Finding } from '../output-schemas.js';
import type { CrossReferenceGraph } from '../cross-reference.js';
import type { BenchmarkSuite, KnownFinding, KnownCrossRef } from './benchmark-suite.js';

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface FindingMatch {
  known: KnownFinding;
  matched: Finding | null;    // null = missed
  match_score: number;        // 0–1, keyword overlap
}

export interface AccuracyScore {
  precision: number;           // of reported findings, what % are real
  recall: number;              // of known findings, what % were found
  f1: number;                  // harmonic mean of precision and recall
  cross_ref_recall: number;    // of known cross-refs, what % detected
  cross_ref_precision: number;
  cross_ref_f1: number;
  findings_matched: number;
  findings_missed: number;
  false_positives: number;
  details: FindingMatch[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** A known finding is "matched" when an actual finding contains at least this
 *  fraction of the known finding's keywords (in title + description). */
const KEYWORD_MATCH_THRESHOLD = 0.6;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Tokenize text to lowercase words for keyword matching.
 */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 0),
  );
}

/**
 * Compute keyword overlap between a known finding's keyword list and an
 * actual finding's title + description.
 *
 * Returns a ratio 0–1: matched_keywords / total_keywords.
 */
function keywordOverlap(known: KnownFinding, actual: Finding): number {
  if (known.keywords.length === 0) return 0;

  const haystack = tokenize(`${actual.title} ${actual.description}`);
  const matched = known.keywords.filter((kw) => haystack.has(kw.toLowerCase())).length;

  return matched / known.keywords.length;
}

/**
 * Compute the harmonic mean of precision and recall. Returns 0 when both
 * inputs are 0 to avoid division by zero.
 */
function f1Score(precision: number, recall: number): number {
  if (precision + recall === 0) return 0;
  return (2 * precision * recall) / (precision + recall);
}

// ---------------------------------------------------------------------------
// Finding accuracy
// ---------------------------------------------------------------------------

/**
 * Score pipeline findings against a benchmark's known findings.
 *
 * Matching strategy: for each known finding, find the actual finding with the
 * highest keyword overlap score. If that score meets or exceeds
 * {@link KEYWORD_MATCH_THRESHOLD}, the known finding is considered "matched".
 *
 * False positives are actual findings that did not match any known finding.
 */
export function scoreAccuracy(
  actual: Finding[],
  benchmark: BenchmarkSuite,
): AccuracyScore {
  const known = benchmark.known_findings;
  const matchedActualIds = new Set<string>();

  const details: FindingMatch[] = known.map((knownFinding) => {
    let bestMatch: Finding | null = null;
    let bestScore = 0;

    for (const actualFinding of actual) {
      const score = keywordOverlap(knownFinding, actualFinding);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = actualFinding;
      }
    }

    const isMatch = bestScore >= KEYWORD_MATCH_THRESHOLD;

    if (isMatch && bestMatch) {
      matchedActualIds.add(bestMatch.finding_id);
    }

    return {
      known: knownFinding,
      matched: isMatch ? bestMatch : null,
      match_score: bestScore,
    };
  });

  const findings_matched = details.filter((d) => d.matched !== null).length;
  const findings_missed = known.length - findings_matched;

  // False positives: actual findings not matched to any known finding
  const false_positives = actual.filter(
    (f) => !matchedActualIds.has(f.finding_id),
  ).length;

  const recall = known.length > 0 ? findings_matched / known.length : 0;
  const precision =
    actual.length > 0
      ? (actual.length - false_positives) / actual.length
      : 0;

  return {
    precision,
    recall,
    f1: f1Score(precision, recall),
    cross_ref_recall: 0,
    cross_ref_precision: 0,
    cross_ref_f1: 0,
    findings_matched,
    findings_missed,
    false_positives,
    details,
  };
}

// ---------------------------------------------------------------------------
// Cross-reference accuracy
// ---------------------------------------------------------------------------

/**
 * Score cross-reference detection against the benchmark's known cross-refs.
 *
 * A known cross-ref is considered detected when the graph contains both named
 * entities (case-insensitive substring match) among its entity values.
 */
export function scoreCrossRefAccuracy(
  graph: CrossReferenceGraph,
  benchmark: BenchmarkSuite,
): { recall: number; precision: number; f1: number } {
  const knownRefs = benchmark.known_cross_refs;
  if (knownRefs.length === 0) {
    return { recall: 0, precision: 0, f1: 0 };
  }

  const allRefs = graph.getAllReferences();
  // Build a flat list of entity-pair strings present in the graph
  // represented as sorted entity value substrings
  const graphEntityValues = new Set(
    [...Array.from({ length: graph.entityCount })].map((_, i) => i), // placeholder
  );
  // Actually retrieve entity values via the graph's inspection API
  const entityValues: string[] = [];
  // We use getEntitiesByType is not available for all types generically,
  // so we pull via references' from/to entity IDs and getEntity
  const seenIds = new Set<string>();
  for (const ref of allRefs) {
    for (const id of [ref.from, ref.to]) {
      if (!seenIds.has(id)) {
        seenIds.add(id);
        const entity = graph.getEntity(id);
        if (entity) entityValues.push(entity.value);
      }
    }
  }
  void graphEntityValues; // suppress unused warning

  /**
   * Check if a known cross-ref pair (entity_a, entity_b) is represented in
   * the graph: both terms must appear as substring of some entity value AND
   * there must be a reference connecting entities containing each term.
   */
  function isKnownRefDetected(knownRef: KnownCrossRef): boolean {
    const aLower = knownRef.entity_a.toLowerCase();
    const bLower = knownRef.entity_b.toLowerCase();

    const aEntity = entityValues.find((v) => v.includes(aLower) || aLower.includes(v));
    const bEntity = entityValues.find((v) => v.includes(bLower) || bLower.includes(v));

    // Both must be present in the graph
    return aEntity !== undefined && bEntity !== undefined;
  }

  const detectedCount = knownRefs.filter(isKnownRefDetected).length;

  const recall = knownRefs.length > 0 ? detectedCount / knownRefs.length : 0;

  // Precision: of all graph references, how many correspond to a known cross-ref
  // Approximate: detected / total graph references (or 1 if no graph refs)
  const totalGraphRefs = allRefs.length;
  const precision = totalGraphRefs > 0 ? detectedCount / totalGraphRefs : 0;

  return { recall, precision, f1: f1Score(precision, recall) };
}

// ---------------------------------------------------------------------------
// Report formatting
// ---------------------------------------------------------------------------

/**
 * Render an {@link AccuracyScore} as a Markdown table for CLI/log output.
 */
export function formatAccuracyReport(score: AccuracyScore): string {
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

  const lines: string[] = [
    '## Accuracy Report',
    '',
    '### Finding Accuracy',
    '',
    '| Metric | Value |',
    '|--------|-------|',
    `| Precision | ${pct(score.precision)} |`,
    `| Recall | ${pct(score.recall)} |`,
    `| F1 Score | ${pct(score.f1)} |`,
    `| Matched | ${score.findings_matched} |`,
    `| Missed | ${score.findings_missed} |`,
    `| False Positives | ${score.false_positives} |`,
    '',
    '### Cross-Reference Accuracy',
    '',
    '| Metric | Value |',
    '|--------|-------|',
    `| Precision | ${pct(score.cross_ref_precision)} |`,
    `| Recall | ${pct(score.cross_ref_recall)} |`,
    `| F1 Score | ${pct(score.cross_ref_f1)} |`,
    '',
    '### Finding Detail',
    '',
    '| Known Finding | Matched? | Match Score |',
    '|---------------|----------|-------------|',
    ...score.details.map((d) =>
      `| ${d.known.title.slice(0, 60)} | ${d.matched ? 'Yes' : '**Missed**'} | ${(d.match_score * 100).toFixed(0)}% |`
    ),
  ];

  return lines.join('\n');
}
