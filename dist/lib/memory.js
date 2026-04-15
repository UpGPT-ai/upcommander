/**
 * Claude Commander — Agent Memory System (Tier 1: local files)
 *
 * Manages core facts, session history, learnings, and failures across
 * three scopes: global, domain, and project.
 *
 * Storage root: ~/.claude-commander/memory/
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync, } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const MEMORY_ROOT = join(homedir(), '.claude-commander', 'memory');
const DOMAINS = ['software-dev', 'research', 'marketing', 'book-writing'];
function domainDir(domain) {
    return join(MEMORY_ROOT, 'domains', domain);
}
function projectDir(project) {
    return join(MEMORY_ROOT, 'projects', project);
}
function globalDir() {
    return join(MEMORY_ROOT, 'global');
}
// ---------------------------------------------------------------------------
// a) initMemory
// ---------------------------------------------------------------------------
/**
 * Creates the full memory directory structure under ~/.claude-commander/memory/
 * if it does not already exist.
 */
export function initMemory() {
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
function readJsonArray(filePath) {
    if (!existsSync(filePath))
        return [];
    try {
        return JSON.parse(readFileSync(filePath, 'utf8'));
    }
    catch {
        return [];
    }
}
function writeJson(filePath, data) {
    const lastSlash = filePath.lastIndexOf('/');
    const dir = lastSlash > 0 ? filePath.substring(0, lastSlash) : '.';
    mkdirSync(dir, { recursive: true });
    writeFileSync(filePath, JSON.stringify(data, null, 2), { encoding: 'utf8' });
}
function factsPath(domain, project) {
    if (project)
        return join(projectDir(project), 'core_facts.json');
    if (domain)
        return join(domainDir(domain), 'core_facts.json');
    return join(globalDir(), 'core_facts.json');
}
function sessionHistoryDir(domain, project) {
    if (project)
        return join(projectDir(project), 'session_history');
    return join(domainDir(domain), 'session_history');
}
function summariesDir(domain) {
    return join(domainDir(domain), 'summaries');
}
/** Simple similarity check — true if two fact strings share ≥80% of their words */
function isSimilarFact(a, b) {
    const wordsA = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
    const wordsB = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
    if (wordsA.size === 0 || wordsB.size === 0)
        return false;
    let overlap = 0;
    for (const w of wordsA) {
        if (wordsB.has(w))
            overlap++;
    }
    const similarity = overlap / Math.max(wordsA.size, wordsB.size);
    return similarity >= 0.8;
}
// ---------------------------------------------------------------------------
// b) saveFact
// ---------------------------------------------------------------------------
export function saveFact(fact) {
    initMemory();
    const filePath = factsPath(fact.domain, fact.project);
    const facts = readJsonArray(filePath);
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
    const newFact = {
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
export function getFacts(domain, project) {
    initMemory();
    const filePath = factsPath(domain, project);
    return readJsonArray(filePath);
}
// ---------------------------------------------------------------------------
// d) saveSessionRecord
// ---------------------------------------------------------------------------
export function saveSessionRecord(record) {
    initMemory();
    const id = crypto.randomUUID();
    const created = new Date().toISOString();
    const full = { id, ...record, created };
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
export function getRecentSessions(domain, limit = 5) {
    initMemory();
    const dir = sessionHistoryDir(domain);
    if (!existsSync(dir))
        return [];
    // Parse each file and sort by created timestamp descending
    const records = [];
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    for (const file of files) {
        try {
            const raw = readFileSync(join(dir, file), 'utf8');
            records.push(JSON.parse(raw));
        }
        catch {
            // skip corrupt records
        }
    }
    records.sort((a, b) => b.created.localeCompare(a.created));
    return records.slice(0, limit);
}
// ---------------------------------------------------------------------------
// f) saveLearning
// ---------------------------------------------------------------------------
function learningToMarkdown(learning) {
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
function parseLearningMarkdown(raw, id) {
    try {
        const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
        if (!fmMatch)
            return null;
        const fm = fmMatch[1];
        const get = (key) => {
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
    }
    catch {
        return null;
    }
}
export function saveLearning(learning) {
    initMemory();
    const id = crypto.randomUUID();
    const created = new Date().toISOString();
    const full = { id, ...learning, created };
    const dir = join(domainDir(learning.domain), 'learnings');
    mkdirSync(dir, { recursive: true });
    const filePath = join(dir, `${id}.md`);
    writeFileSync(filePath, learningToMarkdown(full), 'utf8');
    return full;
}
// ---------------------------------------------------------------------------
// g) getLearnings
// ---------------------------------------------------------------------------
export function getLearnings(domain, query) {
    initMemory();
    const dirs = [];
    if (domain) {
        dirs.push(join(domainDir(domain), 'learnings'));
    }
    else {
        for (const d of DOMAINS) {
            dirs.push(join(domainDir(d), 'learnings'));
        }
    }
    const learnings = [];
    for (const dir of dirs) {
        if (!existsSync(dir))
            continue;
        const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
        for (const file of files) {
            try {
                const raw = readFileSync(join(dir, file), 'utf8');
                const id = file.replace('.md', '');
                const parsed = parseLearningMarkdown(raw, id);
                if (parsed)
                    learnings.push(parsed);
            }
            catch {
                // skip
            }
        }
    }
    if (!query)
        return learnings;
    const q = query.toLowerCase();
    return learnings.filter((l) => l.title.toLowerCase().includes(q) ||
        l.content.toLowerCase().includes(q) ||
        l.tags.some((t) => t.toLowerCase().includes(q)));
}
// ---------------------------------------------------------------------------
// h) saveFailure
// ---------------------------------------------------------------------------
function failureToMarkdown(failure) {
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
function parseFailureMarkdown(raw, id) {
    try {
        const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
        if (!fmMatch)
            return null;
        const fm = fmMatch[1];
        const get = (key) => {
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
    }
    catch {
        return null;
    }
}
export function saveFailure(failure) {
    initMemory();
    const id = crypto.randomUUID();
    const created = new Date().toISOString();
    const full = { id, ...failure, created };
    const dir = join(domainDir(failure.domain), 'failures');
    mkdirSync(dir, { recursive: true });
    const filePath = join(dir, `${id}.md`);
    writeFileSync(filePath, failureToMarkdown(full), 'utf8');
    return full;
}
// ---------------------------------------------------------------------------
// i) getFailures
// ---------------------------------------------------------------------------
export function getFailures(domain) {
    initMemory();
    const dirs = [];
    if (domain) {
        dirs.push(join(domainDir(domain), 'failures'));
    }
    else {
        for (const d of DOMAINS) {
            dirs.push(join(domainDir(d), 'failures'));
        }
    }
    const failures = [];
    for (const dir of dirs) {
        if (!existsSync(dir))
            continue;
        const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
        for (const file of files) {
            try {
                const raw = readFileSync(join(dir, file), 'utf8');
                const id = file.replace('.md', '');
                const parsed = parseFailureMarkdown(raw, id);
                if (parsed)
                    failures.push(parsed);
            }
            catch {
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
export function compactHistory(domain) {
    initMemory();
    const dir = sessionHistoryDir(domain);
    if (!existsSync(dir))
        return;
    const entries = [];
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    for (const file of files) {
        try {
            const raw = readFileSync(join(dir, file), 'utf8');
            const rec = JSON.parse(raw);
            entries.push({ file, created: rec.created ?? '', rec });
        }
        catch {
            // skip corrupt
        }
    }
    if (entries.length <= 30)
        return;
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
        }
        catch {
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
export function getRollingSummary(domain) {
    initMemory();
    const dir = summariesDir(domain);
    if (!existsSync(dir))
        return '';
    const files = readdirSync(dir)
        .filter((f) => f.startsWith('rolling_summary_') && f.endsWith('.txt'))
        .sort()
        .reverse();
    if (files.length === 0)
        return '';
    try {
        return readFileSync(join(dir, files[0]), 'utf8');
    }
    catch {
        return '';
    }
}
//# sourceMappingURL=memory.js.map