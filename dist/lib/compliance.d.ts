/**
 * 21 CFR Part 11 Compliance Module
 *
 * Provides tamper-evident audit chains, electronic signatures, and
 * retention policies for regulated environments. Designed for FDA,
 * EMA, and ICH regulated workflows where electronic records require
 * an auditable trail of all actions and approvals.
 *
 * Storage layout inside .claude-coord/:
 *   audit-chain.jsonl   — append-only tamper-evident audit log
 *   signatures.json     — electronic signature records
 *   retention.json      — retention policy configuration
 */
export interface AuditEntry {
    id: string;
    timestamp: string;
    action: string;
    /** Worker name or 'human' */
    actor: string;
    /** File path or finding ID that was acted upon */
    target: string;
    details: string;
    /** SHA-256 hash of the previous entry (empty string for first entry) */
    previous_hash: string;
    /** SHA-256 hash of this entry's content (tamper-evident) */
    hash: string;
}
export interface ElectronicSignature {
    signer: string;
    /** Role of the signer in the regulated workflow */
    role: 'reviewer' | 'approver' | 'validator';
    timestamp: string;
    /** Finding IDs that this signature covers */
    finding_ids: string[];
    /** Attestation statement */
    statement: string;
    /** SHA-256 hash of this signature record */
    hash: string;
}
export interface RetentionPolicy {
    project_type: string;
    /** Number of years records must be retained */
    retention_years: number;
    /** After how many days to move records to archive storage */
    archive_after_days: number;
}
export interface ChainVerifyResult {
    valid: boolean;
    /** Index of the first broken link (if any) */
    broken_at?: number;
    total_entries: number;
}
/**
 * Initialize the audit chain for a project.
 * Creates the .claude-coord directory and writes a genesis entry.
 * Safe to call on an existing project — will not overwrite if chain already exists.
 */
export declare function createAuditChain(projectPath: string): void;
/**
 * Append a new entry to the audit chain.
 *
 * Automatically computes:
 * - A unique UUID for the entry
 * - The previous entry's hash (linking the chain)
 * - The SHA-256 hash of this entry's content
 *
 * @param projectPath Project root directory
 * @param entry Entry data without id, previous_hash, and hash
 * @returns The completed AuditEntry as written
 */
export declare function appendAuditEntry(projectPath: string, entry: Omit<AuditEntry, 'id' | 'previous_hash' | 'hash'>): AuditEntry;
/**
 * Verify the integrity of the entire audit chain.
 *
 * Checks:
 * 1. Each entry's hash matches its computed hash (no tampering)
 * 2. Each entry's previous_hash matches the preceding entry's hash (chain intact)
 *
 * @param projectPath Project root directory
 * @returns Verification result with valid flag and broken_at index if invalid
 */
export declare function verifyAuditChain(projectPath: string): ChainVerifyResult;
/**
 * Add an electronic signature to the project's signature file.
 *
 * Also appends an audit entry recording the signature event.
 *
 * @param projectPath Project root directory
 * @param signature Signature data without the hash field
 * @returns The completed ElectronicSignature as written
 */
export declare function addSignature(projectPath: string, signature: Omit<ElectronicSignature, 'hash'>): ElectronicSignature;
/**
 * Retrieve all electronic signatures for a project.
 *
 * @param projectPath Project root directory
 * @returns Array of ElectronicSignature records
 */
export declare function getSignatures(projectPath: string): ElectronicSignature[];
/**
 * Export the complete audit trail in the specified format.
 * Suitable for FDA 21 CFR Part 11 electronic record submissions.
 *
 * @param projectPath Project root directory
 * @param format 'json' for machine-readable, 'csv' for spreadsheet import
 * @returns String content of the export
 */
export declare function exportAuditTrail(projectPath: string, format: 'json' | 'csv'): string;
/**
 * Set the retention policy for a project.
 *
 * @param projectPath Project root directory
 * @param policy Retention policy to apply
 */
export declare function setRetentionPolicy(projectPath: string, policy: RetentionPolicy): void;
/**
 * Retrieve the retention policy for a project.
 * Returns null if no policy has been set.
 *
 * @param projectPath Project root directory
 */
export declare function getRetentionPolicy(projectPath: string): RetentionPolicy | null;
/**
 * Check whether a project's records are overdue for archival or deletion.
 *
 * @param projectPath Project root directory
 * @param projectCreatedAt ISO timestamp of project creation
 * @returns Object describing archival/deletion status
 */
export declare function checkRetentionStatus(projectPath: string, projectCreatedAt: string): {
    should_archive: boolean;
    should_delete: boolean;
    days_since_creation: number;
    policy: RetentionPolicy | null;
};
//# sourceMappingURL=compliance.d.ts.map