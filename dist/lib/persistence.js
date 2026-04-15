/**
 * Session persistence — save and restore tmux session state using
 * snapshots stored in ~/.claude-commander/snapshots/.
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { getSessionTree } from './tmux.js';
// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const SNAPSHOTS_DIR = join(homedir(), '.claude-commander', 'snapshots');
const LATEST_SNAPSHOT = join(SNAPSHOTS_DIR, 'latest.json');
function ensureSnapshotsDir() {
    if (!existsSync(SNAPSHOTS_DIR)) {
        mkdirSync(SNAPSHOTS_DIR, { recursive: true, mode: 0o700 });
    }
}
// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
/**
 * Get the working directory of a tmux session (from the first pane).
 * Returns an empty string if it cannot be determined.
 */
function getSessionPath(sessionName) {
    try {
        return execSync(`tmux display-message -t "${sessionName}" -p "#{pane_current_path}"`, { encoding: 'utf8', timeout: 3000 }).trim();
    }
    catch {
        return '';
    }
}
/**
 * Get the working directory of a specific window pane.
 */
function getWindowPath(sessionName, windowName) {
    try {
        return execSync(`tmux display-message -t "${sessionName}:${windowName}" -p "#{pane_current_path}"`, { encoding: 'utf8', timeout: 3000 }).trim();
    }
    catch {
        return getSessionPath(sessionName);
    }
}
// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
/**
 * Capture the current tmux state and write it to:
 *   ~/.claude-commander/snapshots/latest.json
 *   ~/.claude-commander/snapshots/{ISO-timestamp}.json
 *
 * Returns the snapshot object.
 */
export function saveAllSessions() {
    ensureSnapshotsDir();
    const tree = getSessionTree();
    const timestamp = new Date().toISOString();
    const snapshot = {
        timestamp,
        sessions: tree.sessions.map((sess) => {
            const sessionPath = getSessionPath(sess.name);
            return {
                name: sess.name,
                path: sessionPath,
                windows: sess.windows.map((win) => ({
                    name: win.name,
                    command: 'claude',
                })),
            };
        }),
    };
    const json = JSON.stringify(snapshot, null, 2);
    writeFileSync(LATEST_SNAPSHOT, json, { mode: 0o600 });
    // Also write a timestamped copy (colons replaced for filesystem compat)
    const safeTs = timestamp.replace(/:/g, '-').replace(/\..+$/, '');
    const timestampedFile = join(SNAPSHOTS_DIR, `${safeTs}.json`);
    writeFileSync(timestampedFile, json, { mode: 0o600 });
    return snapshot;
}
/**
 * Restore tmux sessions from a snapshot.
 * If no snapshot is provided, reads ~/.claude-commander/snapshots/latest.json.
 *
 * For each session in the snapshot:
 *   1. Create the tmux session (if it does not already exist)
 *   2. Create all windows
 *   3. Send "claude" to each window to relaunch Claude
 */
export function restoreAllSessions(snapshot) {
    let snap = snapshot;
    if (!snap) {
        if (!existsSync(LATEST_SNAPSHOT)) {
            throw new Error('No snapshot found at ' + LATEST_SNAPSHOT);
        }
        try {
            const raw = readFileSync(LATEST_SNAPSHOT, 'utf8');
            snap = JSON.parse(raw);
        }
        catch (err) {
            throw new Error('Failed to parse snapshot: ' + (err instanceof Error ? err.message : String(err)));
        }
    }
    for (const sess of snap.sessions) {
        const workingDir = sess.path || homedir();
        // Check if session already exists
        let sessionExists = false;
        try {
            execSync(`tmux has-session -t "${sess.name}" 2>/dev/null`, {
                timeout: 3000,
            });
            sessionExists = true;
        }
        catch {
            sessionExists = false;
        }
        if (!sessionExists) {
            const firstWindow = sess.windows[0];
            const firstWindowName = firstWindow?.name ?? 'main';
            // Create the session with the first window
            execSync(`tmux new-session -d -s "${sess.name}" -n "${firstWindowName}" -c "${workingDir}"`, { timeout: 5000 });
            // Launch claude in the first window
            execSync(`tmux send-keys -t "${sess.name}:${firstWindowName}" "claude" Enter`, { timeout: 3000 });
            // Create remaining windows
            for (let i = 1; i < sess.windows.length; i++) {
                const win = sess.windows[i];
                execSync(`tmux new-window -t "${sess.name}" -n "${win.name}" -c "${workingDir}"`, { timeout: 3000 });
                execSync(`tmux send-keys -t "${sess.name}:${win.name}" "${win.command || 'claude'}" Enter`, { timeout: 3000 });
            }
        }
    }
}
/**
 * List all available snapshots in ~/.claude-commander/snapshots/.
 * Returns metadata sorted newest first.
 */
export function listSnapshots() {
    ensureSnapshotsDir();
    let files;
    try {
        files = readdirSync(SNAPSHOTS_DIR).filter((f) => f.endsWith('.json'));
    }
    catch {
        return [];
    }
    const results = [];
    for (const file of files) {
        const fullPath = join(SNAPSHOTS_DIR, file);
        try {
            const raw = readFileSync(fullPath, 'utf8');
            const snap = JSON.parse(raw);
            results.push({
                file: fullPath,
                timestamp: snap.timestamp ?? file,
                sessions: snap.sessions?.length ?? 0,
            });
        }
        catch {
            // Skip unreadable/malformed files
        }
    }
    // Sort newest first
    results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return results;
}
//# sourceMappingURL=persistence.js.map