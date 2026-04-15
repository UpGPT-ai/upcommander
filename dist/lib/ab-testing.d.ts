/**
 * A/B testing for worker role definitions (CLAUDE.md variants).
 *
 * Tests are stored in ~/.claude-commander/ab-tests/{id}.json
 * Current CLAUDE.md for a worker lives at ~/.claude-commander/roles/{worker}.md
 */
export interface RoleVariant {
    id: string;
    worker: string;
    version: 'A' | 'B';
    claudeMd: string;
    tasksRun: number;
    avgQuality: number;
    rejectionRate: number;
    status: 'active' | 'promoted' | 'retired';
    created: string;
}
export interface ABTest {
    id: string;
    worker: string;
    variantA: RoleVariant;
    variantB: RoleVariant;
    minSample: number;
    status: 'running' | 'concluded';
    winner?: 'A' | 'B';
    created: string;
    concluded?: string;
}
/**
 * Create an A/B test for a worker.
 * The current CLAUDE.md becomes variant A; the challenger becomes variant B.
 *
 * Throws if the worker already has a running test.
 */
export declare function createABTest(worker: string, challengerClaudeMd: string, minSample?: number): ABTest;
/**
 * Return the currently running A/B test for a worker, or null if none.
 */
export declare function getActiveTest(worker: string): ABTest | null;
/**
 * List all A/B tests (all statuses).
 */
export declare function listABTests(): ABTest[];
/**
 * Record the result of a task run under a specific variant.
 * Updates running averages for quality and rejection rate.
 */
export declare function recordABResult(testId: string, variant: 'A' | 'B', quality: number, rejected: boolean): void;
/**
 * Evaluate whether a test has enough data to declare a winner.
 * Both variants must have at least minSample tasks.
 *
 * Winner selection:
 *   - Higher avgQuality AND lower rejectionRate → clear winner
 *   - If one metric is significantly better (>10% improvement) and the other
 *     is neutral, declare that variant the winner
 */
export declare function evaluateTest(testId: string): {
    concluded: boolean;
    winner?: 'A' | 'B';
    reason?: string;
};
/**
 * Conclude a test and promote the winning CLAUDE.md variant.
 * Saves the winner's claudeMd to ~/.claude-commander/roles/{worker}.md
 */
export declare function promoteWinner(testId: string): void;
//# sourceMappingURL=ab-testing.d.ts.map