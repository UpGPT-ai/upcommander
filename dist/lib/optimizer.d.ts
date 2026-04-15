/**
 * Optimization proposal engine — detects quality issues in worker performance
 * and proposes CLAUDE.md improvements for human review and approval.
 *
 * Proposals are stored in ~/.claude-commander/proposals/{pending,approved,rejected}/
 */
export interface OptimizationProposal {
    id: string;
    type: 'role_definition_revision' | 'template_improvement' | 'workflow_change';
    target: string;
    reason: string;
    proposed_change: string;
    confidence: number;
    sample_size: number;
    status: 'pending_approval' | 'approved' | 'rejected';
    created: string;
    decided?: string;
    decided_by?: string;
    rejection_reason?: string;
}
/**
 * Inline WorkerPerformance type — defined here because performance.ts does not
 * yet exist. If that module is introduced later, import from there instead.
 */
export interface WorkerPerformance {
    worker_name: string;
    total_tasks: number;
    rejection_rate: number;
    quality_score: number;
    avg_cost_per_task?: number;
    last_updated: string;
    history?: Array<{
        date: string;
        quality_score: number;
        rejection_rate: number;
        tasks: number;
    }>;
}
/**
 * Analyse performance data for a single worker and return a proposal if
 * quality thresholds are breached. Returns null if no action needed or if
 * a proposal was already raised within the past 14 days.
 */
export declare function analyzePerformance(workerName: string): OptimizationProposal | null;
/**
 * Generate a specific CLAUDE.md modification proposal based on metrics.
 * The proposal is saved to ~/.claude-commander/proposals/pending/ immediately.
 */
export declare function generateProposal(workerName: string, metrics: WorkerPerformance): OptimizationProposal;
/** Return all pending proposals */
export declare function getPendingProposals(): OptimizationProposal[];
/**
 * Approve a proposal — moves it from pending/ to approved/.
 * The actual CLAUDE.md change is recorded but must be applied manually
 * for safety.
 */
export declare function approveProposal(id: string, approvedBy: string): void;
/**
 * Reject a proposal — moves it from pending/ to rejected/ with an optional reason.
 */
export declare function rejectProposal(id: string, rejectedBy: string, reason?: string): void;
/**
 * List all proposals, optionally filtered by status.
 */
export declare function listProposals(filter?: 'pending' | 'approved' | 'rejected'): OptimizationProposal[];
//# sourceMappingURL=optimizer.d.ts.map