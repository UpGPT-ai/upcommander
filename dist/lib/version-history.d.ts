/**
 * Version history for CLAUDE.md role definitions with rollback support.
 *
 * Each version is stored as a numbered JSON file under:
 *   ~/.claude-commander/role-history/{worker}/{version}.json
 *
 * The active role definition lives at:
 *   ~/.claude-commander/roles/{worker}.md
 */
export interface RoleVersion {
    id: string;
    worker: string;
    version: number;
    claudeMd: string;
    changedBy: string;
    reason: string;
    timestamp: string;
}
/**
 * Save a new version of a worker's CLAUDE.md.
 * Automatically increments the version number.
 * Also updates the active role file at ~/.claude-commander/roles/{worker}.md
 *
 * Returns the created RoleVersion.
 */
export declare function saveRoleVersion(worker: string, claudeMd: string, changedBy: string, reason: string): RoleVersion;
/**
 * Return the full version history for a worker, sorted ascending by version.
 */
export declare function getRoleHistory(worker: string): RoleVersion[];
/**
 * Roll back a worker's active CLAUDE.md to a specific historical version.
 *
 * This creates a new version entry (so the rollback itself is tracked),
 * and updates the active role file. The historical version is not mutated.
 *
 * Throws if the target version does not exist.
 */
export declare function rollbackRole(worker: string, version: number): RoleVersion;
//# sourceMappingURL=version-history.d.ts.map