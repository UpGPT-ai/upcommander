/**
 * Session persistence — save and restore tmux session state using
 * snapshots stored in ~/.claude-commander/snapshots/.
 */
export interface SessionSnapshot {
    timestamp: string;
    sessions: Array<{
        name: string;
        path: string;
        windows: Array<{
            name: string;
            command: string;
        }>;
    }>;
}
/**
 * Capture the current tmux state and write it to:
 *   ~/.claude-commander/snapshots/latest.json
 *   ~/.claude-commander/snapshots/{ISO-timestamp}.json
 *
 * Returns the snapshot object.
 */
export declare function saveAllSessions(): SessionSnapshot;
/**
 * Restore tmux sessions from a snapshot.
 * If no snapshot is provided, reads ~/.claude-commander/snapshots/latest.json.
 *
 * For each session in the snapshot:
 *   1. Create the tmux session (if it does not already exist)
 *   2. Create all windows
 *   3. Send "claude" to each window to relaunch Claude
 */
export declare function restoreAllSessions(snapshot?: SessionSnapshot): void;
/**
 * List all available snapshots in ~/.claude-commander/snapshots/.
 * Returns metadata sorted newest first.
 */
export declare function listSnapshots(): Array<{
    file: string;
    timestamp: string;
    sessions: number;
}>;
//# sourceMappingURL=persistence.d.ts.map