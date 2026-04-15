/**
 * Session health monitor — checks tmux pane PIDs and tracks consecutive
 * failures, triggering callbacks after sustained dead sessions.
 */

import { execSync } from 'node:child_process';
import { getSessionTree } from './tmux.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionHealth {
  session: string;
  window: string;
  alive: boolean;
  lastCheck: string;
  consecutiveFailures: number;
  pid: number;
}

export interface HealthMonitorCallbacks {
  onHealthUpdate: (health: SessionHealth[]) => void;
  onSessionDead: (session: string, window: string) => void;
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

/** Consecutive failure counters keyed by "session:window" */
const failureCounts = new Map<string, number>();

const DEAD_THRESHOLD = 3;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check the health of a single tmux session window by probing its pane PID
 * with kill -0 (signal 0 — existence check only, never kills the process).
 */
export function checkSessionHealth(
  session: string,
  window: string,
  pid: number
): SessionHealth {
  let alive = false;

  if (pid > 0) {
    try {
      execSync(`kill -0 ${pid}`, { stdio: 'ignore', timeout: 2000 });
      alive = true;
    } catch {
      alive = false;
    }
  }

  const key = `${session}:${window}`;
  const prev = failureCounts.get(key) ?? 0;
  const consecutiveFailures = alive ? 0 : prev + 1;
  failureCounts.set(key, consecutiveFailures);

  return {
    session,
    window,
    alive,
    lastCheck: new Date().toISOString(),
    consecutiveFailures,
    pid,
  };
}

/**
 * Check health of every window across all active tmux sessions.
 */
export function checkAllHealth(): SessionHealth[] {
  const tree = getSessionTree();
  const results: SessionHealth[] = [];

  for (const sess of tree.sessions) {
    for (const win of sess.windows) {
      const health = checkSessionHealth(sess.name, win.name, win.pane_pid);
      results.push(health);
    }
  }

  // Prune stale keys that no longer appear in the current tree
  const activeKeys = new Set(
    results.map((h) => `${h.session}:${h.window}`)
  );
  for (const key of failureCounts.keys()) {
    if (!activeKeys.has(key)) {
      failureCounts.delete(key);
    }
  }

  return results;
}

/**
 * Start a background health monitor that runs checkAllHealth() every
 * intervalMs milliseconds (default: 10 000 ms).
 *
 * After DEAD_THRESHOLD consecutive failures for a window, onSessionDead is
 * called. onHealthUpdate is called after every check cycle.
 *
 * Returns a stop function that cancels the interval.
 */
export function startHealthMonitor(
  callbacks: HealthMonitorCallbacks,
  intervalMs = 10_000
): () => void {
  const timer = setInterval(() => {
    try {
      const results = checkAllHealth();
      callbacks.onHealthUpdate(results);

      for (const h of results) {
        if (!h.alive && h.consecutiveFailures >= DEAD_THRESHOLD) {
          callbacks.onSessionDead(h.session, h.window);
        }
      }
    } catch {
      // Swallow errors — health monitoring must not crash the server
    }
  }, intervalMs);

  return () => clearInterval(timer);
}
