/**
 * Claude Commander — Regression Tracker
 *
 * Records accuracy scores over time and alerts when a metric drops
 * significantly compared to recent history. Scores are stored in a
 * JSONL file at ~/.claude-commander/test-results/regression.jsonl.
 */
import type { AccuracyScore } from './accuracy-scorer.js';
export interface RegressionEntry {
    timestamp: string;
    benchmark: string;
    config: string;
    score: AccuracyScore;
    template_version?: string;
}
export interface RegressionAlert {
    benchmark: string;
    metric: string;
    previous: number;
    current: number;
    delta: number;
    severity: 'warning' | 'critical';
}
/**
 * Append a new {@link RegressionEntry} to the regression log.
 * Creates the results directory if it does not exist.
 */
export declare function recordScore(entry: RegressionEntry): void;
/**
 * Compare `currentScore` against the rolling average of the last
 * {@link ROLLING_WINDOW} scores for the given benchmark.
 *
 * Returns one {@link RegressionAlert} per metric that has regressed
 * beyond the warning (>5%) or critical (>10%) threshold.
 */
export declare function checkForRegression(benchmark: string, currentScore: AccuracyScore): RegressionAlert[];
/**
 * Return historical regression entries for a benchmark, newest first.
 *
 * @param benchmark - Benchmark name to filter by.
 * @param limit     - Maximum number of entries to return. Defaults to all.
 */
export declare function getHistory(benchmark: string, limit?: number): RegressionEntry[];
/**
 * Render a list of {@link RegressionAlert}s as a Markdown table.
 * Returns an empty string when there are no alerts.
 */
export declare function formatRegressionReport(alerts: RegressionAlert[]): string;
//# sourceMappingURL=regression-tracker.d.ts.map