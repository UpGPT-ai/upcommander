# Claude Commander — Mobile Multi-Agent Orchestration Platform

**Version:** 1.0
**Date:** 2026-03-21
**Author:** Greg Bibas
**Status:** Spec Complete — Ready for Build

---

## Executive Summary

Claude Commander is a mobile PWA that turns an iPhone into a command center for dozens of concurrent Claude Code sessions running on a host machine (local Mac or remote server). It replaces the current workflow of physically switching between Antigravity/VS Code windows with a hierarchical dashboard that shows every agent's status, accepts voice/text prompts, and routes them to the correct session via tmux.

The system introduces a **file-based multi-agent coordination protocol** that allows Claude instances to orchestrate other Claude instances without sharing context windows — enabling massively parallel execution across multiple projects and domains simultaneously.

**This is not a code tool.** The same agent network handles software development, market research, marketing campaign production, long-form document writing, AI-generated media, competitive analysis, or any work that can be decomposed into parallel tasks with file-based deliverables. The architecture is domain-agnostic — what changes between use cases is the CLAUDE.md role definitions and the output file formats, not the orchestration layer.

**Key insight:** By running Claude Code in terminal mode inside tmux panes, the IDE becomes irrelevant to the mobile layer. The same architecture works identically in VS Code, Antigravity, Cursor, or any terminal.

### The Efficiency Thesis

A single Claude session working sequentially through a complex task (build an app, write a book, run a research campaign) takes hours and degrades as its context window fills. Claude Commander inverts this:

- **Parallelism:** 30 agents working simultaneously on different facets of the same project, each with a clean context window
- **Specialization:** Each agent carries only the context relevant to its domain — a research agent never sees code, a code agent never sees marketing copy
- **No degradation:** Subagents are disposable. They do one task, write their result, and their context is discarded. The orchestrator synthesizes without carrying execution baggage
- **Human leverage:** You give one high-level directive. The orchestrator decomposes, assigns, monitors, resolves dependencies, and synthesizes. Your only job is clearing approvals and giving new direction

A 40-hour sequential task becomes a 2-hour parallel execution with higher quality output, because each agent operates at the top of its context window instead of the bottom.

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Architecture Overview](#2-architecture-overview)
3. [Agent Hierarchy](#3-agent-hierarchy)
4. [File-Based Coordination Protocol](#4-file-based-coordination-protocol)
5. [Bridge Server](#5-bridge-server)
6. [Mobile PWA](#6-mobile-pwa)
7. [Security Model](#7-security-model)
8. [Session Lifecycle](#8-session-lifecycle)
9. [Open Source Components](#9-open-source-components)
10. [Build Phases](#10-build-phases)
11. [Constraints & Limits](#11-constraints--limits)
12. [Agent Learning System](#12-agent-learning-system)
13. [Deployment Topology — Local vs Remote vs Hybrid](#13-deployment-topology--local-vs-remote-vs-hybrid)

---

## 1. Problem Statement

### Current Workflow

Greg runs 3+ Antigravity IDE sessions simultaneously, each with up to 6 Claude Code extension windows. Total: 12-18+ active Claude instances across multiple projects (UpGPT, Paula, AROP, HardRx, etc.).

**Pain points:**

- Must physically walk to the desktop to check status or unblock agents
- No unified view of which agents are idle, running, or waiting for approval
- No way to direct work from mobile
- Each Claude session is an isolated webview — no external tool can address them
- Context windows fill up when a single session handles too many concerns

### Why Existing Solutions Fail

| Solution | Why It Fails |
|----------|-------------|
| Claude Code Remote Control (`/rc`) | One link per session. 18 sessions = 18 browser tabs on phone. Not a dashboard. |
| CDP (Chrome DevTools Protocol) | Can only reach the currently visible conversation. Hardcoded to `activeTerminal` with no targeting. |
| antigravity-link-extension | Targets Antigravity's native Agent Manager DOM, not Claude Code webview panels. |
| SSH + tmux alone | Functional but no dashboard, no status badges, no orchestration. |

---

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│              HOST MACHINE (Mac or Remote Server)          │
│                                                          │
│  tmux server                                             │
│  ├── session: "paula"                                    │
│  │   ├── window: orchestrator  → claude (terminal mode)  │
│  │   ├── window: backend       → claude (terminal mode)  │
│  │   ├── window: frontend      → claude (terminal mode)  │
│  │   └── window: tests         → claude (terminal mode)  │
│  ├── session: "arop"                                     │
│  │   ├── window: orchestrator  → claude (terminal mode)  │
│  │   ├── window: landing       → claude (terminal mode)  │
│  │   └── window: email         → claude (terminal mode)  │
│  └── session: "meta"                                     │
│      └── window: meta-orch     → claude (terminal mode)  │
│                                                          │
│  Bridge Server (127.0.0.1:7700)                          │
│  ├── tmux session registry                               │
│  ├── coordination file watcher (chokidar)                │
│  ├── WebSocket server (status push)                      │
│  └── REST API (/sessions, /send, /status)                │
│                                                          │
│  Tailscale (100.x.x.x mesh)                              │
└──────────────────────────────────────────────────────────┘
          │
          │  Tailscale encrypted mesh (no public URL)
          │
┌──────────────────────────────────────────────────────────┐
│                       YOUR iPHONE                        │
│                                                          │
│  Claude Commander PWA                                    │
│  ├── Hierarchical session tree                           │
│  ├── Per-agent status badges                             │
│  ├── Text + voice prompt input                           │
│  ├── Approval queue (bubble-up from any tier)            │
│  └── Broadcast mode (send to all / to project)           │
└──────────────────────────────────────────────────────────┘
```

**Data flow for a prompt:**
1. You type/speak a prompt on your phone
2. PWA sends `POST /send/:session/:window` to the bridge via Tailscale
3. Bridge executes `tmux send-keys -t session:window "prompt" Enter`
4. Claude Code (running locally as you) reads/writes your actual files
5. Claude updates `.claude-coord/status/*.json`
6. Bridge's file watcher detects the change, pushes via WebSocket to PWA
7. Your phone dashboard updates in real-time

**File access is a non-issue.** tmux runs locally. Claude Code runs as your user, in your project directory, with your filesystem permissions. The phone never touches files — it only sends prompts and receives status updates.

---

## 3. Agent Hierarchy

### Three-Tier Model

```
TIER 0 — Meta-Orchestrator (1 instance)
  Role: CEO — sets direction across all projects/campaigns
  Context: project priorities, cross-project dependencies
  Never produces deliverables. Only reads/writes coordination files.

  TIER 1 — Project Orchestrators (1 per project, 3-5 typical)
    Role: Project Lead — plans and coordinates within one project
    Context: project scope, worker status, task definitions
    Never produces deliverables. Only plans and monitors.

    TIER 2 — Domain Workers (up to 10 per orchestrator)
      Role: Domain Specialist — owns a vertical (code, research, writing, design, etc.)
      Context: domain-specific files and references
      Delegates execution to subagents.

      TIER 3 — Execution Subagents (up to 6 per worker, native Claude Code)
        Role: Executor — produces a single bounded deliverable
        Context: single task, narrow file scope
        Full file read/write. This is where output is actually produced.
```

### Use Case Examples

The hierarchy is domain-agnostic. What changes between use cases is the **worker role definitions** and **output file formats**, not the orchestration layer.

#### Software Development
```
META-ORCH → "Build the UpInbox Chrome extension"
  PAULA-ORCH
    ├─ backend-worker     → subagents write TypeScript, migrations, API routes
    ├─ frontend-worker    → subagents write React components, CSS
    ├─ test-worker        → subagents write/run test suites
    └─ deploy-worker      → subagents handle CI/CD, staging, production
```

#### Market Research Campaign
```
META-ORCH → "Research the AI email assistant market for UpInbox positioning"
  RESEARCH-ORCH
    ├─ competitor-worker  → subagents analyze 10 competitors each, write profiles
    ├─ complaint-worker   → subagents mine Reddit/G2/Trustpilot, write complaint taxonomies
    ├─ pricing-worker     → subagents model pricing tiers, write comparison matrices
    ├─ influencer-worker  → subagents identify key voices, write outreach lists
    └─ synthesis-worker   → reads all worker outputs, writes final research report
```

#### Book Production
```
META-ORCH → "Write a 200-page book on AI agent orchestration"
  BOOK-ORCH
    ├─ outline-worker     → subagents research topics, produce chapter outlines
    ├─ chapter-1-worker   → subagents write sections, produce chapter-1.md
    ├─ chapter-2-worker   → subagents write sections, produce chapter-2.md
    ├─ ...
    ├─ edit-worker        → subagents review chapters for consistency, tone, accuracy
    ├─ citations-worker   → subagents verify claims, build bibliography
    └─ format-worker      → subagents compile final manuscript, generate PDF/EPUB
```

#### Marketing Campaign
```
META-ORCH → "Launch UpInbox across 5 channels with cohesive messaging"
  CAMPAIGN-ORCH
    ├─ copy-worker        → subagents write landing pages, email sequences, ad copy
    ├─ social-worker      → subagents write posts for Twitter/LinkedIn/Reddit
    ├─ seo-worker         → subagents research keywords, write blog posts
    ├─ creative-worker    → subagents generate image prompts, produce visual assets
    ├─ video-worker       → subagents write scripts, generate AI video prompts
    └─ analytics-worker   → subagents set up tracking, attribution, dashboards
```

#### AI Video Production
```
META-ORCH → "Create a 10-episode explainer series on SEM optimization"
  VIDEO-ORCH
    ├─ script-worker      → subagents write per-episode scripts
    ├─ storyboard-worker  → subagents produce shot lists, visual descriptions
    ├─ prompt-worker      → subagents craft generation prompts (Sora/Runway/Kling)
    ├─ audio-worker       → subagents write voiceover scripts, music direction
    └─ assembly-worker    → subagents compile asset manifests, edit instructions
```

#### Multi-Domain (Your Actual Day)
```
META-ORCH → "Today: ship UpInbox v1.1, finish HardRx research, draft Paula pitch deck"
  UPINBOX-ORCH         → 5 dev workers (code)
  HARDRX-ORCH          → 3 research workers (market analysis)
  PAULA-ORCH           → 2 content workers (pitch deck + financials)
```

**The orchestration layer doesn't know or care what the workers produce.** It reads STATUS.json, routes tasks, resolves dependencies, and synthesizes results. Whether the output is `.ts` files, `.md` chapters, image prompts, or video scripts is irrelevant to the coordination protocol.

### Scale Examples

| Configuration | Workers | Subagents | Total Instances |
|---------------|---------|-----------|-----------------|
| Light (1 project, 3 workers) | 3 | 12 | 17 |
| Medium (3 projects, 5 workers each) | 15 | 60 | 79 |
| Heavy (3 projects, 10 workers each) | 30 | 120 | 154 |
| Max (5 projects, 10 workers each) | 50 | 300 | 356 |

### Context Window Isolation (the key insight)

Each tier only carries the context it needs:

- **Meta-orchestrator:** project status summaries. Never sees deliverables.
- **Project orchestrator:** worker status + task definitions. Never sees execution details.
- **Worker:** its domain files + subagent results. Never sees other workers' output.
- **Subagent:** one task file + a handful of reference files. Disposable after completion.

Work products move **down** as task files and **up** as result files — never through context windows. This prevents the degradation that happens when a single Claude session handles too many concerns.

This scales identically whether the output is code, prose, research, or media generation prompts. The file system is the universal coordination layer.

---

## 4. File-Based Coordination Protocol

### Directory Structure

Every project that uses coordination gets a `.claude-coord/` directory at the project root:

```
~/projects/upgpt/paula/
├── .claude-coord/
│   ├── PLAN.md                          ← Tier 0→1: meta-orchestrator's directive
│   ├── ORCHESTRATOR.md                  ← Tier 1: project master plan
│   │
│   ├── workers/
│   │   ├── backend/
│   │   │   ├── TASK.md                  ← Tier 1→2: current assignment
│   │   │   ├── STATUS.json             ← Tier 2→1: progress report
│   │   │   ├── SYNTHESIS.md            ← Tier 2→1: completed work summary
│   │   │   └── subagents/
│   │   │       ├── jwt-impl/
│   │   │       │   ├── TASK.md          ← Tier 2→3: specific task
│   │   │       │   ├── STATUS.json      ← Tier 3→2: progress
│   │   │       │   └── RESULT.md        ← Tier 3→2: deliverable
│   │   │       ├── session-mgmt/
│   │   │       │   └── ...
│   │   │       └── token-refresh/
│   │   │           └── ...
│   │   │
│   │   ├── frontend/
│   │   │   └── ...
│   │   └── tests/
│   │       └── ...
│   │
│   └── SYNTHESIS.md                     ← Tier 1→0: project-level summary
│
├── .gitignore                           ← includes .claude-coord/
├── CLAUDE.md                            ← references coordination protocol
└── src/
```

### STATUS.json Schema

```json
{
  "agent": "backend",
  "tier": 2,
  "state": "in_progress | complete | blocked | error | idle | waiting_approval",
  "task": "Implement JWT refresh token rotation",
  "started": "2026-03-21T14:30:00Z",
  "updated": "2026-03-21T14:45:00Z",
  "progress": "3/5 subtasks complete",
  "blocking_reason": null,
  "waiting_for": null,
  "subagents": {
    "active": 3,
    "complete": 1,
    "total": 4
  },
  "files_produced": [
    "src/auth/jwt.ts",
    "output/chapter-3-draft.md",
    "assets/prompts/hero-image.txt"
  ]
}
```

### TASK.md Format

```markdown
# Task: [Title]

**Assigned by:** [orchestrator|worker name]
**Priority:** [P0|P1|P2]
**Dependencies:** [list of workers/tasks that must complete first]

## Objective
[1-3 sentences describing what needs to be done]

## Constraints
- [Constraint 1]
- [Constraint 2]

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Context Files
- [Reference files, source material, prior outputs — any domain]
```

### SYNTHESIS.md Format

```markdown
# Synthesis: [Worker/Project Name]

**Generated:** [timestamp]
**Task:** [original task title]
**Status:** complete

## What Was Done
[2-5 bullet points]

## Files Produced
- [List of output files with one-line descriptions]

## Decisions Made
- [Key judgment calls with rationale — useful for orchestrator review]

## Open Questions
- [Any unresolved issues for the orchestrator to decide]
```

### Coordination Rules

1. **Ownership:** Each agent owns exactly one `STATUS.json` and one `SYNTHESIS.md`. No two agents ever write to the same file.
2. **Read direction:** Each tier reads one level down (tasks, status) and one level up (its own task assignment).
3. **Write direction:** Each tier writes its own status (up) and task files (down).
4. **No cross-reads:** A worker never reads another worker's files directly. Cross-worker information flows through the orchestrator's synthesis.
5. **Idempotency:** Task files are complete specifications. A worker that crashes and restarts can re-read its `TASK.md` and resume.

### CLAUDE.md Integration

Each worker's tmux pane launches Claude with a project `CLAUDE.md` that includes:

```markdown
## Coordination Protocol

You are the **[backend]** worker for this project.

- Your task assignment: `.claude-coord/workers/backend/TASK.md`
- Write your status to: `.claude-coord/workers/backend/STATUS.json`
- Write your results to: `.claude-coord/workers/backend/SYNTHESIS.md`
- Your subagent tasks go in: `.claude-coord/workers/backend/subagents/[name]/TASK.md`

Poll your TASK.md when prompted. Update STATUS.json after each significant action.
When your task is complete, write SYNTHESIS.md and set status to "complete".
```

### Orchestrator Self-Direction (Autonomous Worker Activation)

Orchestrators do NOT require human intervention to activate workers. When an orchestrator receives a high-level directive, it:

1. Decomposes the work into TASK.md files for each worker
2. **Sends prompts directly to workers** via the bridge server's CLI or REST API
3. Monitors STATUS.json files for completion, blocking, and errors
4. Resolves dependencies (activates downstream workers when upstream completes)
5. Synthesizes results and reports back to the human

**How orchestrators reach workers:**

The orchestrator's CLAUDE.md grants it access to the `claude-commander` CLI as an allowed tool:

```markdown
## Orchestrator Tools

You have access to the `claude-commander` CLI to direct workers:

- `claude-commander send paula:backend "Check your TASK.md and begin work"` — activate a worker
- `claude-commander send paula:frontend "Your dependency on backend is resolved. Begin work."` — unblock a worker
- `claude-commander broadcast paula "Stop current work and run tests"` — broadcast to all workers

Use these after writing TASK.md files. Never require the human to activate workers manually.
Monitor STATUS.json files to know when to activate dependent workers.
```

**Alternatively**, the orchestrator can use the bridge server's REST API directly via `curl`:

```bash
curl -X POST http://127.0.0.1:7700/send/paula/backend \
  -H "Authorization: Bearer $COMMANDER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Check your TASK.md and begin work"}'
```

**The human's only job** is to give the orchestrator a high-level directive ("Refactor auth to use JWT") and clear approval prompts that bubble up. Everything between — task decomposition, worker activation, dependency resolution, synthesis — is autonomous.

---

## 5. Bridge Server

### Tech Stack

- **Runtime:** Node.js 20+
- **Framework:** Express
- **WebSocket:** ws (for real-time push to mobile)
- **File watching:** chokidar (for `.claude-coord/` status changes)
- **Process:** tmux CLI via `child_process.execSync`

### API Endpoints

#### Session Management

```
GET /sessions
  → Returns full tmux session/window tree as JSON
  Response: {
    sessions: [
      {
        name: "paula",
        windows: [
          { name: "orchestrator", pane_pid: 12345, active: true },
          { name: "backend", pane_pid: 12346, active: false }
        ]
      }
    ]
  }

GET /status/:session/:window
  → Returns STATUS.json for that worker (read from .claude-coord/)
  Response: { ...STATUS.json contents }

GET /status/tree
  → Returns full coordination tree across all projects
  Response: { projects: { paula: { orchestrator: {...}, workers: {...} } } }
```

#### Command Routing

```
POST /send/:session/:window
  Body: { "prompt": "Refactor the auth module to use JWT" }
  → Executes: tmux send-keys -t session:window "prompt" Enter
  → Returns: { "sent": true, "session": "paula", "window": "backend" }

POST /broadcast/:session
  Body: { "prompt": "Stop current work and run tests" }
  → Sends to ALL windows in the named session

POST /broadcast/all
  Body: { "prompt": "Status update please" }
  → Sends to ALL windows in ALL sessions

POST /approve/:session/:window
  → Sends "y" + Enter to approve a pending Claude action
```

#### Health & Auth

```
GET /health
  → { "status": "ok", "sessions": 3, "windows": 12 }

POST /auth
  Body: { "token": "..." }
  → Validates bearer token, returns session cookie
```

### Session Registry Implementation

```typescript
// Core: parse tmux ls into structured data
function getSessionTree(): SessionTree {
  const raw = execSync('tmux ls -F "#{session_name}"').toString().trim();
  const sessions = raw.split('\n').map(session => {
    const windows = execSync(
      `tmux list-windows -t ${session} -F "#{window_name}:#{pane_pid}:#{window_active}"`
    ).toString().trim().split('\n').map(w => {
      const [name, pid, active] = w.split(':');
      return { name, pane_pid: parseInt(pid), active: active === '1' };
    });
    return { name: session, windows };
  });
  return { sessions };
}
```

### File Watcher

```typescript
// Watch all coordination directories for status changes
const watcher = chokidar.watch('**/. claude-coord/**/STATUS.json', {
  persistent: true,
  ignoreInitial: true
});

watcher.on('change', (filepath) => {
  const status = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  // Push to all connected mobile clients via WebSocket
  wsClients.forEach(client => {
    client.send(JSON.stringify({
      type: 'status_update',
      path: filepath,
      status
    }));
  });
});
```

### Bridge Server Config

```json
{
  "port": 7700,
  "host": "127.0.0.1",
  "tokenFile": "~/.claude-commander/auth-token",
  "logFile": "~/.claude-commander/audit.log",
  "coordGlob": "**/. claude-coord/**/STATUS.json",
  "projectRoots": [
    "~/projects/upgpt",
    "~/projects/hardrx",
    "~/projects/arop"
  ]
}
```

---

## 6. Mobile PWA

### Tech Stack

- **Framework:** Preact + Vite (from antigravity-link-extension)
- **Styling:** Tailwind CSS, dark theme, glassmorphism
- **Voice:** Web Speech API (speech-to-text for prompts)
- **Connectivity:** WebSocket (real-time status) + REST (commands)
- **Auth:** Biometric/PIN on session start, auto-lock after 30min idle

### Dashboard Views

#### 1. Hierarchy View (default)

```
┌─────────────────────────────────────────────┐
│  Claude Commander              [META] ●      │
├─────────────────────────────────────────────┤
│  ▼ PAULA              [ORCH] ●  12/30 done  │
│    ▼ backend          [WORK] ●   3/6 agents │
│      ├─ jwt-impl           ● running        │
│      ├─ session-mgmt       ✓ complete       │
│      └─ token-refresh      ◉ needs approval │
│    ▶ frontend         [WORK] ○  waiting     │
│    ▶ tests            [WORK] ● running      │
│                                             │
│  ▶ AROP               [ORCH] ○  pending     │
│  ▶ HARDRX              [ORCH] ● running     │
├─────────────────────────────────────────────┤
│  [🎤 Voice]  [⌨ Text]  [📢 Broadcast]      │
└─────────────────────────────────────────────┘
```

#### 2. Approval Queue View

Shows only agents in `waiting_approval` state across all projects. Swipe to approve, tap to inspect. This is the primary mobile interaction — clearing the approval queue.

```
┌─────────────────────────────────────────────┐
│  Approvals                          3 pending│
├─────────────────────────────────────────────┤
│  paula:backend:token-refresh                │
│  "Delete src/auth/old-tokens.ts?"           │
│  [Approve]  [Deny]  [Inspect]               │
│─────────────────────────────────────────────│
│  hardrx:landing                             │
│  "Run npm run deploy:staging?"              │
│  [Approve]  [Deny]  [Inspect]               │
│─────────────────────────────────────────────│
│  paula:tests                                │
│  "Install @testing-library/react@15?"       │
│  [Approve]  [Deny]  [Inspect]               │
└─────────────────────────────────────────────┘
```

#### 3. Session Detail View

Tap any row in the hierarchy → full terminal output stream + prompt input.

```
┌─────────────────────────────────────────────┐
│  ← paula:backend                    ● live   │
├─────────────────────────────────────────────┤
│  > Reading src/auth/jwt.ts                  │
│  > Editing src/auth/jwt.ts (lines 42-67)    │
│  > Running npm test -- auth                 │
│  > 14/14 tests passing                      │
│  > Writing SYNTHESIS.md                     │
│  > Status: complete                         │
│                                             │
│                                             │
│                                             │
├─────────────────────────────────────────────┤
│  [Type a prompt or tap 🎤 to speak...]      │
└─────────────────────────────────────────────┘
```

#### 4. Metrics View

Aggregate stats: agents running, tasks complete, files modified, time elapsed per project.

### Mobile Interactions

| Action | Behavior |
|--------|----------|
| Tap project name | Opens orchestrator for that project |
| Tap worker name | Opens session detail for that worker |
| Tap approval badge | Jumps to approval queue, filtered to that agent |
| Long-press project | Broadcast prompt to all workers in that project |
| Swipe approval | Quick approve/deny |
| Voice button | Speech-to-text → routes to selected session |
| Broadcast button | Prompt all sessions simultaneously |

---

## 7. Security Model

### Threat Assessment

This system can write files, run commands, and execute code on your laptop. The bridge server has effective full filesystem access as your user. Design accordingly.

### Attack Surfaces & Mitigations

#### 1. Network Exposure

**Risk:** A public URL (Cloudflare tunnel) could be discovered, allowing anyone to send commands to your laptop.

**Mitigation:** Use **Tailscale** instead. Tailscale creates a private encrypted mesh network between your phone and laptop with zero public exposure. No open ports, no public URL, no tunnel. Your phone gets a private IP (100.x.x.x) that can reach your laptop directly. Free for personal use.

**Hard rule:** The bridge server binds to `127.0.0.1` only, never `0.0.0.0`. Tailscale routes traffic to localhost via its virtual interface.

#### 2. Authentication

| Layer | Implementation |
|-------|----------------|
| Bearer token | 32-byte random token generated on bridge startup, written to `~/.claude-commander/auth-token` |
| Token validation | Every endpoint validates the `Authorization: Bearer <token>` header |
| Rate limiting | 10 failed auth attempts → 5 minute lockout per IP |
| Session expiry | Mobile auth expires after 30 minutes of inactivity |
| Biometric | PWA requires Face ID/Touch ID on session start |

#### 3. Command Injection

**Risk:** `tmux send-keys` is essentially `eval` — it executes whatever string you send.

**Mitigations:**
- Input sanitization: strip shell metacharacters before passing to `send-keys`
- Claude-only mode: pipe input to Claude Code's stdin rather than raw shell, constraining it to the Claude context
- Audit log: every command sent through the bridge is logged to `~/.claude-commander/audit.log` with timestamp, source device, target session, and full prompt text

#### 4. Phone Compromise

**Risk:** If someone gets your unlocked phone, they can send commands to your laptop.

**Mitigations:**
- Biometric/PIN required on PWA launch
- Auto-lock after 30 min idle
- "Kill switch" endpoint: `POST /lockdown` immediately stops accepting commands until re-authenticated from the Mac directly

### Security Architecture

```
Phone (Tailscale 100.x.x.y)
  │
  │  Tailscale WireGuard tunnel (encrypted, no public endpoint)
  │
Mac (Tailscale 100.x.x.z, bridge on 127.0.0.1:7700)
  │
  ├── TLS (self-signed cert for HTTPS, required for mic/speech API)
  ├── Bearer token auth (32-byte random, per-session)
  ├── Rate limiting on all endpoints
  ├── Command logging to ~/.claude-commander/audit.log
  ├── Input sanitization before send-keys
  └── Session timeout (30 min idle → re-auth required)
```

### What Does NOT Leave Your Machine

- **Files:** The bridge never reads file contents. It only forwards prompts and reads STATUS.json.
- **API keys:** Anthropic keys stay in `~/.claude/`. The bridge doesn't need them.
- **Prompts:** Claude Code already sends prompts to Anthropic's API. The bridge just delivers the prompt to Claude Code the same way your keyboard does.

---

## 8. Session Lifecycle

### Starting a Work Session

```bash
# 1. Start the bridge server
claude-commander start

# 2. Create project sessions with named workers (any domain)
claude-commander init paula ~/projects/upgpt/paula \
  --workers orchestrator,backend,frontend,tests

claude-commander init book ~/projects/ai-book \
  --workers orchestrator,outline,chapter-1,chapter-2,chapter-3,edit,citations

claude-commander init campaign ~/projects/upinbox-launch \
  --workers orchestrator,copy,social,paid-search,creative,analytics

# Under the hood this runs (per project):
# tmux new-session -d -s paula -c ~/projects/upgpt/paula
# tmux rename-window -t paula:0 "orchestrator"
# tmux send-keys -t paula:orchestrator "claude" Enter
# tmux new-window -t paula -n "backend" -c ~/projects/upgpt/paula
# tmux send-keys -t paula:backend "claude" Enter
# ... etc

# 3. Initialize coordination directory
claude-commander coord-init paula

# Creates .claude-coord/ structure with CLAUDE.md references

# 4. Open the PWA on your phone
# Navigate to https://100.x.x.z:7700 via Tailscale
# Authenticate with token (QR code shown in terminal)
```

### Directing Work From Mobile

#### Example 1: Software Development
1. Open the PWA → see all projects and their status
2. Tap **paula → orchestrator**
3. Type or speak: "Refactor the auth module to use JWT. Backend handles implementation, tests validates, frontend updates the login flow."
4. The orchestrator autonomously:
   - Writes `workers/backend/TASK.md` with the JWT implementation spec
   - Writes `workers/tests/TASK.md` with what tests need to pass
   - Sets `workers/frontend/TASK.md` with a dependency on backend completion
   - **Sends prompts to each worker** via `claude-commander send` to activate them
   - Monitors `STATUS.json` files for completion
   - When backend completes, activates frontend automatically
   - Synthesizes results into `SYNTHESIS.md`
5. Workers execute, subagents do the code writing
6. Status badges update in real-time on your phone
7. Approval prompts bubble up to the approval queue
8. You clear approvals from the couch

#### Example 2: Book Production
1. Tap **book → orchestrator**
2. Speak: "Write a 12-chapter book on AI agent orchestration for non-technical founders. Research-backed, practical, 200 pages."
3. The orchestrator autonomously:
   - Writes `workers/outline/TASK.md` — produce chapter structure with themes
   - When outline completes, reads it and spawns `workers/chapter-1/` through `workers/chapter-12/` with per-chapter TASK.md files
   - Each chapter worker runs subagents: one for research, one for drafting, one for examples
   - Writes `workers/edit/TASK.md` with dependency on all chapters — consistency pass
   - Writes `workers/citations/TASK.md` — verify all claims, build bibliography
   - Synthesizes into a compiled manuscript
4. You review chapter summaries as they complete, give feedback ("Chapter 4 needs more case studies"), which the orchestrator routes to the right worker

#### Example 3: Marketing Campaign
1. Tap **campaign → orchestrator**
2. Speak: "Launch campaign for UpInbox across email, social, and paid search. Target: solopreneurs drowning in email. Budget: $5K."
3. The orchestrator:
   - Spawns copy, social, paid-search, creative, and analytics workers
   - Copy worker produces landing page text, email sequences, ad variants
   - Social worker produces platform-specific posts (LinkedIn, Twitter, Reddit)
   - Creative worker generates image prompts, produces visual asset briefs
   - Analytics worker writes tracking plans, UTM structures, conversion goals
   - All workers complete → orchestrator synthesizes into a campaign launch playbook

**You give one prompt. The orchestrator handles everything else.** Your ongoing role is limited to clearing the approval queue and giving new high-level directives.

#### Example 4: Multi-Domain Day
From the airport, in one sitting:
1. Tap **meta-orchestrator**
2. Speak: "Today: ship UpInbox hotfix for the scanner bug, finish the HardRx competitive analysis, and draft the Paula investor deck."
3. The meta-orchestrator:
   - Activates 3 project orchestrators with specific directives
   - Each project orchestrator spawns its own workers
   - You see all three projects progressing simultaneously on your dashboard
   - Clear approvals as they surface. Review syntheses when projects complete.

### Ending a Work Session

```bash
# Save all sessions (persist across reboot)
claude-commander save

# Under the hood: tmux-resurrect saves session layout
# Coordination files already persist on disk

# Resume later
claude-commander restore
```

---

## 9. Open Source Components

### What to Fork / Extract

| Repo | License | What You Take | What You Replace |
|------|---------|---------------|------------------|
| **cafeTechne/antigravity-link-extension** | MIT | Express server shell, Cloudflare tunnel manager, QR pairing, multi-device WebSocket, mobile Preact UI, voice-to-text | CDP targeting → tmux targeting |
| **ye4wzp/antigravity-link-extension** (fork) | MIT | `/instances` multi-session discovery, `cdp-manager.ts` architecture | CDP → tmux session registry |
| **thethrillgh/antigravity-link-extension** (perf fork) | MIT | Gzip compression (500KB→5KB payloads), CSS caching, ETag dirty detection, 304 Not Modified, optimized polling | Nothing — pure add |
| **yazanbaker94/AntiGravity-AutoAccept** | MIT | Session health monitoring, 10s heartbeat, auto-reconnect, MutationObserver re-injection, 3-strike pruning | MutationObserver → file watcher |
| **smtg-ai/claude-squad** | MIT | tmux orchestration patterns for Claude Code sessions, session registry | GUI → headless bridge |
| **tmux-plugins/tmux-resurrect** | MIT | Session persistence across reboots | Nothing — direct dependency |

### Component Mapping

```
YOUR TOOL: "Claude Commander"

├── VS Code Extension (optional, TypeScript)
│   ├── FROM: cafeTechne — extension.ts shell, status bar, QR webview
│   ├── FROM: cafeTechne — cert.ts (SSL for mobile mic access)
│   └── NEW: tmux session registry (replaces CDP discovery)
│
├── Bridge Server (Node/Express)
│   ├── FROM: cafeTechne — server/index.ts orchestrator (~200 lines)
│   ├── FROM: thethrillgh — gzip + ETag performance layer
│   ├── FROM: cafeTechne — tunnel.ts (Cloudflare fallback)
│   ├── FROM: cafeTechne — device-manager.ts (multi-phone WebSocket)
│   ├── NEW: /sessions endpoint → parses tmux ls
│   ├── NEW: /send/:session/:window → tmux send-keys
│   ├── NEW: /status/tree → reads .claude-coord/ tree
│   └── NEW: chokidar file watcher for real-time status push
│
├── Session Health Monitor
│   ├── FROM: yazanbaker94 — heartbeat + auto-reconnect pattern
│   └── NEW: polls tmux pane liveness instead of CDP WebSocket
│
├── Coordination Protocol
│   └── NEW: .claude-coord/ directory structure, JSON schemas, CLAUDE.md templates
│
├── CLI Tool (claude-commander)
│   ├── NEW: init, start, stop, save, restore, coord-init commands
│   └── FROM: claude-squad — tmux session management patterns
│
└── Mobile PWA (Preact + Vite)
    ├── FROM: cafeTechne/ye4wzp — mobile UI, dark theme, glassmorphism
    ├── FROM: cafeTechne — voice-to-text with Web Speech API
    ├── NEW: hierarchical session tree (collapse/expand)
    ├── NEW: approval queue view
    ├── NEW: per-agent status badges (from STATUS.json)
    └── NEW: broadcast mode (send to all / to project / to tier)
```

---

## 10. Build Phases

### Phase 1 — Single Session Control (Week 1)

**Goal:** Send a prompt from your phone to one Claude session and see it execute.

**Deliverables:**
1. Bridge server with `/sessions`, `/send`, `/health` endpoints
2. tmux session registry (parses `tmux ls` into JSON)
3. Bearer token auth + audit logging
4. Minimal mobile page: session list + prompt input
5. Tailscale setup (Mac + iPhone on same mesh)
6. `claude-commander start` and `claude-commander init` CLI commands

**Validation:** From your phone, send "create a file called hello.txt with today's date" to a Claude session. Verify the file appears on your laptop. This proves the full chain: phone → Tailscale → bridge → tmux → Claude → filesystem.

**Test with:** One coding session (familiar territory). Confirm the pipe works before scaling.

---

### Phase 2 — Multi-Session Dashboard (Week 2)

**Goal:** Full dashboard with real-time status for 10+ sessions across multiple projects.

**Deliverables:**
1. Mobile PWA (Preact + Vite) with hierarchy view (projects → windows)
2. WebSocket server for real-time status push
3. Voice-to-text input (Web Speech API)
4. Broadcast mode (send to all windows in a session, or all sessions)
5. Session detail view (terminal output stream)
6. QR code pairing flow from bridge server
7. Performance layer (gzip, ETag, 304s from thethrillgh fork)
8. `claude-commander broadcast` CLI command

**Validation:** Run 3 projects × 4 windows = 12 Claude sessions. Dashboard shows all of them. Send prompts to individual sessions. Broadcast "what are you working on?" to all. See responses stream in.

**Test with:** Mix of domains — one coding project, one research task, one writing task. Confirm the dashboard doesn't assume any specific domain.

---

### Phase 3 — File-Based Coordination Protocol (Week 3)

**Goal:** One Claude instance autonomously directs other Claude instances. You give one prompt, agents self-coordinate.

**Deliverables:**
1. `.claude-coord/` directory structure and JSON schemas (STATUS.json, TASK.md, SYNTHESIS.md)
2. CLAUDE.md role templates for orchestrator, worker, and subagent
3. Orchestrator self-direction: orchestrator calls `claude-commander send` to activate workers without human intervention
4. chokidar file watcher in bridge → WebSocket push for real-time status
5. Approval queue view in PWA (swipe to approve/deny)
6. `claude-commander coord-init` CLI command
7. Status badges derived from STATUS.json (idle / running / blocked / waiting_approval / complete)
8. Dependency resolution: orchestrator activates downstream workers when upstream completes

**Validation — Code:** Create an orchestrator + 3 workers for a coding project. Send: "Add user authentication with JWT." Verify the orchestrator decomposes into backend/frontend/test tasks, activates workers, and workers complete without human prompting.

**Validation — Non-code:** Create an orchestrator + 3 workers for a research project. Send: "Research the top 10 AI email tools, their pricing, and user complaints." Verify the orchestrator creates per-competitor tasks, workers produce research files, and the orchestrator synthesizes a final report.

**This is the critical phase.** If coordination works, everything after this is scale and polish.

---

### Phase 4 — Multi-Domain Templates (Week 4)

**Goal:** Predefined project templates for common use cases so you can spin up any type of work instantly.

**Deliverables:**
1. Template system: `claude-commander init --template <name>`
2. Built-in templates:

| Template | Workers Created | Use Case |
|----------|----------------|----------|
| `dev` | orchestrator, backend, frontend, tests, deploy | Software development |
| `research` | orchestrator, competitors, complaints, pricing, influencers, synthesis | Market research |
| `book` | orchestrator, outline, chapter-1 through chapter-N, edit, citations, format | Long-form writing |
| `campaign` | orchestrator, copy, social, paid-search, creative, analytics | Marketing campaigns |
| `video` | orchestrator, scripts, storyboard, prompts, audio, assembly | AI video production |
| `custom` | orchestrator + user-defined workers | Anything else |

3. Per-template CLAUDE.md role definitions (domain-specific instructions for each worker type)
4. Per-template output directory structure (where deliverables land)
5. Template authoring: users can create and save their own templates

**Validation:** From your phone:
- `claude-commander init market-study ~/projects/sem-market --template research` → 6 workers spawn, ready for a directive
- Send one prompt: "Analyze the AI SEM tool market for SEM Sentinel positioning"
- Workers execute in parallel, produce research files, orchestrator synthesizes
- Total elapsed: ~30 minutes for what would be 2 days of serial research

---

### Phase 5 — Scale, Persistence & Remote (Week 5-6)

**Goal:** Handle 50+ concurrent agents, survive reboots, optionally run on a remote server.

**Deliverables:**
1. Three-tier hierarchy: meta-orchestrator → project orchestrators → workers → subagents
2. Meta-orchestrator support: direct multiple projects from a single prompt ("Today: ship UpInbox hotfix, finish HardRx research, draft Paula deck")
3. Metrics view in PWA (agents running, tasks complete, files produced, time elapsed per project)
4. Session lifecycle: `claude-commander save` / `restore` (tmux-resurrect integration)
5. Health monitor with auto-reconnect and 3-strike pruning (from yazanbaker94 patterns)
6. Pagination/virtualization for large session trees on mobile
7. Mobile biometric auth + 30-min auto-lock
8. Remote deployment support:
   - Documentation for VPS setup (Hetzner/DO/FastComet)
   - Tailscale mesh between VPS + phone + Mac
   - VS Code Remote-SSH configuration guide
   - Bridge server runs identically local or remote (zero code changes)

**Validation — Scale:** Meta-orchestrator directing 3 project orchestrators (one code, one research, one content), each with 5 workers. Verify context isolation, status propagation, dependency resolution, and approval bubbling all work at scale.

**Validation — Persistence:** Kill the terminal, reboot, run `claude-commander restore`. All sessions resume with coordination state intact.

**Validation — Remote:** Deploy to a Hetzner CX22. Confirm full functionality from phone + Mac via Tailscale. Verify latency is acceptable.

---

### Phase 6 — VS Code Extension & Polish (Week 7-8)

**Goal:** Desktop-class interface alongside the mobile PWA. Production-ready.

**Deliverables:**
1. VS Code extension:
   - Status bar showing active sessions count + states
   - Sidebar panel: same hierarchy/approval views as PWA
   - Inline prompt input — send to any session without leaving the editor
   - Connects to bridge at localhost (local) or via Tailscale (remote)
2. Notification system: push notifications to phone when agents need approval or complete major milestones
3. Output aggregation: collect all worker deliverables into a structured output directory per project
4. Cost tracking: estimate Anthropic API spend per project based on agent count × duration
5. Session recording: log full session transcripts for review/replay
6. Documentation + README for open-source release

**Validation:** Complete a full multi-domain day using only the VS Code extension (at desk) and PWA (away from desk), managing 3+ projects simultaneously. No terminal interaction required.

---

### Phase 7 — Agent Learning System (Weeks 9-10)

**Goal:** Agents get smarter with every task. The system remembers what works and proposes its own improvements.

**Launch with Tier 1 only** — flat files on disk, zero external dependencies. Build the Tier 2/3 adapters in parallel so they can be switched on later without code changes to agents.

**Deliverables:**
1. Tier 1 memory structure (`~/.claude-commander/memory/`) — all local JSON + Markdown files
2. Progressive disclosure: Level 0 always loaded, Level 1 on task start, Level 2 on demand via tool call
3. Automatic fact extraction after every task completion (fire-and-forget, writes to local files)
4. `recall_memory` tool available to all workers — grep/glob search on local learning files
5. Session history auto-compaction at 30 exchanges (from NEXUS pattern)
6. Worker performance tracking (`worker-performance.json` — local)
7. Template performance tracking (`template-performance.json` — local)
8. Cost tracking per agent, per project, per domain (local JSON)
9. **Memory backend interface** — abstract adapter so the same agent tools work against Tier 1 (local files) or Tier 2+3 (pgvector + Supabase) with a config switch:

```json
// ~/.claude-commander/config.json
{
  "memory_backend": "local",     // "local" at launch, switch to "cloud" later
  "memory_cloud": {              // ignored until memory_backend = "cloud"
    "supabase_url": "...",
    "supabase_key": "...",
    "embedding_model": "text-embedding-3-small"
  }
}
```

**Validation:** Run the same research task twice, two weeks apart. Second run should:
- Auto-load relevant facts from the first run
- Produce output closer to your preferences without correction
- Complete faster (fewer revisions needed)

---

### Phase 8 — Self-Evolution & Cloud Memory (Weeks 11-12)

**Goal:** System proposes improvements to its own configuration. Optionally upgrade to semantic search and structured analytics.

**Deliverables — Self-Evolution (all local):**
1. Optimization proposal engine: detects quality flags (rejection_rate > 15%, quality < 7.0)
2. Automatic CLAUDE.md modification proposals surfaced in mobile dashboard
3. Approval workflow: approve/reject from phone, audit trail logged
4. Role A/B testing: challenger versions of worker definitions run on alternating tasks
5. Drift detection: alerts when orchestrator task decomposition patterns shift from template norms
6. Guard rails: min sample size 10, max 1 proposal per worker per 14 days, human approval required
7. Version history for all role definitions with instant rollback

**Deliverables — Cloud Memory (optional, flip the switch):**
8. Tier 2 adapter: embed learning files into pgvector (Supabase), semantic search via `recall_memory` tool
9. Tier 3 adapter: structured analytics tables in Supabase (task_outcomes, agent_performance, cost_log)
10. Migration script: backfill existing Tier 1 files into Tier 2+3
11. Dashboard: performance analytics powered by Tier 3 data (optional web UI or mobile view)

**When to flip:** Move to cloud memory when:
- You have >1000 learning files and grep can't find the right context
- You want cross-project semantic search ("what worked in Paula that applies to HardRx?")
- You want automated performance dashboards beyond local JSON

**Validation — Self-Evolution:** After 20+ research tasks, the system should propose at least one CLAUDE.md improvement (e.g., "Add pricing comparison table requirement — 25% rejection rate without it"). Approve it, verify future tasks include the improvement automatically.

**Validation — Cloud Memory:** Switch `memory_backend` to `"cloud"`. Verify all existing learnings are searchable via semantic query. Verify agents get better context matches than grep-based search.

---

### Phase Summary

| Phase | Week | What You Get | Key Risk |
|-------|------|-------------|----------|
| 1 — Single Session | 1 | Phone → Claude pipe works | Tailscale setup, tmux familiarity |
| 2 — Dashboard | 2 | See and control 12+ sessions | WebSocket reliability, mobile UX |
| 3 — Coordination | 3 | Agents direct other agents | Orchestrator prompt engineering, dependency resolution |
| 4 — Templates | 4 | Instant project spinup for any domain | Template quality, role definitions |
| 5 — Scale & Remote | 5-6 | 50+ agents, survives reboots, runs on server | API rate limits, remote latency |
| 6 — VS Code & Polish | 7-8 | Production-ready, open-source | Extension marketplace approval |
| 7 — Learning System | 9-10 | Agents remember and improve (local files) | Learning extraction quality, memory bloat |
| 8 — Self-Evolution | 11-12 | System proposes its own improvements + optional cloud memory | Proposal quality, guard rail tuning |

**Ship after Phase 3.** That's the minimum viable product — you can direct multi-agent work from your phone across any domain.

**Phases 4-6** are acceleration and polish.

**Phases 7-8** are the compounding advantage — the system gets better the more you use it. Every task teaches it. By month 3, the agent network has domain expertise that would take a human team weeks to develop.

**Memory evolution:** Phases 7-8 launch with local files only (zero dependencies). When volume demands it, flip `memory_backend` from `"local"` to `"cloud"` — same agent tools, same progressive disclosure levels, just a better search backend. Build both adapters, switch when it makes sense.

---

## 11. Constraints & Limits

### Anthropic API Rate Limits

At 50+ simultaneous Claude instances, you will hit API rate limits. Mitigations:
- **Staggered spawning:** The meta-orchestrator launches waves, not all workers simultaneously
- **Priority queuing:** P0 tasks get API priority over P2 tasks
- **Subagent pooling:** Workers reuse subagent slots rather than spawning new ones

### File Write Conflicts

180 agents writing to the same filesystem needs discipline:
- **Ownership rule:** Each agent owns exactly one STATUS.json and one SYNTHESIS.md
- **No shared writes:** No two agents ever write to the same file
- **Git-ignored:** `.claude-coord/` is in `.gitignore` — it's ephemeral coordination state, not source code

### Deadlock Detection

Worker A waiting on Worker B, who waits on a subagent that depends on Worker A's output.
- Orchestrators must write tasks in dependency order
- The bridge server can detect circular `waiting_for` references in STATUS.json files and alert via the mobile dashboard
- Manual override: you can break deadlocks from the phone by sending a direct prompt to the blocked agent

### tmux Limits

tmux handles hundreds of panes without issue. The bridge server's session registry uses pagination on the mobile dashboard. At full scale, you interact with tier-0 and tier-1 orchestrators and drill down only when needed.

### Bandwidth

With the performance layer (gzip + ETag + 304s), status updates are ~5KB per push. At 50 agents updating every 10 seconds, that's ~25KB/s — negligible on any connection including cellular.

---

## 12. Agent Learning System

Agents that do the work should get smarter at the work. Claude Commander incorporates a three-tier memory and self-evolution system adapted from the VISION/CORTEX/NEXUS architecture — the same patterns that power UpGPT's skill engine, NEXUS's conversational memory, and the platform's feedback loops.

### The Core Principle

Every task execution produces two outputs:
1. **The deliverable** — code, research, chapters, campaigns (goes to the project)
2. **The learning** — what worked, what failed, what to do differently (goes to the memory system)

Most agent systems discard #2 when the context window closes. Commander persists it, indexes it, and injects it into future sessions. The system gets better at every domain the more it works in that domain.

### Three-Tier Agent Memory (adapted from NEXUS Phase 3)

The tiers are designed to be adopted incrementally. **Launch with Tier 1 only** — flat files on disk, zero external dependencies. Add Tiers 2 and 3 later when the volume of learned knowledge outgrows what file-based search can handle.

```
┌─────────────────────────────────────────────────────────────────┐
│  TIER 1 — Local File Memory (JSON + Markdown on disk)           │
│  Fast · Zero dependencies · Ships at launch                     │
│  Status: LAUNCH                                                 │
│                                                                 │
│  ├── core_facts.json    — Durable knowledge about this domain   │
│  │   "Greg prefers competitor tables with pricing columns"      │
│  │   "Paula codebase uses Supabase RPCs, not direct queries"    │
│  │   "Book chapters should be 4000-5000 words each"             │
│  │                                                              │
│  ├── session_history/   — What happened in recent sessions      │
│  │   (last 20 exchanges per worker, auto-compacted)             │
│  │   Plain .md files, one per session                           │
│  │                                                              │
│  ├── rolling_summaries/ — Compressed history of older sessions  │
│  │   (when history > 30, older entries are summarized + pruned) │
│  │                                                              │
│  ├── learnings/         — Extracted lessons per domain           │
│  │   learnings/research-approach.md                             │
│  │   learnings/code-patterns.md                                 │
│  │   learnings/writing-style.md                                 │
│  │                                                              │
│  └── failures/          — What went wrong and why                │
│      failures/jwt-refresh-race-condition.md                     │
│      failures/chapter-6-tone-drift.md                           │
│                                                                 │
│  Search: grep/glob on local files. Not semantic, but fast and   │
│  sufficient for <1000 learnings. Bridge server handles search   │
│  and returns relevant excerpts to agents via tool call.          │
├─────────────────────────────────────────────────────────────────┤
│  TIER 2 — Semantic Memory (pgvector / embeddings)               │
│  Cloud · Meaning-based search · Cross-project recall            │
│  Status: FUTURE (add when learnings exceed ~1000 files or       │
│  keyword search stops finding the right context)                │
│                                                                 │
│  ├── work_history namespace                                     │
│  │   Every task/synthesis pair embedded and stored               │
│  │   "What approach worked last time we did competitor research?"│
│  │   → Semantic search returns top 3 relevant past experiences   │
│  │                                                              │
│  ├── domain_knowledge namespace                                 │
│  │   Ingested reference material per domain                     │
│  │   Research papers, style guides, brand docs, API references  │
│  │                                                              │
│  └── failure_patterns namespace                                 │
│      Semantic index over failures/ directory                    │
│                                                                 │
│  Migration path: embed existing Tier 1 files into pgvector.     │
│  Tier 1 files remain the source of truth. Tier 2 is an index.  │
├─────────────────────────────────────────────────────────────────┤
│  TIER 3 — Structured Analytics (Supabase / PostgreSQL)          │
│  Cloud · Queryable · Powers dashboards and optimization         │
│  Status: FUTURE (add when you want performance dashboards       │
│  and automated optimization proposals)                          │
│                                                                 │
│  ├── task_outcomes      — Every task with result + quality score │
│  ├── agent_performance  — Per-worker completion rate, speed,     │
│  │                        rejection rate, cost                   │
│  ├── template_metrics   — Which templates produce best results   │
│  ├── cost_log           — API spend per agent, per project,      │
│  │                        per domain                             │
│  └── tool_call_audit    — What tools each agent used and how     │
│                                                                 │
│  Migration path: backfill from Tier 1 JSON logs on disk.        │
│  Until Tier 3 exists, performance.json files serve the same     │
│  purpose locally.                                               │
└─────────────────────────────────────────────────────────────────┘
```

**Evolution trigger:** Move to Tier 2 when you notice agents can't find relevant past work via keyword search (typically >1000 learning files). Move to Tier 3 when you want automated optimization proposals and cross-project performance dashboards.

### Progressive Disclosure — Minimizing Context Window Impact

Memory is only valuable if it doesn't crowd out the current task. The system uses **progressive disclosure**: load the minimum context by default, pull deeper memory only when the agent signals it needs it.

```
LEVEL 0 — Always loaded (tiny, <500 tokens):
  ├── core_facts.json for this domain (10-20 key facts)
  └── TASK.md (current assignment)

  Cost: negligible. Every agent gets this.

LEVEL 1 — Loaded on task start (<2000 tokens):
  ├── Rolling summary of recent sessions (1 paragraph)
  └── Top 3 relevant learnings (grep/glob match on Tier 1 files,
  │   or Tier 2 semantic search when available)
  │
  Cost: small. Gives the agent relevant history without full transcripts.
  Works with local files at launch. Upgrades to semantic search later.

LEVEL 2 — Pulled on demand (agent requests it):
  ├── Full session history (last 20 exchanges)
  ├── Extended search (10 results, broader query)
  ├── Failure patterns for this domain
  └── Related worker syntheses from other projects

  Cost: moderate. Agent explicitly asks: "I need more context on how
  we handled X before" → bridge serves Level 2 via tool call.

LEVEL 3 — Never loaded into agent context:
  ├── Raw performance metrics (worker-performance.json)
  ├── Cost tracking data
  ├── Optimization proposals
  └── Template performance history

  These are consumed by the bridge server and mobile dashboard only.
  Agents never see analytics about themselves — that would waste tokens
  and create self-referential loops.
```

**Key rule:** Agents are reactive about memory, not proactive. They don't poll for updates or load speculative context. The bridge server assembles the right context level before injecting it into the session. If an agent needs deeper recall, it calls a tool — the tool fetches from the memory system, returns a focused excerpt, and the agent continues.

This mirrors the CORTEX principle: **don't burn tokens on background overhead**. Every token in the context window should serve the current task.

### How Memory Flows (adapted from NEXUS agent loop)

```
BEFORE TASK EXECUTION (context loading — progressive):
  1. Bridge assembles context (NOT the agent):
     ├── Level 0: core_facts.json + TASK.md (always)
     ├── Level 1: rolling summary + top 3 relevant learnings (always)
     │   (grep/glob on local files at launch, semantic search when Tier 2 added)
     └── Level 2: available via tool call if agent needs it
  2. Inject Level 0 + Level 1 into worker's system prompt
  3. Worker starts execution with lean, relevant context
  4. If worker hits ambiguity → calls recall_memory tool → gets Level 2

AFTER TASK EXECUTION (learning capture — fire-and-forget):
  1. BACKGROUND (never blocks the agent, never enters context):

     Always (Tier 1 — local files, available at launch):
     ├── Extract durable facts → core_facts.json
     ├── Save session exchanges → session_history/
     ├── Compact if history > 30 exchanges → rolling_summaries/
     ├── Extract learnings → learnings/
     ├── Log failures → failures/
     └── Update worker-performance.json (local JSON)

     When enabled (Tier 2+3 — add later, zero code changes to agents):
     ├── Tier 2: embed task + synthesis into pgvector
     ├── Tier 2: embed failures into failure_patterns namespace
     ├── Tier 3: log to Supabase task_outcomes table
     ├── Tier 3: update agent_performance table
     └── Tier 3: log API cost to cost_log table
```

### What Gets Learned (by domain)

| Domain | Facts Extracted (Tier 1) | Patterns Indexed (Tier 2) | Metrics Tracked (Tier 3) |
|--------|--------------------------|---------------------------|--------------------------|
| **Software Dev** | "This project uses Supabase RPCs not direct queries", "Tests must pass before frontend work begins" | Successful refactoring approaches, common bug patterns, architecture decisions | Lines changed, test pass rate, build success rate per worker |
| **Research** | "Greg wants competitor tables with pricing", "Include G2 complaint data in every analysis" | Which research structures got approved, which sources yielded best insights | Sources per report, approval rate, revision requests |
| **Book Writing** | "Target 4500 words per chapter", "Use second-person 'you' voice", "Include case study per chapter" | Chapter structures that passed edit review, transition patterns between chapters | Words per chapter, edit rejection rate, consistency score |
| **Marketing** | "UpInbox targets solopreneurs", "Never use 'AI-powered' in headlines", "CTA must be above fold" | Ad copy variants that converted, subject line patterns, channel-specific formats | CTR per variant, open rates, conversion per channel |
| **Video** | "Episodes should be 8-12 minutes", "Open with a question not a statement" | Script structures that tested well, prompt formats that generated best visuals | Generation success rate, prompt revision count |

### Self-Evolution System (adapted from VISION Phase 4)

The system doesn't just remember — it actively proposes improvements to its own configuration.

#### 1. Performance Tracking (from Skill Performance Tracker)

```
.claude-coord/metrics/
├── worker-performance.json     ← Updated after every task completion
│   {
│     "backend": {
│       "tasks_completed": 47,
│       "avg_completion_minutes": 23,
│       "rejection_rate": 0.08,
│       "cost_per_task_usd": 1.42,
│       "quality_score": 8.7
│     },
│     "competitor-research": {
│       "tasks_completed": 12,
│       "avg_completion_minutes": 35,
│       "rejection_rate": 0.25,
│       "cost_per_task_usd": 2.10,
│       "quality_score": 7.2
│     }
│   }
│
├── template-performance.json   ← Which templates work best
│   {
│     "research": { "avg_quality": 7.8, "avg_time_minutes": 120, "uses": 8 },
│     "dev": { "avg_quality": 8.9, "avg_time_minutes": 90, "uses": 23 },
│     "book": { "avg_quality": 6.5, "avg_time_minutes": 240, "uses": 2 }
│   }
│
└── optimization-proposals.json ← System-generated improvement suggestions
    [
      {
        "type": "role_definition_revision",
        "target": "competitor-research worker",
        "reason": "25% rejection rate — outputs lack pricing comparison tables",
        "proposed_change": "Add to CLAUDE.md: 'Always include a pricing tier comparison table'",
        "confidence": 0.85,
        "sample_size": 12,
        "status": "pending_approval"
      }
    ]
```

#### 2. Optimization Proposal Workflow (from Self-Optimizing Skills)

```
Performance Snapshot (after every task)
  → Detect Quality Flags (sample size >= 10)
  → If rejection_rate > 0.15 OR quality_score < 7.0:
      → Analyze rejection reasons from SYNTHESIS.md feedback
      → Generate specific CLAUDE.md modification proposal
      → Write to optimization-proposals.json
      → Surface in mobile dashboard for approval
  → You approve/reject from your phone
  → If approved: CLAUDE.md updated, new version tagged
  → Audit trail: "changed_by: 'system:optimizer (approved by greg)'"
```

**Guard rails** (from VISION spec):
- Minimum sample size of 10 tasks before proposing changes
- Max 1 proposal per worker per 14 days (prevent thrashing)
- Human approval required — system proposes, you decide
- Rollback: previous CLAUDE.md version always preserved

#### 3. Prompt/Role A/B Testing (from Prompt Ops)

When the system proposes a CLAUDE.md change, it can run as a challenger:

```
Worker: "competitor-research"
├── Version A (current):  "Analyze competitor's features and pricing"
├── Version B (challenger): "Analyze competitor's features, pricing, AND complaints from G2/Reddit"
│
│  Both versions run on alternating tasks
│  After 10 tasks each:
│    Version A: quality 7.2, rejection 25%
│    Version B: quality 8.8, rejection 5%
│  → Promote Version B, archive Version A
```

#### 4. Drift Detection (from Prompt Ops)

Over time, orchestrators may subtly change how they decompose tasks or what instructions they give workers. The system detects this:

- Canonical role definition stored in `.claude-coord/templates/`
- After every orchestrator task decomposition, compare generated TASK.md against historical patterns
- If task assignments drift significantly from template norms → alert in mobile dashboard
- "The research orchestrator is no longer assigning complaint-mining tasks. Was this intentional?"

### Memory File Structure

```
~/.claude-commander/
├── memory/
│   ├── domains/
│   │   ├── software-dev/
│   │   │   ├── core_facts.json        ← Tier 1: durable knowledge
│   │   │   ├── session_history/        ← Tier 1: per-worker history
│   │   │   └── summaries/             ← Tier 1: compacted history
│   │   ├── research/
│   │   │   └── ...
│   │   ├── marketing/
│   │   │   └── ...
│   │   └── book-writing/
│   │       └── ...
│   │
│   ├── projects/
│   │   ├── paula/
│   │   │   ├── core_facts.json        ← Project-specific knowledge
│   │   │   └── session_history/
│   │   ├── upinbox/
│   │   └── sem-sentinel/
│   │
│   └── global/
│       ├── core_facts.json            ← Cross-domain knowledge about Greg
│       └── preferences.json           ← Output format preferences, review style
│
├── metrics/
│   ├── worker-performance.json
│   ├── template-performance.json
│   └── cost-tracking.json
│
├── templates/                          ← Canonical role definitions
│   ├── dev/
│   ├── research/
│   ├── book/
│   ├── campaign/
│   └── video/
│
└── proposals/
    ├── pending/                        ← Awaiting your approval
    ├── approved/                       ← Applied + archived
    └── rejected/                       ← Rejected + archived with reason
```

### Graceful Degradation (from NEXUS design principle)

Each memory tier initializes independently. If any tier is unavailable, the system continues with reduced capability:

| Tier Down | Impact | Fallback |
|-----------|--------|----------|
| Tier 1 (local) | No session history, no core facts | Agent works from TASK.md only — still functional, just no memory |
| Tier 2 (semantic) | No cross-project recall | Agent can't draw on past experience — works but doesn't learn from history |
| Tier 3 (analytics) | No performance tracking or optimization | System works but doesn't self-improve. Manual tuning only. |
| All tiers down | Stateless agents | System works exactly like Phase 1-3 (no learning). Still fully functional for task execution. |

### How This Maps to VISION/CORTEX/NEXUS

| NEXUS Component | Commander Equivalent |
|-----------------|---------------------|
| `core_memory` table (auto-extracted facts) | `core_facts.json` per domain/project — durable knowledge extracted from every session |
| `nexus_memory` with pgvector embeddings | Tier 2 semantic search across work_history, domain_knowledge, failure_patterns |
| `cost_log` + `activity_log` + `nexus_tool_calls` | Tier 3 analytics: cost tracking, worker performance, tool call audit |
| Skill Performance Tracker (`skill_performance_snapshots`) | `worker-performance.json` — tracks quality, speed, cost, rejection rate per worker |
| Self-Optimizing Skills (`skill_optimization_proposals`) | `optimization-proposals.json` — system proposes CLAUDE.md improvements |
| Prompt Ops A/B testing (`prompt_variants`) | Role A/B testing — challenger versions of worker definitions |
| Prompt drift detection | Orchestrator drift detection — alerts when task decomposition patterns shift |
| Feedback Loops (`meeting_outcomes` → `routing_performance`) | Task outcomes → worker performance → routing optimization |
| Alert Rules Engine (`alert_rules` → `alert_history`) | Performance alerts surfaced in mobile dashboard approval queue |
| Automatic compaction (30 msg → summary + prune) | Same pattern: session_history auto-compacts at 30 exchanges |

### The Flywheel

```
DO WORK → CAPTURE LEARNINGS → INJECT INTO NEXT SESSION → BETTER WORK → MORE LEARNINGS
    │                                                                         │
    └─────────── Every cycle makes the next cycle faster and higher quality ───┘

Week 1:  "Write a competitor analysis" → generic output, needs revision
Week 4:  "Write a competitor analysis" → knows your format, your sources,
         your preference for pricing tables, complaint data, and G2 reviews.
         Output is 80% ready on first pass.
Week 12: System proposes a new research template based on patterns from
         20 past analyses. You approve. Future research starts from a
         proven structure, not a blank page.
```

The agents aren't just executing — they're building domain expertise. The same network that writes rough first drafts in Week 1 produces polished, on-brand, Greg-approved output by Week 12, because every rejection, every approval, and every revision teaches it what "good" looks like for your specific standards.

---

## 13. Deployment Topology — Local vs Remote vs Hybrid

The entire stack (tmux + Claude Code + bridge server) can run locally on your Mac, remotely on a server (e.g., FastComet), or in a hybrid configuration. Each has distinct tradeoffs.

### Option A — Local (Mac)

```
Mac (tmux + bridge + Claude Code)  ←→  iPhone (PWA via Tailscale)
```

| Aspect | Assessment |
|--------|------------|
| File access | Native — Claude reads/writes your local files directly |
| IDE integration | Full — VS Code/Antigravity can open the same files |
| Session persistence | Tied to laptop uptime. Laptop sleeps = sessions pause |
| Setup complexity | Low — everything runs on one machine |
| Security | Best — keys and code never leave your machine |
| Cost | Zero infrastructure cost (just your Anthropic API usage) |

**Best for:** When you're at your desk most of the day and want zero-latency file access.

### Option B — Remote (FastComet)

```
FastComet VPS (tmux + bridge + Claude Code)  ←→  iPhone (PWA via Tailscale)
                                              ←→  Mac (VS Code Remote-SSH for IDE)
```

| Aspect | Assessment |
|--------|------------|
| File access | Claude reads/writes files on the server. Code lives remotely. |
| IDE integration | VS Code Remote-SSH — full IDE experience, but over network |
| Session persistence | **24/7** — sessions survive laptop sleep, restart, travel |
| Setup complexity | Medium — server provisioning, SSH keys, Tailscale on VPS, git sync |
| Security | Keys and code on shared hosting. Less secure than local. Mitigate with encrypted disk + Tailscale ACLs |
| Cost | VPS cost + Anthropic API. FastComet shared plans may throttle CPU with 50+ Node processes |
| Latency | Every file op goes through server disk. Negligible for code, noticeable for large git operations |

**Best for:** When you want agents running 24/7 regardless of whether your laptop is open. True "manage from the couch/airport/bed" workflow.

### Option C — Hybrid (Recommended)

```
FastComet VPS (tmux + bridge + long-running Claude sessions)
    ↕ git push/pull or mutagen sync
Mac (VS Code with local files, can also attach to remote tmux via SSH)
    ↕ Tailscale
iPhone (PWA)
```

| Aspect | Assessment |
|--------|------------|
| File access | Primary repo lives on server. Mac has a synced copy for IDE work |
| IDE integration | Full local IDE *or* Remote-SSH — your choice per session |
| Session persistence | **24/7** on server. Mac sessions are optional overlay |
| Sync mechanism | `git push/pull` (simple, explicit) or `mutagen` (real-time bidirectional sync) |
| Security | Better than pure remote — you can keep secrets in local `.env` and inject via SSH |
| Complexity | Highest — but most flexible |

**Best for:** Your actual workflow. You get 24/7 persistence from the server, full IDE experience from the Mac when you're at your desk, and mobile control from anywhere.

### Hybrid Architecture Detail

```
┌─────────────────────────────────────────┐
│           FastComet VPS                  │
│                                          │
│  tmux (all sessions, 24/7)               │
│  Bridge Server (127.0.0.1:7700)          │
│  Claude Code instances (terminal mode)   │
│  Git repo (authoritative copy)           │
│  .claude-coord/ (coordination files)     │
│  Tailscale (100.x.x.a)                   │
│                                          │
│  Anthropic API key in ~/.claude/          │
│  Project .env files on encrypted disk    │
└─────────────────────────────────────────┘
          │                    │
          │ Tailscale          │ SSH + git
          │                    │
┌─────────┴─────┐    ┌────────┴───────────┐
│   iPhone      │    │     Mac            │
│   PWA         │    │   VS Code          │
│   100.x.x.b   │    │   Remote-SSH *or*  │
│               │    │   local + git sync │
│   Dashboard   │    │   100.x.x.c        │
│   Approvals   │    │                    │
│   Voice input │    │   IDE when needed  │
└───────────────┘    └────────────────────┘
```

### Platform Compatibility Matrix

Not all hosting platforms can run this stack. The critical requirements are: **persistent shell access**, **tmux**, and **long-running processes** (Claude Code sessions run for hours).

| Platform | Can Host tmux + Claude Code? | Can Host Bridge Server? | Can Host PWA? | Verdict |
|----------|------------------------------|------------------------|---------------|---------|
| **FastComet VPS** | Yes | Yes | Yes | Full stack. Best if you already have it. |
| **Hetzner / DigitalOcean / Linode** | Yes | Yes | Yes | Full stack. Better price/perf than FastComet for compute-heavy use. |
| **AWS EC2 / GCP Compute** | Yes | Yes | Yes | Full stack. Overkill unless you need auto-scaling. |
| **Fly.io (Machines)** | Yes (with persistent volumes) | Yes | Yes | Works. Fly Machines are full VMs. Can suspend/resume to save cost. |
| **Railway** | Partial — no tmux, containers restart | Yes | Yes | Bridge + PWA only. Agent sessions need a separate VPS. |
| **Vercel** | No — serverless, no persistent processes | No — functions timeout at 300s | **Yes — ideal for PWA** | PWA hosting only. Not for bridge or agents. |
| **Render** | Partial — background workers OK, no tmux | Yes | Yes | Can host bridge as background worker. Agents need VPS. |
| **Coolify (self-hosted)** | Yes (on your own VPS) | Yes | Yes | Full stack via Docker. Good for self-managed infra. |

### Recommended Fully-Remote Architecture

**Split deployment** — put each component where it runs best:

```
┌──────────────────────────────────────────┐
│  VPS (FastComet / Hetzner / DO / Fly)     │
│                                           │
│  tmux + Claude Code sessions (24/7)       │
│  Bridge Server (Node/Express)             │
│  .claude-coord/ (coordination files)      │
│  Git repo (authoritative copy)            │
│  Tailscale (100.x.x.a)                    │
└───────────────┬──────────────────────────┘
                │ Tailscale mesh
┌───────────────┴──────────────────────────┐
│  Vercel / Cloudflare Pages (optional)     │
│                                           │
│  PWA static assets (Preact + Vite)        │
│  Connects to bridge via Tailscale or      │
│  authenticated WebSocket tunnel           │
└───────────────┬──────────────────────────┘
                │ HTTPS
┌───────────────┴──────────────────────────┐
│  iPhone / any browser                     │
│  PWA → bridge → tmux → Claude            │
└──────────────────────────────────────────┘
```

**Why split?** The PWA is static files — Vercel/Cloudflare Pages serve them globally with zero cold starts. The bridge + agents need persistent processes and shell access — that's a VPS. Trying to force both onto one platform means compromises on both.

**Simplest fully-remote setup:** One Hetzner CX22 (2 vCPU, 4GB RAM, ~$4.50/mo) runs everything including the PWA. Vercel split is optional optimization.

### Cost Estimates (Fully Remote)

| Provider | Plan | Specs | Monthly Cost | Agents Supported |
|----------|------|-------|-------------|------------------|
| Hetzner CX22 | Cloud VPS | 2 vCPU, 4GB RAM, 40GB | ~$4.50 | 10-15 |
| Hetzner CX32 | Cloud VPS | 4 vCPU, 8GB RAM, 80GB | ~$8.50 | 30-50 |
| Hetzner CX42 | Cloud VPS | 8 vCPU, 16GB RAM, 160GB | ~$16 | 50-100+ |
| DigitalOcean | Droplet | 4 vCPU, 8GB RAM | ~$48 | 30-50 |
| FastComet | Cloud VPS | 4 vCPU, 8GB RAM | ~$60 | 30-50 |
| Fly.io | Machine (L) | 4 vCPU, 8GB RAM | ~$62 (auto-suspend saves ~40%) | 30-50 |
| AWS EC2 t3.xlarge | On-demand | 4 vCPU, 16GB RAM | ~$120 | 50-100+ |

**Note:** These are compute costs only. Your primary expense is the Anthropic API — at 50 concurrent Claude Code sessions, API costs will dwarf hosting costs by 10-100x.

### Remote Server Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| Plan | VPS (not shared hosting) | VPS with 4+ cores |
| RAM | 4GB (10-15 agents) | 8-16GB (50+ agents) |
| Storage | 40GB SSD | 80GB+ SSD |
| OS | Ubuntu 22.04+ | Ubuntu 24.04 LTS |
| Node.js | 20+ | 22 LTS |
| tmux | 3.3+ | Latest |
| Claude Code | Latest | Latest |
| Tailscale | Latest | Latest |

**Important:** Shared hosting (cPanel-based) will NOT work — you need shell access, tmux, and the ability to install Node/Claude Code. FastComet's VPS plans provide this; their shared plans do not.

### File Sync Strategies (for Hybrid)

| Strategy | Pros | Cons |
|----------|------|------|
| **git push/pull** | Simple, explicit, uses existing workflow | Manual — you must push/pull |
| **mutagen** | Real-time bidirectional sync, conflict resolution | Another dependency, can create unexpected overwrites |
| **VS Code Remote-SSH only** | No sync needed — edit server files directly | Requires network, no offline editing |
| **rsync on save** | Lightweight, one-direction | One-way only, can overwrite remote changes |

**Recommendation:** Start with VS Code Remote-SSH (zero sync complexity). Add git-based sync later if you want offline editing on the Mac.

### Migration Path: Local → Remote

The architecture is designed to start on your laptop and migrate to a server with zero code changes. The bridge server, tmux sessions, and coordination protocol are all location-agnostic.

**Phase 1 — Local (start here)**
- Everything runs on your Mac
- Access via VS Code extension (desktop) + PWA (mobile via Tailscale)
- Zero infrastructure cost
- Sessions pause when laptop sleeps

**Phase 2 — Validate**
- Confirm the orchestrator-worker pattern works at your scale
- Tune CLAUDE.md templates and coordination protocol
- Identify where you hit CPU/RAM limits on the laptop

**Phase 3 — Migrate to Remote**
- Provision a VPS (start small: Hetzner CX22 at ~$4.50/mo)
- Install Node, tmux, Claude Code, Tailscale on the VPS
- `scp` or `git clone` your projects to the server
- Copy `~/.claude/` config to the server
- Run `claude-commander start` on the server instead of your Mac
- Update Tailscale to point your phone + Mac at the server's IP
- VS Code Remote-SSH from your Mac for IDE access
- **Everything else is identical** — same bridge API, same PWA, same coordination files

**Phase 4 — Scale Up**
- Upgrade VPS as needed (4→8→16 vCPU)
- Or split across multiple servers: one VPS per project, bridge server on a coordinator VPS
- Auto-suspend with Fly.io Machines to save cost during off-hours

**What changes when you go remote:**
| Component | Local | Remote |
|-----------|-------|--------|
| tmux sessions | On Mac | On VPS |
| Bridge server | localhost:7700 on Mac | localhost:7700 on VPS |
| Tailscale target | Mac IP (100.x.x.z) | VPS IP (100.x.x.a) |
| File access | Direct (local disk) | Via Claude Code on VPS disk |
| IDE | VS Code local | VS Code Remote-SSH |
| PWA | Same | Same |
| VS Code Extension | Connects to local bridge | Connects to remote bridge via Tailscale |
| Code changes required | None | None |

### Access Methods

The system supports two client interfaces, both connecting to the same bridge server:

**1. Mobile PWA (primary mobile interface)**
- Preact + Vite app served from the bridge server or Vercel
- Connects via Tailscale mesh (local or remote bridge)
- Full dashboard: hierarchy view, approval queue, voice input, broadcast

**2. VS Code Extension (primary desktop interface)**
- Status bar showing active sessions and their states
- Sidebar panel with the same hierarchy/approval views as the PWA
- Inline prompt input — send to any session without leaving the editor
- Connects to bridge at `127.0.0.1:7700` (local) or via Tailscale (remote)
- When running remote, pairs naturally with VS Code Remote-SSH

Both interfaces hit the same REST + WebSocket API. The bridge server is the single source of truth — clients are interchangeable.

---

## Appendix A: CLI Reference

```bash
# Start/stop the bridge server
claude-commander start [--port 7700]
claude-commander stop

# Initialize a project with tmux sessions
claude-commander init <project-name> <project-path> \
  --workers <comma-separated window names>

# Initialize coordination directory for a project
claude-commander coord-init <project-name>

# Save/restore all sessions (tmux-resurrect)
claude-commander save
claude-commander restore

# Show the full session tree
claude-commander tree

# Send a prompt to a specific session
claude-commander send <session>:<window> "prompt text"

# Broadcast to all windows in a session
claude-commander broadcast <session> "prompt text"

# Show the QR code for mobile pairing
claude-commander pair
```

## Appendix B: Environment Prerequisites

### Local Deployment (Mac)

| Requirement | Version | Purpose |
|-------------|---------|---------|
| macOS | 13+ | Host OS |
| Node.js | 20+ | Bridge server |
| tmux | 3.3+ | Session multiplexer |
| Claude Code | 2.1.52+ | AI agent (terminal mode) |
| Tailscale | Latest | Secure mesh networking |
| tmux-resurrect | Latest | Session persistence |

### Remote Deployment (VPS)

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Ubuntu | 22.04+ | Host OS (any Linux works, Ubuntu recommended) |
| Node.js | 20+ | Bridge server |
| tmux | 3.3+ | Session multiplexer |
| Claude Code | 2.1.52+ | AI agent (terminal mode) |
| Tailscale | Latest | Secure mesh networking (replaces public exposure) |
| tmux-resurrect | Latest | Session persistence |
| VS Code Remote-SSH | Latest | IDE access from Mac (optional) |

## Appendix C: IDE Compatibility

Claude Commander is IDE-agnostic by design. The agent sessions run in tmux terminal mode — the IDE is an optional overlay for when you want to browse/edit files visually.

| IDE | Compatibility | Notes |
|-----|---------------|-------|
| VS Code | Full | Recommended. Native Agent Sessions view (v1.109+), VS Code Extension works natively, Remote-SSH for remote deployment |
| Antigravity | Full | Works identically. Use if you want Antigravity's browser automation or Google Cloud grounding alongside Commander |
| Cursor | Full | Same VS Code foundation, Claude Code extension compatible |
| Windsurf | Full | Same VS Code foundation |
| Terminal only (no IDE) | Full | Commander doesn't require any IDE. tmux + bridge + PWA is the complete stack |
| Remote (VS Code Remote-SSH) | Full | The recommended path when running agents on a remote server |

**Start with whatever IDE you're using today.** The migration path to remote doesn't change your IDE choice — VS Code Remote-SSH transparently connects your local IDE to remote files.
