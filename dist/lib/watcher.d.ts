/**
 * File watcher for .claude-coord/ STATUS.json changes.
 * Uses chokidar v4 to detect when agents update their status.
 */
import type { AgentStatus } from './coordination.js';
export interface WatcherCallbacks {
    onStatusChange: (filepath: string, status: AgentStatus) => void;
    onApprovalNeeded: (project: string, worker: string, status: AgentStatus) => void;
}
/**
 * Start watching .claude-coord/ STATUS.json files across all given project paths.
 *
 * @param projectPaths - Absolute paths to project roots
 * @param callbacks    - Handlers for status changes and approval events
 * @returns A stop function that closes the watcher
 */
export declare function startWatcher(projectPaths: string[], callbacks: WatcherCallbacks): () => void;
//# sourceMappingURL=watcher.d.ts.map