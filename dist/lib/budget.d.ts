/**
 * Claude Commander — Cost & Budget Management
 *
 * Enforces project-level budget caps, tracks spend per worker,
 * and provides cost projections before analysis begins.
 */
export interface BudgetAlert {
    threshold: number;
    triggered: boolean;
    triggered_at?: string;
}
export interface ProjectBudget {
    project: string;
    total_usd: number;
    spent_usd: number;
    allocated: Record<string, number>;
    alerts: BudgetAlert[];
    created: string;
    updated: string;
}
export interface SpendRecord {
    worker: string;
    model: string;
    tokens_input: number;
    tokens_output: number;
    tokens_cached: number;
    cost_usd: number;
    timestamp: string;
}
export interface CostEstimate {
    template: string;
    document_pages: number;
    estimated_chunks: number;
    estimated_tasks: number;
    cost_per_task_usd: number;
    total_estimated_usd: number;
    breakdown: Record<string, number>;
}
export interface BudgetCheckResult {
    remaining: number;
    percentage: number;
    exceeded: boolean;
    alerts: BudgetAlert[];
}
/**
 * Set (or reset) the budget for a project.
 *
 * Allocates the total_usd evenly across workers when `allocated` is not
 * explicitly provided. The project string should be the project directory path
 * so it can be used as a stable identifier.
 *
 * @param projectPath  Absolute path to the project root
 * @param totalUsd     Hard budget cap in USD
 * @param allocated    Optional map of worker role → reserved amount
 */
export declare function setBudget(projectPath: string, totalUsd: number, allocated?: Record<string, number>): ProjectBudget;
/**
 * Retrieve the current budget for a project.
 * Returns null if no budget has been set.
 */
export declare function getBudget(projectPath: string): ProjectBudget | null;
/**
 * Record a spend event against the project budget.
 *
 * - Adds cost to spent_usd
 * - Checks each alert threshold and fires it if newly exceeded
 * - Appends the SpendRecord to the append-only JSONL spend log
 *
 * @param projectPath  Absolute path to the project root
 * @param record       Spend record to persist
 */
export declare function recordSpend(projectPath: string, record: SpendRecord): void;
/**
 * Check current budget status for a project.
 *
 * @returns BudgetCheckResult with remaining, percentage used, exceeded flag,
 *          and the list of alert objects.
 */
export declare function checkBudget(projectPath: string): BudgetCheckResult;
/**
 * Estimate the cost of an analysis run before it begins.
 *
 * @param documentPages   Approximate number of document pages to process
 * @param template        Template name (dev, research, book, campaign, video, custom)
 * @returns CostEstimate with per-worker breakdown and totals
 */
export declare function estimateCost(documentPages: number, template: string): CostEstimate;
/**
 * Return a human-readable budget summary string.
 *
 * Example output:
 * ```
 * Budget: $2.34 / $10.00 used (23.4%) — $7.66 remaining
 * Alerts: ⚠ 75% threshold not yet reached
 * ```
 */
export declare function getBudgetSummary(projectPath: string): string;
/**
 * Read all spend records from the append-only JSONL log.
 * Returns an empty array if no log exists yet.
 */
export declare function readSpendLog(projectPath: string): SpendRecord[];
/**
 * Summarise total spend per worker from the spend log.
 */
export declare function spendByWorker(projectPath: string): Record<string, number>;
/**
 * Convenience guard: throw an error when the project budget is fully exhausted.
 * Call this at the start of each API execution to enforce the hard stop.
 *
 * @param projectPath  Absolute path to the project root
 * @throws Error when the budget has been exceeded
 */
export declare function assertBudgetAvailable(projectPath: string): void;
//# sourceMappingURL=budget.d.ts.map