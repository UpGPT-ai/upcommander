#!/usr/bin/env node
/**
 * claude-commander CLI — route prompts to tmux sessions hosting Claude agents.
 *
 * Usage:
 *   claude-commander start [--port PORT]
 *   claude-commander init <project-name> <project-path> --template <name>
 *   claude-commander init <project-name> <project-path> --workers <w1,w2,...>
 *   claude-commander send <session>:<window> "<prompt>"
 *   claude-commander broadcast <session> "<prompt>"
 *   claude-commander tree
 *   claude-commander pair
 *   claude-commander templates
 *   claude-commander template-create <name> --workers <csv> --description "..."
 *   claude-commander help
 */
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, basename } from 'node:path';
import { getSessionTree, sendKeys, broadcastToSession, broadcastToAll, createSession, sessionExists, } from '../lib/tmux.js';
import { loadOrGenerateToken, getToken } from '../lib/auth.js';
import { logSend, logBroadcast, logLifecycle } from '../lib/audit.js';
import { getTemplate, listTemplates, createCustomTemplate, applyTemplate, } from '../lib/templates.js';
import { initCoordination, getCoordinationTree, generateWorkerClaudeMd, generateOrchestratorClaudeMd, } from '../lib/coordination.js';
import { registerSession, loadConfig, getProjectPaths, } from '../lib/config.js';
import { saveAllSessions, restoreAllSessions, listSnapshots } from '../lib/persistence.js';
import { getSystemMetrics } from '../lib/metrics.js';
import { checkAllHealth } from '../lib/health.js';
import { getFacts } from '../lib/memory.js';
import { recallMemory } from '../lib/memory-context.js';
import { loadWorkerPerformance } from '../lib/performance.js';
import { getPendingProposals, approveProposal, rejectProposal, } from '../lib/optimizer.js';
import { getAllAlerts } from '../lib/drift-detector.js';
import { getRoleHistory } from '../lib/version-history.js';
import { setBudget, checkBudget, estimateCost, getBudgetSummary } from '../lib/budget.js';
import { generateReport, generateExecutiveSummary } from '../lib/reports.js';
import { runVerification, getVerificationSummary, } from '../lib/verification.js';
import { runRecoveryCheck, loadSwarmState, resumeSwarm, manualContinue, } from '../lib/session-recovery.js';
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
function printHelp() {
    console.log(`
claude-commander — route prompts to tmux sessions running Claude agents

USAGE
  claude-commander <command> [options]

COMMANDS
  start [--port PORT]
    Start the bridge server (default port: 3000).
    Prints the auth token and pairing URL.

  init <project-name> <project-path> --workers <w1,w2,...>
    Create a new tmux session with named worker windows, each running claude.
    Example: claude-commander init paula ~/projects/paula --workers orchestrator,backend,frontend,tests

  send <session>:<window> "<prompt>"
    Send a prompt to a specific session:window.

  broadcast <session> "<prompt>"
    Broadcast a prompt to all windows in a session.

  broadcast-all "<prompt>"
    Broadcast a prompt to every window in every session.

  coord-init <session-or-path> [--workers <w1,w2,...>]
    Initialise .claude-coord/ directory structure in a project.
    Looks up project path from session registry, or use a direct path.
    Example: claude-commander coord-init myproject --workers backend,frontend

  status [project-name-or-path]
    Show coordination status for a project or all configured projects.
    Displays worker name, state, progress, and current task.

  tree
    Pretty-print the full tmux session tree.

  pair
    Display the auth token and pairing information.

  save
    Snapshot the current tmux session state to ~/.claude-commander/snapshots/.

  restore
    Restore tmux sessions from the latest snapshot.

  metrics
    Print system-wide and per-project agent metrics in a table.

  health
    Print the current health status of all tmux session windows.

  recall "<query>" [--domain X]
    Search agent memory (learnings + facts) for a keyword or phrase.
    Optional --domain filters to a specific domain (e.g. software-dev).

  performance
    Print a table of per-worker performance metrics (tasks, quality, cost).

  facts [--domain X] [--project Y]
    List stored core facts, optionally filtered by domain or project.

  proposals
    List pending optimization proposals for worker role definitions.

  approve-proposal <id>
    Approve a pending optimization proposal (records approval; apply CLAUDE.md changes manually).

  reject-proposal <id> [reason]
    Reject a pending optimization proposal with an optional reason.

  alerts
    List active drift alerts (task decomposition, quality regression, cost spike).

  role-history <worker>
    Show the version history of a worker's role definition (CLAUDE.md).

  verify <project-path> [--stages 1,2,3] [--domain sem]
    Run the verification pipeline on project findings.
    Stages default to 1,2,3,4,5. Use --stages to run a subset.

  report <project-path> [--format html] [--type executive] [--domain sem]
    Generate a project findings report (default: JSON, full).
    Use --format html for an HTML report, --type executive for critical/high only.

  budget <project-path> [--set <amount>]
    Show budget status for a project, or set the budget with --set <usd>.

  benchmark <suite-path>
    Run a template benchmark suite and print the cost estimate table.

  model-assign <session>:<window> <model-preset>
    Send a model-assignment directive to a specific tmux window.

  recovery-status
    Show stall/rate-limit state of all tmux windows.

  resume
    Resume workers from saved swarm state (~/.claude-commander/recovery/).

  continue <session>:<window>
    Manually send a "please continue" to a specific worker.

  help
    Show this help text.
`.trim());
}
function parseArgs(argv) {
    const result = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const next = argv[i + 1];
            if (next && !next.startsWith('--')) {
                result[key] = next;
                i++;
            }
            else {
                result[key] = true;
            }
        }
    }
    return result;
}
function die(message) {
    console.error(`Error: ${message}`);
    process.exit(1);
}
// ---------------------------------------------------------------------------
// Command implementations
// ---------------------------------------------------------------------------
function cmdStart(flags) {
    const port = flags['port'] ? Number(flags['port']) : 3000;
    if (isNaN(port) || port < 1 || port > 65535) {
        die(`Invalid port: ${flags['port']}`);
    }
    const token = loadOrGenerateToken();
    logLifecycle('start', `Bridge server starting on port ${port}`);
    const serverPath = join(__dirname, '..', 'server', 'index.js');
    const child = spawn(process.execPath, [serverPath], {
        env: { ...process.env, PORT: String(port), AUTH_TOKEN: token },
        stdio: 'inherit',
        detached: false,
    });
    child.on('error', (err) => {
        // If the compiled server doesn't exist, fall back to tsx for development
        if (err.code === 'MODULE_NOT_FOUND' || !existsSync(serverPath)) {
            const tsServerPath = join(__dirname, '..', 'server', 'index.ts');
            const tsx = spawn('tsx', [tsServerPath], {
                env: { ...process.env, PORT: String(port), AUTH_TOKEN: token },
                stdio: 'inherit',
                detached: false,
            });
            tsx.on('error', () => {
                console.error('Could not start server — ensure src/server/index.ts exists and tsx is installed.');
                process.exit(1);
            });
        }
        else {
            console.error('Failed to start bridge server:', err.message);
            process.exit(1);
        }
    });
    console.log(`Bridge server running on 127.0.0.1:${port}`);
    console.log(`Auth token: ${token}`);
    console.log(`Pair URL: https://100.x.x.x:${port} (configure Tailscale)`);
}
function cmdInit(argv) {
    // argv here starts after the subcommand: [project-name, project-path, --template|--workers, ...]
    const projectName = argv[0];
    const projectPathRaw = argv[1];
    if (!projectName)
        die('Missing <project-name>');
    if (!projectPathRaw)
        die('Missing <project-path>');
    const flags = parseArgs(argv.slice(2));
    const templateName = flags['template'];
    const workersRaw = flags['workers'];
    const projectPath = resolve(projectPathRaw.replace(/^~/, process.env.HOME ?? '~'));
    if (!existsSync(projectPath)) {
        die(`Project path does not exist: ${projectPath}`);
    }
    // ── Template mode ─────────────────────────────────────────────────────────
    if (templateName && typeof templateName === 'string') {
        const template = getTemplate(templateName);
        if (!template) {
            die(`Unknown template "${templateName}". Run "claude-commander templates" for available options.`);
        }
        try {
            applyTemplate(template, projectPath, projectName);
        }
        catch (err) {
            die(err.message);
        }
        // Persist session → project path mapping
        registerSession(projectName, projectPath);
        logLifecycle('init', `Created session "${projectName}" from template "${templateName}" with workers: ${template.workers.map((w) => w.name).join(', ')}`);
        console.log(`Session "${projectName}" created from template "${templateName}" with ${template.workers.length} window(s):`);
        template.workers.forEach((w, i) => {
            const prefix = i === template.workers.length - 1 ? '  └─' : '  ├─';
            console.log(`${prefix} ${w.name}  —  ${w.role}`);
        });
        console.log(`\nAttach with: tmux attach -t ${projectName}`);
        return;
    }
    // ── Manual workers mode ───────────────────────────────────────────────────
    if (!workersRaw || typeof workersRaw !== 'string') {
        die('Either --template <name> or --workers <comma-separated> is required');
    }
    const workers = workersRaw
        .split(',')
        .map((w) => w.trim())
        .filter(Boolean);
    if (workers.length === 0) {
        die('At least one worker name is required');
    }
    if (sessionExists(projectName)) {
        die(`tmux session "${projectName}" already exists`);
    }
    createSession(projectName, projectPath, workers);
    // Persist session → project path mapping for coord-init and status lookup
    registerSession(projectName, projectPath);
    logLifecycle('init', `Created session "${projectName}" with workers: ${workers.join(', ')}`);
    console.log(`Session "${projectName}" created with ${workers.length} window(s):`);
    workers.forEach((w, i) => {
        const prefix = i === workers.length - 1 ? '  └─' : '  ├─';
        console.log(`${prefix} ${w}`);
    });
    console.log(`\nAttach with: tmux attach -t ${projectName}`);
}
/**
 * List all available templates (built-in + custom).
 */
function cmdTemplates() {
    const templates = listTemplates();
    if (templates.length === 0) {
        console.log('No templates found.');
        return;
    }
    const nameWidth = Math.max(...templates.map((t) => t.name.length), 12);
    const descWidth = Math.max(...templates.map((t) => t.description.length), 16);
    console.log('');
    console.log(`${'TEMPLATE'.padEnd(nameWidth)}  ${'DESCRIPTION'.padEnd(descWidth)}  WORKERS`);
    console.log(`${'─'.repeat(nameWidth)}  ${'─'.repeat(descWidth)}  ${'─'.repeat(40)}`);
    for (const t of templates) {
        const name = t.name.padEnd(nameWidth);
        const desc = t.description.padEnd(descWidth);
        const workers = t.workers.join(', ');
        console.log(`${name}  ${desc}  ${workers}`);
    }
    console.log('');
}
/**
 * Create a custom template from CLI flags.
 *
 * claude-commander template-create <name> --workers <csv> --description "..."
 */
function cmdTemplateCreate(argv) {
    const name = argv[0];
    if (!name)
        die('Missing <name> argument');
    const flags = parseArgs(argv.slice(1));
    const workersRaw = flags['workers'];
    const description = flags['description'];
    if (!workersRaw || typeof workersRaw !== 'string') {
        die('--workers <comma-separated> is required');
    }
    if (!description || typeof description !== 'string') {
        die('--description "<text>" is required');
    }
    const workerNames = workersRaw
        .split(',')
        .map((w) => w.trim())
        .filter(Boolean);
    if (workerNames.length === 0) {
        die('At least one worker name is required');
    }
    // Build minimal WorkerDefinition objects; claudeMd generated at applyTemplate() time
    const workers = workerNames.map((workerName) => ({
        name: workerName,
        role: workerName === 'orchestrator' ? 'Project Lead — coordinates all workers' : `Worker — ${workerName}`,
        claudeMd: '',
        tier: workerName === 'orchestrator' ? 1 : 2,
    }));
    const template = createCustomTemplate(name, description, workers);
    console.log(`Template "${template.name}" created with ${template.workers.length} workers:`);
    template.workers.forEach((w, i) => {
        const prefix = i === template.workers.length - 1 ? '  └─' : '  ├─';
        console.log(`${prefix} ${w.name}`);
    });
    console.log(`\nSaved to ~/.claude-commander/templates/${name}.json`);
    console.log(`Use with: claude-commander init <project-name> <project-path> --template ${name}`);
}
function cmdSend(target, prompt) {
    if (!target)
        die('Missing <session>:<window> argument');
    if (!prompt)
        die('Missing "<prompt>" argument');
    const colonIdx = target.indexOf(':');
    if (colonIdx === -1)
        die('Target must be in the format <session>:<window>');
    const session = target.slice(0, colonIdx);
    const window = target.slice(colonIdx + 1);
    if (!session || !window)
        die('Both session and window must be non-empty in <session>:<window>');
    sendKeys(session, window, prompt);
    logSend('cli', session, window, prompt);
    console.log(`Sent to ${session}:${window}`);
}
function cmdBroadcast(session, prompt) {
    if (!session)
        die('Missing <session> argument');
    if (!prompt)
        die('Missing "<prompt>" argument');
    const sentTo = broadcastToSession(session, prompt);
    logBroadcast('cli', session, prompt, sentTo);
    console.log(`Broadcast to ${sentTo.length} window(s) in "${session}":`);
    sentTo.forEach((t) => console.log(`  • ${t}`));
}
function cmdBroadcastAll(prompt) {
    if (!prompt)
        die('Missing "<prompt>" argument');
    const sentTo = broadcastToAll(prompt);
    logBroadcast('cli', 'all', prompt, sentTo);
    console.log(`Broadcast to ${sentTo.length} window(s) across all sessions:`);
    sentTo.forEach((t) => console.log(`  • ${t}`));
}
function cmdTree() {
    const tree = getSessionTree();
    if (tree.sessions.length === 0) {
        console.log('No active tmux sessions found.');
        return;
    }
    for (const sess of tree.sessions) {
        console.log(`▼ ${sess.name} (${sess.windows.length} window${sess.windows.length === 1 ? '' : 's'})`);
        sess.windows.forEach((win, i) => {
            const isLast = i === sess.windows.length - 1;
            const branch = isLast ? '  └─' : '  ├─';
            const status = win.active ? '● active' : '○';
            // Pad window name for alignment
            const namePad = win.name.padEnd(14);
            console.log(`${branch} ${namePad} ${status}`);
        });
    }
}
/**
 * coord-init — initialise the .claude-coord/ directory structure.
 *
 * Usage:
 *   claude-commander coord-init <session-or-path> [--workers <csv>]
 *
 * If the first argument is a recognised session name, the project path is
 * looked up from ~/.claude-commander/config.json.
 * Otherwise it is treated as a literal project path.
 */
function cmdCoordInit(argv) {
    const target = argv[0];
    if (!target)
        die('Missing <session-or-path> argument');
    const flags = parseArgs(argv.slice(1));
    // Resolve project path — check if target is a known session name first
    let projectPath;
    const config = loadConfig();
    if (config.sessions[target]) {
        projectPath = config.sessions[target];
    }
    else {
        projectPath = resolve(target.replace(/^~/, process.env.HOME ?? '~'));
    }
    if (!existsSync(projectPath)) {
        die(`Project path does not exist: ${projectPath}`);
    }
    // Determine workers
    let workers = [];
    const workersFlag = flags['workers'];
    if (workersFlag && typeof workersFlag === 'string') {
        workers = workersFlag
            .split(',')
            .map((w) => w.trim())
            .filter(Boolean);
    }
    // Initialise the coordination directory structure
    initCoordination(projectPath, workers);
    // Write CLAUDE.md for the orchestrator
    const orchMd = generateOrchestratorClaudeMd(basename(projectPath), workers);
    writeFileSync(join(projectPath, '.claude-coord', 'ORCHESTRATOR.md'), orchMd);
    // Write CLAUDE.md for each worker
    for (const workerName of workers) {
        const workerMdPath = join(projectPath, '.claude-coord', 'workers', workerName, 'CLAUDE.md');
        writeFileSync(workerMdPath, generateWorkerClaudeMd(workerName));
    }
    console.log(`Coordination directory initialised at: ${projectPath}/.claude-coord/`);
    if (workers.length > 0) {
        console.log(`Workers:`);
        workers.forEach((w, i) => {
            const prefix = i === workers.length - 1 ? '  └─' : '  ├─';
            console.log(`${prefix} ${w}`);
        });
        console.log('\nCLAUDE.md files written for orchestrator and all workers.');
    }
    else {
        console.log('No workers specified. Add workers with --workers <csv>.');
    }
}
/**
 * status — show the coordination status tree.
 *
 * Usage:
 *   claude-commander status [project-name-or-path]
 *
 * Without an argument, shows status for all configured project paths.
 */
function cmdStatus(argv) {
    const target = argv[0];
    let projectPaths;
    if (target) {
        // Resolve single project
        const config = loadConfig();
        if (config.sessions[target]) {
            projectPaths = [config.sessions[target]];
        }
        else {
            const resolved = resolve(target.replace(/^~/, process.env.HOME ?? '~'));
            projectPaths = [resolved];
        }
    }
    else {
        projectPaths = getProjectPaths();
    }
    if (projectPaths.length === 0) {
        console.log('No project paths configured. Use coord-init to initialise a project.');
        return;
    }
    const tree = getCoordinationTree(projectPaths);
    const projects = Object.entries(tree.projects);
    if (projects.length === 0) {
        console.log('No coordination data found.');
        return;
    }
    for (const [projectName, project] of projects) {
        console.log(`\n▼ ${projectName}`);
        if (project.orchestrator) {
            const o = project.orchestrator;
            const stateIcon = stateEmoji(o.state);
            console.log(`  ├─ [orchestrator]  ${stateIcon} ${o.state.padEnd(18)} ${o.progress.padEnd(16)} ${o.task || '(no task)'}`);
        }
        const workerEntries = Object.entries(project.workers);
        if (workerEntries.length === 0) {
            console.log('  └─ (no workers)');
        }
        else {
            workerEntries.forEach(([name, status], i) => {
                const isLast = i === workerEntries.length - 1;
                const branch = isLast ? '  └─' : '  ├─';
                const stateIcon = stateEmoji(status.state);
                const namePad = name.padEnd(16);
                const statePad = status.state.padEnd(18);
                const progressPad = status.progress.padEnd(16);
                console.log(`${branch} ${namePad} ${stateIcon} ${statePad} ${progressPad} ${status.task || '(no task)'}`);
            });
        }
    }
}
/** Return a single-char status indicator for display */
function stateEmoji(state) {
    switch (state) {
        case 'idle': return '○';
        case 'in_progress': return '●';
        case 'complete': return '✓';
        case 'blocked': return '⚠';
        case 'error': return '✗';
        case 'waiting_approval': return '?';
        default: return '·';
    }
}
function cmdPair() {
    const token = getToken();
    const port = process.env.PORT ?? '7700';
    const host = process.env.PAIR_HOST ?? `http://100.x.x.x:${port}`;
    const width = 45;
    const bar = '─'.repeat(width - 2);
    const pad = (text) => `│ ${text.padEnd(width - 4)} │`;
    console.log(`┌${bar}┐`);
    console.log(pad('  Claude Commander — Pair'));
    console.log(`├${bar}┤`);
    console.log(pad(`  Token: ${token.slice(0, 32)}…`));
    console.log(pad(`  URL:   ${host}`));
    console.log(pad(''));
    console.log(pad('  Open the URL on your phone and'));
    console.log(pad('  enter the token to connect.'));
    console.log(`└${bar}┘`);
}
// ---------------------------------------------------------------------------
// Phase 5: save / restore / metrics / health
// ---------------------------------------------------------------------------
function cmdSave() {
    try {
        const snapshot = saveAllSessions();
        console.log(`Saved ${snapshot.sessions.length} session(s) to ~/.claude-commander/snapshots/latest.json`);
        snapshot.sessions.forEach((s, i) => {
            const prefix = i === snapshot.sessions.length - 1 ? '  └─' : '  ├─';
            console.log(`${prefix} ${s.name}  (${s.windows.length} window${s.windows.length === 1 ? '' : 's'})`);
        });
    }
    catch (err) {
        die(err.message);
    }
}
function cmdRestore(argv) {
    // Optionally accept a path to a specific snapshot file
    const snapshotFile = argv[0];
    try {
        if (snapshotFile) {
            const raw = readFileSync(snapshotFile, 'utf8');
            const snap = JSON.parse(raw);
            restoreAllSessions(snap);
            const sessionCount = snap?.sessions?.length ?? 0;
            console.log(`Restored ${sessionCount} session(s) from ${snapshotFile}`);
        }
        else {
            const snapshots = listSnapshots();
            if (snapshots.length === 0) {
                die('No snapshots found. Run "claude-commander save" first.');
            }
            restoreAllSessions();
            const latest = snapshots[0];
            console.log(`Restored ${latest.sessions} session(s) from latest snapshot (${latest.timestamp})`);
        }
    }
    catch (err) {
        die(err.message);
    }
}
function cmdMetrics() {
    const paths = getProjectPaths();
    const pathMap = {};
    for (const p of paths) {
        pathMap[basename(p)] = p;
    }
    const metrics = getSystemMetrics(pathMap);
    const upMins = Math.floor(metrics.uptime / 60);
    const upSecs = metrics.uptime % 60;
    console.log('');
    console.log('System Metrics');
    console.log('──────────────────────────────────────────────────');
    console.log(`  Sessions : ${metrics.totalSessions}`);
    console.log(`  Windows  : ${metrics.totalWindows}`);
    console.log(`  Uptime   : ${upMins}m ${upSecs}s`);
    console.log('');
    if (metrics.projects.length === 0) {
        console.log('  No projects configured.');
        console.log('');
        return;
    }
    const colW = [18, 8, 8, 8, 8, 8];
    const header = [
        'PROJECT'.padEnd(colW[0]),
        'RUNNING'.padEnd(colW[1]),
        'DONE'.padEnd(colW[2]),
        'BLOCKED'.padEnd(colW[3]),
        'WAITING'.padEnd(colW[4]),
        'ELAPSED',
    ].join('  ');
    console.log('  ' + header);
    console.log('  ' + '─'.repeat(header.length));
    for (const p of metrics.projects) {
        const row = [
            p.project.padEnd(colW[0]),
            String(p.agentsRunning).padEnd(colW[1]),
            String(p.agentsComplete).padEnd(colW[2]),
            String(p.agentsBlocked).padEnd(colW[3]),
            String(p.agentsWaiting).padEnd(colW[4]),
            `${p.elapsedMinutes}m`,
        ].join('  ');
        console.log('  ' + row);
    }
    console.log('');
}
function cmdHealth() {
    const results = checkAllHealth();
    if (results.length === 0) {
        console.log('No active tmux sessions found.');
        return;
    }
    const colW = [20, 20, 8, 6];
    const header = [
        'SESSION'.padEnd(colW[0]),
        'WINDOW'.padEnd(colW[1]),
        'STATUS'.padEnd(colW[2]),
        'FAILS',
    ].join('  ');
    console.log('');
    console.log('  ' + header);
    console.log('  ' + '─'.repeat(header.length));
    for (const h of results) {
        const status = h.alive ? 'alive' : 'dead';
        const row = [
            h.session.padEnd(colW[0]),
            h.window.padEnd(colW[1]),
            status.padEnd(colW[2]),
            String(h.consecutiveFailures),
        ].join('  ');
        const indicator = h.alive ? '  ' : '! ';
        console.log(indicator + row);
    }
    console.log('');
}
// ---------------------------------------------------------------------------
// Phase 7: recall / performance / facts
// ---------------------------------------------------------------------------
/**
 * recall "<query>" [--domain X]
 * Searches memory (learnings + facts) and prints matching excerpts.
 */
function cmdRecall(argv) {
    const query = argv[0];
    if (!query)
        die('Missing "<query>" argument');
    const flags = parseArgs(argv.slice(1));
    const domain = typeof flags['domain'] === 'string' ? flags['domain'] : undefined;
    const result = recallMemory(query, domain);
    console.log('');
    console.log(result);
    console.log('');
}
/**
 * performance
 * Prints a table of per-worker performance metrics.
 */
function cmdPerformance() {
    const workers = loadWorkerPerformance();
    const entries = Object.entries(workers);
    if (entries.length === 0) {
        console.log('No worker performance data recorded yet.');
        return;
    }
    const colW = [20, 8, 8, 8, 8, 8];
    const header = [
        'WORKER'.padEnd(colW[0]),
        'TASKS'.padEnd(colW[1]),
        'AVG MIN'.padEnd(colW[2]),
        'REJ %'.padEnd(colW[3]),
        'QUALITY'.padEnd(colW[4]),
        'COST/TASK',
    ].join('  ');
    console.log('');
    console.log('Worker Performance');
    console.log('──────────────────────────────────────────────────────────────');
    console.log('  ' + header);
    console.log('  ' + '─'.repeat(header.length));
    for (const [name, perf] of entries) {
        const rejPct = (perf.rejection_rate * 100).toFixed(1);
        const quality = perf.quality_score.toFixed(2);
        const avgMin = perf.avg_completion_minutes.toFixed(1);
        const costPer = `$${perf.cost_per_task_usd.toFixed(4)}`;
        const row = [
            name.padEnd(colW[0]),
            String(perf.tasks_completed).padEnd(colW[1]),
            avgMin.padEnd(colW[2]),
            `${rejPct}%`.padEnd(colW[3]),
            quality.padEnd(colW[4]),
            costPer,
        ].join('  ');
        console.log('  ' + row);
    }
    console.log('');
    console.log(`  Last updated: ${entries[0]?.[1]?.last_updated ?? 'n/a'}`);
    console.log('');
}
/**
 * facts [--domain X] [--project Y]
 * Lists stored core facts, optionally filtered by domain or project.
 */
function cmdFacts(argv) {
    const flags = parseArgs(argv);
    const domain = typeof flags['domain'] === 'string' ? flags['domain'] : undefined;
    const project = typeof flags['project'] === 'string' ? flags['project'] : undefined;
    const facts = getFacts(domain, project);
    if (facts.length === 0) {
        const scope = domain ? `domain "${domain}"` : project ? `project "${project}"` : 'global';
        console.log(`No facts found for ${scope}.`);
        return;
    }
    const scopeLabel = domain
        ? `Domain: ${domain}`
        : project
            ? `Project: ${project}`
            : 'Global';
    console.log('');
    console.log(`Core Facts — ${scopeLabel} (${facts.length})`);
    console.log('──────────────────────────────────────────────────');
    for (const fact of facts) {
        const date = fact.updated.slice(0, 10);
        console.log(`  [${date}] ${fact.fact}`);
        console.log(`           source: ${fact.source}`);
    }
    console.log('');
}
// ---------------------------------------------------------------------------
// Phase 8: Self-evolution commands
// ---------------------------------------------------------------------------
/**
 * proposals — list pending optimization proposals.
 */
function cmdProposals() {
    const proposals = getPendingProposals();
    if (proposals.length === 0) {
        console.log('No pending optimization proposals.');
        return;
    }
    console.log('');
    console.log(`Pending Optimization Proposals (${proposals.length})`);
    console.log('──────────────────────────────────────────────────');
    for (const p of proposals) {
        const date = p.created.slice(0, 10);
        const conf = `${(p.confidence * 100).toFixed(0)}% confidence`;
        console.log(`  [${p.id.slice(0, 8)}]  ${p.target}  —  ${date}  —  ${conf}`);
        console.log(`    Reason: ${p.reason}`);
        console.log('');
    }
}
/**
 * approve-proposal <id> — approve a pending optimization proposal.
 */
function cmdApproveProposal(id) {
    if (!id)
        die('Missing <id> argument');
    try {
        approveProposal(id, 'cli');
        console.log(`Proposal ${id} approved. Apply the proposed CLAUDE.md changes manually.`);
    }
    catch (err) {
        die(err.message);
    }
}
/**
 * reject-proposal <id> [reason] — reject a pending optimization proposal.
 */
function cmdRejectProposal(id, reason) {
    if (!id)
        die('Missing <id> argument');
    try {
        rejectProposal(id, 'cli', reason);
        console.log(`Proposal ${id} rejected.`);
    }
    catch (err) {
        die(err.message);
    }
}
/**
 * alerts — list all active drift alerts.
 */
function cmdAlerts() {
    const alerts = getAllAlerts();
    const active = alerts.filter((a) => !a.acknowledged);
    if (alerts.length === 0) {
        console.log('No drift alerts on record.');
        return;
    }
    console.log('');
    console.log(`Drift Alerts (${active.length} unacknowledged / ${alerts.length} total)`);
    console.log('──────────────────────────────────────────────────');
    for (const a of alerts) {
        const date = a.created.slice(0, 10);
        const ackLabel = a.acknowledged ? '[ack]' : '     ';
        const sevLabel = a.severity.toUpperCase().padEnd(8);
        console.log(`  ${ackLabel}  [${a.id.slice(0, 8)}]  ${sevLabel}  ${a.target}  —  ${date}`);
        console.log(`    ${a.description}`);
        console.log('');
    }
}
/**
 * role-history <worker> — show version history for a worker's CLAUDE.md.
 */
function cmdRoleHistory(worker) {
    if (!worker)
        die('Missing <worker> argument');
    const history = getRoleHistory(worker);
    if (history.length === 0) {
        console.log(`No role history found for worker "${worker}".`);
        return;
    }
    console.log('');
    console.log(`Role History — ${worker} (${history.length} version${history.length === 1 ? '' : 's'})`);
    console.log('──────────────────────────────────────────────────');
    for (const v of history) {
        const date = v.timestamp.slice(0, 10);
        console.log(`  v${String(v.version).padEnd(4)} [${v.id.slice(0, 8)}]  ${date}  by: ${v.changedBy}`);
        console.log(`         ${v.reason}`);
        console.log('');
    }
}
// ---------------------------------------------------------------------------
// Phase 5: verify / report / budget / benchmark / model-assign
// ---------------------------------------------------------------------------
/**
 * verify <project-path> [--stages 1,2,3] [--domain sem]
 * Run the verification pipeline against a project's findings.json.
 */
function cmdVerify(argv) {
    const projectPathRaw = argv[0];
    if (!projectPathRaw)
        die('Missing <project-path> argument');
    const flags = parseArgs(argv.slice(1));
    const projectPath = resolve(projectPathRaw.replace(/^~/, process.env.HOME ?? '~'));
    if (!existsSync(projectPath))
        die(`Project path does not exist: ${projectPath}`);
    // Parse stages
    let stages = [1, 2, 3, 4, 5];
    if (typeof flags['stages'] === 'string') {
        stages = flags['stages']
            .split(',')
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => [1, 2, 3, 4, 5].includes(n));
    }
    const domain = typeof flags['domain'] === 'string' ? flags['domain'] : 'general';
    // Load findings.json
    const findingsFile = join(projectPath, '.claude-coord', 'findings.json');
    if (!existsSync(findingsFile))
        die('No findings.json found at .claude-coord/findings.json');
    let findings = [];
    try {
        findings = JSON.parse(readFileSync(findingsFile, 'utf8'));
    }
    catch (err) {
        die(`Could not parse findings.json: ${err.message}`);
    }
    const config = {
        stages,
        domain,
        escalateDisagreements: false,
    };
    const results = runVerification(findings, config);
    const summary = getVerificationSummary(results);
    console.log('');
    console.log(`Verification Pipeline — ${basename(projectPath)}`);
    console.log('──────────────────────────────────────────────────');
    console.log(`  Total     : ${summary.total_findings}`);
    console.log(`  Passed    : ${summary.passed}`);
    console.log(`  Failed    : ${summary.failed}`);
    console.log(`  Escalated : ${summary.escalated}`);
    console.log(`  Conf avg  : ${summary.avg_confidence_before.toFixed(2)} → ${summary.avg_confidence_after.toFixed(2)}`);
    console.log(`  Completeness: ${summary.completeness_pct}%`);
    console.log('');
}
/**
 * report <project-path> [--format html] [--type executive] [--domain sem]
 * Generate a findings report and print to stdout.
 */
function cmdReport(argv) {
    const projectPathRaw = argv[0];
    if (!projectPathRaw)
        die('Missing <project-path> argument');
    const flags = parseArgs(argv.slice(1));
    const projectPath = resolve(projectPathRaw.replace(/^~/, process.env.HOME ?? '~'));
    if (!existsSync(projectPath))
        die(`Project path does not exist: ${projectPath}`);
    const format = (flags['format'] === 'html' ? 'html' : 'json');
    const type = (flags['type'] === 'executive' ? 'executive' : 'technical');
    const domain = typeof flags['domain'] === 'string' ? flags['domain'] : 'general';
    // Load findings from project coordination directory
    const findingsFile = join(projectPath, '.claude-coord', 'findings.json');
    let findings = [];
    if (existsSync(findingsFile)) {
        try {
            findings = JSON.parse(readFileSync(findingsFile, 'utf8'));
        }
        catch (err) {
            die(`Could not parse findings.json: ${err.message}`);
        }
    }
    if (type === 'executive') {
        const title = `Executive Summary — ${basename(projectPath)}`;
        const report = generateExecutiveSummary(findings, domain, title);
        process.stdout.write(report.content + '\n');
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
    process.stdout.write(report.content + '\n');
}
/**
 * budget <project-path> [--set <amount>]
 * Show budget status or set a new budget for the project.
 */
function cmdBudget(argv) {
    const projectPathRaw = argv[0];
    if (!projectPathRaw)
        die('Missing <project-path> argument');
    const flags = parseArgs(argv.slice(1));
    const projectPath = resolve(projectPathRaw.replace(/^~/, process.env.HOME ?? '~'));
    if (!existsSync(projectPath))
        die(`Project path does not exist: ${projectPath}`);
    if (typeof flags['set'] === 'string') {
        const amount = parseFloat(flags['set']);
        if (isNaN(amount) || amount < 0)
            die('--set <amount> must be a non-negative number');
        const budget = setBudget(projectPath, amount);
        console.log(`Budget set: $${budget.total_usd.toFixed(2)} for "${basename(projectPath)}"`);
        return;
    }
    // Show status
    const check = checkBudget(projectPath);
    const summary = getBudgetSummary(projectPath);
    console.log('');
    console.log(`Budget Status — ${basename(projectPath)}`);
    console.log('──────────────────────────────────────────────────');
    if (check.remaining === Infinity) {
        console.log('  No budget set. Use --set <amount> to configure one.');
    }
    else {
        console.log(`  Remaining : $${check.remaining.toFixed(2)}`);
        console.log(`  Used      : ${check.percentage.toFixed(1)}%`);
        console.log(`  Exceeded  : ${check.exceeded ? 'YES' : 'No'}`);
        console.log('');
        console.log(summary);
    }
    console.log('');
}
/**
 * benchmark <suite-path>
 * Load a benchmark suite JSON and print cost estimates for each template config.
 *
 * Suite file format (JSON):
 *   { runs: [{ template: string, pages: number, label?: string }] }
 */
function cmdBenchmark(argv) {
    const suitePathRaw = argv[0];
    if (!suitePathRaw)
        die('Missing <suite-path> argument');
    const suitePath = resolve(suitePathRaw.replace(/^~/, process.env.HOME ?? '~'));
    if (!existsSync(suitePath))
        die(`Suite file does not exist: ${suitePath}`);
    let suite;
    try {
        suite = JSON.parse(readFileSync(suitePath, 'utf8'));
    }
    catch (err) {
        die(`Could not parse suite file: ${err.message}`);
    }
    if (!Array.isArray(suite?.runs) || suite.runs.length === 0) {
        die('Suite file must have a non-empty "runs" array');
    }
    const colW = [20, 14, 12, 12, 14];
    const header = [
        'LABEL'.padEnd(colW[0]),
        'TEMPLATE'.padEnd(colW[1]),
        'PAGES'.padEnd(colW[2]),
        'TASKS'.padEnd(colW[3]),
        'EST. COST',
    ].join('  ');
    console.log('');
    console.log('Benchmark Suite — Cost Estimates');
    console.log('──────────────────────────────────────────────────────────────');
    console.log('  ' + header);
    console.log('  ' + '─'.repeat(header.length));
    for (const run of suite.runs) {
        const label = (run.label ?? run.template).slice(0, colW[0] - 1);
        const estimate = estimateCost(run.pages, run.template);
        const row = [
            label.padEnd(colW[0]),
            run.template.padEnd(colW[1]),
            String(run.pages).padEnd(colW[2]),
            String(estimate.estimated_tasks).padEnd(colW[3]),
            `$${estimate.total_estimated_usd.toFixed(2)}`,
        ].join('  ');
        console.log('  ' + row);
    }
    console.log('');
}
/**
 * model-assign <session>:<window> <model-preset>
 * Send a model-assignment directive to a specific tmux window via sendKeys.
 *
 * The directive is injected as a special comment that CLAUDE.md instructs
 * each worker to parse and apply as its active model configuration.
 */
function cmdModelAssign(argv) {
    const target = argv[0];
    const modelPreset = argv[1];
    if (!target)
        die('Missing <session>:<window> argument');
    if (!modelPreset)
        die('Missing <model-preset> argument');
    const colonIdx = target.indexOf(':');
    if (colonIdx === -1)
        die('Target must be in the format <session>:<window>');
    const session = target.slice(0, colonIdx);
    const window = target.slice(colonIdx + 1);
    if (!session || !window)
        die('Both session and window must be non-empty');
    // Inject as a structured comment that Claude will parse
    const directive = `# model-assign: ${modelPreset}`;
    sendKeys(session, window, directive);
    logSend('cli', session, window, directive);
    console.log(`Model preset "${modelPreset}" assigned to ${session}:${window}`);
}
// ---------------------------------------------------------------------------
// Recovery commands
// ---------------------------------------------------------------------------
function cmdRecoveryStatus() {
    // Run a single check cycle to get fresh data
    const noopCallbacks = {
        onWorkerStalled: () => { },
        onWorkerRateLimited: () => { },
        onWorkerRecovered: () => { },
        onSwarmStateUpdate: () => { },
    };
    const states = runRecoveryCheck(noopCallbacks);
    if (states.length === 0) {
        console.log('No active tmux windows found.');
        return;
    }
    console.log('Recovery Status');
    console.log('═'.repeat(80));
    console.log('  ' +
        'Session'.padEnd(20) +
        'Window'.padEnd(20) +
        'State'.padEnd(16) +
        'Stalls'.padEnd(8) +
        'Last Change');
    console.log('─'.repeat(80));
    for (const s of states) {
        const stateIcon = s.state === 'active' ? '●' :
            s.state === 'stalled' ? '⏸' :
                s.state === 'rate_limited' ? '⚠' :
                    s.state === 'dead' ? '✗' :
                        s.state === 'completed' ? '✓' : '?';
        const ago = Math.round((Date.now() - s.lastChangeTime) / 1000);
        const agoStr = ago < 60 ? `${ago}s ago` : `${Math.round(ago / 60)}m ago`;
        console.log('  ' +
            s.session.padEnd(20) +
            s.window.padEnd(20) +
            `${stateIcon} ${s.state}`.padEnd(16) +
            String(s.consecutiveStalls).padEnd(8) +
            agoStr);
    }
    console.log('');
}
function cmdResume() {
    const state = loadSwarmState();
    if (!state) {
        console.log('No saved swarm state found at ~/.claude-commander/recovery/swarm-state.json');
        return;
    }
    console.log(`Resuming swarm for session "${state.session}" (started ${state.startedAt})`);
    console.log(`Workers: ${state.workers.length}`);
    console.log('');
    const result = resumeSwarm(state);
    if (result.completed.length > 0) {
        console.log('Completed (output files found):');
        for (const w of result.completed)
            console.log(`  ✓ ${w}`);
    }
    if (result.resumed.length > 0) {
        console.log('Resumed (prompt resent):');
        for (const w of result.resumed)
            console.log(`  ● ${w}`);
    }
    if (result.skipped.length > 0) {
        console.log('Skipped (dead or no prompt):');
        for (const w of result.skipped)
            console.log(`  ✗ ${w}`);
    }
    console.log('');
}
function cmdContinue(target) {
    if (!target)
        die('Missing <session>:<window> argument');
    const colonIdx = target.indexOf(':');
    if (colonIdx === -1)
        die('Target must be in the format <session>:<window>');
    const session = target.slice(0, colonIdx);
    const window = target.slice(colonIdx + 1);
    if (!session || !window)
        die('Both session and window must be non-empty');
    manualContinue(session, window);
    console.log(`Continue sent to ${session}:${window}`);
}
// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
const subcommand = argv[0];
switch (subcommand) {
    case 'start': {
        const flags = parseArgs(argv.slice(1));
        cmdStart(flags);
        break;
    }
    case 'init': {
        cmdInit(argv.slice(1));
        break;
    }
    case 'send': {
        const target = argv[1];
        const prompt = argv[2];
        cmdSend(target, prompt);
        break;
    }
    case 'broadcast': {
        const session = argv[1];
        const prompt = argv[2];
        cmdBroadcast(session, prompt);
        break;
    }
    case 'broadcast-all': {
        const prompt = argv[1];
        cmdBroadcastAll(prompt);
        break;
    }
    case 'coord-init': {
        cmdCoordInit(argv.slice(1));
        break;
    }
    case 'status': {
        cmdStatus(argv.slice(1));
        break;
    }
    case 'tree': {
        cmdTree();
        break;
    }
    case 'pair': {
        // Ensure token is loaded before displaying
        loadOrGenerateToken();
        cmdPair();
        break;
    }
    case 'templates': {
        cmdTemplates();
        break;
    }
    case 'template-create': {
        cmdTemplateCreate(argv.slice(1));
        break;
    }
    case 'save': {
        cmdSave();
        break;
    }
    case 'restore': {
        cmdRestore(argv.slice(1));
        break;
    }
    case 'metrics': {
        cmdMetrics();
        break;
    }
    case 'health': {
        cmdHealth();
        break;
    }
    case 'recall': {
        cmdRecall(argv.slice(1));
        break;
    }
    case 'performance': {
        cmdPerformance();
        break;
    }
    case 'facts': {
        cmdFacts(argv.slice(1));
        break;
    }
    case 'proposals': {
        cmdProposals();
        break;
    }
    case 'approve-proposal': {
        cmdApproveProposal(argv[1]);
        break;
    }
    case 'reject-proposal': {
        const reason = argv[2];
        cmdRejectProposal(argv[1], reason);
        break;
    }
    case 'alerts': {
        cmdAlerts();
        break;
    }
    case 'role-history': {
        cmdRoleHistory(argv[1]);
        break;
    }
    case 'verify': {
        cmdVerify(argv.slice(1));
        break;
    }
    case 'report': {
        cmdReport(argv.slice(1));
        break;
    }
    case 'budget': {
        cmdBudget(argv.slice(1));
        break;
    }
    case 'benchmark': {
        cmdBenchmark(argv.slice(1));
        break;
    }
    case 'model-assign': {
        cmdModelAssign(argv.slice(1));
        break;
    }
    case 'recovery-status': {
        cmdRecoveryStatus();
        break;
    }
    case 'resume': {
        cmdResume();
        break;
    }
    case 'continue': {
        cmdContinue(argv[1]);
        break;
    }
    case 'help':
    case '--help':
    case '-h':
    case undefined: {
        printHelp();
        break;
    }
    default: {
        console.error(`Unknown command: ${subcommand}`);
        console.error('Run "claude-commander help" for usage.');
        process.exit(1);
    }
}
//# sourceMappingURL=index.js.map