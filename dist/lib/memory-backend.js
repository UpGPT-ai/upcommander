/**
 * Abstract memory backend — provides a unified interface for fact/learning/session
 * storage, allowing future migration from local filesystem to cloud (Supabase).
 *
 * Local backend: delegates to filesystem operations within ~/.claude-commander/memory/
 * Cloud backend: placeholder — configure supabase_url + supabase_key in config.json
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { loadConfig } from './config.js';
// ---------------------------------------------------------------------------
// Local backend — filesystem implementation
// ---------------------------------------------------------------------------
const MEMORY_BASE = join(homedir(), '.claude-commander', 'memory');
function ensureMemoryDir(subdir) {
    const dir = join(MEMORY_BASE, subdir);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    return dir;
}
function readJsonDir(dir) {
    if (!existsSync(dir))
        return [];
    const results = [];
    for (const file of readdirSync(dir)) {
        if (!file.endsWith('.json'))
            continue;
        try {
            results.push(JSON.parse(readFileSync(join(dir, file), 'utf8')));
        }
        catch {
            // Skip malformed files
        }
    }
    return results;
}
export class LocalMemoryBackend {
    type = 'local';
    async saveFact(fact) {
        const dir = ensureMemoryDir('facts');
        // Use a deterministic filename based on domain + key so updates overwrite
        const safeKey = `${fact.domain}_${fact.key}`.replace(/[^a-zA-Z0-9_-]/g, '_');
        writeFileSync(join(dir, `${safeKey}.json`), JSON.stringify(fact, null, 2), { mode: 0o600 });
    }
    async getFacts(domain, project) {
        const dir = join(MEMORY_BASE, 'facts');
        const all = readJsonDir(dir);
        return all.filter((f) => (!domain || f.domain === domain) &&
            (!project || f.project === project));
    }
    async saveLearning(learning) {
        const dir = ensureMemoryDir('learnings');
        writeFileSync(join(dir, `${learning.id}.json`), JSON.stringify(learning, null, 2), { mode: 0o600 });
    }
    async searchLearnings(query, domain, limit = 10) {
        const dir = join(MEMORY_BASE, 'learnings');
        const all = readJsonDir(dir);
        const lower = query.toLowerCase();
        const filtered = all.filter((l) => (!domain || l.domain === domain) &&
            (l.content.toLowerCase().includes(lower) ||
                l.tags.some((t) => t.toLowerCase().includes(lower))));
        return filtered.slice(0, limit);
    }
    async saveSession(record) {
        const dir = ensureMemoryDir('sessions');
        writeFileSync(join(dir, `${record.id}.json`), JSON.stringify(record, null, 2), { mode: 0o600 });
    }
    async getRecentSessions(domain, limit = 5) {
        const dir = join(MEMORY_BASE, 'sessions');
        const all = readJsonDir(dir);
        return all
            .filter((s) => s.domain === domain)
            .sort((a, b) => b.created.localeCompare(a.created))
            .slice(0, limit);
    }
}
// ---------------------------------------------------------------------------
// Cloud backend — placeholder for future Supabase migration
// ---------------------------------------------------------------------------
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
export class CloudMemoryBackend {
    type = 'cloud';
    // TODO: initialise Supabase client here when migration is ready
    // private supabase: SupabaseClient;
    constructor() {
        // TODO: read supabase_url, supabase_key, embedding_model from config
        // and create a Supabase client instance.
    }
    async saveFact(_fact) {
        throw new Error('Cloud backend not configured');
        // TODO: upsert into `memory_facts` table keyed on (domain, key)
    }
    async getFacts(_domain, _project) {
        throw new Error('Cloud backend not configured');
        // TODO: SELECT * FROM memory_facts WHERE domain = $1 AND project = $2
    }
    async saveLearning(_learning) {
        throw new Error('Cloud backend not configured');
        // TODO: embed content with embedding_model, INSERT into memory_learnings
    }
    async searchLearnings(_query, _domain, _limit) {
        throw new Error('Cloud backend not configured');
        // TODO: embed query, run pgvector similarity search on memory_learnings
    }
    async saveSession(_record) {
        throw new Error('Cloud backend not configured');
        // TODO: INSERT into memory_sessions
    }
    async getRecentSessions(_domain, _limit) {
        throw new Error('Cloud backend not configured');
        // TODO: SELECT * FROM memory_sessions WHERE domain = $1 ORDER BY created DESC LIMIT $2
    }
}
// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
/**
 * Create the appropriate memory backend based on ~/.claude-commander/config.json.
 * Defaults to 'local' if memory_backend is not set or config cannot be read.
 */
export function createMemoryBackend() {
    let backendType = 'local';
    try {
        // loadConfig returns CommanderConfig; cast to access extended fields
        const config = loadConfig();
        if (typeof config['memory_backend'] === 'string') {
            backendType = config['memory_backend'];
        }
    }
    catch {
        // Use local on any config read failure
    }
    if (backendType === 'cloud') {
        return new CloudMemoryBackend();
    }
    return new LocalMemoryBackend();
}
// ---------------------------------------------------------------------------
// Convenience helpers for callers that don't want to instantiate directly
// ---------------------------------------------------------------------------
/** Create a new CoreFact with generated id and timestamps. */
export function makeFact(domain, key, value, project) {
    const now = new Date().toISOString();
    return { id: randomUUID(), domain, project, key, value, created: now, updated: now };
}
/** Create a new Learning with a generated id. */
export function makeLearning(domain, content, tags = []) {
    return { id: randomUUID(), domain, content, tags, created: new Date().toISOString() };
}
/** Create a new SessionRecord with a generated id. */
export function makeSessionRecord(domain, summary, context) {
    return { id: randomUUID(), domain, summary, context, created: new Date().toISOString() };
}
//# sourceMappingURL=memory-backend.js.map