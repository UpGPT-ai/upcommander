/**
 * Drift detector — monitors agent behaviour against established baselines and
 * raises alerts when significant deviations are detected.
 *
 * Alert types:
 *   - task_decomposition_drift: TASK.md structure differs from template norms
 *   - quality_regression: rolling quality score has dropped significantly
 *   - cost_spike: cost per task has increased >50% from baseline
 *
 * Alerts are stored in ~/.claude-commander/alerts/
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const BASE_DIR = join(homedir(), '.claude-commander');
const ALERTS_DIR = join(BASE_DIR, 'alerts');
const METRICS_DIR = join(BASE_DIR, 'metrics');
function ensureAlertsDir() {
    if (!existsSync(ALERTS_DIR)) {
        mkdirSync(ALERTS_DIR, { recursive: true, mode: 0o700 });
    }
}
// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
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
function saveAlert(alert) {
    ensureAlertsDir();
    writeFileSync(join(ALERTS_DIR, `${alert.id}.json`), JSON.stringify(alert, null, 2), { mode: 0o600 });
}
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
/**
 * Simple structural similarity check for TASK.md content.
 * Returns a score from 0 (completely different) to 1 (identical structure).
 */
function computeStructureSimilarity(a, b) {
    // Extract markdown headings as a structural fingerprint
    const headings = (text) => text
        .split('\n')
        .filter((l) => l.startsWith('#'))
        .map((l) => l.replace(/^#+\s+/, '').toLowerCase());
    const ha = headings(a);
    const hb = headings(b);
    if (ha.length === 0 && hb.length === 0)
        return 1;
    if (ha.length === 0 || hb.length === 0)
        return 0;
    const setA = new Set(ha);
    const setB = new Set(hb);
    const intersection = [...setA].filter((h) => setB.has(h)).length;
    const union = new Set([...ha, ...hb]).size;
    return union === 0 ? 1 : intersection / union;
}
// ---------------------------------------------------------------------------
// Individual detectors
// ---------------------------------------------------------------------------
/**
 * Detect task decomposition drift by comparing recent TASK.md files against
 * a baseline template structure. If structural similarity drops below 0.5,
 * an alert is raised.
 */
export function detectTaskDecompositionDrift(projectPath) {
    const coordDir = join(projectPath, '.claude-coord');
    if (!existsSync(coordDir))
        return null;
    // Look for TASK.md files in the coordination directory
    const taskFiles = [];
    try {
        for (const entry of readdirSync(coordDir, { recursive: true })) {
            const name = typeof entry === 'string' ? entry : entry.toString();
            if (name.endsWith('TASK.md')) {
                taskFiles.push(join(coordDir, name));
            }
        }
    }
    catch {
        return null;
    }
    if (taskFiles.length < 2)
        return null;
    // Use the oldest TASK.md as the baseline and the newest as current
    const sorted = taskFiles
        .map((f) => ({ path: f, mtime: (() => { try {
            return readFileSync(f);
        }
        catch {
            return Buffer.alloc(0);
        } })() }))
        .sort((a, b) => a.path.localeCompare(b.path));
    let baselineContent = '';
    let currentContent = '';
    try {
        baselineContent = readFileSync(sorted[0].path, 'utf8');
        currentContent = readFileSync(sorted[sorted.length - 1].path, 'utf8');
    }
    catch {
        return null;
    }
    if (!baselineContent || !currentContent || baselineContent === currentContent) {
        return null;
    }
    const similarity = computeStructureSimilarity(baselineContent, currentContent);
    if (similarity >= 0.5)
        return null;
    const alert = {
        id: randomUUID(),
        type: 'task_decomposition_drift',
        target: projectPath,
        description: `TASK.md structure similarity has dropped to ${(similarity * 100).toFixed(0)}% ` +
            `compared to the baseline template (threshold: 50%).`,
        severity: similarity < 0.25 ? 'critical' : 'warning',
        baseline: `Structural similarity: 100% (baseline TASK.md)`,
        current: `Structural similarity: ${(similarity * 100).toFixed(0)}%`,
        created: new Date().toISOString(),
        acknowledged: false,
    };
    saveAlert(alert);
    return alert;
}
/**
 * Detect quality regression for a worker.
 * If the latest quality_score has dropped >1 point from the 30-day average, raise alert.
 */
export function detectQualityDrift(workerName) {
    const all = readWorkerPerformance();
    const metrics = all.find((m) => m.worker_name === workerName);
    if (!metrics || !metrics.history || metrics.history.length < 3)
        return null;
    const now = Date.now();
    const thirtyDaysMs = 30 * 86_400_000;
    const recent = metrics.history.filter((h) => now - new Date(h.date).getTime() <= thirtyDaysMs);
    if (recent.length === 0)
        return null;
    const avg = recent.reduce((sum, h) => sum + h.quality_score, 0) / recent.length;
    const current = metrics.quality_score;
    const drop = avg - current;
    if (drop <= 1.0)
        return null;
    const severity = drop > 2.5 ? 'critical' : drop > 1.5 ? 'warning' : 'info';
    const alert = {
        id: randomUUID(),
        type: 'quality_regression',
        target: workerName,
        description: `Worker "${workerName}" quality score has dropped ${drop.toFixed(2)} points ` +
            `from the 30-day average (threshold: 1.0 point drop).`,
        severity,
        baseline: `30-day average quality: ${avg.toFixed(2)}`,
        current: `Current quality score: ${current.toFixed(2)}`,
        created: new Date().toISOString(),
        acknowledged: false,
    };
    saveAlert(alert);
    return alert;
}
/**
 * Detect cost spikes for a project.
 * If the current avg_cost_per_task has increased >50% from baseline, raise alert.
 */
export function detectCostDrift(project) {
    const all = readWorkerPerformance();
    // Find metrics relevant to this project (worker names that include the project)
    const relevant = all.filter((m) => m.worker_name.startsWith(project) || m.avg_cost_per_task !== undefined);
    if (relevant.length === 0)
        return null;
    for (const metrics of relevant) {
        if (!metrics.history || metrics.history.length < 3)
            continue;
        if (metrics.avg_cost_per_task === undefined)
            continue;
        const baselineEntries = metrics.history.slice(0, Math.floor(metrics.history.length / 2));
        if (baselineEntries.length === 0)
            continue;
        const baselineAvg = baselineEntries.reduce((sum, h) => sum + (h.cost ?? 0), 0) /
            baselineEntries.length;
        if (baselineAvg === 0)
            continue;
        const increase = (metrics.avg_cost_per_task - baselineAvg) / baselineAvg;
        if (increase <= 0.5)
            continue;
        const severity = increase > 1.0 ? 'critical' : 'warning';
        const alert = {
            id: randomUUID(),
            type: 'cost_spike',
            target: project,
            description: `Cost per task for "${metrics.worker_name}" has increased ` +
                `${(increase * 100).toFixed(0)}% from baseline (threshold: 50%).`,
            severity,
            baseline: `Baseline avg cost: $${baselineAvg.toFixed(4)}`,
            current: `Current avg cost: $${metrics.avg_cost_per_task.toFixed(4)}`,
            created: new Date().toISOString(),
            acknowledged: false,
        };
        saveAlert(alert);
        return alert; // Return first spike found
    }
    return null;
}
// ---------------------------------------------------------------------------
// Public composite API
// ---------------------------------------------------------------------------
/**
 * Run all drift detectors for a project path and return any alerts raised.
 */
export function detectDrift(projectPath) {
    const alerts = [];
    const decomp = detectTaskDecompositionDrift(projectPath);
    if (decomp)
        alerts.push(decomp);
    return alerts;
}
/** Return all stored alerts (unacknowledged and acknowledged). */
export function getAllAlerts() {
    return readJsonDir(ALERTS_DIR);
}
/** Mark an alert as acknowledged. */
export function acknowledgeAlert(id) {
    ensureAlertsDir();
    const file = join(ALERTS_DIR, `${id}.json`);
    if (!existsSync(file)) {
        throw new Error(`Alert not found: ${id}`);
    }
    const alert = JSON.parse(readFileSync(file, 'utf8'));
    alert.acknowledged = true;
    writeFileSync(file, JSON.stringify(alert, null, 2), { mode: 0o600 });
}
//# sourceMappingURL=drift-detector.js.map