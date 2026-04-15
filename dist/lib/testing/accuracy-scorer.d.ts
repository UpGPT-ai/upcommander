/**
 * Claude Commander — Accuracy Scorer
 *
 * Precision, recall, and F1 scoring for pipeline findings against a
 * gold-standard {@link BenchmarkSuite}. Also scores cross-reference
 * detection accuracy.
 */
import type { Finding } from '../output-schemas.js';
import type { CrossReferenceGraph } from '../cross-reference.js';
import type { BenchmarkSuite, KnownFinding } from './benchmark-suite.js';
export interface FindingMatch {
    known: KnownFinding;
    matched: Finding | null;
    match_score: number;
}
export interface AccuracyScore {
    precision: number;
    recall: number;
    f1: number;
    cross_ref_recall: number;
    cross_ref_precision: number;
    cross_ref_f1: number;
    findings_matched: number;
    findings_missed: number;
    false_positives: number;
    details: FindingMatch[];
}
/**
 * Score pipeline findings against a benchmark's known findings.
 *
 * Matching strategy: for each known finding, find the actual finding with the
 * highest keyword overlap score. If that score meets or exceeds
 * {@link KEYWORD_MATCH_THRESHOLD}, the known finding is considered "matched".
 *
 * False positives are actual findings that did not match any known finding.
 */
export declare function scoreAccuracy(actual: Finding[], benchmark: BenchmarkSuite): AccuracyScore;
/**
 * Score cross-reference detection against the benchmark's known cross-refs.
 *
 * A known cross-ref is considered detected when the graph contains both named
 * entities (case-insensitive substring match) among its entity values.
 */
export declare function scoreCrossRefAccuracy(graph: CrossReferenceGraph, benchmark: BenchmarkSuite): {
    recall: number;
    precision: number;
    f1: number;
};
/**
 * Render an {@link AccuracyScore} as a Markdown table for CLI/log output.
 */
export declare function formatAccuracyReport(score: AccuracyScore): string;
//# sourceMappingURL=accuracy-scorer.d.ts.map