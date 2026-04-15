/**
 * UpCommander — Worker & Template Performance Tracking
 *
 * Tracks per-worker and per-template performance metrics plus cost data.
 * All data persists in ~/.upcommander/metrics/.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkerPerformance {
  tasks_completed: number;
  avg_completion_minutes: number;
  rejection_rate: number;
  cost_per_task_usd: number;
  quality_score: number;
  last_updated: string;
  model?: {                   // model used by this worker
    provider: string;
    model: string;
  };
  model_stats?: {             // per-model performance comparison
    avg_tokens_per_task: number;
    avg_cost_per_task_usd: number;
    quality_by_model: Record<string, number>;  // model_id → avg quality
  };
}

export interface TemplatePerformance {
  avg_quality: number;
  avg_time_minutes: number;
  uses: number;
  last_used: string;
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const METRICS_DIR = join(homedir(), '.upcommander', 'metrics');
const WORKER_PERF_FILE = join(METRICS_DIR, 'worker-performance.json');
const TEMPLATE_PERF_FILE = join(METRICS_DIR, 'template-performance.json');
const COST_FILE = join(METRICS_DIR, 'cost-tracking.json');

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function ensureMetricsDir(): void {
  if (!existsSync(METRICS_DIR)) {
    mkdirSync(METRICS_DIR, { recursive: true, mode: 0o700 });
  }
}

function readJsonObject<T extends object>(filePath: string): T {
  if (!existsSync(filePath)) return {} as T;
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as T;
  } catch {
    return {} as T;
  }
}

function writeJsonObject(filePath: string, data: object): void {
  ensureMetricsDir();
  writeFileSync(filePath, JSON.stringify(data, null, 2), { encoding: 'utf8' });
}

/** Incremental running average: (old_avg * old_n + new_val) / (old_n + 1) */
function runningAvg(oldAvg: number, oldN: number, newVal: number): number {
  if (oldN === 0) return newVal;
  return (oldAvg * oldN + newVal) / (oldN + 1);
}

// ---------------------------------------------------------------------------
// a) loadWorkerPerformance
// ---------------------------------------------------------------------------

export function loadWorkerPerformance(): Record<string, WorkerPerformance> {
  ensureMetricsDir();
  return readJsonObject<Record<string, WorkerPerformance>>(WORKER_PERF_FILE);
}

// ---------------------------------------------------------------------------
// b) updateWorkerPerformance
// ---------------------------------------------------------------------------

export function updateWorkerPerformance(
  workerName: string,
  update: Partial<WorkerPerformance>
): void {
  ensureMetricsDir();
  const all = loadWorkerPerformance();
  const existing: WorkerPerformance = all[workerName] ?? {
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
export function recordTaskCompletion(
  workerName: string,
  durationMinutes: number,
  rejected: boolean,
  qualityScore?: number
): void {
  ensureMetricsDir();
  const all = loadWorkerPerformance();
  const existing: WorkerPerformance = all[workerName] ?? {
    tasks_completed: 0,
    avg_completion_minutes: 0,
    rejection_rate: 0,
    cost_per_task_usd: 0,
    quality_score: 0,
    last_updated: new Date().toISOString(),
  };

  const n = existing.tasks_completed;

  const updated: WorkerPerformance = {
    tasks_completed: n + 1,
    avg_completion_minutes: runningAvg(existing.avg_completion_minutes, n, durationMinutes),
    rejection_rate: runningAvg(existing.rejection_rate, n, rejected ? 1 : 0),
    cost_per_task_usd: existing.cost_per_task_usd,
    quality_score:
      qualityScore !== undefined
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

export function loadTemplatePerformance(): Record<string, TemplatePerformance> {
  ensureMetricsDir();
  return readJsonObject<Record<string, TemplatePerformance>>(TEMPLATE_PERF_FILE);
}

// ---------------------------------------------------------------------------
// e) recordTemplateUse
// ---------------------------------------------------------------------------

export function recordTemplateUse(
  templateName: string,
  qualityScore: number,
  durationMinutes: number
): void {
  ensureMetricsDir();
  const all = loadTemplatePerformance();
  const existing: TemplatePerformance = all[templateName] ?? {
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

// ---------------------------------------------------------------------------
// f) getCostTracking
// ---------------------------------------------------------------------------

export interface CostEntry {
  total_usd: number;
  by_project: Record<string, number>;
}

export function getCostTracking(): Record<string, CostEntry> {
  ensureMetricsDir();
  return readJsonObject<Record<string, CostEntry>>(COST_FILE);
}

// ---------------------------------------------------------------------------
// g) recordCost
// ---------------------------------------------------------------------------

export function recordCost(
  project: string,
  worker: string,
  costUsd: number
): void {
  ensureMetricsDir();
  const all = getCostTracking();

  const existing: CostEntry = all[worker] ?? { total_usd: 0, by_project: {} };

  all[worker] = {
    total_usd: existing.total_usd + costUsd,
    by_project: {
      ...existing.by_project,
      [project]: (existing.by_project[project] ?? 0) + costUsd,
    },
  };

  writeJsonObject(COST_FILE, all);
}
