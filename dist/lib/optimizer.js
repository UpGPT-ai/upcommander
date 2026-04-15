/**
 * Optimization proposal engine — detects quality issues in worker performance
 * and proposes CLAUDE.md improvements for human review and approval.
 *
 * Proposals are stored in ~/.claude-commander/proposals/{pending,approved,rejected}/
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, renameSync, } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const BASE_DIR = join(homedir(), '.claude-commander');
const METRICS_DIR = join(BASE_DIR, 'metrics');
const PROPOSALS_DIR = join(BASE_DIR, 'proposals');
const PENDING_DIR = join(PROPOSALS_DIR, 'pending');
const APPROVED_DIR = join(PROPOSALS_DIR, 'approved');
const REJECTED_DIR = join(PROPOSALS_DIR, 'rejected');
function ensureDirs() {
    for (const dir of [PENDING_DIR, APPROVED_DIR, REJECTED_DIR]) {
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true, mode: 0o700 });
        }
    }
}
// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
/** Days between two ISO date strings */
function daysBetween(isoA, isoB) {
    const msPerDay = 86_400_000;
    return Math.abs(new Date(isoA).getTime() - new Date(isoB).getTime()) / msPerDay;
}
/** Read all .json files from a directory, parsing as T */
function readJsonDir(dir) {
    if (!existsSync(dir))
        return [];
    const results = [];
    for (const file of readdirSync(dir)) {
        if (!file.endsWith('.json'))
            continue;
        try {
            const raw = readFileSync(join(dir, file), 'utf8');
            results.push(JSON.parse(raw));
        }
        catch {
            // Skip malformed files
        }
    }
    return results;
}
/** Read worker performance from ~/.claude-commander/metrics/worker-performance.json */
function readWorkerPerformance() {
    const file = join(METRICS_DIR, 'worker-performance.json');
    if (!existsSync(file))
        return [];
    try {
        const raw = readFileSync(file, 'utf8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
/** Returns the most recent pending proposal for a given worker, or undefined */
function getLatestPendingProposal(workerName) {
    return readJsonDir(PENDING_DIR).find((p) => p.target === workerName);
}
// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
/**
 * Analyse performance data for a single worker and return a proposal if
 * quality thresholds are breached. Returns null if no action needed or if
 * a proposal was already raised within the past 14 days.
 */
export function analyzePerformance(workerName) {
    const all = readWorkerPerformance();
    const metrics = all.find((m) => m.worker_name === workerName);
    if (!metrics)
        return null;
    const meetsMinSample = metrics.total_tasks >= 10;
    const hasHighRejection = metrics.rejection_rate > 0.15;
    const hasLowQuality = metrics.quality_score < 7.0;
    if (!meetsMinSample)
        return null;
    if (!hasHighRejection && !hasLowQuality)
        return null;
    // Guard rail: max 1 proposal per worker per 14 days
    const existing = getLatestPendingProposal(workerName);
    if (existing && daysBetween(existing.created, new Date().toISOString()) < 14) {
        return null;
    }
    return generateProposal(workerName, metrics);
}
/**
 * Generate a specific CLAUDE.md modification proposal based on metrics.
 * The proposal is saved to ~/.claude-commander/proposals/pending/ immediately.
 */
export function generateProposal(workerName, metrics) {
    ensureDirs();
    const reasons = [];
    if (metrics.rejection_rate > 0.15) {
        reasons.push(`Rejection rate is ${(metrics.rejection_rate * 100).toFixed(1)}% (threshold: 15%)`);
    }
    if (metrics.quality_score < 7.0) {
        reasons.push(`Quality score is ${metrics.quality_score.toFixed(1)}/10 (threshold: 7.0)`);
    }
    const reason = reasons.join('; ');
    const proposedChange = [
        `# Proposed CLAUDE.md revision for worker: ${workerName}`,
        '',
        `## Reason`,
        reason,
        '',
        `## Suggested Changes`,
        '',
        `1. **Clarify output format expectations** — Add explicit examples of accepted`,
        `   and rejected output formats to reduce rejection rate.`,
        '',
        `2. **Add quality checkpoints** — Instruct the worker to self-review against`,
        `   the acceptance criteria before marking a task complete.`,
        '',
        `3. **Tighten scope definition** — Narrow the worker's mandate to reduce`,
        `   ambiguity that may be causing quality variance.`,
        '',
        `_Review and customise before approving. Apply manually to the worker's CLAUDE.md._`,
    ].join('\n');
    const confidence = Math.min(0.95, (metrics.rejection_rate / 0.15 + (7.0 - metrics.quality_score) / 7.0) / 2);
    const proposal = {
        id: randomUUID(),
        type: 'role_definition_revision',
        target: workerName,
        reason,
        proposed_change: proposedChange,
        confidence: parseFloat(confidence.toFixed(3)),
        sample_size: metrics.total_tasks,
        status: 'pending_approval',
        created: new Date().toISOString(),
    };
    writeFileSync(join(PENDING_DIR, `${proposal.id}.json`), JSON.stringify(proposal, null, 2), { mode: 0o600 });
    return proposal;
}
/** Return all pending proposals */
export function getPendingProposals() {
    return readJsonDir(PENDING_DIR);
}
/**
 * Approve a proposal — moves it from pending/ to approved/.
 * The actual CLAUDE.md change is recorded but must be applied manually
 * for safety.
 */
export function approveProposal(id, approvedBy) {
    ensureDirs();
    const src = join(PENDING_DIR, `${id}.json`);
    if (!existsSync(src)) {
        throw new Error(`Proposal not found in pending: ${id}`);
    }
    const proposal = JSON.parse(readFileSync(src, 'utf8'));
    proposal.status = 'approved';
    proposal.decided = new Date().toISOString();
    proposal.decided_by = approvedBy;
    const dest = join(APPROVED_DIR, `${id}.json`);
    writeFileSync(dest, JSON.stringify(proposal, null, 2), { mode: 0o600 });
    // Remove from pending (rename would fail cross-device; write+unlink is safer)
    renameSync(src, dest);
}
/**
 * Reject a proposal — moves it from pending/ to rejected/ with an optional reason.
 */
export function rejectProposal(id, rejectedBy, reason) {
    ensureDirs();
    const src = join(PENDING_DIR, `${id}.json`);
    if (!existsSync(src)) {
        throw new Error(`Proposal not found in pending: ${id}`);
    }
    const proposal = JSON.parse(readFileSync(src, 'utf8'));
    proposal.status = 'rejected';
    proposal.decided = new Date().toISOString();
    proposal.decided_by = rejectedBy;
    if (reason)
        proposal.rejection_reason = reason;
    const dest = join(REJECTED_DIR, `${id}.json`);
    writeFileSync(dest, JSON.stringify(proposal, null, 2), { mode: 0o600 });
    renameSync(src, dest);
}
/**
 * List all proposals, optionally filtered by status.
 */
export function listProposals(filter) {
    const dirs = {
        pending: PENDING_DIR,
        approved: APPROVED_DIR,
        rejected: REJECTED_DIR,
    };
    if (filter) {
        return readJsonDir(dirs[filter]);
    }
    return [
        ...readJsonDir(PENDING_DIR),
        ...readJsonDir(APPROVED_DIR),
        ...readJsonDir(REJECTED_DIR),
    ];
}
//# sourceMappingURL=optimizer.js.map