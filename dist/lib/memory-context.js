/**
 * Claude Commander — Memory Context Assembly (Progressive Disclosure)
 *
 * Assembles context payloads for agents at three disclosure levels:
 *   Level 0: Always injected — core facts + task (<500 tokens)
 *   Level 1: Loaded on task start — rolling summary + matched learnings (<2000 tokens)
 *   Level 2: On demand — full session history + extended search + failures
 */
import { getFacts, getLearnings, getFailures, getRecentSessions, getRollingSummary, } from './memory.js';
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** Extract keywords from a task string for matching */
function extractKeywords(text) {
    const stopWords = new Set([
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'is', 'are', 'was', 'be', 'been', 'that', 'this',
        'it', 'as', 'from', 'into', 'do', 'does', 'not', 'no', 'i', 'we',
    ]);
    return text
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length > 2 && !stopWords.has(w));
}
/** Score a learning by keyword match against task keywords */
function scoreLearning(learning, keywords) {
    if (keywords.length === 0)
        return 0;
    const text = `${learning.title} ${learning.content} ${learning.tags.join(' ')}`.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
        if (text.includes(kw))
            score++;
    }
    return score;
}
/** Format a core fact for context injection */
function formatFact(fact) {
    return `- ${fact.fact} [source: ${fact.source}]`;
}
// ---------------------------------------------------------------------------
// a) assembleContext
// ---------------------------------------------------------------------------
/**
 * Assembles a three-tier AgentContext for injection into agent prompts.
 *
 * @param domain   - Memory domain (e.g. "software-dev")
 * @param project  - Project name for project-scoped facts
 * @param taskContent - The task description (used for keyword extraction)
 */
export function assembleContext(domain, project, taskContent) {
    const keywords = extractKeywords(taskContent);
    // ── Level 0: core facts + task ──────────────────────────────────────────
    const domainFacts = getFacts(domain);
    const projectFacts = getFacts(domain, project);
    const globalFacts = getFacts();
    // Top 20 facts: project first, then domain, then global
    const allFacts = [...projectFacts, ...domainFacts, ...globalFacts].slice(0, 20);
    const level0Parts = [];
    level0Parts.push('## Core Facts');
    if (allFacts.length > 0) {
        level0Parts.push(allFacts.map(formatFact).join('\n'));
    }
    else {
        level0Parts.push('(no facts stored yet)');
    }
    level0Parts.push('');
    level0Parts.push('## Task');
    level0Parts.push(taskContent);
    const level0 = level0Parts.join('\n');
    // ── Level 1: rolling summary + top 3 matched learnings ──────────────────
    const summary = getRollingSummary(domain);
    const learnings = getLearnings(domain);
    const scored = learnings
        .map((l) => ({ l, score: scoreLearning(l, keywords) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(({ l }) => l);
    const level1Parts = [];
    if (summary) {
        level1Parts.push('## Session History Summary');
        level1Parts.push(summary);
        level1Parts.push('');
    }
    if (scored.length > 0) {
        level1Parts.push('## Relevant Learnings');
        for (const learning of scored) {
            level1Parts.push(`### ${learning.title}`);
            level1Parts.push(learning.content);
            level1Parts.push('');
        }
    }
    else {
        level1Parts.push('## Relevant Learnings');
        level1Parts.push('(no matched learnings for this task)');
    }
    const level1 = level1Parts.join('\n');
    // ── Level 2: full recent history + extended learnings + failures ─────────
    const recentSessions = getRecentSessions(domain, 20);
    const failures = getFailures(domain);
    const level2Parts = [];
    // Recent session exchanges (last 20 sessions, all exchanges)
    if (recentSessions.length > 0) {
        level2Parts.push('## Recent Session History');
        for (const session of recentSessions) {
            level2Parts.push(`### ${session.created.slice(0, 10)} — ${session.worker} on "${session.project}"`);
            level2Parts.push(`Task: ${session.task}`);
            for (const ex of session.exchanges) {
                level2Parts.push(`[${ex.role}] ${ex.content}`);
            }
            level2Parts.push('');
        }
    }
    // Top 10 matched learnings
    const top10Learnings = learnings
        .map((l) => ({ l, score: scoreLearning(l, keywords) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map(({ l }) => l);
    if (top10Learnings.length > 0) {
        level2Parts.push('## Extended Learnings');
        for (const learning of top10Learnings) {
            level2Parts.push(`### ${learning.title}`);
            level2Parts.push(`Tags: ${learning.tags.join(', ')}`);
            level2Parts.push(learning.content);
            level2Parts.push('');
        }
    }
    // Domain failures
    if (failures.length > 0) {
        level2Parts.push('## Known Failures & Resolutions');
        for (const failure of failures) {
            level2Parts.push(`### ${failure.title}`);
            level2Parts.push(`**Root Cause:** ${failure.rootCause}`);
            level2Parts.push(`**Resolution:** ${failure.resolution}`);
            level2Parts.push('');
        }
    }
    const level2 = level2Parts.join('\n');
    return { level0, level1, level2 };
}
// ---------------------------------------------------------------------------
// b) recallMemory
// ---------------------------------------------------------------------------
/**
 * Grep-style search across all learnings and facts for a query string.
 * Returns formatted excerpts up to `limit` results (default 5).
 *
 * This function is intended to be exposed as a tool call for agents.
 */
export function recallMemory(query, domain, limit = 5) {
    if (!query.trim())
        return 'No query provided.';
    const results = [];
    const q = query.toLowerCase();
    const keywords = extractKeywords(query);
    // Search learnings
    const learnings = getLearnings(domain);
    for (const learning of learnings) {
        const score = scoreLearning(learning, keywords);
        if (score > 0) {
            // Find the most relevant excerpt
            const lines = learning.content.split('\n');
            const matchedLine = lines.find((line) => line.toLowerCase().includes(q)) ?? lines[0] ?? '';
            results.push({
                type: 'learning',
                title: learning.title,
                excerpt: matchedLine.trim().slice(0, 200),
            });
        }
        if (results.length >= limit * 2)
            break; // Over-fetch then trim
    }
    // Search facts
    const facts = getFacts(domain);
    for (const fact of facts) {
        if (fact.fact.toLowerCase().includes(q)) {
            results.push({
                type: 'fact',
                title: `Fact [${fact.domain}]`,
                excerpt: fact.fact.slice(0, 200),
            });
        }
        if (results.length >= limit * 3)
            break;
    }
    if (results.length === 0) {
        return `No results found for query: "${query}"`;
    }
    // Trim to limit
    const trimmed = results.slice(0, limit);
    const formatted = trimmed
        .map((r, i) => `${i + 1}. [${r.type.toUpperCase()}] ${r.title}\n   ${r.excerpt}`)
        .join('\n\n');
    return `Memory recall results for "${query}" (${trimmed.length} of ${results.length} matches):\n\n${formatted}`;
}
//# sourceMappingURL=memory-context.js.map