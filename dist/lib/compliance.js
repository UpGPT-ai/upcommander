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
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { join } from 'node:path';
// ---------------------------------------------------------------------------
// Storage paths
// ---------------------------------------------------------------------------
function coordDir(projectPath) {
    return join(projectPath, '.claude-coord');
}
function auditChainPath(projectPath) {
    return join(coordDir(projectPath), 'audit-chain.jsonl');
}
function signaturesPath(projectPath) {
    return join(coordDir(projectPath), 'signatures.json');
}
function retentionPath(projectPath) {
    return join(coordDir(projectPath), 'retention.json');
}
// ---------------------------------------------------------------------------
// Hashing utilities
// ---------------------------------------------------------------------------
/**
 * Compute SHA-256 hash of the given content string.
 * Returns the hex digest.
 */
function sha256(content) {
    return createHash('sha256').update(content, 'utf8').digest('hex');
}
/**
 * Compute the canonical hash for an AuditEntry.
 * Excludes the 'hash' field itself to avoid circular dependency.
 */
function hashEntry(entry) {
    const canonical = JSON.stringify({
        id: entry.id,
        timestamp: entry.timestamp,
        action: entry.action,
        actor: entry.actor,
        target: entry.target,
        details: entry.details,
        previous_hash: entry.previous_hash,
    });
    return sha256(canonical);
}
/**
 * Compute the canonical hash for an ElectronicSignature.
 * Excludes the 'hash' field itself.
 */
function hashSignature(sig) {
    const canonical = JSON.stringify({
        signer: sig.signer,
        role: sig.role,
        timestamp: sig.timestamp,
        finding_ids: sig.finding_ids,
        statement: sig.statement,
    });
    return sha256(canonical);
}
// ---------------------------------------------------------------------------
// Audit chain
// ---------------------------------------------------------------------------
/**
 * Initialize the audit chain for a project.
 * Creates the .claude-coord directory and writes a genesis entry.
 * Safe to call on an existing project — will not overwrite if chain already exists.
 */
export function createAuditChain(projectPath) {
    const dir = coordDir(projectPath);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    const chainFile = auditChainPath(projectPath);
    if (existsSync(chainFile)) {
        // Chain already initialized — do not overwrite
        return;
    }
    const genesisEntry = {
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        action: 'chain_initialized',
        actor: 'system',
        target: projectPath,
        details: 'Audit chain initialized for 21 CFR Part 11 compliance',
        previous_hash: '',
    };
    const entry = {
        ...genesisEntry,
        hash: hashEntry(genesisEntry),
    };
    writeFileSync(chainFile, JSON.stringify(entry) + '\n', {
        encoding: 'utf8',
        mode: 0o600,
    });
}
/**
 * Read all audit entries from the chain file.
 * Returns empty array if file does not exist.
 */
function readAuditEntries(projectPath) {
    const path = auditChainPath(projectPath);
    if (!existsSync(path))
        return [];
    return readFileSync(path, 'utf8')
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line));
}
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
export function appendAuditEntry(projectPath, entry) {
    // Ensure chain exists
    createAuditChain(projectPath);
    const existing = readAuditEntries(projectPath);
    const lastEntry = existing[existing.length - 1];
    const previousHash = lastEntry ? lastEntry.hash : '';
    const partial = {
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        action: entry.action,
        actor: entry.actor,
        target: entry.target,
        details: entry.details,
        previous_hash: previousHash,
    };
    const newEntry = {
        ...partial,
        hash: hashEntry(partial),
    };
    appendFileSync(auditChainPath(projectPath), JSON.stringify(newEntry) + '\n', 'utf8');
    return newEntry;
}
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
export function verifyAuditChain(projectPath) {
    const entries = readAuditEntries(projectPath);
    if (entries.length === 0) {
        return { valid: true, total_entries: 0 };
    }
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        // Verify this entry's own hash
        const expectedHash = hashEntry({
            id: entry.id,
            timestamp: entry.timestamp,
            action: entry.action,
            actor: entry.actor,
            target: entry.target,
            details: entry.details,
            previous_hash: entry.previous_hash,
        });
        if (entry.hash !== expectedHash) {
            return { valid: false, broken_at: i, total_entries: entries.length };
        }
        // Verify chain link (previous_hash matches prior entry's hash)
        if (i === 0) {
            if (entry.previous_hash !== '') {
                return { valid: false, broken_at: 0, total_entries: entries.length };
            }
        }
        else {
            if (entry.previous_hash !== entries[i - 1].hash) {
                return { valid: false, broken_at: i, total_entries: entries.length };
            }
        }
    }
    return { valid: true, total_entries: entries.length };
}
// ---------------------------------------------------------------------------
// Electronic signatures
// ---------------------------------------------------------------------------
/**
 * Add an electronic signature to the project's signature file.
 *
 * Also appends an audit entry recording the signature event.
 *
 * @param projectPath Project root directory
 * @param signature Signature data without the hash field
 * @returns The completed ElectronicSignature as written
 */
export function addSignature(projectPath, signature) {
    const dir = coordDir(projectPath);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    const completed = {
        ...signature,
        hash: hashSignature(signature),
    };
    // Load existing signatures
    const existing = getSignatures(projectPath);
    existing.push(completed);
    writeFileSync(signaturesPath(projectPath), JSON.stringify(existing, null, 2), { encoding: 'utf8', mode: 0o600 });
    // Record in audit chain
    appendAuditEntry(projectPath, {
        action: 'electronic_signature',
        actor: signature.signer,
        target: signature.finding_ids.join(', '),
        details: `${signature.role} signature by ${signature.signer}: "${signature.statement}"`,
        timestamp: signature.timestamp,
    });
    return completed;
}
/**
 * Retrieve all electronic signatures for a project.
 *
 * @param projectPath Project root directory
 * @returns Array of ElectronicSignature records
 */
export function getSignatures(projectPath) {
    const path = signaturesPath(projectPath);
    if (!existsSync(path))
        return [];
    try {
        const raw = readFileSync(path, 'utf8');
        return JSON.parse(raw);
    }
    catch {
        return [];
    }
}
// ---------------------------------------------------------------------------
// Audit trail export
// ---------------------------------------------------------------------------
/**
 * Export the complete audit trail in the specified format.
 * Suitable for FDA 21 CFR Part 11 electronic record submissions.
 *
 * @param projectPath Project root directory
 * @param format 'json' for machine-readable, 'csv' for spreadsheet import
 * @returns String content of the export
 */
export function exportAuditTrail(projectPath, format) {
    const entries = readAuditEntries(projectPath);
    const signatures = getSignatures(projectPath);
    if (format === 'json') {
        return JSON.stringify({
            exported_at: new Date().toISOString(),
            project: projectPath,
            chain_verified: verifyAuditChain(projectPath),
            audit_entries: entries,
            electronic_signatures: signatures,
        }, null, 2);
    }
    // CSV format
    const auditHeaders = [
        'id',
        'timestamp',
        'action',
        'actor',
        'target',
        'details',
        'previous_hash',
        'hash',
    ];
    const csvEscape = (s) => `"${String(s).replace(/"/g, '""')}"`;
    const auditRows = entries.map((e) => [
        csvEscape(e.id),
        csvEscape(e.timestamp),
        csvEscape(e.action),
        csvEscape(e.actor),
        csvEscape(e.target),
        csvEscape(e.details),
        csvEscape(e.previous_hash),
        csvEscape(e.hash),
    ].join(','));
    const sigHeaders = [
        'signer',
        'role',
        'timestamp',
        'finding_ids',
        'statement',
        'hash',
    ];
    const sigRows = signatures.map((s) => [
        csvEscape(s.signer),
        csvEscape(s.role),
        csvEscape(s.timestamp),
        csvEscape(s.finding_ids.join('; ')),
        csvEscape(s.statement),
        csvEscape(s.hash),
    ].join(','));
    return [
        '# AUDIT ENTRIES',
        auditHeaders.join(','),
        ...auditRows,
        '',
        '# ELECTRONIC SIGNATURES',
        sigHeaders.join(','),
        ...sigRows,
    ].join('\n');
}
// ---------------------------------------------------------------------------
// Retention policy
// ---------------------------------------------------------------------------
/**
 * Set the retention policy for a project.
 *
 * @param projectPath Project root directory
 * @param policy Retention policy to apply
 */
export function setRetentionPolicy(projectPath, policy) {
    const dir = coordDir(projectPath);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    writeFileSync(retentionPath(projectPath), JSON.stringify(policy, null, 2), { encoding: 'utf8', mode: 0o600 });
    appendAuditEntry(projectPath, {
        action: 'retention_policy_set',
        actor: 'system',
        target: retentionPath(projectPath),
        details: `Retention policy set: ${policy.retention_years} years, archive after ${policy.archive_after_days} days (project_type: ${policy.project_type})`,
        timestamp: new Date().toISOString(),
    });
}
/**
 * Retrieve the retention policy for a project.
 * Returns null if no policy has been set.
 *
 * @param projectPath Project root directory
 */
export function getRetentionPolicy(projectPath) {
    const path = retentionPath(projectPath);
    if (!existsSync(path))
        return null;
    try {
        return JSON.parse(readFileSync(path, 'utf8'));
    }
    catch {
        return null;
    }
}
/**
 * Check whether a project's records are overdue for archival or deletion.
 *
 * @param projectPath Project root directory
 * @param projectCreatedAt ISO timestamp of project creation
 * @returns Object describing archival/deletion status
 */
export function checkRetentionStatus(projectPath, projectCreatedAt) {
    const policy = getRetentionPolicy(projectPath);
    const created = new Date(projectCreatedAt);
    const now = new Date();
    const daysSinceCreation = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    if (!policy) {
        return {
            should_archive: false,
            should_delete: false,
            days_since_creation: daysSinceCreation,
            policy: null,
        };
    }
    const retentionDays = policy.retention_years * 365;
    return {
        should_archive: daysSinceCreation >= policy.archive_after_days,
        should_delete: daysSinceCreation >= retentionDays,
        days_since_creation: daysSinceCreation,
        policy,
    };
}
//# sourceMappingURL=compliance.js.map