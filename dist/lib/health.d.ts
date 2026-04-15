/**
 * Session health monitor — checks tmux pane PIDs and tracks consecutive
 * failures, triggering callbacks after sustained dead sessions.
 */
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
/**
 * Check the health of a single tmux session window by probing its pane PID
 * with kill -0 (signal 0 — existence check only, never kills the process).
 */
export declare function checkSessionHealth(session: string, window: string, pid: number): SessionHealth;
/**
 * Check health of every window across all active tmux sessions.
 */
export declare function checkAllHealth(): SessionHealth[];
/**
 * Start a background health monitor that runs checkAllHealth() every
 * intervalMs milliseconds (default: 10 000 ms).
 *
 * After DEAD_THRESHOLD consecutive failures for a window, onSessionDead is
 * called. onHealthUpdate is called after every check cycle.
 *
 * Returns a stop function that cancels the interval.
 */
export declare function startHealthMonitor(callbacks: HealthMonitorCallbacks, intervalMs?: number): () => void;
//# sourceMappingURL=health.d.ts.map