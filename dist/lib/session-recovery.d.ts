/**
 * Session recovery — detects stalled / rate-limited workers and
 * automatically continues them, caches prompts for replay, and persists
 * swarm state so the orchestrator can resume after a restart.
 */
export interface PaneState {
    session: string;
    window: string;
    lastOutput: string;
    lastOutputTime: number;
    lastChangeTime: number;
    consecutiveStalls: number;
    state: 'active' | 'stalled' | 'rate_limited' | 'dead' | 'completed';
}
export interface SwarmWorker {
    name: string;
    prompt: string;
    expectedOutputDir: string;
    expectedFiles: string[];
    state: PaneState['state'];
    lastChecked: string;
}
export interface SwarmState {
    session: string;
    startedAt: string;
    workers: SwarmWorker[];
    nextRefreshTime?: string;
}
export interface RecoveryMonitorCallbacks {
    onWorkerStalled: (session: string, window: string, stalledFor: number) => void;
    onWorkerRateLimited: (session: string, window: string, nextRefresh: string | null) => void;
    onWorkerRecovered: (session: string, window: string, method: string) => void;
    onSwarmStateUpdate: (state: SwarmState | null) => void;
}
export declare function cachePrompt(session: string, window: string, prompt: string): void;
export declare function getCachedPrompt(session: string, window: string): string | undefined;
export declare function saveSwarmState(state: SwarmState): void;
export declare function loadSwarmState(): SwarmState | null;
/**
 * Resume a swarm from saved state: check which workers completed
 * and resend prompts to those that didn't.
 */
export declare function resumeSwarm(state: SwarmState): {
    resumed: string[];
    completed: string[];
    skipped: string[];
};
/**
 * Run a single recovery check cycle across all tmux windows.
 * Returns the current PaneState array.
 */
export declare function runRecoveryCheck(callbacks: RecoveryMonitorCallbacks): PaneState[];
/**
 * Get the current PaneState for all monitored windows.
 */
export declare function getAllPaneStates(): PaneState[];
/**
 * Get the current swarm state (if any).
 */
export declare function getCurrentSwarmState(): SwarmState | null;
/**
 * Manually trigger a continue for a specific worker.
 */
export declare function manualContinue(session: string, window: string): void;
/**
 * Start the recovery monitor. Runs a check cycle every intervalMs
 * milliseconds (default: 15 000 ms). Also saves swarm state every 30 s.
 *
 * Returns a stop function that cancels both intervals and all scheduled timers.
 */
export declare function startRecoveryMonitor(callbacks: RecoveryMonitorCallbacks, intervalMs?: number): () => void;
//# sourceMappingURL=session-recovery.d.ts.map