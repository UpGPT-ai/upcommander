/**
 * Abstract memory backend — provides a unified interface for fact/learning/session
 * storage, allowing future migration from local filesystem to cloud (Supabase).
 *
 * Local backend: delegates to filesystem operations within ~/.claude-commander/memory/
 * Cloud backend: placeholder — configure supabase_url + supabase_key in config.json
 */
export interface CoreFact {
    id: string;
    domain: string;
    project?: string;
    key: string;
    value: string;
    created: string;
    updated: string;
}
export interface Learning {
    id: string;
    domain: string;
    content: string;
    tags: string[];
    created: string;
}
export interface SessionRecord {
    id: string;
    domain: string;
    summary: string;
    context: string;
    created: string;
}
export interface MemoryBackend {
    type: 'local' | 'cloud';
    saveFact(fact: CoreFact): Promise<void>;
    getFacts(domain?: string, project?: string): Promise<CoreFact[]>;
    saveLearning(learning: Learning): Promise<void>;
    searchLearnings(query: string, domain?: string, limit?: number): Promise<Learning[]>;
    saveSession(record: SessionRecord): Promise<void>;
    getRecentSessions(domain: string, limit?: number): Promise<SessionRecord[]>;
}
export declare class LocalMemoryBackend implements MemoryBackend {
    type: "local";
    saveFact(fact: CoreFact): Promise<void>;
    getFacts(domain?: string, project?: string): Promise<CoreFact[]>;
    saveLearning(learning: Learning): Promise<void>;
    searchLearnings(query: string, domain?: string, limit?: number): Promise<Learning[]>;
    saveSession(record: SessionRecord): Promise<void>;
    getRecentSessions(domain: string, limit?: number): Promise<SessionRecord[]>;
}
/**
 * Cloud backend configuration (read from ~/.claude-commander/config.json).
 * Add these fields to the config when ready to enable cloud storage:
 *
 *   {
 *     "memory_backend": "cloud",
 *     "supabase_url": "https://your-project.supabase.co",
 *     "supabase_key": "your-anon-or-service-role-key",
 *     "embedding_model": "text-embedding-3-small"
 *   }
 */
export declare class CloudMemoryBackend implements MemoryBackend {
    type: "cloud";
    constructor();
    saveFact(_fact: CoreFact): Promise<void>;
    getFacts(_domain?: string, _project?: string): Promise<CoreFact[]>;
    saveLearning(_learning: Learning): Promise<void>;
    searchLearnings(_query: string, _domain?: string, _limit?: number): Promise<Learning[]>;
    saveSession(_record: SessionRecord): Promise<void>;
    getRecentSessions(_domain: string, _limit?: number): Promise<SessionRecord[]>;
}
/**
 * Create the appropriate memory backend based on ~/.claude-commander/config.json.
 * Defaults to 'local' if memory_backend is not set or config cannot be read.
 */
export declare function createMemoryBackend(): MemoryBackend;
/** Create a new CoreFact with generated id and timestamps. */
export declare function makeFact(domain: string, key: string, value: string, project?: string): CoreFact;
/** Create a new Learning with a generated id. */
export declare function makeLearning(domain: string, content: string, tags?: string[]): Learning;
/** Create a new SessionRecord with a generated id. */
export declare function makeSessionRecord(domain: string, summary: string, context: string): SessionRecord;
//# sourceMappingURL=memory-backend.d.ts.map