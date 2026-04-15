/**
 * File watcher for .claude-coord/ STATUS.json changes.
 * Uses chokidar v4 to detect when agents update their status.
 */

import { watch } from 'chokidar';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AgentStatus } from './coordination.js';

export interface WatcherCallbacks {
  onStatusChange: (filepath: string, status: AgentStatus) => void;
  onApprovalNeeded: (
    project: string,
    worker: string,
    status: AgentStatus
  ) => void;
}

/**
 * Start watching .claude-coord/ STATUS.json files across all given project paths.
 *
 * @param projectPaths - Absolute paths to project roots
 * @param callbacks    - Handlers for status changes and approval events
 * @returns A stop function that closes the watcher
 */
export function startWatcher(
  projectPaths: string[],
  callbacks: WatcherCallbacks
): () => void {
  if (projectPaths.length === 0) {
    // Nothing to watch — return a no-op stop function
    return () => { /* no-op */ };
  }

  // Build glob patterns for each project path
  const patterns = projectPaths.map((p) =>
    join(p, '.claude-coord', '**', 'STATUS.json')
  );

  const watcher = watch(patterns, {
    persistent: true,
    ignoreInitial: true,      // Only fire on changes, not initial scan
    awaitWriteFinish: {
      stabilityThreshold: 100, // Wait 100ms after last write before firing
      pollInterval: 50,
    },
  });

  function handleChange(filepath: string): void {
    if (!existsSync(filepath)) return;

    let status: AgentStatus;
    try {
      const raw = readFileSync(filepath, 'utf8');
      status = JSON.parse(raw) as AgentStatus;
    } catch {
      // File not yet fully written or invalid JSON — skip
      return;
    }

    callbacks.onStatusChange(filepath, status);

    if (status.state === 'waiting_approval') {
      // Extract project and worker from the path
      // Expected pattern: <projectPath>/.claude-coord/workers/<worker>/STATUS.json
      //                or: <projectPath>/.claude-coord/ORCHESTRATOR_STATUS.json
      const { project, worker } = extractProjectWorker(
        filepath,
        projectPaths
      );
      callbacks.onApprovalNeeded(project, worker, status);
    }
  }

  watcher.on('change', handleChange);
  watcher.on('add', handleChange);

  watcher.on('error', (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[watcher] Error watching coordination files:', message);
  });

  return () => {
    watcher.close().catch((err: Error) => {
      console.error('[watcher] Error closing watcher:', err.message);
    });
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Given a STATUS.json filepath and the list of project roots,
 * returns the project name and worker name extracted from the path.
 */
function extractProjectWorker(
  filepath: string,
  projectPaths: string[]
): { project: string; worker: string } {
  // Normalize separators
  const normalised = filepath.replace(/\\/g, '/');

  for (const projectPath of projectPaths) {
    const normalProject = projectPath.replace(/\\/g, '/');
    if (!normalised.startsWith(normalProject)) continue;

    const relative = normalised.slice(normalProject.length).replace(/^\//, '');
    // e.g. ".claude-coord/workers/backend/STATUS.json"
    //   or ".claude-coord/ORCHESTRATOR_STATUS.json"

    const parts = relative.split('/');
    // parts[0] === '.claude-coord'
    // parts[1] === 'workers' | 'ORCHESTRATOR_STATUS.json'

    const projectName = projectPath.split('/').pop() ?? projectPath;

    if (parts[1] === 'workers' && parts[2]) {
      return { project: projectName, worker: parts[2] };
    }

    // Orchestrator or root-level status file
    return { project: projectName, worker: 'orchestrator' };
  }

  // Fallback — couldn't resolve
  return { project: 'unknown', worker: 'unknown' };
}
