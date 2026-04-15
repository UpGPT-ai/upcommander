/**
 * Aggregate metrics tracking — per-project agent counts and system-wide stats.
 */
export interface ProjectMetrics {
    project: string;
    agentsRunning: number;
    agentsComplete: number;
    agentsBlocked: number;
    agentsWaiting: number;
    totalTasks: number;
    filesProduced: string[];
    startedAt: string;
    elapsedMinutes: number;
}
export interface SystemMetrics {
    totalSessions: number;
    totalWindows: number;
    projects: ProjectMetrics[];
    uptime: number;
}
/**
 * Build per-project metrics by reading all STATUS.json files under
 * .claude-coord/workers/ and the orchestrator status.
 */
export declare function getProjectMetrics(projectPath: string, projectName: string): ProjectMetrics;
/**
 * Build system-wide metrics across all configured project paths.
 * projectPaths is a map of projectName → projectPath (or just an array
 * of paths, in which case the basename is used as the project name).
 */
export declare function getSystemMetrics(projectPaths: Record<string, string> | string[]): SystemMetrics;
//# sourceMappingURL=metrics.d.ts.map