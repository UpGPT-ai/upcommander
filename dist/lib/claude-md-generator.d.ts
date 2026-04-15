/**
 * Centralized CLAUDE.md generation for different agent roles.
 *
 * Generates role-specific CLAUDE.md files that wire each agent into
 * the .claude-coord/ coordination protocol used by Claude Commander.
 */
/**
 * Generate the CLAUDE.md for the meta-orchestrator — the top-level
 * CEO agent that spans all projects.
 */
export declare function generateMetaOrchestratorMd(): string;
/**
 * Generate the CLAUDE.md for a project-level orchestrator.
 *
 * @param projectName - The project name (matches tmux session name)
 * @param workers     - List of worker names in this session (excluding orchestrator)
 */
export declare function generateProjectOrchestratorMd(projectName: string, workers: string[]): string;
/**
 * Generate the CLAUDE.md for a domain worker.
 *
 * @param projectName - The project name (matches tmux session name)
 * @param workerName  - This worker's name (matches tmux window name)
 * @param role        - One-line description of this worker's role
 * @param domain      - Domain category (e.g. "dev", "research", "book")
 * @param modelInfo   - Optional model assignment info for display
 */
export declare function generateWorkerMd(projectName: string, workerName: string, role: string, domain: string, modelInfo?: string): string;
//# sourceMappingURL=claude-md-generator.d.ts.map