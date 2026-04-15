/**
 * Claude Commander — Worker & Template Performance Tracking
 *
 * Tracks per-worker and per-template performance metrics plus cost data.
 * All data persists in ~/.claude-commander/metrics/.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const METRICS_DIR = join(homedir(), '.claude-commander', 'metrics');
const WORKER_PERF_FILE = join(METRICS_DIR, 'worker-performance.json');
const TEMPLATE_PERF_FILE = join(METRICS_DIR, 'template-performance.json');
const COST_FILE = join(METRICS_DIR, 'cost-tracking.json');
// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
function ensureMetricsDir() {
    if (!existsSync(METRICS_DIR)) {
        mkdirSync(METRICS_DIR, { recursive: true, mode: 0o700 });
    }
}
function readJsonObject(filePath) {
    if (!existsSync(filePath))
        return {};
    try {
        return JSON.parse(readFileSync(filePath, 'utf8'));
    }
    catch {
        return {};
    }
}
function writeJsonObject(filePath, data) {
    ensureMetricsDir();
    writeFileSync(filePath, JSON.stringify(data, null, 2), { encoding: 'utf8' });
}
/** Incremental running average: (old_avg * old_n + new_val) / (old_n + 1) */
function runningAvg(oldAvg, oldN, newVal) {
    if (oldN === 0)
        return newVal;
    return (oldAvg * oldN + newVal) / (oldN + 1);
}
// ---------------------------------------------------------------------------
// a) loadWorkerPerformance
// ---------------------------------------------------------------------------
export function loadWorkerPerformance() {
    ensureMetricsDir();
    return readJsonObject(WORKER_PERF_FILE);
}
// ---------------------------------------------------------------------------
// b) updateWorkerPerformance
// ---------------------------------------------------------------------------
export function updateWorkerPerformance(workerName, update) {
    ensureMetricsDir();
    const all = loadWorkerPerformance();
    const existing = all[workerName] ?? {
        tasks_completed: 0,
        avg_completion_minutes: 0,
        rejection_rate: 0,
        cost_per_task_usd: 0,
        quality_score: 0,
        last_updated: new Date().toISOString(),
    };
    all[workerName] = {
        ...existing,
        ...update,
        last_updated: new Date().toISOString(),
    };
    writeJsonObject(WORKER_PERF_FILE, all);
}
// ---------------------------------------------------------------------------
// c) recordTaskCompletion
// ---------------------------------------------------------------------------
/**
 * Record a completed task for a worker.
 * Increments tasks_completed, recalculates running averages for time
 * and quality, and updates rejection_rate.
 */
export function recordTaskCompletion(workerName, durationMinutes, rejected, qualityScore) {
    ensureMetricsDir();
    const all = loadWorkerPerformance();
    const existing = all[workerName] ?? {
        tasks_completed: 0,
        avg_completion_minutes: 0,
        rejection_rate: 0,
        cost_per_task_usd: 0,
        quality_score: 0,
        last_updated: new Date().toISOString(),
    };
    const n = existing.tasks_completed;
    const updated = {
        tasks_completed: n + 1,
        avg_completion_minutes: runningAvg(existing.avg_completion_minutes, n, durationMinutes),
        rejection_rate: runningAvg(existing.rejection_rate, n, rejected ? 1 : 0),
        cost_per_task_usd: existing.cost_per_task_usd,
        quality_score: qualityScore !== undefined
            ? runningAvg(existing.quality_score, n, qualityScore)
            : existing.quality_score,
        last_updated: new Date().toISOString(),
    };
    all[workerName] = updated;
    writeJsonObject(WORKER_PERF_FILE, all);
}
// ---------------------------------------------------------------------------
// d) loadTemplatePerformance
// ---------------------------------------------------------------------------
export function loadTemplatePerformance() {
    ensureMetricsDir();
    return readJsonObject(TEMPLATE_PERF_FILE);
}
// ---------------------------------------------------------------------------
// e) recordTemplateUse
// ---------------------------------------------------------------------------
export function recordTemplateUse(templateName, qualityScore, durationMinutes) {
    ensureMetricsDir();
    const all = loadTemplatePerformance();
    const existing = all[templateName] ?? {
        avg_quality: 0,
        avg_time_minutes: 0,
        uses: 0,
        last_used: new Date().toISOString(),
    };
    const n = existing.uses;
    all[templateName] = {
        avg_quality: runningAvg(existing.avg_quality, n, qualityScore),
        avg_time_minutes: runningAvg(existing.avg_time_minutes, n, durationMinutes),
        uses: n + 1,
        last_used: new Date().toISOString(),
    };
    writeJsonObject(TEMPLATE_PERF_FILE, all);
}
export function getCostTracking() {
    ensureMetricsDir();
    return readJsonObject(COST_FILE);
}
// ---------------------------------------------------------------------------
// g) recordCost
// ---------------------------------------------------------------------------
export function recordCost(project, worker, costUsd) {
    ensureMetricsDir();
    const all = getCostTracking();
    const existing = all[worker] ?? { total_usd: 0, by_project: {} };
    all[worker] = {
        total_usd: existing.total_usd + costUsd,
        by_project: {
            ...existing.by_project,
            [project]: (existing.by_project[project] ?? 0) + costUsd,
        },
    };
    writeJsonObject(COST_FILE, all);
}
//# sourceMappingURL=performance.js.map