/**
 * Claude Commander — Memory Context Assembly (Progressive Disclosure)
 *
 * Assembles context payloads for agents at three disclosure levels:
 *   Level 0: Always injected — core facts + task (<500 tokens)
 *   Level 1: Loaded on task start — rolling summary + matched learnings (<2000 tokens)
 *   Level 2: On demand — full session history + extended search + failures
 */
export interface AgentContext {
    /** Always loaded (<500 tokens): core facts + task */
    level0: string;
    /** Loaded on task start (<2000 tokens): rolling summary + relevant learnings */
    level1: string;
    /** On demand: full history + extended search + failures */
    level2: string;
}
/**
 * Assembles a three-tier AgentContext for injection into agent prompts.
 *
 * @param domain   - Memory domain (e.g. "software-dev")
 * @param project  - Project name for project-scoped facts
 * @param taskContent - The task description (used for keyword extraction)
 */
export declare function assembleContext(domain: string, project: string, taskContent: string): AgentContext;
/**
 * Grep-style search across all learnings and facts for a query string.
 * Returns formatted excerpts up to `limit` results (default 5).
 *
 * This function is intended to be exposed as a tool call for agents.
 */
export declare function recallMemory(query: string, domain?: string, limit?: number): string;
//# sourceMappingURL=memory-context.d.ts.map