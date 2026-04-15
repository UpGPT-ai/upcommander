/**
 * Claude Commander — Checkpoint / Resume Utility
 *
 * Allows long-running workers to save incremental progress to disk.
 * On crash or restart, workers can resume from their last checkpoint
 * rather than reprocessing from the beginning.
 *
 * Storage: <projectPath>/.claude-coord/<worker>/checkpoint.json
 */
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
export declare function saveCheckpoint(projectPath: string, worker: string, checkpoint: Checkpoint): void;
/**
 * Load the saved checkpoint for a worker, if one exists.
 *
 * @param projectPath  Absolute path to the project root
 * @param worker       Worker name
 * @returns            Checkpoint if found and valid, null otherwise
 */
export declare function loadCheckpoint(projectPath: string, worker: string): Checkpoint | null;
/**
 * Delete the checkpoint file for a worker.
 *
 * Call this when the worker has successfully completed its task to prevent
 * stale checkpoints from being picked up on the next run.
 *
 * @param projectPath  Absolute path to the project root
 * @param worker       Worker name
 */
export declare function clearCheckpoint(projectPath: string, worker: string): void;
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
export declare function canResume(projectPath: string, worker: string): boolean;
//# sourceMappingURL=checkpoint.d.ts.map