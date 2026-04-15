/**
 * Configuration management — reads/writes ~/.claude-commander/config.json.
 * Also manages the session→path registry used by coord-init and init.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
const CONFIG_DIR = join(homedir(), '.claude-commander');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
const DEFAULT_CONFIG = {
    port: 7700,
    host: '127.0.0.1',
    projectRoots: [],
    sessions: {},
};
/**
 * Load config from disk, merging with defaults.
 * Creates default config if it does not exist.
 */
export function loadConfig() {
    ensureConfigDir();
    if (!existsSync(CONFIG_FILE)) {
        writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), {
            mode: 0o600,
        });
        return { ...DEFAULT_CONFIG };
    }
    try {
        const raw = readFileSync(CONFIG_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return {
            ...DEFAULT_CONFIG,
            ...parsed,
            sessions: parsed.sessions ?? {},
        };
    }
    catch {
        // Corrupt config — return defaults
        return { ...DEFAULT_CONFIG };
    }
}
/**
 * Save a partial config update, merging with existing config.
 */
export function saveConfig(config) {
    ensureConfigDir();
    const current = loadConfig();
    const updated = {
        ...current,
        ...config,
        sessions: {
            ...current.sessions,
            ...(config.sessions ?? {}),
        },
        projectRoots: config.projectRoots ?? current.projectRoots,
    };
    writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), {
        mode: 0o600,
    });
}
/**
 * Register a tmux session name → project path mapping.
 * Used by `init` to persist the association for later use by `coord-init`.
 */
export function registerSession(sessionName, projectPath) {
    const config = loadConfig();
    config.sessions[sessionName] = projectPath;
    // Also add projectPath to projectRoots if not already present
    if (!config.projectRoots.includes(projectPath)) {
        config.projectRoots.push(projectPath);
    }
    saveConfig(config);
}
/**
 * Return all known project root paths, with env var override support.
 * COMMANDER_PROJECTS env var (comma-separated) takes precedence.
 */
export function getProjectPaths() {
    const envVar = process.env['COMMANDER_PROJECTS'];
    if (envVar && envVar.trim().length > 0) {
        return envVar
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean);
    }
    return loadConfig().projectRoots;
}
// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
function ensureConfigDir() {
    if (!existsSync(CONFIG_DIR)) {
        mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
    }
}
//# sourceMappingURL=config.js.map