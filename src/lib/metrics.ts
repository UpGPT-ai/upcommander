/**
 * Aggregate metrics tracking — per-project agent counts and system-wide stats.
 */

import { basename } from 'node:path';
import { readAllStatuses, readOrchestratorStatus } from './coordination.js';
import { getSessionTree } from './tmux.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProjectMetrics {
  project: string;
  agentsRunning: number;
  agentsComplete: number;
  agentsBlocked: number;
  agentsWaiting: number;
  totalTasks: number;
  filesProduced: string[];
  startedAt: string;
  elapsedMinutes: number;
}

export interface SystemMetrics {
  totalSessions: number;
  totalWindows: number;
  projects: ProjectMetrics[];
  uptime: number; // seconds since module was first imported
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

const startTime = Date.now();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build per-project metrics by reading all STATUS.json files under
 * .claude-coord/workers/ and the orchestrator status.
 */
export function getProjectMetrics(
  projectPath: string,
  projectName: string
): ProjectMetrics {
  const workerStatuses = readAllStatuses(projectPath);
  const orchestratorStatus = readOrchestratorStatus(projectPath);

  // Collect all statuses (orchestrator + workers) into one list
  const allStatuses = Object.values(workerStatuses);
  if (orchestratorStatus) allStatuses.push(orchestratorStatus);

  let agentsRunning = 0;
  let agentsComplete = 0;
  let agentsBlocked = 0;
  let agentsWaiting = 0;
  const filesProduced: string[] = [];
  let earliestStart = '';

  for (const s of allStatuses) {
    switch (s.state) {
      case 'in_progress':
        agentsRunning++;
        break;
      case 'complete':
        agentsComplete++;
        break;
      case 'blocked':
      case 'error':
        agentsBlocked++;
        break;
      case 'waiting_approval':
        agentsWaiting++;
        break;
      default:
        break;
    }

    if (s.files_produced) {
      for (const f of s.files_produced) {
        if (!filesProduced.includes(f)) filesProduced.push(f);
      }
    }

    if (!earliestStart || s.started < earliestStart) {
      earliestStart = s.started;
    }
  }

  const startedAt = earliestStart || new Date().toISOString();
  const elapsedMinutes = Math.floor(
    (Date.now() - new Date(startedAt).getTime()) / 60_000
  );

  return {
    project: projectName,
    agentsRunning,
    agentsComplete,
    agentsBlocked,
    agentsWaiting,
    totalTasks: allStatuses.length,
    filesProduced,
    startedAt,
    elapsedMinutes,
  };
}

/**
 * Build system-wide metrics across all configured project paths.
 * projectPaths is a map of projectName → projectPath (or just an array
 * of paths, in which case the basename is used as the project name).
 */
export function getSystemMetrics(
  projectPaths: Record<string, string> | string[]
): SystemMetrics {
  const tree = getSessionTree();
  const totalSessions = tree.sessions.length;
  const totalWindows = tree.sessions.reduce(
    (sum, s) => sum + s.windows.length,
    0
  );

  const entries: Array<[string, string]> = Array.isArray(projectPaths)
    ? projectPaths.map((p) => [basename(p), p])
    : Object.entries(projectPaths);

  const projects: ProjectMetrics[] = entries.map(([name, path]) =>
    getProjectMetrics(path, name)
  );

  const uptime = Math.floor((Date.now() - startTime) / 1000);

  return {
    totalSessions,
    totalWindows,
    projects,
    uptime,
  };
}
