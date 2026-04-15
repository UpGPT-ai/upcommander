/**
 * Claude Commander — Worker & Template Performance Tracking
 *
 * Tracks per-worker and per-template performance metrics plus cost data.
 * All data persists in ~/.claude-commander/metrics/.
 */
export interface WorkerPerformance {
    tasks_completed: number;
    avg_completion_minutes: number;
    rejection_rate: number;
    cost_per_task_usd: number;
    quality_score: number;
    last_updated: string;
    model?: {
        provider: string;
        model: string;
    };
    model_stats?: {
        avg_tokens_per_task: number;
        avg_cost_per_task_usd: number;
        quality_by_model: Record<string, number>;
    };
}
export interface TemplatePerformance {
    avg_quality: number;
    avg_time_minutes: number;
    uses: number;
    last_used: string;
}
export declare function loadWorkerPerformance(): Record<string, WorkerPerformance>;
export declare function updateWorkerPerformance(workerName: string, update: Partial<WorkerPerformance>): void;
/**
 * Record a completed task for a worker.
 * Increments tasks_completed, recalculates running averages for time
 * and quality, and updates rejection_rate.
 */
export declare function recordTaskCompletion(workerName: string, durationMinutes: number, rejected: boolean, qualityScore?: number): void;
export declare function loadTemplatePerformance(): Record<string, TemplatePerformance>;
export declare function recordTemplateUse(templateName: string, qualityScore: number, durationMinutes: number): void;
export interface CostEntry {
    total_usd: number;
    by_project: Record<string, number>;
}
export declare function getCostTracking(): Record<string, CostEntry>;
export declare function recordCost(project: string, worker: string, costUsd: number): void;
//# sourceMappingURL=performance.d.ts.map