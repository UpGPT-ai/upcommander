/**
 * UpCommander — Regression Tracker
 *
 * Records accuracy scores over time and alerts when a metric drops
 * significantly compared to recent history. Scores are stored in a
 * JSONL file at ~/.upcommander/test-results/regression.jsonl.
 */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { AccuracyScore } from './accuracy-scorer.js';

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface RegressionEntry {
  timestamp: string;
  benchmark: string;
  config: string;
  score: AccuracyScore;
  template_version?: string;
}

export interface RegressionAlert {
  benchmark: string;
  metric: string;        // 'precision' | 'recall' | 'f1' | etc.
  previous: number;
  current: number;
  delta: number;
  severity: 'warning' | 'critical';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RESULTS_DIR = join(homedir(), '.upcommander', 'test-results');
const REGRESSION_FILE = join(RESULTS_DIR, 'regression.jsonl');

/** Metrics tracked for regression. Must be numeric keys on AccuracyScore. */
const TRACKED_METRICS: Array<keyof AccuracyScore> = [
  'precision',
  'recall',
  'f1',
  'cross_ref_recall',
  'cross_ref_precision',
  'cross_ref_f1',
];

/** Rolling window: compare against the average of the last N scores. */
const ROLLING_WINDOW = 5;

/** >5% drop in F1 → warning, >10% → critical. */
const WARNING_THRESHOLD = 0.05;
const CRITICAL_THRESHOLD = 0.10;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureResultsDir(): void {
  if (!existsSync(RESULTS_DIR)) {
    mkdirSync(RESULTS_DIR, { recursive: true });
  }
}

function readAllEntries(): RegressionEntry[] {
  if (!existsSync(REGRESSION_FILE)) return [];

  const raw = readFileSync(REGRESSION_FILE, 'utf-8');
  const entries: RegressionEntry[] = [];

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      entries.push(JSON.parse(trimmed) as RegressionEntry);
    } catch {
      // Skip malformed lines
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Primary API
// ---------------------------------------------------------------------------

/**
 * Append a new {@link RegressionEntry} to the regression log.
 * Creates the results directory if it does not exist.
 */
export function recordScore(entry: RegressionEntry): void {
  ensureResultsDir();
  appendFileSync(REGRESSION_FILE, JSON.stringify(entry) + '\n', 'utf-8');
}

/**
 * Compare `currentScore` against the rolling average of the last
 * {@link ROLLING_WINDOW} scores for the given benchmark.
 *
 * Returns one {@link RegressionAlert} per metric that has regressed
 * beyond the warning (>5%) or critical (>10%) threshold.
 */
export function checkForRegression(
  benchmark: string,
  currentScore: AccuracyScore,
): RegressionAlert[] {
  const history = getHistory(benchmark, ROLLING_WINDOW);

  if (history.length === 0) {
    // No history yet — nothing to compare against
    return [];
  }

  const alerts: RegressionAlert[] = [];

  for (const metric of TRACKED_METRICS) {
    const historicalValues = history
      .map((e) => e.score[metric] as number)
      .filter((v) => typeof v === 'number' && !isNaN(v));

    if (historicalValues.length === 0) continue;

    const average =
      historicalValues.reduce((sum, v) => sum + v, 0) / historicalValues.length;

    const current = currentScore[metric] as number;
    if (typeof current !== 'number' || isNaN(current)) continue;

    const delta = current - average;

    // Only alert on drops (negative delta)
    if (delta >= 0) continue;

    const dropFraction = Math.abs(delta) / (average || 1);

    if (dropFraction >= CRITICAL_THRESHOLD) {
      alerts.push({
        benchmark,
        metric: metric as string,
        previous: average,
        current,
        delta,
        severity: 'critical',
      });
    } else if (dropFraction >= WARNING_THRESHOLD) {
      alerts.push({
        benchmark,
        metric: metric as string,
        previous: average,
        current,
        delta,
        severity: 'warning',
      });
    }
  }

  // Sort: critical first
  return alerts.sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === 'critical' ? -1 : 1
  );
}

/**
 * Return historical regression entries for a benchmark, newest first.
 *
 * @param benchmark - Benchmark name to filter by.
 * @param limit     - Maximum number of entries to return. Defaults to all.
 */
export function getHistory(benchmark: string, limit?: number): RegressionEntry[] {
  const all = readAllEntries();

  const filtered = all
    .filter((e) => e.benchmark === benchmark)
    .reverse(); // newest first

  return limit !== undefined ? filtered.slice(0, limit) : filtered;
}

/**
 * Render a list of {@link RegressionAlert}s as a Markdown table.
 * Returns an empty string when there are no alerts.
 */
export function formatRegressionReport(alerts: RegressionAlert[]): string {
  if (alerts.length === 0) {
    return '**No regressions detected.**';
  }

  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

  const lines: string[] = [
    '## Regression Report',
    '',
    `**${alerts.filter((a) => a.severity === 'critical').length} critical, ` +
      `${alerts.filter((a) => a.severity === 'warning').length} warnings**`,
    '',
    '| Severity | Benchmark | Metric | Previous (avg) | Current | Delta |',
    '|----------|-----------|--------|----------------|---------|-------|',
    ...alerts.map(
      (a) =>
        `| ${a.severity === 'critical' ? '**CRITICAL**' : 'warning'} | ${a.benchmark} | ${a.metric} | ${pct(a.previous)} | ${pct(a.current)} | ${pct(a.delta)} |`,
    ),
  ];

  return lines.join('\n');
}
