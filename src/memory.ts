/**
 * Claude Commander — Agent Memory System (Tier 1: local files)
 *
 * Manages core facts, session history, learnings, and failures across
 * three scopes: global, domain, and project.
 *
 * Storage root: ~/.claude-commander/memory/
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CoreFact {
  id: string;
  fact: string;
  domain: string; // e.g. "software-dev", "research", "marketing"
  project?: string;
  source: string; // which session/task produced this
  created: string;
  updated: string;
}

export interface SessionRecord {
  id: string;
  worker: string;
  project: string;
  task: string;
  exchanges: Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>;
  created: string;
}

export interface Learning {
  id: string;
  title: string;
  content: string;
  domain: string;
  tags: string[];
  source: { project: string; worker: string; task: string };
  created: string;
}

export interface Failure {
  id: string;
  title: string;
  description: string;
  rootCause: string;
  resolution: string;
  domain: string;
  source: { project: string; worker: string; task: string };
  created: string;
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const MEMORY_ROOT = join(homedir(), '.claude-commander', 'memory');

const DOMAINS = ['software-dev', 'research', 'marketing', 'book-writing'] as const;

function domainDir(domain: string): string {
  return join(MEMORY_ROOT, 'domains', domain);
}

function projectDir(project: string): string {
  return join(MEMORY_ROOT, 'projects', project);
}

function globalDir(): string {
  return join(MEMORY_ROOT, 'global');
}

// ---------------------------------------------------------------------------
// a) initMemory
// ---------------------------------------------------------------------------

/**
 * Creates the full memory directory structure under ~/.claude-commander/memory/
 * if it does not already exist.
 */
export function initMemory(): void {
  // Domain directories
  for (const domain of DOMAINS) {
    const base = domainDir(domain);
    mkdirSync(join(base, 'session_history'), { recursive: true });
    mkdirSync(join(base, 'summaries'), { recursive: true });
    mkdirSync(join(base, 'learnings'), { recursive: true });
    mkdirSync(join(base, 'failures'), { recursive: true });
  }

  // Projects root
  mkdirSync(join(MEMORY_ROOT, 'projects'), { recursive: true });

  // Global directory
  const global = globalDir();
  mkdirSync(global, { recursive: true });

  // Seed global files if missing
  const globalFacts = join(global, 'core_facts.json');
  if (!existsSync(globalFacts)) {
    writeFileSync(globalFacts, JSON.stringify([], null, 2));
  }
  const globalPrefs = join(global, 'preferences.json');
  if (!existsSync(globalPrefs)) {
    writeFileSync(globalPrefs, JSON.stringify({}, null, 2));
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readJsonArray<T>(filePath: string): T[] {
  if (!existsSync(filePath)) return [];
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as T[];
  } catch {
    return [];
  }
}

function writeJson(filePath: string, data: unknown): void {
  const lastSlash = filePath.lastIndexOf('/');
  const dir = lastSlash > 0 ? filePath.substring(0, lastSlash) : '.';
  mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, JSON.stringify(data, null, 2), { encoding: 'utf8' });
}

function factsPath(domain?: string, project?: string): string {
  if (project) return join(projectDir(project), 'core_facts.json');
  if (domain) return join(domainDir(domain), 'core_facts.json');
  return join(globalDir(), 'core_facts.json');
}

function sessionHistoryDir(domain: string, project?: string): string {
  if (project) return join(projectDir(project), 'session_history');
  return join(domainDir(domain), 'session_history');
}

function summariesDir(domain: string): string {
  return join(domainDir(domain), 'summaries');
}

/** Simple similarity check — true if two fact strings share ≥80% of their words */
function isSimilarFact(a: string, b: string): boolean {
  const wordsA = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const wordsB = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  if (wordsA.size === 0 || wordsB.size === 0) return false;
  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }
  const similarity = overlap / Math.max(wordsA.size, wordsB.size);
  return similarity >= 0.8;
}

// ---------------------------------------------------------------------------
// b) saveFact
// ---------------------------------------------------------------------------

export function saveFact(
  fact: Omit<CoreFact, 'id' | 'created' | 'updated'>
): CoreFact {
  initMemory();

  const filePath = factsPath(fact.domain, fact.project);
  const facts = readJsonArray<CoreFact>(filePath);

  const now = new Date().toISOString();

  // Deduplication: update if similar fact already exists
  const existing = facts.find((f) => isSimilarFact(f.fact, fact.fact));
  if (existing) {
    existing.fact = fact.fact;
    existing.source = fact.source;
    existing.updated = now;
    writeJson(filePath, facts);
    return existing;
  }

  const newFact: CoreFact = {
    id: crypto.randomUUID(),
    ...fact,
    created: now,
    updated: now,
  };

  facts.push(newFact);
  writeJson(filePath, facts);
  return newFact;
}

// ---------------------------------------------------------------------------
// c) getFacts
// ---------------------------------------------------------------------------

export function getFacts(domain?: string, project?: string): CoreFact[] {
  initMemory();
  const filePath = factsPath(domain, project);
  return readJsonArray<CoreFact>(filePath);
}

// ---------------------------------------------------------------------------
// d) saveSessionRecord
// ---------------------------------------------------------------------------

export function saveSessionRecord(
  record: Omit<SessionRecord, 'id' | 'created'>
): void {
  initMemory();

  const id = crypto.randomUUID();
  const created = new Date().toISOString();
  const full: SessionRecord = { id, ...record, created };

  // Store sessions under the domain directory (using project as domain key)
  const dir = sessionHistoryDir(record.project);
  mkdirSync(dir, { recursive: true });

  const filePath = join(dir, `${id}.json`);
  writeJson(filePath, full);

  // Auto-compact if over threshold
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  if (files.length > 30) {
    compactHistory(record.project);
  }
}

// ---------------------------------------------------------------------------
// e) getRecentSessions
// ---------------------------------------------------------------------------

export function getRecentSessions(
  domain: string,
  limit = 5
): SessionRecord[] {
  initMemory();
  const dir = sessionHistoryDir(domain);
  if (!existsSync(dir)) return [];

  // Parse each file and sort by created timestamp descending
  const records: SessionRecord[] = [];
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

  for (const file of files) {
    try {
      const raw = readFileSync(join(dir, file), 'utf8');
      records.push(JSON.parse(raw) as SessionRecord);
    } catch {
      // skip corrupt records
    }
  }

  records.sort((a, b) => b.created.localeCompare(a.created));
  return records.slice(0, limit);
}

// ---------------------------------------------------------------------------
// f) saveLearning
// ---------------------------------------------------------------------------

function learningToMarkdown(learning: Learning): string {
  return [
    '---',
    `id: ${learning.id}`,
    `title: "${learning.title}"`,
    `domain: ${learning.domain}`,
    `tags: [${learning.tags.map((t) => `"${t}"`).join(', ')}]`,
    `source_project: "${learning.source.project}"`,
    `source_worker: "${learning.source.worker}"`,
    `source_task: "${learning.source.task}"`,
    `created: ${learning.created}`,
    '---',
    '',
    `# ${learning.title}`,
    '',
    learning.content,
  ].join('\n');
}

function parseLearningMarkdown(raw: string, id: string): Learning | null {
  try {
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) return null;
    const fm = fmMatch[1];

    const get = (key: string): string => {
      const m = fm.match(new RegExp(`^${key}:\\s*"?([^"\\n]*)"?`, 'm'));
      return m ? m[1].trim() : '';
    };

    const tagsMatch = fm.match(/^tags:\s*\[(.*)\]/m);
    const tags = tagsMatch
      ? tagsMatch[1].split(',').map((t) => t.trim().replace(/^"|"$/g, '')).filter(Boolean)
      : [];

    const contentMatch = raw.match(/---\n[\s\S]*?---\n\n# [^\n]*\n\n([\s\S]*)/);
    const content = contentMatch ? contentMatch[1].trim() : '';

    return {
      id: get('id') || id,
      title: get('title'),
      content,
      domain: get('domain'),
      tags,
      source: {
        project: get('source_project'),
        worker: get('source_worker'),
        task: get('source_task'),
      },
      created: get('created'),
    };
  } catch {
    return null;
  }
}

export function saveLearning(
  learning: Omit<Learning, 'id' | 'created'>
): Learning {
  initMemory();

  const id = crypto.randomUUID();
  const created = new Date().toISOString();
  const full: Learning = { id, ...learning, created };

  const dir = join(domainDir(learning.domain), 'learnings');
  mkdirSync(dir, { recursive: true });

  const filePath = join(dir, `${id}.md`);
  writeFileSync(filePath, learningToMarkdown(full), 'utf8');

  return full;
}

// ---------------------------------------------------------------------------
// g) getLearnings
// ---------------------------------------------------------------------------

export function getLearnings(domain?: string, query?: string): Learning[] {
  initMemory();

  const dirs: string[] = [];
  if (domain) {
    dirs.push(join(domainDir(domain), 'learnings'));
  } else {
    for (const d of DOMAINS) {
      dirs.push(join(domainDir(d), 'learnings'));
    }
  }

  const learnings: Learning[] = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
    for (const file of files) {
      try {
        const raw = readFileSync(join(dir, file), 'utf8');
        const id = file.replace('.md', '');
        const parsed = parseLearningMarkdown(raw, id);
        if (parsed) learnings.push(parsed);
      } catch {
        // skip
      }
    }
  }

  if (!query) return learnings;

  const q = query.toLowerCase();
  return learnings.filter(
    (l) =>
      l.title.toLowerCase().includes(q) ||
      l.content.toLowerCase().includes(q) ||
      l.tags.some((t) => t.toLowerCase().includes(q))
  );
}

// ---------------------------------------------------------------------------
// h) saveFailure
// ---------------------------------------------------------------------------

function failureToMarkdown(failure: Failure): string {
  return [
    '---',
    `id: ${failure.id}`,
    `title: "${failure.title}"`,
    `domain: ${failure.domain}`,
    `source_project: "${failure.source.project}"`,
    `source_worker: "${failure.source.worker}"`,
    `source_task: "${failure.source.task}"`,
    `created: ${failure.created}`,
    '---',
    '',
    `# ${failure.title}`,
    '',
    '## Description',
    '',
    failure.description,
    '',
    '## Root Cause',
    '',
    failure.rootCause,
    '',
    '## Resolution',
    '',
    failure.resolution,
  ].join('\n');
}

function parseFailureMarkdown(raw: string, id: string): Failure | null {
  try {
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) return null;
    const fm = fmMatch[1];

    const get = (key: string): string => {
      const m = fm.match(new RegExp(`^${key}:\\s*"?([^"\\n]*)"?`, 'm'));
      return m ? m[1].trim() : '';
    };

    const descMatch = raw.match(/## Description\n\n([\s\S]*?)\n\n## Root Cause/);
    const rootCauseMatch = raw.match(/## Root Cause\n\n([\s\S]*?)\n\n## Resolution/);
    const resolutionMatch = raw.match(/## Resolution\n\n([\s\S]*)$/);

    return {
      id: get('id') || id,
      title: get('title'),
      description: descMatch ? descMatch[1].trim() : '',
      rootCause: rootCauseMatch ? rootCauseMatch[1].trim() : '',
      resolution: resolutionMatch ? resolutionMatch[1].trim() : '',
      domain: get('domain'),
      source: {
        project: get('source_project'),
        worker: get('source_worker'),
        task: get('source_task'),
      },
      created: get('created'),
    };
  } catch {
    return null;
  }
}

export function saveFailure(
  failure: Omit<Failure, 'id' | 'created'>
): Failure {
  initMemory();

  const id = crypto.randomUUID();
  const created = new Date().toISOString();
  const full: Failure = { id, ...failure, created };

  const dir = join(domainDir(failure.domain), 'failures');
  mkdirSync(dir, { recursive: true });

  const filePath = join(dir, `${id}.md`);
  writeFileSync(filePath, failureToMarkdown(full), 'utf8');

  return full;
}

// ---------------------------------------------------------------------------
// i) getFailures
// ---------------------------------------------------------------------------

export function getFailures(domain?: string): Failure[] {
  initMemory();

  const dirs: string[] = [];
  if (domain) {
    dirs.push(join(domainDir(domain), 'failures'));
  } else {
    for (const d of DOMAINS) {
      dirs.push(join(domainDir(d), 'failures'));
    }
  }

  const failures: Failure[] = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
    for (const file of files) {
      try {
        const raw = readFileSync(join(dir, file), 'utf8');
        const id = file.replace('.md', '');
        const parsed = parseFailureMarkdown(raw, id);
        if (parsed) failures.push(parsed);
      } catch {
        // skip
      }
    }
  }

  return failures;
}

// ---------------------------------------------------------------------------
// j) compactHistory
// ---------------------------------------------------------------------------

/**
 * When session_history has >30 files, reads the 10 oldest records, condenses
 * them into a rolling summary paragraph, saves it to summaries/, and deletes
 * the original files.
 */
export function compactHistory(domain: string): void {
  initMemory();
  const dir = sessionHistoryDir(domain);
  if (!existsSync(dir)) return;

  type FileEntry = { file: string; created: string; rec: SessionRecord };

  const entries: FileEntry[] = [];
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

  for (const file of files) {
    try {
      const raw = readFileSync(join(dir, file), 'utf8');
      const rec = JSON.parse(raw) as SessionRecord;
      entries.push({ file, created: rec.created ?? '', rec });
    } catch {
      // skip corrupt
    }
  }

  if (entries.length <= 30) return;

  // Sort ascending by created — oldest first
  entries.sort((a, b) => a.created.localeCompare(b.created));
  const oldest = entries.slice(0, 10);

  // Build condensed summary paragraph
  const summaryLines = oldest.map(({ rec }) => {
    const date = rec.created.slice(0, 10);
    const exchanges = rec.exchanges.length;
    return `[${date}] ${rec.worker} on "${rec.project}" — ${rec.task} (${exchanges} exchanges)`;
  });

  const summaryText = summaryLines.join('\n');

  // Save to summaries/
  const sumDir = summariesDir(domain);
  mkdirSync(sumDir, { recursive: true });
  const sumFile = join(sumDir, `rolling_summary_${Date.now()}.txt`);
  writeFileSync(sumFile, summaryText, 'utf8');

  // Delete compacted originals
  for (const { file } of oldest) {
    try {
      unlinkSync(join(dir, file));
    } catch {
      // skip if already gone
    }
  }
}

// ---------------------------------------------------------------------------
// k) getRollingSummary
// ---------------------------------------------------------------------------

/**
 * Returns the content of the most recent rolling summary file for a domain.
 */
export function getRollingSummary(domain: string): string {
  initMemory();
  const dir = summariesDir(domain);
  if (!existsSync(dir)) return '';

  const files = readdirSync(dir)
    .filter((f) => f.startsWith('rolling_summary_') && f.endsWith('.txt'))
    .sort()
    .reverse();

  if (files.length === 0) return '';

  try {
    return readFileSync(join(dir, files[0]), 'utf8');
  } catch {
    return '';
  }
}
