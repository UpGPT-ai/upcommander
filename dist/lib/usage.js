/**
 * Claude Commander — Usage Tracking
 *
 * Tracks per-session and per-period usage: prompts sent, tokens consumed,
 * estimated cost, and time active. Persists to ~/.claude-commander/usage/.
 *
 * Designed to give the user visibility into their Claude consumption
 * across all Commander sessions — visible in VS Code status bar and PWA.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const USAGE_DIR = join(homedir(), '.claude-commander', 'usage');
const SESSIONS_FILE = join(USAGE_DIR, 'sessions.json');
const DAILY_DIR = join(USAGE_DIR, 'daily');
function ensureUsageDir() {
    if (!existsSync(USAGE_DIR))
        mkdirSync(USAGE_DIR, { recursive: true });
    if (!existsSync(DAILY_DIR))
        mkdirSync(DAILY_DIR, { recursive: true });
}
// ---------------------------------------------------------------------------
// JSON helpers
// ---------------------------------------------------------------------------
function readJson(path, fallback) {
    try {
        if (!existsSync(path))
            return fallback;
        return JSON.parse(readFileSync(path, 'utf8'));
    }
    catch {
        return fallback;
    }
}
function writeJson(path, data) {
    writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
}
// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------
function todayStr() {
    return new Date().toISOString().slice(0, 10);
}
function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
}
function dailyFile(date) {
    return join(DAILY_DIR, `${date}.json`);
}
// ---------------------------------------------------------------------------
// Core: record a prompt event
// ---------------------------------------------------------------------------
export function recordPrompt(event) {
    ensureUsageDir();
    const now = new Date().toISOString();
    const today = todayStr();
    // --- Update session usage ---
    const sessions = readJson(SESSIONS_FILE, {});
    const existing = sessions[event.session] ?? {
        session: event.session,
        prompts_sent: 0,
        prompts_today: 0,
        tokens_in: 0,
        tokens_out: 0,
        tokens_cached: 0,
        cost_usd: 0,
        cost_today_usd: 0,
        first_active: now,
        last_active: now,
        active_minutes: 0,
        by_provider: {},
    };
    // Reset daily counters if day changed
    const lastDate = existing.last_active.slice(0, 10);
    if (lastDate !== today) {
        existing.prompts_today = 0;
        existing.cost_today_usd = 0;
    }
    existing.prompts_sent += 1;
    existing.prompts_today += 1;
    existing.tokens_in += event.tokens_in ?? 0;
    existing.tokens_out += event.tokens_out ?? 0;
    existing.tokens_cached += event.tokens_cached ?? 0;
    existing.cost_usd += event.cost_usd ?? 0;
    existing.cost_today_usd += event.cost_usd ?? 0;
    existing.last_active = now;
    // Track by provider
    const provider = event.provider ?? 'tmux';
    const model = event.model ?? 'unknown';
    if (!existing.by_provider)
        existing.by_provider = {};
    const prov = existing.by_provider[provider] ?? {
        provider,
        prompts: 0,
        tokens_in: 0,
        tokens_out: 0,
        tokens_cached: 0,
        cost_usd: 0,
        models_used: {},
    };
    prov.prompts += 1;
    prov.tokens_in += event.tokens_in ?? 0;
    prov.tokens_out += event.tokens_out ?? 0;
    prov.tokens_cached += event.tokens_cached ?? 0;
    prov.cost_usd += event.cost_usd ?? 0;
    prov.models_used[model] = (prov.models_used[model] ?? 0) + 1;
    existing.by_provider[provider] = prov;
    // Estimate active minutes from gap since last activity
    const gapMs = new Date(now).getTime() - new Date(existing.last_active).getTime();
    if (gapMs < 300_000) { // less than 5 min gap = still active
        existing.active_minutes += gapMs / 60_000;
    }
    sessions[event.session] = existing;
    writeJson(SESSIONS_FILE, sessions);
    // --- Update daily usage ---
    const daily = readJson(dailyFile(today), {
        date: today,
        prompts: 0,
        tokens_in: 0,
        tokens_out: 0,
        tokens_cached: 0,
        cost_usd: 0,
        sessions_active: [],
        by_provider: {},
    });
    daily.prompts += 1;
    daily.tokens_in += event.tokens_in ?? 0;
    daily.tokens_out += event.tokens_out ?? 0;
    daily.tokens_cached += event.tokens_cached ?? 0;
    daily.cost_usd += event.cost_usd ?? 0;
    if (!daily.sessions_active.includes(event.session)) {
        daily.sessions_active.push(event.session);
    }
    // Track daily by provider
    if (!daily.by_provider)
        daily.by_provider = {};
    const dp = daily.by_provider[provider] ?? {
        provider,
        prompts: 0,
        tokens_in: 0,
        tokens_out: 0,
        tokens_cached: 0,
        cost_usd: 0,
        models_used: {},
    };
    dp.prompts += 1;
    dp.tokens_in += event.tokens_in ?? 0;
    dp.tokens_out += event.tokens_out ?? 0;
    dp.tokens_cached += event.tokens_cached ?? 0;
    dp.cost_usd += event.cost_usd ?? 0;
    dp.models_used[model] = (dp.models_used[model] ?? 0) + 1;
    daily.by_provider[provider] = dp;
    writeJson(dailyFile(today), daily);
}
// ---------------------------------------------------------------------------
// Query: get usage summary
// ---------------------------------------------------------------------------
export function getUsageSummary() {
    ensureUsageDir();
    const today = todayStr();
    const emptyDaily = (date) => ({
        date,
        prompts: 0,
        tokens_in: 0,
        tokens_out: 0,
        tokens_cached: 0,
        cost_usd: 0,
        sessions_active: [],
        by_provider: {},
    });
    // Today's usage
    const todayUsage = readJson(dailyFile(today), emptyDaily(today));
    // Last 7 days
    const weekDays = [];
    let weekPrompts = 0;
    let weekTokensIn = 0;
    let weekTokensOut = 0;
    let weekCost = 0;
    const weekByProvider = {};
    for (let i = 0; i < 7; i++) {
        const date = daysAgo(i);
        const daily = readJson(dailyFile(date), emptyDaily(date));
        weekDays.push(daily);
        weekPrompts += daily.prompts;
        weekTokensIn += daily.tokens_in;
        weekTokensOut += daily.tokens_out;
        weekCost += daily.cost_usd;
        _mergeProviders(weekByProvider, daily.by_provider ?? {});
    }
    // Last 30 days
    let monthPrompts = 0;
    let monthTokensIn = 0;
    let monthTokensOut = 0;
    let monthCost = 0;
    const monthByProvider = {};
    for (let i = 0; i < 30; i++) {
        const date = daysAgo(i);
        const daily = readJson(dailyFile(date), emptyDaily(date));
        monthPrompts += daily.prompts;
        monthTokensIn += daily.tokens_in;
        monthTokensOut += daily.tokens_out;
        monthCost += daily.cost_usd;
        _mergeProviders(monthByProvider, daily.by_provider ?? {});
    }
    // Per-session breakdown
    const sessions = readJson(SESSIONS_FILE, {});
    const bySession = Object.values(sessions).sort((a, b) => b.cost_usd - a.cost_usd);
    return {
        today: todayUsage,
        week: {
            prompts: weekPrompts,
            tokens_in: weekTokensIn,
            tokens_out: weekTokensOut,
            cost_usd: weekCost,
            days: weekDays,
            by_provider: weekByProvider,
        },
        month: {
            prompts: monthPrompts,
            tokens_in: monthTokensIn,
            tokens_out: monthTokensOut,
            cost_usd: monthCost,
            by_provider: monthByProvider,
        },
        by_session: bySession,
        updated: new Date().toISOString(),
    };
}
// ---------------------------------------------------------------------------
// Internal: merge provider usage maps
// ---------------------------------------------------------------------------
function _mergeProviders(target, source) {
    for (const [key, src] of Object.entries(source)) {
        const existing = target[key] ?? {
            provider: key,
            prompts: 0,
            tokens_in: 0,
            tokens_out: 0,
            tokens_cached: 0,
            cost_usd: 0,
            models_used: {},
        };
        existing.prompts += src.prompts;
        existing.tokens_in += src.tokens_in;
        existing.tokens_out += src.tokens_out;
        existing.tokens_cached += src.tokens_cached;
        existing.cost_usd += src.cost_usd;
        for (const [model, count] of Object.entries(src.models_used ?? {})) {
            existing.models_used[model] = (existing.models_used[model] ?? 0) + count;
        }
        target[key] = existing;
    }
}
// ---------------------------------------------------------------------------
// Query: get usage for a specific session
// ---------------------------------------------------------------------------
export function getSessionUsage(sessionName) {
    ensureUsageDir();
    const sessions = readJson(SESSIONS_FILE, {});
    return sessions[sessionName] ?? null;
}
// ---------------------------------------------------------------------------
// Reset daily counters (call at midnight or on demand)
// ---------------------------------------------------------------------------
export function resetDailyCounters() {
    ensureUsageDir();
    const sessions = readJson(SESSIONS_FILE, {});
    for (const s of Object.values(sessions)) {
        s.prompts_today = 0;
        s.cost_today_usd = 0;
    }
    writeJson(SESSIONS_FILE, sessions);
}
//# sourceMappingURL=usage.js.map