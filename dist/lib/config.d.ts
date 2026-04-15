/**
 * Configuration management — reads/writes ~/.claude-commander/config.json.
 * Also manages the session→path registry used by coord-init and init.
 */
export interface CommanderConfig {
    port: number;
    host: string;
    projectRoots: string[];
    sessions: Record<string, string>;
}
/**
 * Load config from disk, merging with defaults.
 * Creates default config if it does not exist.
 */
export declare function loadConfig(): CommanderConfig;
/**
 * Save a partial config update, merging with existing config.
 */
export declare function saveConfig(config: Partial<CommanderConfig>): void;
/**
 * Register a tmux session name → project path mapping.
 * Used by `init` to persist the association for later use by `coord-init`.
 */
export declare function registerSession(sessionName: string, projectPath: string): void;
/**
 * Return all known project root paths, with env var override support.
 * COMMANDER_PROJECTS env var (comma-separated) takes precedence.
 */
export declare function getProjectPaths(): string[];
//# sourceMappingURL=config.d.ts.map