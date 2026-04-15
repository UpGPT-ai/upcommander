/**
 * Version history for CLAUDE.md role definitions with rollback support.
 *
 * Each version is stored as a numbered JSON file under:
 *   ~/.claude-commander/role-history/{worker}/{version}.json
 *
 * The active role definition lives at:
 *   ~/.claude-commander/roles/{worker}.md
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const BASE_DIR = join(homedir(), '.claude-commander');
const ROLE_HISTORY_DIR = join(BASE_DIR, 'role-history');
const ROLES_DIR = join(BASE_DIR, 'roles');
function ensureWorkerHistoryDir(worker) {
    const dir = join(ROLE_HISTORY_DIR, worker);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    return dir;
}
function ensureRolesDir() {
    if (!existsSync(ROLES_DIR)) {
        mkdirSync(ROLES_DIR, { recursive: true, mode: 0o700 });
    }
}
// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
/** Return the highest version number currently saved for a worker, or 0. */
function getLatestVersionNumber(worker) {
    const dir = join(ROLE_HISTORY_DIR, worker);
    if (!existsSync(dir))
        return 0;
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    if (files.length === 0)
        return 0;
    return Math.max(...files.map((f) => {
        try {
            const raw = readFileSync(join(dir, f), 'utf8');
            const parsed = JSON.parse(raw);
            return typeof parsed.version === 'number' ? parsed.version : 0;
        }
        catch {
            return 0;
        }
    }));
}
// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
/**
 * Save a new version of a worker's CLAUDE.md.
 * Automatically increments the version number.
 * Also updates the active role file at ~/.claude-commander/roles/{worker}.md
 *
 * Returns the created RoleVersion.
 */
export function saveRoleVersion(worker, claudeMd, changedBy, reason) {
    const dir = ensureWorkerHistoryDir(worker);
    ensureRolesDir();
    const version = getLatestVersionNumber(worker) + 1;
    const roleVersion = {
        id: randomUUID(),
        worker,
        version,
        claudeMd,
        changedBy,
        reason,
        timestamp: new Date().toISOString(),
    };
    // Save versioned record
    writeFileSync(join(dir, `${version}.json`), JSON.stringify(roleVersion, null, 2), { mode: 0o600 });
    // Update the active role definition
    writeFileSync(join(ROLES_DIR, `${worker}.md`), claudeMd, { mode: 0o600 });
    return roleVersion;
}
/**
 * Return the full version history for a worker, sorted ascending by version.
 */
export function getRoleHistory(worker) {
    const dir = join(ROLE_HISTORY_DIR, worker);
    if (!existsSync(dir))
        return [];
    const results = [];
    for (const file of readdirSync(dir)) {
        if (!file.endsWith('.json'))
            continue;
        try {
            results.push(JSON.parse(readFileSync(join(dir, file), 'utf8')));
        }
        catch {
            // Skip malformed files
        }
    }
    return results.sort((a, b) => a.version - b.version);
}
/**
 * Roll back a worker's active CLAUDE.md to a specific historical version.
 *
 * This creates a new version entry (so the rollback itself is tracked),
 * and updates the active role file. The historical version is not mutated.
 *
 * Throws if the target version does not exist.
 */
export function rollbackRole(worker, version) {
    const dir = join(ROLE_HISTORY_DIR, worker);
    const targetFile = join(dir, `${version}.json`);
    if (!existsSync(targetFile)) {
        throw new Error(`Version ${version} not found in role history for worker "${worker}"`);
    }
    const target = JSON.parse(readFileSync(targetFile, 'utf8'));
    // Record the rollback as a new version
    const rollbackVersion = saveRoleVersion(worker, target.claudeMd, 'system:rollback', `Rolled back to version ${version} (id: ${target.id})`);
    return rollbackVersion;
}
//# sourceMappingURL=version-history.js.map