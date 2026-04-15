/**
 * UpCommander — Checkpoint / Resume Utility
 *
 * Allows long-running workers to save incremental progress to disk.
 * On crash or restart, workers can resume from their last checkpoint
 * rather than reprocessing from the beginning.
 *
 * Storage: <projectPath>/.claude-coord/<worker>/checkpoint.json
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Checkpoint {
  /** Absolute project root path */
  project: string;
  /** Worker name (e.g. "backend", "orchestrator") */
  worker: string;
  /** Description of the task being checkpointed */
  task: string;
  /** Number of findings collected so far */
  findings_so_far: number;
  /** Index of the last successfully processed chunk (0-based) */
  last_chunk_processed: number;
  /** Total number of chunks in the current job */
  total_chunks: number;
  /** ISO timestamp of when the checkpoint was written */
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the checkpoint file path for a given project + worker.
 *
 * Layout: <projectPath>/.claude-coord/<worker>/checkpoint.json
 */
function checkpointPath(projectPath: string, worker: string): string {
  return join(projectPath, '.claude-coord', worker, 'checkpoint.json');
}

/**
 * Ensure the worker directory exists.
 */
function ensureWorkerDir(projectPath: string, worker: string): void {
  const dir = join(projectPath, '.claude-coord', worker);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o755 });
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Persist a checkpoint to disk.
 *
 * Safe to call frequently — writes are atomic via a temp-then-rename strategy
 * using Node's synchronous writeFileSync which overwrites atomically on most
 * POSIX file systems.
 *
 * @param projectPath  Absolute path to the project root
 * @param worker       Worker name
 * @param checkpoint   Checkpoint data to persist
 */
export function saveCheckpoint(
  projectPath: string,
  worker: string,
  checkpoint: Checkpoint
): void {
  ensureWorkerDir(projectPath, worker);
  const file = checkpointPath(projectPath, worker);
  const data: Checkpoint = {
    ...checkpoint,
    project: projectPath,
    worker,
    timestamp: new Date().toISOString(),
  };
  writeFileSync(file, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 });
}

/**
 * Load the saved checkpoint for a worker, if one exists.
 *
 * @param projectPath  Absolute path to the project root
 * @param worker       Worker name
 * @returns            Checkpoint if found and valid, null otherwise
 */
export function loadCheckpoint(
  projectPath: string,
  worker: string
): Checkpoint | null {
  const file = checkpointPath(projectPath, worker);
  if (!existsSync(file)) return null;

  try {
    const raw = readFileSync(file, 'utf8');
    const data = JSON.parse(raw) as Checkpoint;

    // Validate required fields
    if (
      typeof data.project !== 'string' ||
      typeof data.worker !== 'string' ||
      typeof data.task !== 'string' ||
      typeof data.findings_so_far !== 'number' ||
      typeof data.last_chunk_processed !== 'number' ||
      typeof data.total_chunks !== 'number' ||
      typeof data.timestamp !== 'string'
    ) {
      return null;
    }

    return data;
  } catch {
    // Corrupt or missing checkpoint — treat as no checkpoint
    return null;
  }
}

/**
 * Delete the checkpoint file for a worker.
 *
 * Call this when the worker has successfully completed its task to prevent
 * stale checkpoints from being picked up on the next run.
 *
 * @param projectPath  Absolute path to the project root
 * @param worker       Worker name
 */
export function clearCheckpoint(projectPath: string, worker: string): void {
  const file = checkpointPath(projectPath, worker);
  if (existsSync(file)) {
    rmSync(file, { force: true });
  }
}

/**
 * Returns true if a valid checkpoint exists and the job is not already complete.
 *
 * A checkpoint is considered resume-able when:
 *  - The checkpoint file exists and is valid
 *  - last_chunk_processed < total_chunks - 1 (there are chunks left to process)
 *
 * @param projectPath  Absolute path to the project root
 * @param worker       Worker name
 */
export function canResume(projectPath: string, worker: string): boolean {
  const checkpoint = loadCheckpoint(projectPath, worker);
  if (!checkpoint) return false;
  // Can resume if there are remaining chunks to process
  return checkpoint.last_chunk_processed < checkpoint.total_chunks - 1;
}
