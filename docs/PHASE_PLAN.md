# Claude Commander — Phase Plan

**Status:** All 8 phases built. Full platform complete.
**Date:** 2026-03-21

<!-- FORGE_APPROVED -->

---

## Architecture Summary

```
src/                          (6,726 lines TypeScript)
├── server/index.ts           ← Express + WebSocket bridge server (port 7700)
├── cli/index.ts              ← claude-commander CLI (20+ commands)
├── lib/
│   ├── tmux.ts               ← tmux session registry & send-keys
│   ├── auth.ts               ← Bearer token auth + rate limiting
│   ├── audit.ts              ← Audit logging to ~/.claude-commander/audit.log
│   ├── config.ts             ← Config management (~/.claude-commander/config.json)
│   ├── coordination.ts       ← .claude-coord/ protocol (STATUS.json, TASK.md, SYNTHESIS.md)
│   ├── watcher.ts            ← chokidar file watcher for STATUS.json changes
│   ├── templates.ts          ← 6 built-in templates + custom template support
│   ├── claude-md-generator.ts← CLAUDE.md generation for orchestrators/workers
│   ├── health.ts             ← Session health monitor (10s heartbeat, 3-strike pruning)
│   ├── metrics.ts            ← System/project metrics aggregation
│   ├── persistence.ts        ← Session save/restore (tmux-resurrect pattern)
│   ├── memory.ts             ← Tier 1 memory (facts, sessions, learnings, failures)
│   ├── memory-context.ts     ← Progressive disclosure (Level 0/1/2 context assembly)
│   ├── memory-backend.ts     ← Abstract backend (local + cloud placeholder)
│   ├── performance.ts        ← Worker/template performance tracking
│   ├── optimizer.ts          ← Optimization proposal engine
│   ├── drift-detector.ts     ← Behavior drift detection
│   ├── ab-testing.ts         ← CLAUDE.md A/B testing framework
│   └── version-history.ts    ← Role definition versioning + rollback

public/index.html             (1,363 lines — mobile PWA)

vscode-extension/             (1,856 lines TypeScript)
├── src/
│   ├── extension.ts          ← VS Code extension entry point
│   ├── bridge-client.ts      ← HTTP/WS client for bridge server
│   ├── tree-provider.ts      ← Session hierarchy sidebar
│   ├── approval-provider.ts  ← Approval queue sidebar
│   └── webview-panel.ts      ← Session detail webview
```

**Total: ~9,945 lines of code**

---

## Phase Completion Log

### Phase 1 — Single Session Control ✓
- Bridge server (Express on 127.0.0.1:7700)
- tmux session registry (parse, create, send-keys)
- Bearer token auth (32-byte random, rate limiting)
- Audit logging (JSON lines to ~/.claude-commander/audit.log)
- Minimal mobile PWA (auth, session list, prompt input)
- CLI: start, init, send, broadcast, tree, pair, help

### Phase 2 — Multi-Session Dashboard ✓
- Static file serving for PWA from bridge
- Voice-to-text input (Web Speech API)
- Broadcast mode (to session or all)
- QR code pairing endpoint
- Session detail slide-in panel
- Approval badge infrastructure
- broadcast-all CLI command

### Phase 3 — File-Based Coordination Protocol ✓
- .claude-coord/ directory structure
- STATUS.json schema + read/write
- TASK.md / SYNTHESIS.md formats
- chokidar file watcher → WebSocket push
- Approval queue (GET /approvals)
- Deny endpoint (POST /deny/:session/:window)
- CLAUDE.md generation for orchestrators and workers
- Config management (session registry, project paths)
- coord-init and status CLI commands

### Phase 4 — Multi-Domain Templates ✓
- 6 built-in templates: dev, research, book, campaign, video, custom
- Full CLAUDE.md generation per worker role
- Template apply (creates session + coordination + CLAUDE.md files)
- Custom template creation and persistence
- CLI: templates, template-create, init --template

### Phase 5 — Scale, Persistence & Remote ✓
- Session health monitor (10s heartbeat, 3-strike dead detection)
- System/project metrics aggregation
- Session save/restore (snapshot to JSON)
- Lockdown mode (POST /lockdown, POST /unlock)
- Metrics endpoint and PWA metrics panel
- CLI: save, restore, metrics, health

### Phase 6 — VS Code Extension ✓
- Sidebar: session hierarchy + approval queue tree views
- Status bar: "CC: N sessions · M windows · K approvals"
- Commands: connect, disconnect, sendPrompt, approve, deny, broadcast, refresh
- Webview panel: session detail with prompt input
- Auto-connect on startup, WebSocket real-time updates
- Configuration: bridgeUrl, token, autoConnect

### Phase 7 — Agent Learning System ✓
- Tier 1 memory: core facts, session history, learnings, failures
- Auto-compaction at 30 sessions → rolling summaries
- Progressive disclosure: Level 0/1/2 context assembly
- recall_memory function (grep-based search)
- Worker/template performance tracking
- Cost tracking per worker per project
- Server endpoints: facts, recall, learnings, performance
- CLI: recall, performance, facts

### Phase 8 — Self-Evolution & Cloud Memory ✓
- Optimization proposal engine (rejection_rate > 15% or quality < 7.0)
- Guard rails: min 10 tasks, max 1 proposal per worker per 14 days
- Drift detection: task decomposition, quality regression, cost spikes
- A/B testing for CLAUDE.md role definitions
- Cloud memory backend interface (LocalMemoryBackend + CloudMemoryBackend placeholder)
- Role version history with rollback
- Server endpoints: proposals, alerts, ab-tests, role-history
- CLI: proposals, approve-proposal, reject-proposal, alerts, role-history

---

## CLI Command Reference (Full)

```bash
# Session management
claude-commander start [--port PORT]
claude-commander init <project> <path> --workers <csv>
claude-commander init <project> <path> --template <name>
claude-commander tree
claude-commander pair

# Prompt routing
claude-commander send <session>:<window> "<prompt>"
claude-commander broadcast <session> "<prompt>"
claude-commander broadcast-all "<prompt>"

# Coordination
claude-commander coord-init <project-or-path> [--workers <csv>]
claude-commander status [project]
claude-commander templates
claude-commander template-create <name> --workers <csv> --description "..."

# Persistence
claude-commander save
claude-commander restore

# Monitoring
claude-commander metrics
claude-commander health

# Memory & Learning
claude-commander recall "<query>" [--domain X]
claude-commander performance
claude-commander facts [--domain X] [--project Y]

# Self-Evolution
claude-commander proposals
claude-commander approve-proposal <id>
claude-commander reject-proposal <id> [reason]
claude-commander alerts
claude-commander role-history <worker>
```

## REST API Reference (Full)

```
# Public
GET  /health

# Session management
GET  /sessions
GET  /pair

# Prompt routing
POST /send/:session/:window          { prompt }
POST /broadcast/:session             { prompt }
POST /broadcast/all                  { prompt }
POST /approve/:session/:window
POST /deny/:session/:window

# Coordination
GET  /status/tree
GET  /approvals

# Monitoring
GET  /metrics
GET  /health/sessions
POST /lockdown
POST /unlock

# Memory & Learning
GET  /memory/facts?domain=&project=
GET  /memory/recall?query=&domain=&limit=
GET  /memory/learnings?domain=
POST /memory/fact                    { fact, domain, project?, source }
POST /memory/learning                { title, content, domain, tags, source }

# Performance
GET  /performance/workers
GET  /performance/templates

# Self-Evolution
GET  /proposals
POST /proposals/:id/approve
POST /proposals/:id/reject           { reason? }
GET  /alerts
POST /alerts/:id/acknowledge
GET  /ab-tests
POST /ab-tests                       { worker, challengerClaudeMd }
GET  /role-history/:worker
```

---

## Next Steps

1. **Install Tailscale** on Mac + iPhone for secure mesh networking
2. **Test locally**: `npm run dev` → open http://127.0.0.1:7700 in browser
3. **Build VS Code extension**: `cd vscode-extension && npm install && npm run compile`
4. **Remote deployment**: Provision VPS, install Node + tmux + Claude Code + Tailscale
5. **Iterate on CLAUDE.md templates** for each domain
