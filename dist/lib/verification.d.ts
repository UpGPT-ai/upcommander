/**
 * Claude Commander — 5-Stage Verification Pipeline
 *
 * Stage 1: Self-check — agent re-reads own findings, confirms evidence supports conclusion
 * Stage 2: Peer review — second agent reviews, flags disagreements
 * Stage 3: Synthesis check — orchestrator checks cross-agent consistency
 * Stage 4: Completeness audit — requirements checklist vs what's present
 * Stage 5: Evidence chain walk — independently traverse every link
 */
import type { Finding } from './output-schemas.js';
import type { CrossReferenceGraph } from './cross-reference.js';
export type VerificationStage = 1 | 2 | 3 | 4 | 5;
export interface VerificationConfig {
    /** Which stages to run, e.g. [1,2,3] for SEM, [1,2,3,4,5] for pharma. */
    stages: VerificationStage[];
    domain: string;
    /** For stage 4 — which items must be present in the analysis. */
    requirementsChecklist?: string[];
    /** Add to approval queue on disagreement instead of auto-failing. */
    escalateDisagreements: boolean;
}
export interface VerificationResult {
    finding_id: string;
    stages_completed: VerificationStage[];
    passed: boolean;
    original_confidence: number;
    adjusted_confidence: number;
    disagreements: Disagreement[];
    /** Missing requirements flagged in stage 4 (per-finding or global). */
    completeness_gaps: string[];
    /** Evidence links that failed validation in stage 5. */
    broken_evidence_links: BrokenLink[];
    verified_at: string;
    verified_by: string;
}
export interface Disagreement {
    stage: VerificationStage;
    reviewer: string;
    finding_id: string;
    issue: string;
    suggested_action: 'accept' | 'reject' | 'modify' | 'escalate';
    reasoning: string;
}
export interface BrokenLink {
    finding_id: string;
    evidence_index: number;
    link_description: string;
    expected: string;
    actual: string | null;
}
export interface CompletenessReport {
    domain: string;
    required_items: string[];
    present_items: string[];
    missing_items: string[];
    /** 0–100, percentage of required items present. */
    coverage_pct: number;
}
export interface VerificationSummary {
    total_findings: number;
    verified: number;
    passed: number;
    failed: number;
    escalated: number;
    avg_confidence_before: number;
    avg_confidence_after: number;
    completeness_pct: number;
    broken_links: number;
    by_stage: Record<number, {
        passed: number;
        failed: number;
    }>;
}
export declare const BUILT_IN_CHECKLISTS: Record<string, string[]>;
/**
 * Stage 1: Self-check. Validates that a finding's own evidence adequately
 * supports its conclusion. Reduces confidence by 10% when evidence is thin
 * (fewer than 2 evidence links).
 */
export declare function selfCheck(finding: Finding): VerificationResult;
/**
 * Stage 2: Peer review. Checks whether any other finding from a *different*
 * worker contradicts this one (same entity referenced, opposite conclusion or
 * conflicting severity). Flags disagreements for human review or escalation.
 */
export declare function peerReview(finding: Finding, allFindings: Finding[]): VerificationResult;
/**
 * Stage 3: Synthesis check. Uses the CrossReferenceGraph to detect
 * cross-agent conflicts. Any finding whose ID or source documents appear in
 * a conflict is flagged.
 */
export declare function synthesisCheck(findings: Finding[], crossRefGraph: CrossReferenceGraph): VerificationResult[];
/**
 * Stage 4: Completeness audit. Checks which items from the requirements
 * checklist are represented in the set of findings. An item is considered
 * "present" if it appears (case-insensitive substring) in any finding's
 * type or title.
 */
export declare function completenessAudit(findings: Finding[], checklist: string[]): CompletenessReport;
/**
 * Stage 5: Evidence chain walk. For every evidence link in a finding,
 * verifies that both the document_id and excerpt are non-empty. Flags
 * broken links with a description of what is missing.
 */
export declare function evidenceChainWalk(finding: Finding): BrokenLink[];
/**
 * Run the configured verification stages over a set of findings. Stages are
 * run in order; results from earlier stages inform later ones. Stage 4 is
 * computed globally (all findings), all other stages operate per-finding.
 *
 * @param findings - Findings to verify.
 * @param config   - Which stages to run and domain configuration.
 * @returns One VerificationResult per finding.
 */
export declare function runVerification(findings: Finding[], config: VerificationConfig): VerificationResult[];
/**
 * Compute aggregate statistics across all VerificationResults.
 */
export declare function getVerificationSummary(results: VerificationResult[]): VerificationSummary;
/**
 * Write verification results to `<outputDir>/.claude-coord/verification/results.json`.
 * Creates the directory if it does not exist.
 */
export declare function saveVerificationResults(results: VerificationResult[], outputDir: string): void;
//# sourceMappingURL=verification.d.ts.map