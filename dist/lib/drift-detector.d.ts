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
export interface DriftAlert {
    id: string;
    type: 'task_decomposition_drift' | 'quality_regression' | 'cost_spike';
    target: string;
    description: string;
    severity: 'info' | 'warning' | 'critical';
    baseline: string;
    current: string;
    created: string;
    acknowledged: boolean;
}
/**
 * Detect task decomposition drift by comparing recent TASK.md files against
 * a baseline template structure. If structural similarity drops below 0.5,
 * an alert is raised.
 */
export declare function detectTaskDecompositionDrift(projectPath: string): DriftAlert | null;
/**
 * Detect quality regression for a worker.
 * If the latest quality_score has dropped >1 point from the 30-day average, raise alert.
 */
export declare function detectQualityDrift(workerName: string): DriftAlert | null;
/**
 * Detect cost spikes for a project.
 * If the current avg_cost_per_task has increased >50% from baseline, raise alert.
 */
export declare function detectCostDrift(project: string): DriftAlert | null;
/**
 * Run all drift detectors for a project path and return any alerts raised.
 */
export declare function detectDrift(projectPath: string): DriftAlert[];
/** Return all stored alerts (unacknowledged and acknowledged). */
export declare function getAllAlerts(): DriftAlert[];
/** Mark an alert as acknowledged. */
export declare function acknowledgeAlert(id: string): void;
//# sourceMappingURL=drift-detector.d.ts.map