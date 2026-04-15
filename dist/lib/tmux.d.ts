/**
 * tmux session registry — parses tmux state into structured data
 * and provides send-keys abstraction for routing prompts.
 */
export interface TmuxWindow {
    name: string;
    pane_pid: number;
    active: boolean;
}
export interface TmuxSession {
    name: string;
    windows: TmuxWindow[];
}
export interface SessionTree {
    sessions: TmuxSession[];
}
/**
 * Parse tmux ls into structured session tree.
 * Returns empty tree if tmux server is not running.
 */
export declare function getSessionTree(): SessionTree;
/**
 * Send a prompt to a specific tmux session:window.
 * Sanitizes input to prevent shell injection via send-keys.
 */
export declare function sendKeys(session: string, window: string, prompt: string): void;
/**
 * Send a prompt to ALL windows in a session.
 */
export declare function broadcastToSession(session: string, prompt: string): string[];
/**
 * Send a prompt to ALL windows in ALL sessions.
 */
export declare function broadcastToAll(prompt: string): string[];
/**
 * Create a new tmux session with named windows.
 * Each window launches claude in terminal mode.
 */
export declare function createSession(sessionName: string, projectPath: string, workers: string[]): void;
/**
 * Check if a tmux session exists.
 */
export declare function sessionExists(sessionName: string): boolean;
//# sourceMappingURL=tmux.d.ts.map