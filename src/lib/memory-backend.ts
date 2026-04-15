/**
 * Abstract memory backend — provides a unified interface for fact/learning/session
 * storage, allowing future migration from local filesystem to cloud (Supabase).
 *
 * Local backend: delegates to filesystem operations within ~/.claude-commander/memory/
 * Cloud backend: placeholder — configure supabase_url + supabase_key in config.json
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { loadConfig } from './config.js';

// ---------------------------------------------------------------------------
// Domain types
// (Inline — define shared types module when memory.ts is introduced)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Backend interface
// ---------------------------------------------------------------------------

export interface MemoryBackend {
  type: 'local' | 'cloud';

  // Fact operations
  saveFact(fact: CoreFact): Promise<void>;
  getFacts(domain?: string, project?: string): Promise<CoreFact[]>;

  // Learning operations
  saveLearning(learning: Learning): Promise<void>;
  searchLearnings(query: string, domain?: string, limit?: number): Promise<Learning[]>;

  // Session operations
  saveSession(record: SessionRecord): Promise<void>;
  getRecentSessions(domain: string, limit?: number): Promise<SessionRecord[]>;
}

// ---------------------------------------------------------------------------
// Local backend — filesystem implementation
// ---------------------------------------------------------------------------

const MEMORY_BASE = join(homedir(), '.claude-commander', 'memory');

function ensureMemoryDir(subdir: string): string {
  const dir = join(MEMORY_BASE, subdir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  return dir;
}

function readJsonDir<T>(dir: string): T[] {
  if (!existsSync(dir)) return [];
  const results: T[] = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    try {
      results.push(JSON.parse(readFileSync(join(dir, file), 'utf8')) as T);
    } catch {
      // Skip malformed files
    }
  }
  return results;
}

export class LocalMemoryBackend implements MemoryBackend {
  type = 'local' as const;

  async saveFact(fact: CoreFact): Promise<void> {
    const dir = ensureMemoryDir('facts');
    // Use a deterministic filename based on domain + key so updates overwrite
    const safeKey = `${fact.domain}_${fact.key}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    writeFileSync(
      join(dir, `${safeKey}.json`),
      JSON.stringify(fact, null, 2),
      { mode: 0o600 }
    );
  }

  async getFacts(domain?: string, project?: string): Promise<CoreFact[]> {
    const dir = join(MEMORY_BASE, 'facts');
    const all = readJsonDir<CoreFact>(dir);
    return all.filter(
      (f) =>
        (!domain || f.domain === domain) &&
        (!project || f.project === project)
    );
  }

  async saveLearning(learning: Learning): Promise<void> {
    const dir = ensureMemoryDir('learnings');
    writeFileSync(
      join(dir, `${learning.id}.json`),
      JSON.stringify(learning, null, 2),
      { mode: 0o600 }
    );
  }

  async searchLearnings(
    query: string,
    domain?: string,
    limit = 10
  ): Promise<Learning[]> {
    const dir = join(MEMORY_BASE, 'learnings');
    const all = readJsonDir<Learning>(dir);

    const lower = query.toLowerCase();
    const filtered = all.filter(
      (l) =>
        (!domain || l.domain === domain) &&
        (l.content.toLowerCase().includes(lower) ||
          l.tags.some((t) => t.toLowerCase().includes(lower)))
    );

    return filtered.slice(0, limit);
  }

  async saveSession(record: SessionRecord): Promise<void> {
    const dir = ensureMemoryDir('sessions');
    writeFileSync(
      join(dir, `${record.id}.json`),
      JSON.stringify(record, null, 2),
      { mode: 0o600 }
    );
  }

  async getRecentSessions(domain: string, limit = 5): Promise<SessionRecord[]> {
    const dir = join(MEMORY_BASE, 'sessions');
    const all = readJsonDir<SessionRecord>(dir);

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
export class CloudMemoryBackend implements MemoryBackend {
  type = 'cloud' as const;

  // TODO: initialise Supabase client here when migration is ready
  // private supabase: SupabaseClient;

  constructor() {
    // TODO: read supabase_url, supabase_key, embedding_model from config
    // and create a Supabase client instance.
  }

  async saveFact(_fact: CoreFact): Promise<void> {
    throw new Error('Cloud backend not configured');
    // TODO: upsert into `memory_facts` table keyed on (domain, key)
  }

  async getFacts(_domain?: string, _project?: string): Promise<CoreFact[]> {
    throw new Error('Cloud backend not configured');
    // TODO: SELECT * FROM memory_facts WHERE domain = $1 AND project = $2
  }

  async saveLearning(_learning: Learning): Promise<void> {
    throw new Error('Cloud backend not configured');
    // TODO: embed content with embedding_model, INSERT into memory_learnings
  }

  async searchLearnings(
    _query: string,
    _domain?: string,
    _limit?: number
  ): Promise<Learning[]> {
    throw new Error('Cloud backend not configured');
    // TODO: embed query, run pgvector similarity search on memory_learnings
  }

  async saveSession(_record: SessionRecord): Promise<void> {
    throw new Error('Cloud backend not configured');
    // TODO: INSERT into memory_sessions
  }

  async getRecentSessions(_domain: string, _limit?: number): Promise<SessionRecord[]> {
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
export function createMemoryBackend(): MemoryBackend {
  let backendType: string = 'local';

  try {
    // loadConfig returns CommanderConfig; cast to access extended fields
    const config = loadConfig() as unknown as Record<string, unknown>;
    if (typeof config['memory_backend'] === 'string') {
      backendType = config['memory_backend'];
    }
  } catch {
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
export function makeFact(
  domain: string,
  key: string,
  value: string,
  project?: string
): CoreFact {
  const now = new Date().toISOString();
  return { id: randomUUID(), domain, project, key, value, created: now, updated: now };
}

/** Create a new Learning with a generated id. */
export function makeLearning(
  domain: string,
  content: string,
  tags: string[] = []
): Learning {
  return { id: randomUUID(), domain, content, tags, created: new Date().toISOString() };
}

/** Create a new SessionRecord with a generated id. */
export function makeSessionRecord(
  domain: string,
  summary: string,
  context: string
): SessionRecord {
  return { id: randomUUID(), domain, summary, context, created: new Date().toISOString() };
}
