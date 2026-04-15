/**
 * Hard Risk Management Constraints
 *
 * Defines, loads, saves, and enforces constraint configurations for
 * Claude Commander projects. Constraints can block, warn, or log
 * when metric thresholds are exceeded. All constraint checks are
 * appended to an immutable JSONL audit log for traceability.
 */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Storage paths
// ---------------------------------------------------------------------------

function coordDir(projectPath: string): string {
  return join(projectPath, '.claude-coord');
}

function constraintsPath(projectPath: string): string {
  return join(coordDir(projectPath), 'constraints.json');
}

function constraintLogPath(projectPath: string): string {
  return join(coordDir(projectPath), 'constraint-log.jsonl');
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_CONSTRAINTS: ConstraintConfig = {
  max_position_pct: 0.05,
  max_drawdown_pct: 0.15,
  max_sector_exposure_pct: 0.25,
  max_daily_loss_usd: 10_000,
  max_budget_usd: 100,
  max_document_scope: 10_000,
  custom_rules: [],
};

// ---------------------------------------------------------------------------
// Load / Save
// ---------------------------------------------------------------------------

/**
 * Load constraint configuration from a project's .claude-coord directory.
 * Returns the merged defaults + project overrides if the file exists,
 * or the global defaults if not.
 */
export function loadConstraints(projectPath: string): ConstraintConfig {
  const path = constraintsPath(projectPath);

  if (!existsSync(path)) {
    return { ...DEFAULT_CONSTRAINTS };
  }

  try {
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw) as ConstraintConfig;
    // Merge with defaults so missing keys always have a value
    return { ...DEFAULT_CONSTRAINTS, ...parsed };
  } catch {
    return { ...DEFAULT_CONSTRAINTS };
  }
}

/**
 * Persist constraint configuration to .claude-coord/constraints.json.
 * Creates the directory if needed. Merges with defaults before saving.
 */
export function saveConstraints(
  projectPath: string,
  config: ConstraintConfig
): void {
  const dir = coordDir(projectPath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  const merged: ConstraintConfig = { ...DEFAULT_CONSTRAINTS, ...config };

  writeFileSync(constraintsPath(projectPath), JSON.stringify(merged, null, 2), {
    encoding: 'utf8',
    mode: 0o600,
  });
}

// ---------------------------------------------------------------------------
// Constraint checking
// ---------------------------------------------------------------------------

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
export function checkConstraint(
  config: ConstraintConfig,
  metric: string,
  value: number
): ConstraintCheck {
  const timestamp = new Date().toISOString();

  // Built-in constraints
  const builtinMap: Record<
    string,
    { threshold: number | undefined; action: 'block' | 'warn' | 'log' }
  > = {
    position_pct: { threshold: config.max_position_pct, action: 'block' },
    drawdown_pct: { threshold: config.max_drawdown_pct, action: 'block' },
    sector_exposure_pct: { threshold: config.max_sector_exposure_pct, action: 'block' },
    daily_loss_usd: { threshold: config.max_daily_loss_usd, action: 'block' },
    budget_usd: { threshold: config.max_budget_usd, action: 'warn' },
    document_scope: { threshold: config.max_document_scope, action: 'warn' },
  };

  if (metric in builtinMap) {
    const { threshold, action } = builtinMap[metric];

    if (threshold === undefined) {
      return {
        passed: true,
        rule: metric,
        current_value: value,
        threshold: Infinity,
        action,
        timestamp,
      };
    }

    const passed = value <= threshold;
    return { passed, rule: metric, current_value: value, threshold, action, timestamp };
  }

  // Custom rules
  const customRules = config.custom_rules ?? [];
  const rule = customRules.find((r) => r.name === metric);

  if (rule) {
    const passed = value <= rule.threshold;
    return {
      passed,
      rule: rule.name,
      current_value: value,
      threshold: rule.threshold,
      action: rule.action,
      timestamp,
    };
  }

  // Unknown metric — log only, always pass
  return {
    passed: true,
    rule: metric,
    current_value: value,
    threshold: Infinity,
    action: 'log',
    timestamp,
  };
}

/**
 * Evaluate all known metrics from a metrics map against the constraints.
 * Returns one ConstraintCheck per matching metric.
 *
 * @param config Constraint configuration
 * @param metrics Record of metric name → current value
 */
export function checkAllConstraints(
  config: ConstraintConfig,
  metrics: Record<string, number>
): ConstraintCheck[] {
  return Object.entries(metrics).map(([metric, value]) =>
    checkConstraint(config, metric, value)
  );
}

/**
 * Returns true if any constraint check triggered a 'block' action.
 * Use this to gate any operation that should not proceed under violation.
 */
export function isBlocked(checks: ConstraintCheck[]): boolean {
  return checks.some((c) => !c.passed && c.action === 'block');
}

/**
 * Returns all failed constraint checks with 'warn' or 'block' action.
 */
export function getViolations(checks: ConstraintCheck[]): ConstraintCheck[] {
  return checks.filter((c) => !c.passed);
}

/**
 * Format a list of constraint checks into a human-readable summary string.
 */
export function formatConstraintSummary(checks: ConstraintCheck[]): string {
  const violations = getViolations(checks);

  if (violations.length === 0) {
    return `All ${checks.length} constraint(s) passed.`;
  }

  const lines = violations.map((c) => {
    const icon = c.action === 'block' ? 'BLOCKED' : 'WARN';
    return `[${icon}] ${c.rule}: value=${c.current_value.toFixed(4)}, threshold=${c.threshold.toFixed(4)}`;
  });

  return [`${violations.length} violation(s):`, ...lines].join('\n');
}

// ---------------------------------------------------------------------------
// Audit logging
// ---------------------------------------------------------------------------

/**
 * Append a single constraint check result to the JSONL audit log.
 * The log file is created if it does not exist.
 *
 * @param projectPath Project root directory
 * @param check Constraint check result to log
 */
export function logConstraintCheck(
  projectPath: string,
  check: ConstraintCheck
): void {
  const dir = coordDir(projectPath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  const line = JSON.stringify(check) + '\n';
  appendFileSync(constraintLogPath(projectPath), line, 'utf8');
}

/**
 * Append multiple constraint checks to the audit log in a single pass.
 *
 * @param projectPath Project root directory
 * @param checks Array of constraint check results to log
 */
export function logAllConstraintChecks(
  projectPath: string,
  checks: ConstraintCheck[]
): void {
  if (checks.length === 0) return;

  const dir = coordDir(projectPath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  const lines = checks.map((c) => JSON.stringify(c)).join('\n') + '\n';
  appendFileSync(constraintLogPath(projectPath), lines, 'utf8');
}

/**
 * Read all historical constraint check records from the audit log.
 *
 * @param projectPath Project root directory
 * @returns Array of ConstraintCheck records, oldest first
 */
export function readConstraintLog(projectPath: string): ConstraintCheck[] {
  const path = constraintLogPath(projectPath);

  if (!existsSync(path)) return [];

  try {
    return readFileSync(path, 'utf8')
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as ConstraintCheck);
  } catch {
    return [];
  }
}
