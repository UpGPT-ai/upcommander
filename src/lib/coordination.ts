/**
 * File-based multi-agent coordination protocol.
 *
 * Directory layout inside a project root:
 *
 *   .claude-coord/
 *     PLAN.md
 *     ORCHESTRATOR.md
 *     SYNTHESIS.md
 *     workers/
 *       <name>/
 *         TASK.md
 *         STATUS.json
 *         SYNTHESIS.md
 *         subagents/
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { readdirSync } from 'node:fs';
import { appendFileSync } from 'node:fs';
import { join, basename } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentStatus {
  agent: string;
  tier: number; // 0=meta-orch, 1=project-orch, 2=worker, 3=subagent
  state:
    | 'idle'
    | 'in_progress'
    | 'complete'
    | 'blocked'
    | 'error'
    | 'waiting_approval';
  task: string;
  started: string; // ISO timestamp
  updated: string; // ISO timestamp
  progress: string; // e.g. "3/5 subtasks complete"
  blocking_reason: string | null;
  waiting_for: string | null;
  subagents: { active: number; complete: number; total: number };
  files_produced: string[];
  model?: {                // assigned model for this agent
    provider: string;      // 'anthropic' | 'openai' | 'google' | 'custom'
    model: string;         // e.g. 'claude-sonnet-4-6'
  };
  tokens?: {               // token usage for current task
    input: number;
    output: number;
    cached: number;
    cost_usd: number;
  };
}

export interface CoordinationTree {
  projects: Record<
    string,
    {
      orchestrator: AgentStatus | null;
      workers: Record<string, AgentStatus>;
    }
  >;
}

export interface ApprovalItem {
  project: string;
  worker: string;
  task: string;
  since: string; // ISO timestamp of when waiting_approval state was entered
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

function coordDir(projectPath: string): string {
  return join(projectPath, '.claude-coord');
}

function workersDir(projectPath: string): string {
  return join(coordDir(projectPath), 'workers');
}

function workerDir(projectPath: string, workerName: string): string {
  return join(workersDir(projectPath), workerName);
}

function statusPath(projectPath: string, workerName: string): string {
  return join(workerDir(projectPath, workerName), 'STATUS.json');
}

function orchestratorStatusPath(projectPath: string): string {
  return join(coordDir(projectPath), 'ORCHESTRATOR_STATUS.json');
}

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

function defaultStatus(agentName: string, tier: number): AgentStatus {
  const now = new Date().toISOString();
  return {
    agent: agentName,
    tier,
    state: 'idle',
    task: '',
    started: now,
    updated: now,
    progress: '0/0',
    blocking_reason: null,
    waiting_for: null,
    subagents: { active: 0, complete: 0, total: 0 },
    files_produced: [],
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise the .claude-coord/ directory structure inside a project.
 * Safe to call multiple times — will not overwrite existing files.
 */
export function initCoordination(
  projectPath: string,
  workers: string[]
): void {
  const coord = coordDir(projectPath);
  const wDir = workersDir(projectPath);

  mkdirSync(coord, { recursive: true });
  mkdirSync(wDir, { recursive: true });

  // Root coordination files
  touchFile(join(coord, 'PLAN.md'));
  touchFile(join(coord, 'ORCHESTRATOR.md'));
  touchFile(join(coord, 'SYNTHESIS.md'));

  // Orchestrator STATUS.json
  const orchStatusFile = orchestratorStatusPath(projectPath);
  if (!existsSync(orchStatusFile)) {
    const orchStatus = defaultStatus('orchestrator', 1);
    writeFileSync(orchStatusFile, JSON.stringify(orchStatus, null, 2));
  }

  // Cross-reference directory
  mkdirSync(join(coord, 'cross-refs'), { recursive: true });

  // Per-worker directories and files
  for (const name of workers) {
    const wPath = workerDir(projectPath, name);
    const subagentsPath = join(wPath, 'subagents');
    mkdirSync(wPath, { recursive: true });
    mkdirSync(subagentsPath, { recursive: true });

    touchFile(join(wPath, 'TASK.md'));
    touchFile(join(wPath, 'SKILL.md'));        // domain-specific skill instructions
    touchFile(join(wPath, 'RESULT.md'));        // raw findings (subagent level)
    touchFile(join(wPath, 'SUMMARY.md'));       // worker-level summary
    touchFile(join(wPath, 'SYNTHESIS.md'));     // orchestrator reads this

    const statusFile = statusPath(projectPath, name);
    if (!existsSync(statusFile)) {
      const s = defaultStatus(name, 2);
      writeFileSync(statusFile, JSON.stringify(s, null, 2));
    }
  }

  // Add .claude-coord/ to .gitignore
  addToGitignore(projectPath, '.claude-coord/');
}

/**
 * Read and parse STATUS.json for a specific worker.
 * Returns null if the file does not exist or is invalid.
 */
export function readStatus(
  projectPath: string,
  workerName: string
): AgentStatus | null {
  const file = statusPath(projectPath, workerName);
  return parseStatusFile(file);
}

/**
 * Read and parse the orchestrator STATUS.json for a project.
 * Returns null if not found.
 */
export function readOrchestratorStatus(
  projectPath: string
): AgentStatus | null {
  return parseStatusFile(orchestratorStatusPath(projectPath));
}

/**
 * Merge a partial status update into a worker's STATUS.json.
 * The `updated` timestamp is always refreshed.
 */
export function writeStatus(
  projectPath: string,
  workerName: string,
  status: Partial<AgentStatus>
): void {
  const file = statusPath(projectPath, workerName);
  const existing = parseStatusFile(file) ?? defaultStatus(workerName, 2);
  const merged: AgentStatus = {
    ...existing,
    ...status,
    updated: new Date().toISOString(),
  };
  writeFileSync(file, JSON.stringify(merged, null, 2));
}

/**
 * Read all worker STATUS.json files within a project.
 * Returns a map of workerName → AgentStatus.
 */
export function readAllStatuses(
  projectPath: string
): Record<string, AgentStatus> {
  const wDir = workersDir(projectPath);
  if (!existsSync(wDir)) return {};

  const result: Record<string, AgentStatus> = {};

  let entries: string[] = [];
  try {
    entries = readdirSync(wDir);
  } catch {
    return {};
  }

  for (const entry of entries) {
    const file = join(wDir, entry, 'STATUS.json');
    const s = parseStatusFile(file);
    if (s) result[entry] = s;
  }

  return result;
}

/**
 * Build the full coordination tree across one or more project paths.
 */
export function getCoordinationTree(
  projectPaths: string[]
): CoordinationTree {
  const tree: CoordinationTree = { projects: {} };

  for (const projectPath of projectPaths) {
    const name = basename(projectPath);
    tree.projects[name] = {
      orchestrator: readOrchestratorStatus(projectPath),
      workers: readAllStatuses(projectPath),
    };
  }

  return tree;
}

/**
 * Collect all agents in 'waiting_approval' state across all projects.
 */
export function getApprovalQueue(
  projectPaths: string[]
): ApprovalItem[] {
  const queue: ApprovalItem[] = [];

  for (const projectPath of projectPaths) {
    const projectName = basename(projectPath);
    const statuses = readAllStatuses(projectPath);

    for (const [workerName, status] of Object.entries(statuses)) {
      if (status.state === 'waiting_approval') {
        queue.push({
          project: projectName,
          worker: workerName,
          task: status.task,
          since: status.updated,
        });
      }
    }

    // Also check orchestrator
    const orchStatus = readOrchestratorStatus(projectPath);
    if (orchStatus && orchStatus.state === 'waiting_approval') {
      queue.push({
        project: projectName,
        worker: 'orchestrator',
        task: orchStatus.task,
        since: orchStatus.updated,
      });
    }
  }

  return queue;
}

/**
 * Generate the CLAUDE.md content for a worker agent.
 */
export function generateWorkerClaudeMd(workerName: string): string {
  return `# Worker Agent: ${workerName}

## Coordination Protocol

You are a worker agent in a multi-agent system coordinated via the file system.

### Your Coordination Directory

All coordination files live in \`.claude-coord/workers/${workerName}/\` relative to the project root.

| File | Purpose |
|------|---------|
| \`TASK.md\` | Your current task instructions — read this first |
| \`STATUS.json\` | Your current status — update this frequently |
| \`SYNTHESIS.md\` | Your output summary — write here when complete |
| \`subagents/\` | Directory for any sub-agent coordination |

### Updating Your Status

Keep \`STATUS.json\` current throughout your work. Valid states:
- \`idle\` — waiting for work
- \`in_progress\` — actively working
- \`complete\` — task finished, see SYNTHESIS.md
- \`blocked\` — cannot proceed, set \`blocking_reason\`
- \`error\` — encountered an unrecoverable error
- \`waiting_approval\` — requires human approval to continue

Example STATUS.json:
\`\`\`json
{
  "agent": "${workerName}",
  "tier": 2,
  "state": "in_progress",
  "task": "Implement feature X",
  "started": "2024-01-01T00:00:00.000Z",
  "updated": "2024-01-01T00:05:00.000Z",
  "progress": "2/5 subtasks complete",
  "blocking_reason": null,
  "waiting_for": null,
  "subagents": { "active": 0, "complete": 0, "total": 0 },
  "files_produced": []
}
\`\`\`

### Orchestrator Commands

The orchestrator can send you instructions via \`upcommander send\`. When you need approval:
1. Set your state to \`waiting_approval\` in STATUS.json
2. Describe what you need in \`blocking_reason\`
3. Wait — the human operator will approve or deny via the mobile PWA

### Workflow

1. Read \`TASK.md\` for your assignment
2. Update STATUS.json to \`in_progress\`
3. Do your work, updating \`progress\` frequently
4. Write results to \`SYNTHESIS.md\`
5. Update STATUS.json to \`complete\`
`;
}

/**
 * Generate the CLAUDE.md content for an orchestrator agent.
 */
export function generateOrchestratorClaudeMd(
  projectName: string,
  workers: string[]
): string {
  const workerList = workers.map((w) => `- \`${w}\``).join('\n');
  const sendExamples = workers
    .slice(0, 2)
    .map(
      (w) =>
        `upcommander send ${projectName}:${w} "Your next task: ..."`
    )
    .join('\n');

  return `# Orchestrator Agent: ${projectName}

## Your Role

You are the project orchestrator. You decompose the project plan into tasks,
assign them to worker agents, monitor their progress, and synthesise results.

## Workers Under Your Coordination

${workerList}

## Coordination Directory

Root: \`.claude-coord/\`

| File | Purpose |
|------|---------|
| \`PLAN.md\` | The overall project plan — maintain this |
| \`ORCHESTRATOR.md\` | Your running notes and decisions |
| \`ORCHESTRATOR_STATUS.json\` | Your own status for the human operator |
| \`SYNTHESIS.md\` | Final project synthesis when all workers complete |
| \`workers/<name>/TASK.md\` | Write tasks here for each worker |
| \`workers/<name>/STATUS.json\` | Read worker progress here |
| \`workers/<name>/SYNTHESIS.md\` | Read worker results here |

## Sending Instructions to Workers

Use \`upcommander send\` to dispatch prompts to worker tmux windows:

\`\`\`bash
${sendExamples}
\`\`\`

## Orchestration Workflow

1. Read \`PLAN.md\` to understand the project scope
2. Update your \`ORCHESTRATOR_STATUS.json\` to reflect current state
3. Write task instructions into each worker's \`TASK.md\`
4. Send a prompt to each worker via \`upcommander send\`
5. Poll \`workers/*/STATUS.json\` to monitor progress
6. When a worker reaches \`waiting_approval\`, surface this to the human operator
7. When all workers are \`complete\`, synthesise results into \`SYNTHESIS.md\`

## Approval Handling

Workers may set their state to \`waiting_approval\`. The human operator monitors
these via the UpCommander mobile PWA and will send approval/denial back
through the tmux interface. Do not unblock workers manually — wait for the
human signal.

## Status States

| State | Meaning |
|-------|---------|
| \`idle\` | Worker is waiting for a task |
| \`in_progress\` | Worker is actively working |
| \`complete\` | Worker finished — read SYNTHESIS.md |
| \`blocked\` | Worker is stuck — check \`blocking_reason\` |
| \`error\` | Worker errored — intervention needed |
| \`waiting_approval\` | Worker awaits human approval |
`;
}

// ---------------------------------------------------------------------------
// RESULT.md / SUMMARY.md / SKILL.md — three-level audit chain
// ---------------------------------------------------------------------------

/**
 * Write raw findings to a worker's RESULT.md.
 * Appends to existing content (immutable audit trail).
 */
export function writeResult(
  projectPath: string,
  workerName: string,
  content: string
): void {
  const file = join(workerDir(projectPath, workerName), 'RESULT.md');
  const timestamp = new Date().toISOString();
  const entry = `\n---\n<!-- result: ${timestamp} -->\n${content}\n`;
  appendFileSync(file, entry);
}

/**
 * Write a worker-level summary to SUMMARY.md.
 * This aggregates the worker's RESULT.md entries.
 * Links back to RESULT.md for audit traceability.
 */
export function writeSummary(
  projectPath: string,
  workerName: string,
  content: string
): void {
  const file = join(workerDir(projectPath, workerName), 'SUMMARY.md');
  const timestamp = new Date().toISOString();
  const header = `# Summary — ${workerName}\n\n_Generated: ${timestamp}_\n_Source: .claude-coord/workers/${workerName}/RESULT.md_\n\n`;
  writeFileSync(file, header + content);
}

/**
 * Read a worker's SKILL.md (domain-specific analysis instructions).
 */
export function readSkill(
  projectPath: string,
  workerName: string
): string {
  const file = join(workerDir(projectPath, workerName), 'SKILL.md');
  if (!existsSync(file)) return '';
  return readFileSync(file, 'utf8');
}

/**
 * Write domain-specific skill instructions to a worker's SKILL.md.
 */
export function writeSkill(
  projectPath: string,
  workerName: string,
  content: string
): void {
  const file = join(workerDir(projectPath, workerName), 'SKILL.md');
  writeFileSync(file, content);
}

/**
 * Read a worker's RESULT.md content.
 */
export function readResult(
  projectPath: string,
  workerName: string
): string {
  const file = join(workerDir(projectPath, workerName), 'RESULT.md');
  if (!existsSync(file)) return '';
  return readFileSync(file, 'utf8');
}

/**
 * Read a worker's SUMMARY.md content.
 */
export function readSummary(
  projectPath: string,
  workerName: string
): string {
  const file = join(workerDir(projectPath, workerName), 'SUMMARY.md');
  if (!existsSync(file)) return '';
  return readFileSync(file, 'utf8');
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function parseStatusFile(file: string): AgentStatus | null {
  if (!existsSync(file)) return null;
  try {
    const raw = readFileSync(file, 'utf8');
    return JSON.parse(raw) as AgentStatus;
  } catch {
    return null;
  }
}

function touchFile(filePath: string): void {
  if (!existsSync(filePath)) {
    writeFileSync(filePath, '');
  }
}

function addToGitignore(projectPath: string, entry: string): void {
  const gitignorePath = join(projectPath, '.gitignore');

  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, 'utf8');
    if (content.includes(entry)) return;
    appendFileSync(gitignorePath, `\n${entry}\n`);
  } else {
    writeFileSync(gitignorePath, `${entry}\n`);
  }
}
