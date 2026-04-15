# Claude Commander — As-Built vs. Planned Diff

**Date:** 2026-03-23 (updated)
**As-Built:** ~10,800 lines across 27 source files + 1 HTML PWA + VS Code extension
**Fully Planned:** ~19,500 lines across 40+ source files

---

## Section 1: As-Built Inventory

### Built Modules (27 source files, ~10,800 lines)

| Module | Lines | Status |
|--------|-------|--------|
| `src/server/index.ts` | 755 | Built — 30+ REST endpoints, WebSocket, static serving |
| `src/cli/index.ts` | 1,095 | Built — 20+ commands |
| `src/lib/coordination.ts` | 475 | Built — .claude-coord/ protocol, STATUS.json, TASK.md |
| `src/lib/templates.ts` | 663 | Built — 6 templates + multi-model support (upgraded 2026-03-22) |
| `src/lib/memory.ts` | 595 | Built — facts, sessions, learnings, failures |
| `src/lib/drift-detector.ts` | 337 | Built — task decomposition, quality, cost drift |
| `src/lib/ab-testing.ts` | 315 | Built — CLAUDE.md A/B testing |
| `src/lib/optimizer.ts` | 292 | Built — optimization proposals |
| `src/lib/memory-backend.ts` | 292 | Built — local + cloud interface |
| `src/lib/memory-context.ts` | 258 | Built — progressive disclosure (L0/L1/L2) |
| `src/lib/performance.ts` | 242 | Built — worker/template metrics + model stats (upgraded) |
| `src/lib/persistence.ts` | 235 | Built — session save/restore |
| `src/lib/claude-md-generator.ts` | 223 | Built — meta/project/worker CLAUDE.md + model info (upgraded) |
| `src/lib/tmux.ts` | 194 | Built — session registry, send-keys, sanitization |
| `src/lib/version-history.ts` | 184 | Built — role versioning + rollback |
| `src/lib/metrics.ts` | 143 | Built — system/project metrics aggregation |
| `src/lib/health.ts` | 131 | Built — 10s heartbeat, 3-strike pruning |
| `src/lib/watcher.ts` | 130 | Built — chokidar STATUS.json watcher |
| `src/lib/auth.ts` | 129 | Built — bearer token + rate limiting |
| `src/lib/config.ts` | 122 | Built — ~/.claude-commander/config.json |
| `src/lib/session-recovery.ts` | 669 | Built — stall detection, auto-continue, prompt cache, rate limit recovery, swarm state persistence (2026-03-23) |
| `src/lib/audit.ts` | 102 | Built — JSON line audit logging |
| `public/index.html` | 1,363 | Built — mobile PWA |
| `vscode-extension/src/extension.ts` | 565 | Built — VS Code entry point |
| `vscode-extension/src/webview-panel.ts` | 543 | Built — session detail webview |
| `vscode-extension/src/bridge-client.ts` | 443 | Built — HTTP/WS client |
| `vscode-extension/src/tree-provider.ts` | 173 | Built — session tree sidebar |
| `vscode-extension/src/approval-provider.ts` | 132 | Built — approval queue sidebar |

### Built Capabilities

| Capability | Status | Notes |
|-----------|--------|-------|
| tmux agent execution | BUILT | send-keys with input sanitization |
| File-based coordination (.claude-coord/) | BUILT | STATUS.json, TASK.md, SYNTHESIS.md |
| 6 project templates | BUILT | dev, research, book, campaign, video, custom |
| Multi-model worker assignment | BUILT | ModelConfig, MODEL_PRESETS, MODEL.json per worker |
| Bearer token auth + rate limiting | BUILT | 32-byte random, 10-failure lockout |
| Audit logging | BUILT | JSON lines to ~/.claude-commander/audit.log |
| Mobile PWA | BUILT | Auth, session tree, voice input, approvals, metrics |
| VS Code extension | BUILT | Sidebar, webview, status bar, 7 commands |
| Progressive memory (3-level) | BUILT | Facts, learnings, failures with context assembly |
| A/B testing for agent roles | BUILT | CLAUDE.md variant testing with quality measurement |
| Drift detection | BUILT | Task decomposition, quality regression, cost spikes |
| Optimization proposals | BUILT | Auto-proposed CLAUDE.md changes, human approval gate |
| Role version history | BUILT | Immutable versioning with rollback |
| Session health monitoring | BUILT | 10s heartbeat, 3-strike dead detection |
| Session save/restore | BUILT | Snapshot to JSON, timestamped |
| Lockdown mode | BUILT | POST /lockdown, POST /unlock |
| WebSocket real-time push | BUILT | status, health, coordination, approval events |
| Session recovery (stall detection) | BUILT | 15s pane monitoring, auto-continue after 60s stall, prompt replay after 3 stalls |
| Session recovery (rate limit) | BUILT | Parses rate limit refresh time, auto-restarts worker at refresh |
| Swarm state persistence | BUILT | Writes to ~/.claude-commander/recovery/swarm-state.json every 30s, auto-resume on restart |
| Pane streaming | BUILT | Server captures tmux output every 1s, pushes via WebSocket with deduplication |
| Session logging | BUILT | Append-only logs at ~/.claude-commander/logs/{session}/{window}.log, REST endpoints for retrieval |
| Smart auto-scroll | BUILT | VS Code webview detects scroll position, stops auto-scroll when user scrolls up, "N new lines" indicator |
| Commander global CLI | BUILT | ~/bin/commander, 21 slash commands, MCP servers (GitHub, Supabase, visual-gen) |
| Training pipeline (pharma regulatory) | EXECUTED | 3 swarms, 29 workers, 507+ docs, ~70,000 pages processed in ~100 min |

---

## Section 2: Not Yet Built (The Gap)

### New Modules Required

| Module | Est. Lines | Phase | Priority | Purpose |
|--------|-----------|-------|----------|---------|
| `src/lib/ingestion.ts` | ~400 | 0 | P0 | Document ingestion (PDF, DOCX, CSV, XLSX, JSON, XML) |
| `src/lib/cross-reference.ts` | ~500 | 0 | P0 | Entity extraction, cross-ref graph, conflict detection |
| `src/lib/output-schemas.ts` | ~350 | 0 | P0 | FindingSchema, EvidenceLink, mergeFindings, export |
| `src/lib/templates/sem-audit.ts` | ~150 | 1 | P0 | SEM Sentinel backward agent template |
| `src/lib/templates/competitive-intel.ts` | ~120 | 1 | P0 | Continuous competitor monitoring template |
| `src/lib/connectors/sentinel-bridge.ts` | ~300 | 1 | P0 | SEM Sentinel data bridge |
| `src/lib/api-agent.ts` | ~600 | 2 | P1 | Anthropic/OpenAI/Google API execution with multi-model routing |
| `src/lib/budget.ts` | ~300 | 2 | P1 | Project budget caps, cost projection, alerts |
| `src/lib/testing/pipeline-test.ts` | ~200 | 2.5 | P1 | Run same docs through multiple configs |
| `src/lib/testing/benchmark-suite.ts` | ~150 | 2.5 | P1 | Gold-standard test sets per domain |
| `src/lib/testing/accuracy-scorer.ts` | ~150 | 2.5 | P1 | Precision, recall, F1, human-in-the-loop scoring |
| `src/lib/testing/regression-tracker.ts` | ~100 | 2.5 | P1 | Detect quality regressions on template changes |
| `src/lib/verification.ts` | ~500 | 3 | P1 | 5-stage verification pipeline |
| `src/lib/reports.ts` | ~500 | 3 | P1 | Template-driven report generation |
| `src/lib/connectors/base.ts` | ~100 | 4 | P2 | Abstract connector interface |
| `src/lib/connectors/web-search.ts` | ~150 | 4 | P2 | Web search for prediction markets, competitive intel |
| `src/lib/connectors/financial-data.ts` | ~200 | 4 | P2 | Market data, options chains, SEC filings |
| `src/lib/connectors/google-ads.ts` | ~150 | 4 | P2 | Google Ads API for SEM Sentinel |
| `src/lib/connectors/interactive-brokers.ts` | ~100 | 4 | P2 | IBKR TWS API |
| `src/lib/connectors/alpaca.ts` | ~100 | 4 | P2 | Modern REST API with paper trading |
| `src/lib/connectors/tastytrade.ts` | ~100 | 4 | P2 | Options-focused API |
| `src/lib/templates/legal-discovery.ts` | ~150 | 4 | P2 | Privilege review, issue coding, hot docs |
| `src/lib/templates/due-diligence.ts` | ~150 | 4 | P2 | M&A parallel workstream analysis |
| `src/lib/templates/prediction-market.ts` | ~120 | 4 | P2 | Multi-source research, probability estimation |
| `src/lib/templates/financial-analysis.ts` | ~120 | 4 | P2 | Earnings, options pricing, multi-factor |
| `src/lib/templates/regulatory-submission.ts` | ~200 | 4 | P2 | eCTD module analysis, FDA/EMA/PMDA |
| `src/lib/backtesting.ts` | ~400 | 4 | P2 | Historical data replay, Sharpe/Sortino metrics |
| `src/lib/constraints.ts` | ~250 | 4 | P2 | Hard risk limits, circuit breaker |
| `src/lib/compliance.ts` | ~300 | 4 | P2 | 21 CFR Part 11 (hash chain, e-signatures) |

### Existing Module Updates Required

| Module | Changes | Phase | Priority |
|--------|---------|-------|----------|
| `src/lib/coordination.ts` | Add RESULT.md/SUMMARY.md chain, writeResult(), writeSummary(), SKILL.md support | 0, 1 | P0 |
| `src/lib/claude-md-generator.ts` | Add SKILL.md references, RESULT.md instructions, verification instructions | 0, 1, 3 | P0 |
| `src/lib/templates.ts` | Refactor to templates/ directory, add AnalysisTemplate interface | 1 | P0 |
| `src/lib/audit.ts` | Expand for 21 CFR Part 11 (hash chain, retention) | 4 | P2 |
| `src/lib/performance.ts` | Add per-model comparison metrics, API token tracking | 2 | P1 |
| `src/server/index.ts` | Add endpoints: /budget, /findings, /verify, /report, /cost/estimate | 2, 3 | P1 |
| `src/cli/index.ts` | Add commands: verify, report, budget, benchmark, model-assign | 2, 3 | P1 |
| `public/index.html` | Document upload, findings browser, cost dashboard, report preview, cross-ref viz | 5 | P2 |

---

## Section 3: Build-to-Complete Plan

### Phase 0 — Foundation Layer (~1,400 lines)
**Priority:** P0 — blocks all data analysis use cases
**Depends on:** Nothing
**Build approach:** Sequential (each module informs the next)

| Deliverable | New/Update | Lines | Description |
|-------------|-----------|-------|-------------|
| `src/lib/ingestion.ts` | New | ~400 | ingestDocument(), chunkDocument(), distributeChunks(), DocumentRegistry |
| `src/lib/output-schemas.ts` | New | ~350 | FindingSchema, EvidenceLink, AnalysisResult, mergeFindings(), exportFindings() |
| `src/lib/cross-reference.ts` | New | ~500 | extractEntities(), CrossReferenceGraph, findConflicts(), traceChain() |
| `src/lib/coordination.ts` | Update | +150 | writeResult(), writeSummary(), RESULT.md/SUMMARY.md chain, findings_count in STATUS.json |

**Definition of done:** Can ingest a CSV file, distribute chunks to workers, extract entities, detect cross-references, and output structured findings as JSON.

---

### Phase 1 — Templates & SEM Integration (~1,200 lines)
**Priority:** P0 — first domain-specific value
**Depends on:** Phase 0
**Build approach:** 3 parallel agents (template refactor, SEM template, competitive intel)

| Deliverable | New/Update | Lines | Description |
|-------------|-----------|-------|-------------|
| `src/lib/templates/index.ts` | Refactor | ~100 | Template registry, loader, AnalysisTemplate interface |
| `src/lib/templates/base.ts` | New | ~80 | Shared template logic |
| `src/lib/templates/sem-audit.ts` | New | ~150 | 6 SEM Sentinel backward agent workers |
| `src/lib/templates/competitive-intel.ts` | New | ~120 | Continuous monitoring workers |
| `src/lib/connectors/sentinel-bridge.ts` | New | ~300 | Google Ads data pull, findings push to Sentinel DB |
| `src/lib/coordination.ts` | Update | +50 | SKILL.md support in task assignment |
| `src/lib/claude-md-generator.ts` | Update | +30 | SKILL.md loading instructions in worker CLAUDE.md |
| Move existing templates | Refactor | 0 | dev.ts, research.ts, book.ts, campaign.ts, video.ts, custom.ts |

**Definition of done:** Can run `claude-commander init myproject /path --template sem-audit` and get 6 parallel SEM analysis workers with structured output. SEM Sentinel bridge can push findings.

---

### Phase 2 — API Execution & Budget (~1,100 lines)
**Priority:** P1 — required for scale beyond tmux
**Depends on:** Phase 0
**Build approach:** 2 parallel agents (API agent, budget system)

| Deliverable | New/Update | Lines | Description |
|-------------|-----------|-------|-------------|
| `src/lib/api-agent.ts` | New | ~600 | ApiAgent class, multi-model routing, prompt caching, streaming, batch API, fallback |
| `src/lib/budget.ts` | New | ~300 | ProjectBudget, setBudget(), checkBudget(), estimateCost(), hard stops |
| `src/lib/config.ts` | Update | +30 | apiKeys section for Anthropic/OpenAI/Google |
| `src/server/index.ts` | Update | +80 | POST /budget/:project, GET /budget/:project, GET /cost/estimate |
| `public/index.html` | Update | +100 | Cost tracking panel, budget alerts |

**Definition of done:** Can execute a worker task via Anthropic API (not tmux), track token usage and cost, enforce budget cap, and show cost on PWA.

---

### Phase 2.5 — Pipeline Testing Framework (~600 lines)
**Priority:** P1 — required to optimize network performance
**Depends on:** Phase 0 + Phase 1
**Build approach:** 2 parallel agents (pipeline test + benchmarks, accuracy + regression)

| Deliverable | New/Update | Lines | Description |
|-------------|-----------|-------|-------------|
| `src/lib/testing/pipeline-test.ts` | New | ~200 | Run docs through multiple configs, vary chunk size/overlap/workers |
| `src/lib/testing/benchmark-suite.ts` | New | ~150 | Gold-standard test sets per domain with known findings |
| `src/lib/testing/accuracy-scorer.ts` | New | ~150 | Precision, recall, F1, cross-ref recall, human-in-the-loop scoring |
| `src/lib/testing/regression-tracker.ts` | New | ~100 | Track scores over time, alert on quality drops |

**Definition of done:** Can run a benchmark suite (known-waste SEM CSV), measure precision/recall of findings vs. gold standard, compare across configurations.

---

### Phase 3 — Verification & Reports (~1,500 lines)
**Priority:** P1 — required for trust in regulated use cases
**Depends on:** Phase 2
**Build approach:** 2 parallel agents (verification, reports)

| Deliverable | New/Update | Lines | Description |
|-------------|-----------|-------|-------------|
| `src/lib/verification.ts` | New | ~500 | 5-stage pipeline: self-check, peer review, synthesis, completeness audit, evidence chain walk |
| `src/lib/reports.ts` | New | ~500 | generateReport(), executive summary, technical detail, domain-specific formats (HTML/MD/JSON) |
| `src/server/index.ts` | Update | +100 | GET /findings/:project, POST /verify/:project, GET /report/:project |
| `src/cli/index.ts` | Update | +100 | verify, report commands |
| `public/index.html` | Update | +300 | Findings browser, report preview, download |

**Definition of done:** Can run 5-stage verification on findings, generate an executive summary report with evidence chains, preview in PWA.

---

### Phase 4 — Connectors, Advanced Templates & Compliance (~2,650 lines)
**Priority:** P2 — enables per-domain use cases
**Depends on:** Phase 0
**Build approach:** 4 parallel agents (connectors, templates, trading infra, compliance)

| Deliverable | New/Update | Lines | Description |
|-------------|-----------|-------|-------------|
| `src/lib/connectors/base.ts` | New | ~100 | Abstract DataConnector interface |
| `src/lib/connectors/web-search.ts` | New | ~150 | Web search for prediction markets, competitive intel |
| `src/lib/connectors/financial-data.ts` | New | ~200 | Market data, options chains, SEC EDGAR |
| `src/lib/connectors/google-ads.ts` | New | ~150 | Google Ads API (adapted from SEM Sentinel) |
| `src/lib/connectors/interactive-brokers.ts` | New | ~100 | IBKR TWS API |
| `src/lib/connectors/alpaca.ts` | New | ~100 | Modern REST + paper trading |
| `src/lib/connectors/tastytrade.ts` | New | ~100 | Options-focused API |
| `src/lib/templates/legal-discovery.ts` | New | ~150 | Privilege, issue coding, hot docs, chronology |
| `src/lib/templates/due-diligence.ts` | New | ~150 | Financial/legal/IP/employment/regulatory workstreams |
| `src/lib/templates/prediction-market.ts` | New | ~120 | Multi-source research, probability estimation, Kelly sizing |
| `src/lib/templates/financial-analysis.ts` | New | ~120 | Earnings, options, multi-factor synthesis |
| `src/lib/templates/regulatory-submission.ts` | New | ~200 | eCTD modules, FDA/EMA/PMDA, cross-jurisdiction |
| `src/lib/backtesting.ts` | New | ~400 | Historical replay, Sharpe/Sortino/drawdown, regime comparison |
| `src/lib/constraints.ts` | New | ~250 | Hard risk limits, circuit breaker, constraint audit log |
| `src/lib/compliance.ts` | New | ~300 | 21 CFR Part 11 hash chain, e-signatures, retention, FDA export |
| `src/lib/audit.ts` | Update | +60 | Cryptographic hash chain integration |

**Definition of done:** Can execute a prediction market analysis using web search connector, run a legal discovery template, backtest a trading strategy, and produce a 21 CFR Part 11 compliant audit trail.

---

### Phase 5 — Dashboard & Polish (~1,100 lines)
**Priority:** P2 — end-to-end UX
**Depends on:** All above
**Build approach:** 3 parallel agents (PWA, hardening, docs)

| Deliverable | New/Update | Lines | Description |
|-------------|-----------|-------|-------------|
| `public/index.html` | Update | +400 | Document upload drag-and-drop, analysis progress viz, findings browser with filters, cross-ref graph viz, report preview/download, template selection wizard |
| `src/server/index.ts` | Update | +100 | File upload endpoint, partial results streaming |
| Error recovery | New/Update | ~200 | Agent crash resume from checkpoint, partial result serving |
| Rate limiting | Update | +50 | Per-project rate limits, API key rotation |
| Documentation | New | ~350 | Template authoring guide, API docs, deployment guide |

**Definition of done:** Can upload documents from iPhone, watch analysis progress in real-time, browse findings, download PDF report. System recovers from agent crash.

---

## Section 4: Dependency Graph

```
Phase 0 (Foundation) ──────► Phase 1 (Templates + SEM) ──────► Phase 2.5 (Testing)
       │                                                               │
       │                                                               ▼
       ├──────────────────► Phase 2 (API + Budget) ──────────► Phase 3 (Verify + Report)
       │                                                               │
       └──────────────────► Phase 4 (Connectors + Templates + Compliance)
                                                                       │
                                                                       ▼
                                                                  Phase 5 (Dashboard + Polish)
```

**Critical path:** Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 5
**Parallel track:** Phase 4 can run in parallel with Phases 2-3 (depends only on Phase 0)

---

## Section 5: Summary Metrics

| Metric | As-Built | Gap | Fully Built |
|--------|----------|-----|-------------|
| Source files | 27 | +28 new, ~8 updated | ~55 |
| Lines of code | ~10,800 | +8,700 | ~19,500 |
| Library modules | 20 | +22 | ~42 |
| Templates | 6 | +7 | 13 |
| CLI commands | 20+ | +5 | 25+ |
| REST endpoints | 30+ | +8 | 38+ |
| Supported providers | 1 (Anthropic via tmux) | +2 (OpenAI, Google via API) | 3 |
| Data connectors | 0 | +7 | 7 |
| Verification stages | 0 | +5 | 5 |
| Report formats | 1 (SYNTHESIS.md) | +3 (HTML, JSON, CSV) | 4 |
| Use case domains | 1 (programming) | +7 | 8 |

---

*Document generated: 2026-03-22, updated 2026-03-23*
*Based on source code inventory, upgrade planning documents, and training pipeline execution*
