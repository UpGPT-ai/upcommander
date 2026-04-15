/**
 * Claude Commander — Bridge Server
 *
 * Express + WebSocket server that sits on the host machine, manages tmux
 * sessions, and pushes status updates to connected mobile clients (PWA).
 *
 * Binds to 127.0.0.1:7700 (override via PORT env).
 */
import { createServer } from 'node:http';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync, appendFileSync, createReadStream } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { getSessionTree, sendKeys, broadcastToSession, broadcastToAll, } from '../lib/tmux.js';
import { loadOrGenerateToken, authMiddleware, validateWsToken, } from '../lib/auth.js';
import { logSend, logBroadcast, logLifecycle } from '../lib/audit.js';
import { getCoordinationTree, getApprovalQueue, } from '../lib/coordination.js';
import { startWatcher } from '../lib/watcher.js';
import { getProjectPaths } from '../lib/config.js';
import { startHealthMonitor } from '../lib/health.js';
import { getSystemMetrics } from '../lib/metrics.js';
import { getFacts, saveFact, getLearnings, saveLearning, } from '../lib/memory.js';
import { recallMemory } from '../lib/memory-context.js';
import { loadWorkerPerformance, loadTemplatePerformance, } from '../lib/performance.js';
import { getPendingProposals, approveProposal, rejectProposal, } from '../lib/optimizer.js';
import { getAllAlerts, acknowledgeAlert, } from '../lib/drift-detector.js';
import { listABTests, createABTest, } from '../lib/ab-testing.js';
import { getRoleHistory } from '../lib/version-history.js';
import { setBudget, checkBudget, estimateCost, getBudgetSummary } from '../lib/budget.js';
import { generateReport, generateExecutiveSummary } from '../lib/reports.js';
import { runVerification, getVerificationSummary, } from '../lib/verification.js';
import { exportAuditTrail, verifyAuditChain } from '../lib/compliance.js';
import { recordPrompt, getUsageSummary, getSessionUsage } from '../lib/usage.js';
import { startRecoveryMonitor, getAllPaneStates, getCurrentSwarmState, manualContinue, loadSwarmState, resumeSwarm, cachePrompt, } from '../lib/session-recovery.js';
// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const PORT = parseInt(process.env.PORT ?? '7700', 10);
const HOST = '127.0.0.1';
// ---------------------------------------------------------------------------
// Lockdown state
// ---------------------------------------------------------------------------
let lockdown = false;
// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------
const app = express();
// JSON body parsing
app.use(express.json());
// Serve the PWA static files WITHOUT auth (client does auth internally)
app.use(express.static(join(__dirname, '..', '..', 'public')));
// CORS headers for PWA access
app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    next();
});
// Handle preflight OPTIONS requests before auth middleware
app.options('/{*path}', (_req, res) => {
    res.sendStatus(204);
});
// Auth middleware (excludes /health internally)
app.use(authMiddleware);
// Cache-Control: no-cache for all API responses (allows conditional requests via ETag)
app.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache');
    next();
});
// Lockdown middleware — rejects all non-health requests with 503 when active.
// Only POST /unlock from 127.0.0.1 can clear the lockdown flag.
app.use((req, res, next) => {
    if (!lockdown) {
        next();
        return;
    }
    const isHealth = req.path === '/health' || req.path === '/health/sessions';
    const isUnlock = req.method === 'POST' && req.path === '/unlock';
    if (isHealth || isUnlock) {
        next();
        return;
    }
    res.status(503).json({ error: 'Service locked down. POST /unlock from localhost to restore.' });
});
// ---------------------------------------------------------------------------
// REST endpoints
// ---------------------------------------------------------------------------
/** GET /health — public, no auth required */
app.get('/health', (_req, res) => {
    const tree = getSessionTree();
    const sessionCount = tree.sessions.length;
    const windowCount = tree.sessions.reduce((sum, s) => sum + s.windows.length, 0);
    res.json({ status: 'ok', sessions: sessionCount, windows: windowCount });
});
/** GET /sessions — return full tmux session tree */
app.get('/sessions', (_req, res) => {
    const tree = getSessionTree();
    res.json(tree);
});
/** POST /send/:session/:window — send a prompt to a specific window */
app.post('/send/:session/:window', (req, res) => {
    const { session, window } = req.params;
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string') {
        res.status(400).json({ error: 'Body must contain a non-empty "prompt" string' });
        return;
    }
    try {
        sendKeys(session, window, prompt);
        cachePrompt(session, window, prompt);
        const source = req.ip ?? req.socket.remoteAddress ?? 'unknown';
        logSend(source, session, window, prompt);
        recordPrompt({ session, window, source: 'pwa' });
        pushStatusUpdate();
        res.json({ ok: true, target: `${session}:${window}` });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: message });
    }
});
/** POST /broadcast/:session — broadcast to all windows in a session */
app.post('/broadcast/:session', (req, res) => {
    const { session } = req.params;
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string') {
        res.status(400).json({ error: 'Body must contain a non-empty "prompt" string' });
        return;
    }
    try {
        const sentTo = broadcastToSession(session, prompt);
        const source = req.ip ?? req.socket.remoteAddress ?? 'unknown';
        logBroadcast(source, session, prompt, sentTo);
        recordPrompt({ session, source: 'pwa' });
        pushStatusUpdate();
        res.json({ ok: true, sentTo });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: message });
    }
});
/** POST /broadcast/all — broadcast to all sessions and windows */
app.post('/broadcast/all', (req, res) => {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string') {
        res.status(400).json({ error: 'Body must contain a non-empty "prompt" string' });
        return;
    }
    try {
        const sentTo = broadcastToAll(prompt);
        const source = req.ip ?? req.socket.remoteAddress ?? 'unknown';
        logBroadcast(source, 'all', prompt, sentTo);
        for (const target of sentTo) {
            const [s] = target.split(':');
            recordPrompt({ session: s, source: 'pwa' });
        }
        pushStatusUpdate();
        res.json({ ok: true, sentTo });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: message });
    }
});
/** GET /pair — return pairing info including a QR code URL */
app.get('/pair', (_req, res) => {
    const tok = loadOrGenerateToken();
    const host = process.env.PAIR_HOST ?? `http://127.0.0.1:${PORT}`;
    const payload = JSON.stringify({ url: host, token: tok });
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(payload)}&size=256x256`;
    res.json({ token: tok, url: host, qr: qrUrl });
});
/** POST /approve/:session/:window — sends "y" + Enter to approve a pending action */
app.post('/approve/:session/:window', (req, res) => {
    const { session, window } = req.params;
    try {
        sendKeys(session, window, 'y');
        const source = req.ip ?? req.socket.remoteAddress ?? 'unknown';
        logSend(source, session, window, 'y [approve]');
        pushStatusUpdate();
        res.json({ ok: true, target: `${session}:${window}`, action: 'approved' });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: message });
    }
});
/** POST /deny/:session/:window — sends "n" + Enter to deny a pending action */
app.post('/deny/:session/:window', (req, res) => {
    const { session, window } = req.params;
    try {
        sendKeys(session, window, 'n');
        const source = req.ip ?? req.socket.remoteAddress ?? 'unknown';
        logSend(source, session, window, 'n [deny]');
        pushStatusUpdate();
        res.json({ ok: true, target: `${session}:${window}`, action: 'denied' });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: message });
    }
});
/** GET /status/tree — returns the coordination state tree across all configured projects */
app.get('/status/tree', (_req, res) => {
    try {
        const projectPaths = getProjectPaths();
        const tree = getCoordinationTree(projectPaths);
        res.json(tree);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: message });
    }
});
/** GET /approvals — returns all agents currently in waiting_approval state */
app.get('/approvals', (_req, res) => {
    try {
        const projectPaths = getProjectPaths();
        const queue = getApprovalQueue(projectPaths);
        res.json({ approvals: queue, count: queue.length });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: message });
    }
});
/** GET /metrics — returns SystemMetrics across all configured projects */
app.get('/metrics', (_req, res) => {
    try {
        const paths = getProjectPaths();
        // Build a name→path record: use basename as key (same as coordination module)
        const pathMap = {};
        for (const p of paths) {
            pathMap[basename(p)] = p;
        }
        const metrics = getSystemMetrics(pathMap);
        res.json(metrics);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: message });
    }
});
/** GET /usage — returns UsageSummary (today, week, month, by session) */
app.get('/usage', (_req, res) => {
    try {
        const summary = getUsageSummary();
        res.json(summary);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: message });
    }
});
/** GET /usage/:session — returns usage for a specific session */
app.get('/usage/:session', (req, res) => {
    try {
        const usage = getSessionUsage(req.params.session);
        if (!usage) {
            res.json({ session: req.params.session, prompts_sent: 0, cost_usd: 0 });
            return;
        }
        res.json(usage);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: message });
    }
});
/** GET /health/sessions — returns current SessionHealth[] from the health monitor */
app.get('/health/sessions', (_req, res) => {
    res.json(latestHealth);
});
/** GET /pane/:session/:window — capture and return current tmux pane output */
app.get('/pane/:session/:window', (req, res) => {
    const { session, window: win } = req.params;
    try {
        const raw = execSync(`tmux capture-pane -t "${session}:${win}" -p`, { encoding: 'utf8', timeout: 5000 }).trim();
        // Return last 50 lines
        const lines = raw.split('\n');
        const output = lines.slice(-50).join('\n');
        res.json({ session, window: win, output, timestamp: new Date().toISOString() });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        res.status(404).json({ error: `Failed to capture pane: ${msg}` });
    }
});
/** GET /logs/:session/:window — return full log file contents as plain text (streamed) */
app.get('/logs/:session/:window', (req, res) => {
    const { session, window: win } = req.params;
    const logFile = join(homedir(), '.claude-commander', 'logs', session, `${win}.log`);
    if (!existsSync(logFile)) {
        res.setHeader('Content-Type', 'text/plain');
        res.status(200).send('');
        return;
    }
    res.setHeader('Content-Type', 'text/plain');
    const stream = createReadStream(logFile, { encoding: 'utf8' });
    stream.pipe(res);
    stream.on('error', () => {
        res.status(200).send('');
    });
});
/** GET /logs/:session/:window/tail?lines=100 — return the last N lines of the log */
app.get('/logs/:session/:window/tail', (req, res) => {
    const { session, window: win } = req.params;
    const linesParam = typeof req.query['lines'] === 'string' ? parseInt(req.query['lines'], 10) : 100;
    const numLines = isNaN(linesParam) || linesParam < 1 ? 100 : linesParam;
    const logFile = join(homedir(), '.claude-commander', 'logs', session, `${win}.log`);
    if (!existsSync(logFile)) {
        res.setHeader('Content-Type', 'text/plain');
        res.status(200).send('');
        return;
    }
    try {
        const content = readFileSync(logFile, 'utf8');
        const lines = content.split('\n');
        const tail = lines.slice(-numLines).join('\n');
        res.setHeader('Content-Type', 'text/plain');
        res.status(200).send(tail);
    }
    catch {
        res.setHeader('Content-Type', 'text/plain');
        res.status(200).send('');
    }
});
/** POST /lockdown — emergency lockdown; rejects all non-health traffic with 503 */
app.post('/lockdown', (_req, res) => {
    lockdown = true;
    console.warn('[bridge] LOCKDOWN activated');
    logLifecycle('lockdown', 'Lockdown activated');
    res.json({ ok: true, lockdown: true });
});
/** POST /unlock — clears lockdown; only accepted from 127.0.0.1 */
app.post('/unlock', (req, res) => {
    const ip = req.ip ?? req.socket.remoteAddress ?? '';
    if (ip !== '127.0.0.1' && ip !== '::1' && ip !== '::ffff:127.0.0.1') {
        res.status(403).json({ error: 'Unlock only permitted from localhost' });
        return;
    }
    lockdown = false;
    console.log('[bridge] Lockdown cleared');
    logLifecycle('unlock', 'Lockdown cleared');
    res.json({ ok: true, lockdown: false });
});
// ---------------------------------------------------------------------------
// Memory endpoints
// ---------------------------------------------------------------------------
/** GET /memory/facts?domain=X&project=Y — returns stored core facts */
app.get('/memory/facts', (req, res) => {
    try {
        const domain = typeof req.query['domain'] === 'string' ? req.query['domain'] : undefined;
        const project = typeof req.query['project'] === 'string' ? req.query['project'] : undefined;
        const facts = getFacts(domain, project);
        res.json({ facts, count: facts.length });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: message });
    }
});
/** GET /memory/recall?query=X&domain=Y&limit=N — searches memory and returns excerpts */
app.get('/memory/recall', (req, res) => {
    try {
        const query = typeof req.query['query'] === 'string' ? req.query['query'] : '';
        const domain = typeof req.query['domain'] === 'string' ? req.query['domain'] : undefined;
        const limit = typeof req.query['limit'] === 'string' ? parseInt(req.query['limit'], 10) : 5;
        if (!query) {
            res.status(400).json({ error: 'query parameter is required' });
            return;
        }
        const result = recallMemory(query, domain, isNaN(limit) ? 5 : limit);
        res.json({ result });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: message });
    }
});
/** GET /memory/learnings?domain=X — returns learnings for a domain */
app.get('/memory/learnings', (req, res) => {
    try {
        const domain = typeof req.query['domain'] === 'string' ? req.query['domain'] : undefined;
        const query = typeof req.query['query'] === 'string' ? req.query['query'] : undefined;
        const learnings = getLearnings(domain, query);
        res.json({ learnings, count: learnings.length });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: message });
    }
});
/** POST /memory/fact — saves a new core fact */
app.post('/memory/fact', (req, res) => {
    try {
        const { fact, domain, project, source } = req.body;
        if (!fact || typeof fact !== 'string') {
            res.status(400).json({ error: 'Body must contain a non-empty "fact" string' });
            return;
        }
        if (!domain || typeof domain !== 'string') {
            res.status(400).json({ error: 'Body must contain a non-empty "domain" string' });
            return;
        }
        if (!source || typeof source !== 'string') {
            res.status(400).json({ error: 'Body must contain a non-empty "source" string' });
            return;
        }
        const saved = saveFact({ fact, domain, project, source });
        res.status(201).json(saved);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: message });
    }
});
/** POST /memory/learning — saves a new learning entry */
app.post('/memory/learning', (req, res) => {
    try {
        const { title, content, domain, tags, source } = req.body;
        if (!title || typeof title !== 'string') {
            res.status(400).json({ error: 'Body must contain a non-empty "title" string' });
            return;
        }
        if (!content || typeof content !== 'string') {
            res.status(400).json({ error: 'Body must contain a non-empty "content" string' });
            return;
        }
        if (!domain || typeof domain !== 'string') {
            res.status(400).json({ error: 'Body must contain a non-empty "domain" string' });
            return;
        }
        if (!source || typeof source !== 'object') {
            res.status(400).json({ error: 'Body must contain a "source" object with project, worker, task' });
            return;
        }
        const saved = saveLearning({
            title,
            content,
            domain,
            tags: Array.isArray(tags) ? tags : [],
            source,
        });
        res.status(201).json(saved);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: message });
    }
});
// ---------------------------------------------------------------------------
// Performance endpoints
// ---------------------------------------------------------------------------
/** GET /performance/workers — returns per-worker performance metrics */
app.get('/performance/workers', (_req, res) => {
    try {
        const performance = loadWorkerPerformance();
        res.json(performance);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: message });
    }
});
/** GET /performance/templates — returns per-template performance metrics */
app.get('/performance/templates', (_req, res) => {
    try {
        const performance = loadTemplatePerformance();
        res.json(performance);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: message });
    }
});
// ---------------------------------------------------------------------------
// Self-evolution endpoints
// ---------------------------------------------------------------------------
/** GET /proposals — list pending optimization proposals */
app.get('/proposals', (_req, res) => {
    try {
        const proposals = getPendingProposals();
        res.json({ proposals, count: proposals.length });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: message });
    }
});
/** POST /proposals/:id/approve — approve a proposal */
app.post('/proposals/:id/approve', (req, res) => {
    const { id } = req.params;
    const source = req.ip ?? req.socket.remoteAddress ?? 'api';
    try {
        approveProposal(id, source);
        res.json({ ok: true, id, action: 'approved' });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(404).json({ error: message });
    }
});
/** POST /proposals/:id/reject — reject a proposal (optional body.reason) */
app.post('/proposals/:id/reject', (req, res) => {
    const { id } = req.params;
    const source = req.ip ?? req.socket.remoteAddress ?? 'api';
    const reason = typeof req.body.reason === 'string'
        ? req.body.reason
        : undefined;
    try {
        rejectProposal(id, source, reason);
        res.json({ ok: true, id, action: 'rejected' });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(404).json({ error: message });
    }
});
/** GET /alerts — list all drift alerts */
app.get('/alerts', (_req, res) => {
    try {
        const alerts = getAllAlerts();
        res.json({ alerts, count: alerts.length });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: message });
    }
});
/** POST /alerts/:id/acknowledge — acknowledge a drift alert */
app.post('/alerts/:id/acknowledge', (req, res) => {
    const { id } = req.params;
    try {
        acknowledgeAlert(id);
        res.json({ ok: true, id, action: 'acknowledged' });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(404).json({ error: message });
    }
});
/** GET /ab-tests — list all A/B tests */
app.get('/ab-tests', (_req, res) => {
    try {
        const tests = listABTests();
        res.json({ tests, count: tests.length });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: message });
    }
});
/** POST /ab-tests — create a new A/B test for a worker role definition */
app.post('/ab-tests', (req, res) => {
    const { worker, challengerClaudeMd } = req.body;
    if (!worker || typeof worker !== 'string') {
        res.status(400).json({ error: 'Body must contain a non-empty "worker" string' });
        return;
    }
    if (!challengerClaudeMd || typeof challengerClaudeMd !== 'string') {
        res.status(400).json({ error: 'Body must contain a non-empty "challengerClaudeMd" string' });
        return;
    }
    try {
        const test = createABTest(worker, challengerClaudeMd);
        res.status(201).json(test);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(409).json({ error: message });
    }
});
/** GET /role-history/:worker — return version history for a worker role */
app.get('/role-history/:worker', (req, res) => {
    const { worker } = req.params;
    try {
        const history = getRoleHistory(worker);
        res.json({ worker, history, count: history.length });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: message });
    }
});
// ---------------------------------------------------------------------------
// Budget endpoints
// ---------------------------------------------------------------------------
/** POST /budget/:project — set budget for a project */
app.post('/budget/:project', authMiddleware, (req, res) => {
    const { project } = req.params;
    const projectPath = decodeURIComponent(String(project));
    const { total_usd, allocated } = req.body;
    if (total_usd === undefined || typeof total_usd !== 'number' || total_usd < 0) {
        res.status(400).json({ error: 'Body must contain a non-negative "total_usd" number' });
        return;
    }
    try {
        const budget = setBudget(projectPath, total_usd, allocated);
        res.status(201).json(budget);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: message });
    }
});
/** GET /budget/:project — get budget status for a project */
app.get('/budget/:project', authMiddleware, (req, res) => {
    const { project } = req.params;
    const projectPath = decodeURIComponent(String(project));
    try {
        const check = checkBudget(projectPath);
        const summary = getBudgetSummary(projectPath);
        res.json({ ...check, summary });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: message });
    }
});
// ---------------------------------------------------------------------------
// Findings endpoints
// ---------------------------------------------------------------------------
/** GET /findings/:project — get all findings, with optional filtering */
app.get('/findings/:project', authMiddleware, (req, res) => {
    const { project } = req.params;
    const projectPath = decodeURIComponent(String(project));
    const severity = typeof req.query['severity'] === 'string' ? req.query['severity'] : undefined;
    const type = typeof req.query['type'] === 'string' ? req.query['type'] : undefined;
    const verifiedParam = typeof req.query['verified'] === 'string' ? req.query['verified'] : undefined;
    try {
        const findingsFile = join(projectPath, '.claude-coord', 'findings.json');
        let findings = [];
        if (existsSync(findingsFile)) {
            findings = JSON.parse(readFileSync(findingsFile, 'utf8'));
        }
        if (severity)
            findings = findings.filter((f) => f['severity'] === severity);
        if (type)
            findings = findings.filter((f) => f['type'] === type);
        if (verifiedParam !== undefined) {
            const wantVerified = verifiedParam === 'true';
            findings = findings.filter((f) => Boolean(f['verified']) === wantVerified);
        }
        res.json({ findings, count: findings.length });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: message });
    }
});
// ---------------------------------------------------------------------------
// Verification endpoints
// ---------------------------------------------------------------------------
/** POST /verify/:project — run verification pipeline on project findings */
app.post('/verify/:project', authMiddleware, (req, res) => {
    const { project } = req.params;
    const projectPath = decodeURIComponent(String(project));
    const body = req.body;
    const stagesRaw = body.stages;
    const stages = Array.isArray(stagesRaw) ? stagesRaw : [1, 2, 3, 4, 5];
    const domain = body.domain ?? 'general';
    try {
        const findingsFile = join(projectPath, '.claude-coord', 'findings.json');
        if (!existsSync(findingsFile)) {
            res.status(404).json({ error: 'No findings.json found for this project' });
            return;
        }
        const findings = JSON.parse(readFileSync(findingsFile, 'utf8'));
        const config = {
            stages: stages.filter((s) => [1, 2, 3, 4, 5].includes(s)),
            domain,
            escalateDisagreements: false,
        };
        const results = runVerification(findings, config);
        const summary = getVerificationSummary(results);
        res.json({ summary, results });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: message });
    }
});
// ---------------------------------------------------------------------------
// Report endpoints
// ---------------------------------------------------------------------------
/** GET /report/:project — generate a project report */
app.get('/report/:project', authMiddleware, (req, res) => {
    const { project } = req.params;
    const projectPath = decodeURIComponent(String(project));
    const format = (req.query['format'] === 'html' ? 'html' : 'json');
    const type = (req.query['type'] === 'executive' ? 'executive' : 'technical');
    const domain = typeof req.query['domain'] === 'string' ? req.query['domain'] : 'general';
    try {
        // Load findings from project coordination directory
        const findingsFile = join(projectPath, '.claude-coord', 'findings.json');
        let findings = [];
        if (existsSync(findingsFile)) {
            findings = JSON.parse(readFileSync(findingsFile, 'utf8'));
        }
        if (type === 'executive') {
            const title = `Executive Summary — ${basename(projectPath)}`;
            const report = generateExecutiveSummary(findings, domain, title);
            if (format === 'html') {
                res.setHeader('Content-Type', 'text/html');
                res.send(report.content);
            }
            else {
                res.json(report);
            }
            return;
        }
        const config = {
            format,
            type,
            domain,
            title: `Report — ${basename(projectPath)}`,
            includeEvidence: true,
            includeCrossRefs: false,
            includeVerification: false,
        };
        const report = generateReport(findings, config);
        if (format === 'html') {
            res.setHeader('Content-Type', 'text/html');
            res.send(report.content);
        }
        else {
            res.json(report);
        }
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: message });
    }
});
// ---------------------------------------------------------------------------
// Cost estimate endpoint
// ---------------------------------------------------------------------------
/** GET /cost/estimate — estimate cost before starting analysis */
app.get('/cost/estimate', authMiddleware, (req, res) => {
    const pagesParam = typeof req.query['pages'] === 'string' ? req.query['pages'] : '100';
    const template = typeof req.query['template'] === 'string' ? req.query['template'] : 'custom';
    const pages = parseInt(pagesParam, 10);
    if (isNaN(pages) || pages < 1) {
        res.status(400).json({ error: '"pages" must be a positive integer' });
        return;
    }
    try {
        const estimate = estimateCost(pages, template);
        res.json(estimate);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: message });
    }
});
// ---------------------------------------------------------------------------
// Compliance / Audit trail endpoints
// ---------------------------------------------------------------------------
/** GET /audit-trail/:project — export the audit trail */
app.get('/audit-trail/:project', authMiddleware, (req, res) => {
    const { project } = req.params;
    const projectPath = decodeURIComponent(String(project));
    const format = req.query['format'] === 'csv' ? 'csv' : 'json';
    try {
        const trail = exportAuditTrail(projectPath, format);
        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="audit-trail.csv"');
            res.send(trail);
        }
        else {
            res.json(JSON.parse(trail));
        }
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: message });
    }
});
/** POST /audit-trail/:project/verify — verify audit chain integrity */
app.post('/audit-trail/:project/verify', authMiddleware, (req, res) => {
    const { project } = req.params;
    const projectPath = decodeURIComponent(String(project));
    try {
        const result = verifyAuditChain(projectPath);
        const status = result.valid ? 200 : 409;
        res.status(status).json(result);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: message });
    }
});
// ---------------------------------------------------------------------------
// Recovery endpoints
// ---------------------------------------------------------------------------
/** GET /recovery/status — returns current PaneState for all monitored windows */
app.get('/recovery/status', (_req, res) => {
    try {
        const states = getAllPaneStates();
        res.json({ states, count: states.length });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: message });
    }
});
/** POST /recovery/continue/:session/:window — manually trigger continue */
app.post('/recovery/continue/:session/:window', (req, res) => {
    const { session, window: win } = req.params;
    try {
        manualContinue(session, win);
        res.json({ ok: true, target: `${session}:${win}`, action: 'continue_sent' });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: message });
    }
});
/** POST /recovery/resume-swarm — resume from saved swarm state */
app.post('/recovery/resume-swarm', (_req, res) => {
    try {
        const state = loadSwarmState();
        if (!state) {
            res.status(404).json({ error: 'No saved swarm state found' });
            return;
        }
        const result = resumeSwarm(state);
        res.json({ ok: true, ...result });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: message });
    }
});
/** GET /recovery/swarm-state — returns current swarm state */
app.get('/recovery/swarm-state', (_req, res) => {
    try {
        const state = getCurrentSwarmState();
        if (!state) {
            res.json({ state: null });
            return;
        }
        res.json({ state });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: message });
    }
});
// ---------------------------------------------------------------------------
// Knowledge Base RAG endpoints
// ---------------------------------------------------------------------------
const KB_SCRIPT = join(__dirname, '..', '..', 'training', 'query-rag.py');
const KB_INDEX = join(__dirname, '..', '..', 'training', 'rag-index', 'index.json');
/** GET /kb/search?q=...&top=5&guideline=...&severity=...&jurisdiction=...
 *  BM25 full-text search over the pharma regulatory knowledge base.
 *  Returns top matching rules with source citations, verbatim quotes, thresholds.
 */
app.get('/kb/search', (_req, res) => {
    const q = String(_req.query.q || '').trim();
    if (!q) {
        res.status(400).json({ error: 'Missing query parameter: q' });
        return;
    }
    if (!existsSync(KB_INDEX)) {
        res.status(503).json({ error: 'Knowledge base index not built. Run: python3 training/build-rag-index.py' });
        return;
    }
    const top = Math.min(parseInt(String(_req.query.top || '5'), 10) || 5, 20);
    const guideline = String(_req.query.guideline || '');
    const severity = String(_req.query.severity || '');
    const jurisdiction = String(_req.query.jurisdiction || '');
    const args = [KB_SCRIPT, q, '--top', String(top), '--json'];
    if (guideline)
        args.push('--guideline', guideline);
    if (severity)
        args.push('--severity', severity);
    if (jurisdiction)
        args.push('--jurisdiction', jurisdiction);
    try {
        const result = execSync(`python3 ${args.map(a => JSON.stringify(a)).join(' ')}`, {
            timeout: 10000,
            encoding: 'utf8',
        });
        const results = JSON.parse(result);
        res.json({ query: q, count: results.length, results });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: `KB search failed: ${message}` });
    }
});
/** GET /kb/stats — knowledge base index statistics */
app.get('/kb/stats', (_req, res) => {
    const metaFile = join(__dirname, '..', '..', 'training', 'rag-index', 'meta.json');
    if (!existsSync(metaFile)) {
        res.status(503).json({ error: 'Knowledge base index not built. Run: python3 training/build-rag-index.py' });
        return;
    }
    try {
        const meta = JSON.parse(readFileSync(metaFile, 'utf8'));
        res.json(meta);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: message });
    }
});
// ---------------------------------------------------------------------------
// HTTP + WebSocket server
// ---------------------------------------------------------------------------
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
/** Latest health snapshot — served by GET /health/sessions */
let latestHealth = [];
/** Push a health update to all connected WebSocket clients */
function pushHealthUpdate(health) {
    latestHealth = health;
    if (wss.clients.size === 0)
        return;
    const payload = JSON.stringify({ type: 'health_update', data: health });
    for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    }
}
/** Push a session-dead alert to all connected WebSocket clients */
function pushSessionDead(session, window) {
    if (wss.clients.size === 0)
        return;
    const payload = JSON.stringify({ type: 'session_dead', data: { session, window } });
    for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    }
}
/** Broadcast current session tree to all connected WebSocket clients */
function pushStatusUpdate() {
    if (wss.clients.size === 0)
        return;
    const tree = getSessionTree();
    const payload = JSON.stringify({ type: 'status', data: tree });
    for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    }
}
/** Push a coordination status change to all WebSocket clients */
function pushCoordinationUpdate(data) {
    if (wss.clients.size === 0)
        return;
    const payload = JSON.stringify({ type: 'coordination_update', data });
    for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    }
}
/** Push an approval-needed event to all WebSocket clients */
function pushApprovalNeeded(data) {
    if (wss.clients.size === 0)
        return;
    const payload = JSON.stringify({ type: 'approval_needed', data });
    for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    }
}
/** Track which pane keys (session:window) each WebSocket client is subscribed to */
const paneSubscriptions = new Map();
wss.on('connection', (ws, req) => {
    const url = req.url ?? '';
    // Validate token from query string
    if (!validateWsToken(url)) {
        ws.close(4001, 'Unauthorized');
        return;
    }
    // Send full session tree on connect
    const tree = getSessionTree();
    ws.send(JSON.stringify({ type: 'status', data: tree }));
    ws.on('message', (raw) => {
        try {
            const parsed = JSON.parse(String(raw));
            if (parsed.type === 'subscribe_pane') {
                const key = `${parsed.session}:${parsed.window}`;
                let subs = paneSubscriptions.get(ws);
                if (!subs) {
                    subs = new Set();
                    paneSubscriptions.set(ws, subs);
                }
                subs.add(key);
            }
            if (parsed.type === 'unsubscribe_pane') {
                const key = `${parsed.session}:${parsed.window}`;
                const subs = paneSubscriptions.get(ws);
                if (subs)
                    subs.delete(key);
            }
        }
        catch {
            // Ignore malformed messages
        }
    });
    ws.on('error', (err) => {
        console.error('[ws] Client error:', err.message);
    });
    ws.on('close', () => {
        paneSubscriptions.delete(ws);
    });
});
// Pane output streaming — captures tmux pane content every second and pushes to subscribers.
// Only sends when output has changed since the last capture for each pane key.
const lastPaneOutput = new Map();
/** Tracks which log directories have already been created */
const logDirsCreated = new Set();
/** Returns the log file path for a given session:window */
function getLogFilePath(session, window) {
    return join(homedir(), '.claude-commander', 'logs', session, `${window}.log`);
}
/** Ensures the log directory exists (creates on first call per session) */
function ensureLogDir(session) {
    const dirPath = join(homedir(), '.claude-commander', 'logs', session);
    if (!logDirsCreated.has(dirPath)) {
        mkdirSync(dirPath, { recursive: true });
        logDirsCreated.add(dirPath);
    }
}
/** Diff new lines from previous output and append them to the log file */
function appendNewLinesToLog(session, window, output, prev) {
    ensureLogDir(session);
    const logFile = getLogFilePath(session, window);
    const timestamp = new Date().toISOString();
    if (prev === undefined) {
        // First capture — write all lines as the starting point
        const lines = output.split('\n');
        const logContent = lines.map(line => `[${timestamp}] ${line}\n`).join('');
        appendFileSync(logFile, logContent);
        return;
    }
    // Diff: find new lines by comparing against previous output
    const prevLines = prev.split('\n');
    const newLines = output.split('\n');
    // Find lines in newLines that weren't in prevLines
    // Simple approach: if the new output ends with lines not in prev, those are new
    let matchStart = -1;
    if (newLines.length > 0 && prevLines.length > 0) {
        // Find where the previous output's last lines appear in the new output
        for (let i = 0; i <= newLines.length - prevLines.length; i++) {
            let match = true;
            for (let j = 0; j < prevLines.length; j++) {
                if (newLines[i + j] !== prevLines[j]) {
                    match = false;
                    break;
                }
            }
            if (match) {
                matchStart = i;
            }
        }
    }
    let diffLines;
    if (matchStart >= 0) {
        // Previous output found within new output — new lines are after it
        diffLines = newLines.slice(matchStart + prevLines.length);
    }
    else {
        // No overlap found — log all new lines
        diffLines = newLines;
    }
    if (diffLines.length > 0) {
        const logContent = diffLines.map(line => `[${timestamp}] ${line}\n`).join('');
        appendFileSync(logFile, logContent);
    }
}
// Map of "session:window" → list of files that worker has touched
const workerFiles = new Map();
/**
 * Parse pane output for file paths that Claude Code has written or edited.
 * Claude Code output varies — it may say:
 *   - "Wrote to /path/file.json"
 *   - "File created successfully at: /path/file.json"
 *   - "The file /path/file.json has been updated successfully."
 *   - "Both files written to `training/output-v5/`."
 *   - "- `filename.json`"  (backtick-wrapped filenames in summaries)
 *   - Direct path references like training/output-v5/foo.json
 *
 * We use broad patterns and validate that the file actually exists on disk.
 */
function detectFileActivity(session, window, output) {
    const key = `${session}:${window}`;
    const existing = workerFiles.get(key) ?? [];
    const now = new Date().toISOString();
    const detectedPaths = new Set();
    // Pattern 1: Explicit write/create/edit messages with full paths
    const explicitPatterns = [
        /(?:Wrote to|Write to|Written to|Created|File created successfully at:?)\s+[`"]?([\/~][^\s`"]+)[`"]?/gi,
        /(?:The file)\s+[`"]?([\/~][^\s`"]+)[`"]?\s+has been (?:updated|created)/gi,
        /(?:Edit applied to|Updated)\s+[`"]?([\/~][^\s`"]+)[`"]?/gi,
        /(?:has been updated successfully)[.:]?\s*[`"]?([\/~][^\s`"]+)[`"]?/gi,
    ];
    for (const regex of explicitPatterns) {
        let match;
        while ((match = regex.exec(output)) !== null) {
            detectedPaths.add(match[1].replace(/[`'".,)]+$/, ''));
        }
    }
    // Pattern 2: Backtick-wrapped filenames (common in Claude summaries)
    // e.g. `training/output-v5/test-worker-a.json` or `test-worker-b.json`
    const backtickPaths = output.matchAll(/`([^`]+\.\w{1,5})`/g);
    for (const match of backtickPaths) {
        const candidate = match[1].trim();
        // Must have a file extension and not be a code snippet
        if (candidate.includes('/') || candidate.match(/\.\w{1,5}$/)) {
            detectedPaths.add(candidate);
        }
    }
    // Pattern 3: "written to `directory/`" + subsequent filenames
    const dirPattern = /written to\s+[`"]?([^\s`"]+\/)[`"]?/gi;
    let dirMatch;
    while ((dirMatch = dirPattern.exec(output)) !== null) {
        const dir = dirMatch[1];
        // Look for filenames mentioned near this line (backtick-wrapped or after "- ")
        const nearbyFiles = output.matchAll(/[-•]\s*[`"]?([a-zA-Z0-9_-]+\.\w{1,5})[`"]?/g);
        for (const fm of nearbyFiles) {
            detectedPaths.add(dir + fm[1]);
        }
    }
    // Now resolve and validate each detected path
    let newFiles = false;
    for (let rawPath of detectedPaths) {
        // Resolve relative paths — try common working directories
        let fullPath = rawPath;
        if (!rawPath.startsWith('/') && !rawPath.startsWith('~')) {
            // Try resolving relative to known project directories
            const candidates = [
                join(homedir(), '.gemini/antigravity/scratch/Claude Commander', rawPath),
                join(process.cwd(), rawPath),
            ];
            fullPath = candidates.find(c => existsSync(c)) ?? candidates[0];
        }
        else if (rawPath.startsWith('~')) {
            fullPath = rawPath.replace('~', homedir());
        }
        // Clean up path
        fullPath = fullPath.replace(/[`'"]+/g, '');
        // Skip if already tracked
        if (existing.some(f => f.path === fullPath))
            continue;
        // Only track files that actually exist on disk
        if (!existsSync(fullPath))
            continue;
        // Determine action based on context
        const action = 'wrote';
        existing.push({ path: fullPath, action, timestamp: now });
        newFiles = true;
    }
    if (newFiles) {
        workerFiles.set(key, existing);
        // Push file_activity event to ALL connected WebSocket clients
        const message = JSON.stringify({
            type: 'file_activity',
            data: { session, window, files: existing, timestamp: now }
        });
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }
}
// REST endpoint: GET /files/:session/:window — list files a worker has written
app.get('/files/:session/:window', authMiddleware, (req, res) => {
    const key = `${req.params.session}:${req.params.window}`;
    const files = workerFiles.get(key) ?? [];
    res.json({ session: req.params.session, window: req.params.window, files });
});
// REST endpoint: GET /files/:session — list all files across all windows in a session
app.get('/files/:session', authMiddleware, (req, res) => {
    const session = req.params.session;
    const result = {};
    for (const [key, files] of workerFiles.entries()) {
        if (key.startsWith(`${session}:`)) {
            const window = key.split(':')[1];
            result[window] = files;
        }
    }
    res.json({ session, windows: result });
});
const paneStreamInterval = setInterval(() => {
    // Collect all unique pane keys that any client is subscribed to
    const allKeys = new Set();
    for (const subs of paneSubscriptions.values()) {
        for (const key of subs)
            allKeys.add(key);
    }
    // Clean up cache entries for panes nobody is subscribed to
    for (const cachedKey of lastPaneOutput.keys()) {
        if (!allKeys.has(cachedKey))
            lastPaneOutput.delete(cachedKey);
    }
    // Capture each pane once, send to all subscribers only when output has changed
    for (const key of allKeys) {
        const [session, window] = key.split(':');
        try {
            const raw = execSync(`tmux capture-pane -t "${session}:${window}" -p`, { encoding: 'utf8', timeout: 5000 }).trim();
            // Keep last 50 lines
            const lines = raw.split('\n');
            const output = lines.slice(-50).join('\n');
            // Only push if output changed since last capture
            const prev = lastPaneOutput.get(key);
            if (output === prev)
                continue;
            // Append new lines to log file on disk
            appendNewLinesToLog(session, window, output, prev);
            // Detect file writes in the new output
            detectFileActivity(session, window, output);
            lastPaneOutput.set(key, output);
            const message = JSON.stringify({
                type: 'pane_output',
                data: { session, window, output, timestamp: new Date().toISOString() }
            });
            for (const [client, subs] of paneSubscriptions.entries()) {
                if (subs.has(key) && client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            }
        }
        catch {
            // Pane may not exist — ignore
        }
    }
}, 1000);
// ---------------------------------------------------------------------------
// File scan loop — runs on ALL tmux panes regardless of subscription
// Scans every 3 seconds for file activity in pane output
// ---------------------------------------------------------------------------
const lastFileOutput = new Map();
const fileScanInterval = setInterval(() => {
    try {
        // Get all tmux sessions and windows
        const tree = getSessionTree();
        for (const session of tree.sessions) {
            for (const win of session.windows) {
                const key = `${session.name}:${win.name}`;
                // Skip if already being captured by the pane stream (subscribed)
                const isSubscribed = Array.from(paneSubscriptions.values()).some(s => s.has(key));
                if (isSubscribed)
                    continue; // pane stream already handles this
                try {
                    const raw = execSync(`tmux capture-pane -t "${session.name}:${win.name}" -p -S -100`, { encoding: 'utf8', timeout: 5000 }).trim();
                    // Only process if output changed
                    const prev = lastFileOutput.get(key);
                    if (raw === prev)
                        continue;
                    lastFileOutput.set(key, raw);
                    // Run file detection on the full pane output
                    detectFileActivity(session.name, win.name, raw);
                }
                catch {
                    // Pane may not exist — ignore
                }
            }
        }
    }
    catch {
        // tmux not available or no sessions — ignore
    }
}, 3000);
// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------
const token = loadOrGenerateToken();
console.log('[bridge] Claude Commander starting…');
console.log(`[bridge] Auth token: ${token}`);
console.log(`[bridge] Binding to http://${HOST}:${PORT}`);
httpServer.listen(PORT, HOST, () => {
    console.log(`[bridge] Listening on http://${HOST}:${PORT}`);
    logLifecycle('start', `Listening on ${HOST}:${PORT}`);
});
// ---------------------------------------------------------------------------
// Health monitor — checks tmux pane PIDs every 10 s
// ---------------------------------------------------------------------------
const stopHealthMonitor = startHealthMonitor({
    onHealthUpdate: (health) => pushHealthUpdate(health),
    onSessionDead: (session, window) => {
        console.warn(`[bridge] Session dead: ${session}:${window}`);
        pushSessionDead(session, window);
    },
});
console.log('[bridge] Health monitor started (10 s interval)');
// ---------------------------------------------------------------------------
// Recovery monitor — detects stalled / rate-limited workers every 15 s
// ---------------------------------------------------------------------------
/** Push recovery events to all connected WebSocket clients */
function pushRecoveryEvent(type, data) {
    if (wss.clients.size === 0)
        return;
    const payload = JSON.stringify({ type, data });
    for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    }
}
const stopRecoveryMonitor = startRecoveryMonitor({
    onWorkerStalled: (session, window, stalledFor) => {
        console.warn(`[bridge] Worker stalled: ${session}:${window} (${Math.round(stalledFor / 1000)}s)`);
        pushRecoveryEvent('worker_stalled', { session, window, stalledFor });
    },
    onWorkerRateLimited: (session, window, nextRefresh) => {
        console.warn(`[bridge] Worker rate-limited: ${session}:${window}`);
        pushRecoveryEvent('worker_rate_limited', { session, window, nextRefresh });
    },
    onWorkerRecovered: (session, window, method) => {
        console.log(`[bridge] Worker recovered: ${session}:${window} via ${method}`);
        pushRecoveryEvent('worker_recovered', { session, window, method });
    },
    onSwarmStateUpdate: (state) => {
        pushRecoveryEvent('swarm_state_update', { state: state });
    },
});
console.log('[bridge] Recovery monitor started (15 s interval)');
// ---------------------------------------------------------------------------
// File watcher — monitors .claude-coord/ across all configured project paths
// ---------------------------------------------------------------------------
const projectPaths = getProjectPaths();
const stopWatcher = startWatcher(projectPaths, {
    onStatusChange: (filepath, status) => {
        pushCoordinationUpdate({ filepath, status });
    },
    onApprovalNeeded: (project, worker, status) => {
        pushApprovalNeeded({ project, worker, status });
    },
});
if (projectPaths.length > 0) {
    console.log(`[bridge] Watching coordination files in ${projectPaths.length} project(s)`);
}
// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
function shutdown(signal) {
    console.log(`\n[bridge] Received ${signal}, shutting down…`);
    logLifecycle('stop', `Received ${signal}`);
    // Stop health monitor
    stopHealthMonitor();
    // Stop recovery monitor
    stopRecoveryMonitor();
    // Stop file watcher
    stopWatcher();
    // Stop pane streaming interval
    clearInterval(paneStreamInterval);
    wss.close(() => {
        httpServer.close(() => {
            console.log('[bridge] Server closed. Goodbye.');
            process.exit(0);
        });
    });
    // Force exit after 5 s if graceful shutdown hangs
    setTimeout(() => {
        console.error('[bridge] Force exit after timeout');
        process.exit(1);
    }, 5000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
//# sourceMappingURL=index.js.map