/**
 * Claude Commander — Cost & Budget Management
 *
 * Enforces project-level budget caps, tracks spend per worker,
 * and provides cost projections before analysis begins.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const BUDGETS_DIR = join(homedir(), '.claude-commander', 'budgets');
function ensureBudgetsDir() {
    if (!existsSync(BUDGETS_DIR)) {
        mkdirSync(BUDGETS_DIR, { recursive: true, mode: 0o700 });
    }
}
/** Derive a safe filename slug from a project path or name. */
function projectSlug(projectPath) {
    // Use the final path component as the slug; replace non-alphanumeric chars
    return basename(projectPath).replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
}
function budgetFilePath(projectPath) {
    return join(BUDGETS_DIR, `${projectSlug(projectPath)}.json`);
}
function spendLogPath(projectPath) {
    return join(BUDGETS_DIR, `${projectSlug(projectPath)}-spend.jsonl`);
}
// ---------------------------------------------------------------------------
// Default alert thresholds
// ---------------------------------------------------------------------------
const DEFAULT_THRESHOLDS = [0.75, 0.90, 1.0];
function defaultAlerts() {
    return DEFAULT_THRESHOLDS.map((t) => ({ threshold: t, triggered: false }));
}
// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
function readBudgetFile(projectPath) {
    const file = budgetFilePath(projectPath);
    if (!existsSync(file))
        return null;
    try {
        return JSON.parse(readFileSync(file, 'utf8'));
    }
    catch {
        return null;
    }
}
function writeBudgetFile(budget) {
    ensureBudgetsDir();
    const file = budgetFilePath(budget.project);
    writeFileSync(file, JSON.stringify(budget, null, 2), { mode: 0o600 });
}
// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
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
export function setBudget(projectPath, totalUsd, allocated) {
    ensureBudgetsDir();
    const now = new Date().toISOString();
    const existing = readBudgetFile(projectPath);
    const budget = {
        project: projectPath,
        total_usd: totalUsd,
        spent_usd: existing?.spent_usd ?? 0, // preserve already-recorded spend
        allocated: allocated ?? existing?.allocated ?? {},
        alerts: defaultAlerts(),
        created: existing?.created ?? now,
        updated: now,
    };
    // Re-evaluate alert states against current spend (in case budget was lowered)
    budget.alerts = recomputeAlerts(budget.alerts, budget.spent_usd, totalUsd);
    writeBudgetFile(budget);
    return budget;
}
/**
 * Retrieve the current budget for a project.
 * Returns null if no budget has been set.
 */
export function getBudget(projectPath) {
    return readBudgetFile(projectPath);
}
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
export function recordSpend(projectPath, record) {
    ensureBudgetsDir();
    // Append to the spend log first (always, even if no budget is set)
    const logFile = spendLogPath(projectPath);
    appendFileSync(logFile, JSON.stringify(record) + '\n', { encoding: 'utf8' });
    const budget = readBudgetFile(projectPath);
    if (!budget)
        return; // No budget to update
    budget.spent_usd += record.cost_usd;
    budget.updated = new Date().toISOString();
    // Recompute alert states and identify newly triggered alerts
    const previousAlerts = JSON.parse(JSON.stringify(budget.alerts));
    budget.alerts = recomputeAlerts(budget.alerts, budget.spent_usd, budget.total_usd);
    // Emit side-effects for newly triggered alerts
    for (let i = 0; i < budget.alerts.length; i++) {
        const current = budget.alerts[i];
        const previous = previousAlerts[i];
        if (current && previous && current.triggered && !previous.triggered) {
            emitBudgetAlert(budget, current);
        }
    }
    writeBudgetFile(budget);
}
/**
 * Check current budget status for a project.
 *
 * @returns BudgetCheckResult with remaining, percentage used, exceeded flag,
 *          and the list of alert objects.
 */
export function checkBudget(projectPath) {
    const budget = readBudgetFile(projectPath);
    if (!budget) {
        // No budget set — always passes
        return {
            remaining: Infinity,
            percentage: 0,
            exceeded: false,
            alerts: [],
        };
    }
    const remaining = Math.max(0, budget.total_usd - budget.spent_usd);
    const percentage = budget.total_usd > 0
        ? Math.min(100, (budget.spent_usd / budget.total_usd) * 100)
        : 0;
    const exceeded = budget.spent_usd >= budget.total_usd;
    return {
        remaining,
        percentage,
        exceeded,
        alerts: budget.alerts,
    };
}
// ---------------------------------------------------------------------------
// Cost estimation
// ---------------------------------------------------------------------------
/**
 * Per-template cost estimates based on typical token usage patterns.
 *
 * These are conservative estimates based on observed real-world usage.
 * Values represent average cost per task in USD for the default model tier.
 */
const TEMPLATE_COST_PROFILES = {
    dev: {
        costPerTaskUsd: 0.12,
        workerRoles: ['orchestrator', 'backend', 'frontend', 'tests', 'deploy'],
        taskMultiplier: 2.5,
    },
    research: {
        costPerTaskUsd: 0.08,
        workerRoles: ['orchestrator', 'competitors', 'complaints', 'pricing', 'influencers', 'synthesis'],
        taskMultiplier: 3.0,
    },
    book: {
        costPerTaskUsd: 0.15,
        workerRoles: ['orchestrator', 'outline', 'writer-1', 'writer-2', 'writer-3', 'editor', 'citations', 'format'],
        taskMultiplier: 1.5,
    },
    campaign: {
        costPerTaskUsd: 0.07,
        workerRoles: ['orchestrator', 'copy', 'social', 'paid-search', 'creative', 'analytics'],
        taskMultiplier: 2.0,
    },
    video: {
        costPerTaskUsd: 0.10,
        workerRoles: ['orchestrator', 'scripts', 'storyboard', 'prompts', 'audio', 'assembly'],
        taskMultiplier: 2.0,
    },
    custom: {
        costPerTaskUsd: 0.10,
        workerRoles: ['orchestrator'],
        taskMultiplier: 2.0,
    },
};
const DEFAULT_PROFILE = {
    costPerTaskUsd: 0.10,
    workerRoles: ['orchestrator', 'worker'],
    taskMultiplier: 2.0,
};
/**
 * Estimate the cost of an analysis run before it begins.
 *
 * @param documentPages   Approximate number of document pages to process
 * @param template        Template name (dev, research, book, campaign, video, custom)
 * @returns CostEstimate with per-worker breakdown and totals
 */
export function estimateCost(documentPages, template) {
    const profile = TEMPLATE_COST_PROFILES[template] ?? DEFAULT_PROFILE;
    const estimatedChunks = Math.ceil(documentPages * 1.8); // ~1.8 chunks per page
    const estimatedTasks = Math.ceil(documentPages * profile.taskMultiplier);
    const numWorkers = profile.workerRoles.length;
    // Distribute tasks evenly across workers (minus orchestrator which coordinates)
    const workerCount = Math.max(1, numWorkers - 1);
    const tasksPerWorker = Math.ceil(estimatedTasks / workerCount);
    // Build per-role breakdown
    const breakdown = {};
    for (const role of profile.workerRoles) {
        if (role === 'orchestrator') {
            // Orchestrator runs fewer, higher-cost tasks
            breakdown[role] = Math.ceil(estimatedTasks * 0.1) * profile.costPerTaskUsd * 2;
        }
        else {
            breakdown[role] = tasksPerWorker * profile.costPerTaskUsd;
        }
    }
    const totalEstimatedUsd = Object.values(breakdown).reduce((a, b) => a + b, 0);
    return {
        template,
        document_pages: documentPages,
        estimated_chunks: estimatedChunks,
        estimated_tasks: estimatedTasks,
        cost_per_task_usd: profile.costPerTaskUsd,
        total_estimated_usd: Math.round(totalEstimatedUsd * 100) / 100,
        breakdown: Object.fromEntries(Object.entries(breakdown).map(([k, v]) => [k, Math.round(v * 1000) / 1000])),
    };
}
// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
/**
 * Return a human-readable budget summary string.
 *
 * Example output:
 * ```
 * Budget: $2.34 / $10.00 used (23.4%) — $7.66 remaining
 * Alerts: ⚠ 75% threshold not yet reached
 * ```
 */
export function getBudgetSummary(projectPath) {
    const budget = readBudgetFile(projectPath);
    if (!budget) {
        return 'No budget set for this project.';
    }
    const pct = budget.total_usd > 0
        ? ((budget.spent_usd / budget.total_usd) * 100).toFixed(1)
        : '0.0';
    const remaining = Math.max(0, budget.total_usd - budget.spent_usd);
    const exceeded = budget.spent_usd >= budget.total_usd;
    const lines = [
        `Budget: $${budget.spent_usd.toFixed(2)} / $${budget.total_usd.toFixed(2)} used (${pct}%) — $${remaining.toFixed(2)} remaining`,
    ];
    if (exceeded) {
        lines.push('Status: BUDGET EXCEEDED — execution is blocked');
    }
    else {
        lines.push(`Status: ${exceeded ? 'Exceeded' : 'Active'}`);
    }
    // Alert status
    const alertLines = [];
    for (const alert of budget.alerts) {
        const label = `${(alert.threshold * 100).toFixed(0)}%`;
        if (alert.triggered) {
            const at = alert.triggered_at ? ` (triggered ${alert.triggered_at})` : '';
            alertLines.push(`  [x] ${label} threshold exceeded${at}`);
        }
        else {
            alertLines.push(`  [ ] ${label} threshold not yet reached`);
        }
    }
    if (alertLines.length > 0) {
        lines.push('Alerts:');
        lines.push(...alertLines);
    }
    // Worker allocations
    const allocEntries = Object.entries(budget.allocated);
    if (allocEntries.length > 0) {
        lines.push('Allocations:');
        for (const [role, amount] of allocEntries) {
            lines.push(`  ${role}: $${amount.toFixed(2)}`);
        }
    }
    lines.push(`Last updated: ${budget.updated}`);
    return lines.join('\n');
}
// ---------------------------------------------------------------------------
// Spend log reader
// ---------------------------------------------------------------------------
/**
 * Read all spend records from the append-only JSONL log.
 * Returns an empty array if no log exists yet.
 */
export function readSpendLog(projectPath) {
    const logFile = spendLogPath(projectPath);
    if (!existsSync(logFile))
        return [];
    const records = [];
    try {
        const lines = readFileSync(logFile, 'utf8').split('\n').filter(Boolean);
        for (const line of lines) {
            try {
                records.push(JSON.parse(line));
            }
            catch {
                // Skip malformed lines
            }
        }
    }
    catch {
        // File unreadable
    }
    return records;
}
/**
 * Summarise total spend per worker from the spend log.
 */
export function spendByWorker(projectPath) {
    const records = readSpendLog(projectPath);
    const totals = {};
    for (const record of records) {
        totals[record.worker] = (totals[record.worker] ?? 0) + record.cost_usd;
    }
    return totals;
}
// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
/**
 * Recompute alert.triggered flags based on current spend vs total.
 * Also sets triggered_at timestamp on first trigger.
 */
function recomputeAlerts(alerts, spentUsd, totalUsd) {
    if (totalUsd <= 0)
        return alerts;
    const ratio = spentUsd / totalUsd;
    const now = new Date().toISOString();
    return alerts.map((alert) => {
        const shouldTrigger = ratio >= alert.threshold;
        if (shouldTrigger && !alert.triggered) {
            return { ...alert, triggered: true, triggered_at: now };
        }
        return alert;
    });
}
/**
 * Emit side effects when a budget alert fires.
 *
 * At 75%:  log a warning to stderr
 * At 90%:  log a warning to stderr (WebSocket push would be added by server layer)
 * At 100%: log an error to stderr
 */
function emitBudgetAlert(budget, alert) {
    const pct = (alert.threshold * 100).toFixed(0);
    const proj = basename(budget.project);
    const spent = `$${budget.spent_usd.toFixed(2)}`;
    const total = `$${budget.total_usd.toFixed(2)}`;
    if (alert.threshold >= 1.0) {
        console.error(`[Budget] HARD STOP: Project "${proj}" has exceeded its budget. ` +
            `Spent ${spent} of ${total}. Further API executions are blocked.`);
    }
    else if (alert.threshold >= 0.90) {
        console.warn(`[Budget] WARNING: Project "${proj}" is at ${pct}% of budget. ` +
            `Spent ${spent} of ${total}. Approaching hard cap.`);
    }
    else {
        console.warn(`[Budget] NOTICE: Project "${proj}" has used ${pct}% of its budget. ` +
            `Spent ${spent} of ${total}.`);
    }
}
// ---------------------------------------------------------------------------
// Guard helper — for use in ApiAgent integration
// ---------------------------------------------------------------------------
/**
 * Convenience guard: throw an error when the project budget is fully exhausted.
 * Call this at the start of each API execution to enforce the hard stop.
 *
 * @param projectPath  Absolute path to the project root
 * @throws Error when the budget has been exceeded
 */
export function assertBudgetAvailable(projectPath) {
    const check = checkBudget(projectPath);
    if (check.exceeded) {
        throw new Error(`Budget exceeded for project "${basename(projectPath)}". ` +
            `Remaining: $${check.remaining.toFixed(2)}. ` +
            `All API executions are blocked until the budget is increased.`);
    }
}
//# sourceMappingURL=budget.js.map