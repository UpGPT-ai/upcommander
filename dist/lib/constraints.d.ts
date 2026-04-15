/**
 * Hard Risk Management Constraints
 *
 * Defines, loads, saves, and enforces constraint configurations for
 * Claude Commander projects. Constraints can block, warn, or log
 * when metric thresholds are exceeded. All constraint checks are
 * appended to an immutable JSONL audit log for traceability.
 */
export interface ConstraintRule {
    name: string;
    /** Human-readable description of the condition being checked */
    condition: string;
    threshold: number;
    action: 'block' | 'warn' | 'log';
}
export interface ConstraintConfig {
    /** Maximum % of capital per single position (e.g. 0.05 = 5%) */
    max_position_pct?: number;
    /** Maximum portfolio drawdown before halting new trades (e.g. 0.15 = 15%) */
    max_drawdown_pct?: number;
    /** Maximum % of capital in any one sector */
    max_sector_exposure_pct?: number;
    /** Maximum USD loss in a single trading day */
    max_daily_loss_usd?: number;
    /** Maximum USD budget for agent API calls */
    max_budget_usd?: number;
    /** Maximum number of documents to include in a single analysis run */
    max_document_scope?: number;
    /** Additional custom rules defined by the user */
    custom_rules?: ConstraintRule[];
}
export interface ConstraintCheck {
    passed: boolean;
    rule: string;
    current_value: number;
    threshold: number;
    action: 'block' | 'warn' | 'log';
    timestamp: string;
}
/**
 * Load constraint configuration from a project's .claude-coord directory.
 * Returns the merged defaults + project overrides if the file exists,
 * or the global defaults if not.
 */
export declare function loadConstraints(projectPath: string): ConstraintConfig;
/**
 * Persist constraint configuration to .claude-coord/constraints.json.
 * Creates the directory if needed. Merges with defaults before saving.
 */
export declare function saveConstraints(projectPath: string, config: ConstraintConfig): void;
/**
 * Evaluate a single named metric against the constraint configuration.
 *
 * Recognized metric names:
 *   'position_pct'         → compared against max_position_pct
 *   'drawdown_pct'         → compared against max_drawdown_pct
 *   'sector_exposure_pct'  → compared against max_sector_exposure_pct
 *   'daily_loss_usd'       → compared against max_daily_loss_usd
 *   'budget_usd'           → compared against max_budget_usd
 *   'document_scope'       → compared against max_document_scope
 *
 * Custom rules are checked if the metric name matches a rule's name.
 *
 * @param config Constraint configuration
 * @param metric Name of the metric to check
 * @param value Current value of the metric
 * @returns ConstraintCheck result
 */
export declare function checkConstraint(config: ConstraintConfig, metric: string, value: number): ConstraintCheck;
/**
 * Evaluate all known metrics from a metrics map against the constraints.
 * Returns one ConstraintCheck per matching metric.
 *
 * @param config Constraint configuration
 * @param metrics Record of metric name → current value
 */
export declare function checkAllConstraints(config: ConstraintConfig, metrics: Record<string, number>): ConstraintCheck[];
/**
 * Returns true if any constraint check triggered a 'block' action.
 * Use this to gate any operation that should not proceed under violation.
 */
export declare function isBlocked(checks: ConstraintCheck[]): boolean;
/**
 * Returns all failed constraint checks with 'warn' or 'block' action.
 */
export declare function getViolations(checks: ConstraintCheck[]): ConstraintCheck[];
/**
 * Format a list of constraint checks into a human-readable summary string.
 */
export declare function formatConstraintSummary(checks: ConstraintCheck[]): string;
/**
 * Append a single constraint check result to the JSONL audit log.
 * The log file is created if it does not exist.
 *
 * @param projectPath Project root directory
 * @param check Constraint check result to log
 */
export declare function logConstraintCheck(projectPath: string, check: ConstraintCheck): void;
/**
 * Append multiple constraint checks to the audit log in a single pass.
 *
 * @param projectPath Project root directory
 * @param checks Array of constraint check results to log
 */
export declare function logAllConstraintChecks(projectPath: string, checks: ConstraintCheck[]): void;
/**
 * Read all historical constraint check records from the audit log.
 *
 * @param projectPath Project root directory
 * @returns Array of ConstraintCheck records, oldest first
 */
export declare function readConstraintLog(projectPath: string): ConstraintCheck[];
//# sourceMappingURL=constraints.d.ts.map