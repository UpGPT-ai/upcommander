/**
 * File-based multi-agent coordination protocol.
 *
 * Directory layout inside a project root:
 *
 *   .claude-coord/
 *     PLAN.md
 *     ORCHESTRATOR.md
 *     SYNTHESIS.md
 *     workers/
 *       <name>/
 *         TASK.md
 *         STATUS.json
 *         SYNTHESIS.md
 *         subagents/
 */
export interface AgentStatus {
    agent: string;
    tier: number;
    state: 'idle' | 'in_progress' | 'complete' | 'blocked' | 'error' | 'waiting_approval';
    task: string;
    started: string;
    updated: string;
    progress: string;
    blocking_reason: string | null;
    waiting_for: string | null;
    subagents: {
        active: number;
        complete: number;
        total: number;
    };
    files_produced: string[];
    model?: {
        provider: string;
        model: string;
    };
    tokens?: {
        input: number;
        output: number;
        cached: number;
        cost_usd: number;
    };
}
export interface CoordinationTree {
    projects: Record<string, {
        orchestrator: AgentStatus | null;
        workers: Record<string, AgentStatus>;
    }>;
}
export interface ApprovalItem {
    project: string;
    worker: string;
    task: string;
    since: string;
}
/**
 * Initialise the .claude-coord/ directory structure inside a project.
 * Safe to call multiple times — will not overwrite existing files.
 */
export declare function initCoordination(projectPath: string, workers: string[]): void;
/**
 * Read and parse STATUS.json for a specific worker.
 * Returns null if the file does not exist or is invalid.
 */
export declare function readStatus(projectPath: string, workerName: string): AgentStatus | null;
/**
 * Read and parse the orchestrator STATUS.json for a project.
 * Returns null if not found.
 */
export declare function readOrchestratorStatus(projectPath: string): AgentStatus | null;
/**
 * Merge a partial status update into a worker's STATUS.json.
 * The `updated` timestamp is always refreshed.
 */
export declare function writeStatus(projectPath: string, workerName: string, status: Partial<AgentStatus>): void;
/**
 * Read all worker STATUS.json files within a project.
 * Returns a map of workerName → AgentStatus.
 */
export declare function readAllStatuses(projectPath: string): Record<string, AgentStatus>;
/**
 * Build the full coordination tree across one or more project paths.
 */
export declare function getCoordinationTree(projectPaths: string[]): CoordinationTree;
/**
 * Collect all agents in 'waiting_approval' state across all projects.
 */
export declare function getApprovalQueue(projectPaths: string[]): ApprovalItem[];
/**
 * Generate the CLAUDE.md content for a worker agent.
 */
export declare function generateWorkerClaudeMd(workerName: string): string;
/**
 * Generate the CLAUDE.md content for an orchestrator agent.
 */
export declare function generateOrchestratorClaudeMd(projectName: string, workers: string[]): string;
/**
 * Write raw findings to a worker's RESULT.md.
 * Appends to existing content (immutable audit trail).
 */
export declare function writeResult(projectPath: string, workerName: string, content: string): void;
/**
 * Write a worker-level summary to SUMMARY.md.
 * This aggregates the worker's RESULT.md entries.
 * Links back to RESULT.md for audit traceability.
 */
export declare function writeSummary(projectPath: string, workerName: string, content: string): void;
/**
 * Read a worker's SKILL.md (domain-specific analysis instructions).
 */
export declare function readSkill(projectPath: string, workerName: string): string;
/**
 * Write domain-specific skill instructions to a worker's SKILL.md.
 */
export declare function writeSkill(projectPath: string, workerName: string, content: string): void;
/**
 * Read a worker's RESULT.md content.
 */
export declare function readResult(projectPath: string, workerName: string): string;
/**
 * Read a worker's SUMMARY.md content.
 */
export declare function readSummary(projectPath: string, workerName: string): string;
//# sourceMappingURL=coordination.d.ts.map