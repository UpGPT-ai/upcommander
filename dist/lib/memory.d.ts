/**
 * Claude Commander — Agent Memory System (Tier 1: local files)
 *
 * Manages core facts, session history, learnings, and failures across
 * three scopes: global, domain, and project.
 *
 * Storage root: ~/.claude-commander/memory/
 */
export interface CoreFact {
    id: string;
    fact: string;
    domain: string;
    project?: string;
    source: string;
    created: string;
    updated: string;
}
export interface SessionRecord {
    id: string;
    worker: string;
    project: string;
    task: string;
    exchanges: Array<{
        role: 'user' | 'assistant';
        content: string;
        timestamp: string;
    }>;
    created: string;
}
export interface Learning {
    id: string;
    title: string;
    content: string;
    domain: string;
    tags: string[];
    source: {
        project: string;
        worker: string;
        task: string;
    };
    created: string;
}
export interface Failure {
    id: string;
    title: string;
    description: string;
    rootCause: string;
    resolution: string;
    domain: string;
    source: {
        project: string;
        worker: string;
        task: string;
    };
    created: string;
}
/**
 * Creates the full memory directory structure under ~/.claude-commander/memory/
 * if it does not already exist.
 */
export declare function initMemory(): void;
export declare function saveFact(fact: Omit<CoreFact, 'id' | 'created' | 'updated'>): CoreFact;
export declare function getFacts(domain?: string, project?: string): CoreFact[];
export declare function saveSessionRecord(record: Omit<SessionRecord, 'id' | 'created'>): void;
export declare function getRecentSessions(domain: string, limit?: number): SessionRecord[];
export declare function saveLearning(learning: Omit<Learning, 'id' | 'created'>): Learning;
export declare function getLearnings(domain?: string, query?: string): Learning[];
export declare function saveFailure(failure: Omit<Failure, 'id' | 'created'>): Failure;
export declare function getFailures(domain?: string): Failure[];
/**
 * When session_history has >30 files, reads the 10 oldest records, condenses
 * them into a rolling summary paragraph, saves it to summaries/, and deletes
 * the original files.
 */
export declare function compactHistory(domain: string): void;
/**
 * Returns the content of the most recent rolling summary file for a domain.
 */
export declare function getRollingSummary(domain: string): string;
//# sourceMappingURL=memory.d.ts.map