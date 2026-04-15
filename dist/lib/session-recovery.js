/**
 * Session recovery — detects stalled / rate-limited workers and
 * automatically continues them, caches prompts for replay, and persists
 * swarm state so the orchestrator can resume after a restart.
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { getSessionTree, sendKeys } from './tmux.js';
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const STALL_THRESHOLD_MS = 60_000; // 60 s of no change → stalled
const STALL_CHECKS_BEFORE_CONTINUE = 2; // 2 consecutive stall checks → auto-continue
const STALL_CHECKS_BEFORE_ESCALATE = 3; // 3 consecutive → escalate
const RECOVERY_DIR = join(homedir(), '.claude-commander', 'recovery');
// Patterns that indicate rate limiting
const RATE_LIMIT_PATTERNS = [
    /rate limit/i,
    /usage limit/i,
    /capacity/i,
    /try again/i,
    /429/,
];
// Patterns that indicate an idle Claude prompt (task finished or lost prompt)
const IDLE_PROMPT_PATTERNS = [
    /\? for shortcuts/,
    /What can I help/i,
];
// Pattern to extract "try again in X minutes" or "resets at" info
const RETRY_TIME_PATTERNS = [
    /try again in (\d+)\s*(minute|min|second|sec|hour|hr)s?/i,
    /resets?\s+(?:at|in)\s+(\d{1,2}:\d{2})/i,
    /available\s+(?:at|in)\s+(\d+)\s*(minute|min|second|sec|hour|hr)s?/i,
    /wait\s+(\d+)\s*(minute|min|second|sec|hour|hr)s?/i,
];
// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------
/** Tracked pane states keyed by "session:window" */
const paneStates = new Map();
/** Prompt cache — stores last prompt sent to each "session:window" */
const promptCache = new Map();
/** Scheduled rate-limit recovery timers keyed by "session:window" */
const rateLimitTimers = new Map();
/** Current swarm state (if any) */
let currentSwarmState = null;
/** Swarm state save interval handle */
let swarmSaveTimer = null;
// ---------------------------------------------------------------------------
// Prompt cache
// ---------------------------------------------------------------------------
export function cachePrompt(session, window, prompt) {
    promptCache.set(`${session}:${window}`, prompt);
}
export function getCachedPrompt(session, window) {
    return promptCache.get(`${session}:${window}`);
}
// ---------------------------------------------------------------------------
// Pane output capture
// ---------------------------------------------------------------------------
/**
 * Capture the current text content of a tmux pane.
 * Returns the trimmed output or null if capture fails.
 */
function capturePaneOutput(session, window) {
    try {
        const raw = execSync(`tmux capture-pane -t "${session}:${window}" -p`, { encoding: 'utf8', timeout: 5000 }).trim();
        return raw;
    }
    catch {
        return null;
    }
}
/**
 * Check if a pane's underlying process is alive via kill -0.
 */
function isPanePidAlive(session, window) {
    try {
        const pidStr = execSync(`tmux list-panes -t "${session}:${window}" -F "#{pane_pid}"`, { encoding: 'utf8', timeout: 5000 }).trim();
        const pid = parseInt(pidStr, 10);
        if (isNaN(pid) || pid <= 0)
            return false;
        execSync(`kill -0 ${pid}`, { stdio: 'ignore', timeout: 2000 });
        return true;
    }
    catch {
        return false;
    }
}
// ---------------------------------------------------------------------------
// State classification
// ---------------------------------------------------------------------------
/**
 * Classify the state of a pane based on its output and timing.
 */
function classifyPane(key, output, pidAlive, session, window) {
    const now = Date.now();
    const prev = paneStates.get(key);
    // Dead pane — process no longer running
    if (!pidAlive) {
        return {
            session,
            window,
            lastOutput: output ?? prev?.lastOutput ?? '',
            lastOutputTime: now,
            lastChangeTime: prev?.lastChangeTime ?? now,
            consecutiveStalls: 0,
            state: 'dead',
        };
    }
    // Capture failed — keep previous state, bump stall
    if (output === null) {
        if (prev) {
            return {
                ...prev,
                lastOutputTime: now,
                consecutiveStalls: prev.consecutiveStalls + 1,
                state: prev.state,
            };
        }
        return {
            session,
            window,
            lastOutput: '',
            lastOutputTime: now,
            lastChangeTime: now,
            consecutiveStalls: 0,
            state: 'active',
        };
    }
    // Check for rate limiting
    for (const pattern of RATE_LIMIT_PATTERNS) {
        if (pattern.test(output)) {
            return {
                session,
                window,
                lastOutput: output,
                lastOutputTime: now,
                lastChangeTime: prev?.lastChangeTime ?? now,
                consecutiveStalls: prev ? prev.consecutiveStalls + 1 : 1,
                state: 'rate_limited',
            };
        }
    }
    // Check for idle Claude prompt
    for (const pattern of IDLE_PROMPT_PATTERNS) {
        if (pattern.test(output)) {
            return {
                session,
                window,
                lastOutput: output,
                lastOutputTime: now,
                lastChangeTime: now,
                consecutiveStalls: 0,
                state: 'completed',
            };
        }
    }
    // Determine if output changed
    const outputChanged = !prev || prev.lastOutput !== output;
    const lastChangeTime = outputChanged ? now : (prev?.lastChangeTime ?? now);
    const stalledDuration = now - lastChangeTime;
    const isStalled = stalledDuration >= STALL_THRESHOLD_MS;
    const consecutiveStalls = isStalled
        ? (prev?.consecutiveStalls ?? 0) + (outputChanged ? 0 : 1)
        : 0;
    return {
        session,
        window,
        lastOutput: output,
        lastOutputTime: now,
        lastChangeTime,
        consecutiveStalls: outputChanged ? 0 : consecutiveStalls,
        state: isStalled ? 'stalled' : 'active',
    };
}
// ---------------------------------------------------------------------------
// Rate limit time parsing
// ---------------------------------------------------------------------------
/**
 * Attempt to parse a retry/refresh time from pane output.
 * Returns an ISO string for the next available time, or null if unparseable.
 */
function parseRetryTime(output) {
    for (const pattern of RETRY_TIME_PATTERNS) {
        const match = pattern.exec(output);
        if (!match)
            continue;
        const value = match[1];
        const unit = match[2]?.toLowerCase();
        // Handle "HH:MM" format
        if (value.includes(':')) {
            const [hours, minutes] = value.split(':').map(Number);
            const target = new Date();
            target.setHours(hours, minutes, 0, 0);
            // If the target time is in the past, assume next day
            if (target.getTime() <= Date.now()) {
                target.setDate(target.getDate() + 1);
            }
            return target.toISOString();
        }
        // Handle "N minutes/seconds/hours" format
        const num = parseInt(value, 10);
        if (isNaN(num))
            continue;
        let ms = 0;
        if (unit?.startsWith('sec'))
            ms = num * 1000;
        else if (unit?.startsWith('min'))
            ms = num * 60_000;
        else if (unit?.startsWith('hour') || unit?.startsWith('hr'))
            ms = num * 3_600_000;
        else
            ms = num * 60_000; // default to minutes
        return new Date(Date.now() + ms).toISOString();
    }
    return null;
}
// ---------------------------------------------------------------------------
// Auto-continue logic
// ---------------------------------------------------------------------------
/**
 * Send "please continue where you left off" to a stalled worker.
 */
function autoContinue(session, window) {
    try {
        sendKeys(session, window, 'please continue where you left off');
        console.log(`[recovery] Auto-continue sent to ${session}:${window}`);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[recovery] Failed to auto-continue ${session}:${window}: ${msg}`);
    }
}
/**
 * Resend the cached prompt to a worker that appears idle but didn't complete.
 */
function resendCachedPrompt(session, window) {
    const cached = getCachedPrompt(session, window);
    if (!cached)
        return false;
    try {
        sendKeys(session, window, cached);
        console.log(`[recovery] Resent cached prompt to ${session}:${window}`);
        return true;
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[recovery] Failed to resend prompt to ${session}:${window}: ${msg}`);
        return false;
    }
}
/**
 * Check if expected output files exist for a worker (from swarm state).
 */
function workerOutputExists(worker) {
    if (!worker.expectedOutputDir || worker.expectedFiles.length === 0) {
        return false;
    }
    return worker.expectedFiles.every((f) => existsSync(join(worker.expectedOutputDir, f)));
}
// ---------------------------------------------------------------------------
// Rate limit recovery scheduling
// ---------------------------------------------------------------------------
/**
 * Schedule a recovery attempt for a rate-limited worker.
 */
function scheduleRateLimitRecovery(session, window, refreshTime, callbacks) {
    const key = `${session}:${window}`;
    // Clear any existing timer for this pane
    const existing = rateLimitTimers.get(key);
    if (existing)
        clearTimeout(existing);
    const delayMs = new Date(refreshTime).getTime() - Date.now();
    if (delayMs <= 0)
        return; // Already past
    const timer = setTimeout(() => {
        rateLimitTimers.delete(key);
        // Check if still rate-limited
        const currentState = paneStates.get(key);
        if (!currentState || currentState.state !== 'rate_limited') {
            // Worker recovered on its own
            return;
        }
        // Attempt to resend cached prompt
        const cached = getCachedPrompt(session, window);
        if (cached) {
            try {
                sendKeys(session, window, cached);
                console.log(`[recovery] Rate-limit recovery: resent prompt to ${session}:${window}`);
                callbacks.onWorkerRecovered(session, window, 'rate_limit_timer');
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(`[recovery] Rate-limit recovery failed for ${session}:${window}: ${msg}`);
            }
        }
        else {
            // No cached prompt — send a generic continue
            autoContinue(session, window);
            callbacks.onWorkerRecovered(session, window, 'rate_limit_timer_continue');
        }
    }, delayMs);
    rateLimitTimers.set(key, timer);
}
// ---------------------------------------------------------------------------
// Swarm state persistence
// ---------------------------------------------------------------------------
function ensureRecoveryDir() {
    if (!existsSync(RECOVERY_DIR)) {
        mkdirSync(RECOVERY_DIR, { recursive: true });
    }
}
const SWARM_STATE_FILE = join(RECOVERY_DIR, 'swarm-state.json');
export function saveSwarmState(state) {
    ensureRecoveryDir();
    writeFileSync(SWARM_STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
    currentSwarmState = state;
}
export function loadSwarmState() {
    try {
        if (!existsSync(SWARM_STATE_FILE))
            return null;
        const raw = readFileSync(SWARM_STATE_FILE, 'utf8');
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
/**
 * Resume a swarm from saved state: check which workers completed
 * and resend prompts to those that didn't.
 */
export function resumeSwarm(state) {
    const resumed = [];
    const completed = [];
    const skipped = [];
    for (const worker of state.workers) {
        const key = `${state.session}:${worker.name}`;
        // Check if output files exist (worker completed)
        if (workerOutputExists(worker)) {
            worker.state = 'completed';
            worker.lastChecked = new Date().toISOString();
            completed.push(key);
            continue;
        }
        // Check if the pane is alive
        if (!isPanePidAlive(state.session, worker.name)) {
            worker.state = 'dead';
            worker.lastChecked = new Date().toISOString();
            skipped.push(key);
            continue;
        }
        // Resend the prompt
        if (worker.prompt) {
            try {
                sendKeys(state.session, worker.name, worker.prompt);
                cachePrompt(state.session, worker.name, worker.prompt);
                worker.state = 'active';
                worker.lastChecked = new Date().toISOString();
                resumed.push(key);
            }
            catch {
                skipped.push(key);
            }
        }
        else {
            skipped.push(key);
        }
    }
    // Save updated state
    saveSwarmState(state);
    return { resumed, completed, skipped };
}
// ---------------------------------------------------------------------------
// Core check cycle
// ---------------------------------------------------------------------------
/**
 * Run a single recovery check cycle across all tmux windows.
 * Returns the current PaneState array.
 */
export function runRecoveryCheck(callbacks) {
    const tree = getSessionTree();
    const results = [];
    const activeKeys = new Set();
    for (const sess of tree.sessions) {
        for (const win of sess.windows) {
            const key = `${sess.name}:${win.name}`;
            activeKeys.add(key);
            const output = capturePaneOutput(sess.name, win.name);
            const pidAlive = win.pane_pid > 0 ? isPanePidAlive(sess.name, win.name) : false;
            const paneState = classifyPane(key, output, pidAlive, sess.name, win.name);
            const prev = paneStates.get(key);
            paneStates.set(key, paneState);
            results.push(paneState);
            // --- React to state transitions ---
            if (paneState.state === 'stalled') {
                const stalledFor = Date.now() - paneState.lastChangeTime;
                if (paneState.consecutiveStalls >= STALL_CHECKS_BEFORE_ESCALATE) {
                    // Escalate — notify orchestrator
                    callbacks.onWorkerStalled(sess.name, win.name, stalledFor);
                }
                else if (paneState.consecutiveStalls >= STALL_CHECKS_BEFORE_CONTINUE) {
                    // Auto-continue
                    autoContinue(sess.name, win.name);
                    callbacks.onWorkerRecovered(sess.name, win.name, 'auto_continue');
                }
            }
            if (paneState.state === 'rate_limited') {
                const nextRefresh = output ? parseRetryTime(output) : null;
                // Update swarm state if applicable
                if (currentSwarmState) {
                    currentSwarmState.nextRefreshTime = nextRefresh ?? currentSwarmState.nextRefreshTime;
                }
                // Only fire callback on transition to rate_limited
                if (!prev || prev.state !== 'rate_limited') {
                    callbacks.onWorkerRateLimited(sess.name, win.name, nextRefresh);
                }
                // Schedule recovery timer
                if (nextRefresh) {
                    scheduleRateLimitRecovery(sess.name, win.name, nextRefresh, callbacks);
                }
            }
            if (paneState.state === 'completed') {
                // Check if worker is in swarm state
                if (currentSwarmState) {
                    const swarmWorker = currentSwarmState.workers.find((w) => w.name === win.name);
                    if (swarmWorker) {
                        if (workerOutputExists(swarmWorker)) {
                            swarmWorker.state = 'completed';
                            swarmWorker.lastChecked = new Date().toISOString();
                        }
                        else {
                            // Idle prompt but no output files — resend prompt
                            const resent = resendCachedPrompt(sess.name, win.name);
                            if (resent) {
                                callbacks.onWorkerRecovered(sess.name, win.name, 'resend_prompt');
                            }
                        }
                    }
                }
            }
            // Detect recovery from stalled/rate_limited → active
            if (paneState.state === 'active' &&
                prev &&
                (prev.state === 'stalled' || prev.state === 'rate_limited')) {
                callbacks.onWorkerRecovered(sess.name, win.name, 'self_recovered');
            }
        }
    }
    // Prune pane states for windows that no longer exist
    for (const key of paneStates.keys()) {
        if (!activeKeys.has(key)) {
            paneStates.delete(key);
            // Clean up any scheduled timers
            const timer = rateLimitTimers.get(key);
            if (timer) {
                clearTimeout(timer);
                rateLimitTimers.delete(key);
            }
        }
    }
    // Update swarm state worker states
    if (currentSwarmState) {
        for (const worker of currentSwarmState.workers) {
            const ps = paneStates.get(`${currentSwarmState.session}:${worker.name}`);
            if (ps) {
                worker.state = ps.state;
                worker.lastChecked = new Date().toISOString();
            }
        }
    }
    return results;
}
// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
/**
 * Get the current PaneState for all monitored windows.
 */
export function getAllPaneStates() {
    return Array.from(paneStates.values());
}
/**
 * Get the current swarm state (if any).
 */
export function getCurrentSwarmState() {
    return currentSwarmState;
}
/**
 * Manually trigger a continue for a specific worker.
 */
export function manualContinue(session, window) {
    autoContinue(session, window);
}
/**
 * Start the recovery monitor. Runs a check cycle every intervalMs
 * milliseconds (default: 15 000 ms). Also saves swarm state every 30 s.
 *
 * Returns a stop function that cancels both intervals and all scheduled timers.
 */
export function startRecoveryMonitor(callbacks, intervalMs = 15_000) {
    // Load any persisted swarm state on startup
    const persisted = loadSwarmState();
    if (persisted) {
        currentSwarmState = persisted;
        console.log(`[recovery] Loaded persisted swarm state for session "${persisted.session}"`);
    }
    // Main recovery check interval
    const checkTimer = setInterval(() => {
        try {
            runRecoveryCheck(callbacks);
        }
        catch {
            // Recovery monitoring must not crash the server
        }
    }, intervalMs);
    // Swarm state persistence interval (every 30 s)
    swarmSaveTimer = setInterval(() => {
        try {
            if (currentSwarmState) {
                saveSwarmState(currentSwarmState);
                callbacks.onSwarmStateUpdate(currentSwarmState);
            }
        }
        catch {
            // Swarm state save must not crash the server
        }
    }, 30_000);
    return () => {
        clearInterval(checkTimer);
        if (swarmSaveTimer) {
            clearInterval(swarmSaveTimer);
            swarmSaveTimer = null;
        }
        // Clear all scheduled rate-limit timers
        for (const timer of rateLimitTimers.values()) {
            clearTimeout(timer);
        }
        rateLimitTimers.clear();
    };
}
//# sourceMappingURL=session-recovery.js.map