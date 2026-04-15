# UpCommander — Feature Upgrades for General-Purpose Data Analysis

**Document Version:** 1.0
**Date:** 2026-03-22
**Status:** Planning

---

## Overview

This document summarizes the feature upgrades required to evolve UpCommander from a programming-focused multi-agent orchestration platform into a general-purpose parallel data analysis and intelligence platform. Each section describes the current state, the capability gap, and the estimated implementation scope.

---

## Current State

UpCommander currently ships with:

- 6 built-in templates: dev, research, book, campaign, video, custom
- File-based coordination via `.claude-coord/` (STATUS.json, TASK.md, SYNTHESIS.md)
- tmux-based agent execution (send-keys to Claude Code sessions)
- Progressive memory (facts, learnings, failures) with 3-level context assembly
- Performance tracking, A/B testing, drift detection, optimization proposals
- Mobile PWA, bridge server, and CLI
- Approximately 9,945 lines across 27 source files

---

## Target Use Cases

The upgrades described below are intended to support the following parallel data analysis domains:

- Legal research and e-discovery
- Pharma regulatory submissions
- M&A due diligence
- Prediction markets and forecasting
- Competitive intelligence
- Financial analysis and trading research

---

## Upgrade Specifications

### 1. Document Ingestion Pipeline

**Current:** No document ingestion. Agents operate on code files in project directories.

**Needed:**

- File intake system supporting PDF, DOCX, CSV, XLSX, JSON, XML, and plain text
- Document chunking engine that splits large documents into agent-digestible segments, respecting section boundaries rather than applying arbitrary byte splits
- Chunk-to-agent assignment logic that distributes N chunks across M workers with configurable overlap windows for cross-reference detection
- Metadata extraction covering titles, authors, dates, document type, and section headers
- Document registry tracking which agent has analyzed which chunks

**Estimated Scope:** New module `src/lib/ingestion.ts` (~400 lines)

---

### 2. Cross-Reference Detection Engine

**Current:** No cross-referencing. Each agent works independently on its assigned files.

**Needed:**

- Entity extraction from agent outputs, covering names, dates, dollar amounts, legal citations, chemical compounds, and regulatory references
- Cross-reference graph that surfaces connections when Agent A and Agent B each find the same entity in different contexts
- Conflict detection that flags when two agents report contradictory findings about the same entity
- Reference chain tracing that follows a citation or reference across multiple documents
- Integration with the synthesis layer so orchestrators can review cross-references before synthesizing final output

**Estimated Scope:** New module `src/lib/cross-reference.ts` (~500 lines)

---

### 3. Structured Output Schemas

**Current:** SYNTHESIS.md is freeform markdown. Sufficient for code summaries; insufficient for structured analysis output.

**Needed:**

- Domain-specific output schemas defined as JSON Schema per use case
- Finding schema: `{ finding_id, severity, evidence_chain[], confidence, dollar_impact, source_documents[], cross_references[] }`
- Aggregation logic that merges findings from multiple workers into deduplicated, ranked lists
- Evidence chain builder ensuring every claim traces back to a specific document, page, and paragraph
- Export formats: JSON, CSV, PDF report, executive summary

**Estimated Scope:** New module `src/lib/output-schemas.ts` (~350 lines), updates to `coordination.ts`

---

### 4. Data Analysis Templates

**Current:** 6 templates exist; only "research" is partially relevant to data analysis use cases.

**Needed:** New templates for each domain:

- `legal-discovery` — document review, privilege log, issue coding, hot document identification
- `regulatory-submission` — multi-module document analysis (FDA eCTD structure), cross-module consistency checking, gap analysis
- `due-diligence` — parallel financial, legal, IP, employment, and regulatory workstream analysis
- `prediction-market` — multi-source research, probability estimation, signal synthesis
- `competitive-intel` — company monitoring, pricing tracking, job posting analysis, patent mining
- `financial-analysis` — earnings analysis, options pricing, multi-factor synthesis
- `sem-audit` — SEM data ingestion, waste detection, cannibalization analysis, historical pattern mining

Each template defines: workers with roles, output schemas, cross-reference rules, and synthesis instructions.

**Estimated Scope:** Expand `src/lib/templates.ts` (+600 lines) or refactor to a `src/lib/templates/` directory

---

### 5. Cost and Budget Management

**Current:** Basic cost tracking per worker via `cost_per_task_usd` in `performance.ts`. No budget enforcement.

**Needed:**

- Project-level budget caps with a hard stop when the budget is reached
- Per-agent token usage tracking (input, output, and cached tokens per API call)
- Real-time cost dashboard in the mobile PWA
- Budget allocation strategy per template (example: 60% to analysis workers, 20% to cross-reference, 20% to synthesis)
- Cost projection based on document volume before analysis begins
- Alerts at 75%, 90%, and 100% of budget threshold

**Estimated Scope:** Expand `src/lib/performance.ts` (+200 lines), new module `src/lib/budget.ts` (~300 lines)

---

### 6. API-Based Agent Execution

**Current:** All agents run via tmux send-keys to Claude Code CLI sessions.

**Needed:**

- Direct Anthropic API integration for agent execution, decoupled from CLI sessions
- Prompt caching support with system prompts and CLAUDE.md cached and task-specific content uncached
- Batch API support for high-volume, non-urgent analysis (50% cost reduction)
- Streaming response handling for real-time progress updates
- Token counting and rate limit management
- Fallback behavior: tmux mode for interactive sessions, API mode for data analysis tasks

**Estimated Scope:** New module `src/lib/api-agent.ts` (~600 lines)

---

### 7. Verification and Confidence Scoring

**Current:** No verification. Agent outputs are trusted as-is.

**Needed:**

- Three-stage verification pipeline:
  1. Agent self-check
  2. Peer review by a second agent
  3. Synthesis-level consistency check
- Confidence scoring on every finding (0-1 scale based on evidence strength)
- Disagreement surfacing — when a verification agent disagrees with an original finding, the item is escalated for human review
- Fact-checking against known reference data (regulatory databases, financial filings, etc.)

**Estimated Scope:** New module `src/lib/verification.ts` (~400 lines)

---

### 8. Report Generation

**Current:** SYNTHESIS.md is the only output format. No formatted reports.

**Needed:**

- Template-driven report generation (HTML rendered to PDF)
- Executive summary generator producing 1-2 pages from a full analysis
- Technical detail report including full findings with evidence chains
- Domain-specific output formats: privilege log for legal, gap analysis for regulatory, risk matrix for due diligence
- Chart and table generation from structured findings data

**Estimated Scope:** New module `src/lib/reports.ts` (~500 lines)

---

### 9. External Data Connectors

**Current:** No external data sources. Agents read local files only.

**Needed:**

- Web search integration for prediction markets and competitive intelligence
- Financial data APIs for market data, options chains, and SEC filings
- Legal database connectors for case law and regulatory filings
- Patent database connectors (USPTO, EPO)
- Google Ads API connector for SEM Sentinel integration
- Pluggable connector interface so new data sources can be added without modifying core logic

**Estimated Scope:** New `src/lib/connectors/` directory with connector interface and implementations (~800 lines total)

---

### 10. PWA Dashboard Upgrades

**Current:** Session list, prompt input, approval badges, metrics panel.

**Needed:**

- Document upload interface with drag-and-drop support and multi-file selection
- Analysis progress visualization showing document coverage, findings count, and confidence distribution
- Findings browser with filtering and sorting
- Cross-reference graph visualization
- Cost tracking dashboard
- Report preview and download

**Estimated Scope:** Expand `public/index.html` (+800 lines)

---

### 11. SKILL.md Context File

The coordination protocol currently uses CLAUDE.md (role definition) and TASK.md (task assignment). The full three-file context-clearing design adds SKILL.md as a third file containing domain-specific skill instructions, loaded per task type and separate from the worker's general role definition.

**Current:** Workers receive CLAUDE.md (role definition) and TASK.md (task assignment). No separate skill-level instructions.

**Needed:**

- SKILL.md file per task type within each template
- Loaded alongside CLAUDE.md and TASK.md at task start
- Contains domain-specific analysis instructions (e.g., how to extract CMC findings, how to code legal privilege, how to evaluate options flow)
- Prompt-cached separately from CLAUDE.md for cost efficiency (~1,200 tokens per skill file)
- Templates define which SKILL.md files are available for each worker role

**Estimated Scope:** Update `coordination.ts` (+50 lines), new skill files per template

---

### 12. RESULT.md / SUMMARY.md Coordination Chain

The full output chain is RESULT.md → SUMMARY.md → SYNTHESIS.md. The current protocol only has SYNTHESIS.md, skipping the two intermediate levels required for audit trails and regulatory traceability.

**Current:** Workers write findings to SYNTHESIS.md. No intermediate output files.

**Needed:**

- RESULT.md — raw findings from each subagent (most granular level)
- SUMMARY.md — worker-level summary aggregating subagent RESULT.md files
- SYNTHESIS.md — orchestrator-level synthesis aggregating worker SUMMARY.md files
- Each level links to the level below (SYNTHESIS.md references which SUMMARY.md files, SUMMARY.md references which RESULT.md files)
- This three-level chain creates the audit trail that FDA/EMA require for documented AI decision-making
- For regulatory compliance: chain must be immutable once finalized (append-only, with cryptographic hashes)

**Estimated Scope:** Update `coordination.ts` (+100 lines), update CLAUDE.md generator (+50 lines)

---

### 13. Risk Management Hard Constraints

For trading use cases, the CTO-level agent must enforce hard constraints that workers cannot override. Advisory authority is insufficient when capital is at risk.

**Current:** CTO/orchestrator synthesizes worker outputs but has no enforcement mechanism. All agents operate with advisory authority.

**Needed:**

- Risk management configuration per project: max position size, max drawdown, max sector exposure, max correlation
- Hard constraint enforcement at orchestrator level — if constraint violated, block action regardless of worker recommendations
- Circuit breaker: if max drawdown hit, block all new positions system-wide
- Constraint checking before any execution action (trade, position change)
- Audit log of all constraint checks (pass/fail/override)
- Applicable beyond trading: budget hard stops, document scope limits, approval gates

**Estimated Scope:** New module `src/lib/constraints.ts` (~250 lines)

---

### 14. Backtesting Infrastructure

For trading and prediction market use cases, strategies must be validated against historical data before live deployment. Untested strategies carry unacceptable risk.

**Current:** No backtesting. Strategies are untested before execution.

**Needed:**

- Historical data replay: feed past market data through the analysis pipeline as if it were live
- Strategy validation: measure Sharpe ratio, Sortino ratio, max drawdown, win rate, profit factor
- Regime comparison: compare current market environment to historical analogs
- A/B testing for strategies: run two strategy variants against same historical data, compare results
- Integration with performance tracking: backtested performance stored alongside live performance

**Estimated Scope:** New module `src/lib/backtesting.ts` (~400 lines)

---

### 15. Brokerage API Integration

For trading use cases, the system must connect to brokerages for execution. Market data connectors alone are insufficient for a complete trading workflow.

**Current:** External connectors planned for data ingestion only (market data, SEC filings). No execution capability.

**Needed:**

- Connector for Interactive Brokers TWS API (most common institutional API)
- Connector for Alpaca (modern REST API, paper trading for testing)
- Connector for Tastytrade (options-focused)
- Read-only by default (market data, positions, P&L)
- Execution requires explicit human approval per trade OR pre-approved strategy with hard constraints
- Paper trading mode for strategy validation without real capital

**Estimated Scope:** Add to `src/lib/connectors/` directory (+300 lines)

---

### 16. 21 CFR Part 11 Compliance

For pharma use cases, electronic records must meet FDA 21 CFR Part 11 requirements. Basic audit logging is insufficient for regulated submissions.

**Current:** Basic audit logging to `~/.upcommander/audit.log` (JSON lines). Not compliant with regulatory electronic record requirements.

**Needed:**

- Immutable audit trail: append-only log with cryptographic hashes (each entry hashes the previous entry, creating a tamper-evident chain)
- Electronic signatures: record who approved/reviewed each finding, when, with what authority
- Record retention: configurable retention periods per project type
- Access controls: role-based access to audit records
- Export: FDA-compatible audit trail export format
- The RESULT.md → SUMMARY.md → SYNTHESIS.md chain must be hashable and verifiable

**Estimated Scope:** Expand `src/lib/audit.ts` (+200 lines), new `src/lib/compliance.ts` (~300 lines)

---

### 17. Multi-Model Worker Assignment

**Current:** All agents run on a single model (Claude via Claude Code tmux sessions). No model differentiation between workers.

**Needed (NOW BUILT):**

The platform now supports assigning different AI models to individual workers, creating a heterogeneous "hive" where each worker uses the model best suited to its task.

**What was implemented:**

- `ModelConfig` interface: provider (anthropic/openai/google/custom), model ID, fallback model, maxTokens, temperature
- `MODEL_PRESETS` registry: pre-configured presets for opus, sonnet, haiku, o3, gpt-4o, gemini-pro, gemini-flash
- `WorkerDefinition.model` field: each worker can be assigned a specific model
- `ProjectTemplate.defaultModel`: template-level default for workers without explicit assignment
- `MODEL.json` file per worker in `.claude-coord/<worker>/MODEL.json` — persists model config
- `AgentStatus.model` and `AgentStatus.tokens` fields: track model and token usage in coordination protocol
- `WorkerPerformance.model_stats`: per-model quality comparison for A/B optimization
- All 6 built-in templates updated with model assignments following agent-operations.md rules

**Model assignment strategy (per agent-operations.md):**

| Model | Assigned To | Rationale |
|---|---|---|
| Opus | Orchestrators, synthesis, architecture decisions | Deep reasoning, first-attempt correctness required |
| Sonnet | Standard workers (code, analysis, writing) | 97-99% of Opus quality at 40% lower cost |
| Haiku | Scanning, formatting, triage, simple lookups | Speed over depth, high-volume tasks |
| GPT-4o / o3 | Cross-provider verification, specialized reasoning | Second-opinion verification, reasoning benchmarks |
| Gemini Pro/Flash | Visual tasks, prompt optimization for Google tools | Native Veo/Imagen integration |

**Example: dev template model assignment:**
```
orchestrator  → opus     (architecture decisions)
backend       → sonnet   (standard code)
frontend      → sonnet   (standard code)
tests         → sonnet   (test generation)
deploy        → haiku    (formulaic deployment scripts)
```

**Example: pharma regulatory template (planned):**
```
CTO agent                  → opus     (cross-jurisdiction strategy)
Module workers (20+)       → sonnet   (document analysis)
Cross-reference workers    → sonnet   (entity extraction)
Verification workers       → opus     (high-stakes accuracy)
Completeness audit         → o3       (cross-provider second opinion)
Formatting/export          → haiku    (mechanical output)
```

**Cost impact:** Mixed-model assignment reduces cost 25-40% vs. all-opus while maintaining quality where it matters. Scanning/triage on haiku at $0.25/M input vs. $15/M input for opus is a 60x cost reduction on tasks where quality difference is negligible.

**Estimated Scope:** Already implemented in templates.ts, coordination.ts, claude-md-generator.ts, performance.ts. Future work: API agent execution (Phase 2) must route to correct provider based on MODEL.json.

---

## Summary Table

| Upgrade | New Files | Est. Lines | Priority |
|---|---|---|---|
| Document Ingestion Pipeline | `ingestion.ts` | ~400 | P0 — required for all use cases |
| Cross-Reference Detection Engine | `cross-reference.ts` | ~500 | P0 — core differentiator |
| Structured Output Schemas | `output-schemas.ts` | ~350 | P0 — required for findings |
| Data Analysis Templates | `templates/` expansion | ~600 | P1 — enables specific use cases |
| Cost and Budget Management | `budget.ts` | ~300 | P1 — required for production use |
| API-Based Agent Execution | `api-agent.ts` | ~600 | P1 — required for scale |
| Verification and Confidence Scoring | `verification.ts` | ~400 | P1 — required for trust |
| Report Generation | `reports.ts` | ~500 | P2 — delivery format |
| External Data Connectors | `connectors/` | ~800 | P2 — per use case |
| PWA Dashboard Upgrades | `index.html` expansion | ~800 | P2 — UX improvement |
| SKILL.md Context File | `coordination.ts` update | ~50 | P1 — improves prompt quality |
| RESULT.md/SUMMARY.md Chain | `coordination.ts` update | ~150 | P0 — audit trail for regulated use |
| Risk Management Constraints | `constraints.ts` | ~250 | P1 — required for trading |
| Backtesting Infrastructure | `backtesting.ts` | ~400 | P2 — required for trading validation |
| Brokerage API Integration | `connectors/` expansion | ~300 | P2 — required for trade execution |
| 21 CFR Part 11 Compliance | `compliance.ts` + `audit.ts` | ~500 | P1 — required for pharma use cases |
| Multi-Model Worker Assignment | templates.ts, coordination.ts, performance.ts | ~120 | P0 — BUILT |

**Total estimated new code: ~6,900 lines** (Multi-Model Worker Assignment already built — no new lines required)
**Combined with existing codebase: ~16,850 lines**

---

## Implementation Priority

**P0 — Foundation (implement first, all use cases depend on these):**
Document Ingestion, Cross-Reference Engine, Structured Output Schemas, RESULT.md/SUMMARY.md Chain (audit trail for regulated use), Multi-Model Worker Assignment (BUILT)

**P1 — Core Platform (required for production deployment):**
Data Analysis Templates, Cost and Budget Management, API-Based Execution, Verification Pipeline, SKILL.md Context File, Risk Management Constraints, 21 CFR Part 11 Compliance

**P2 — Delivery and Expansion (required for end-to-end user value):**
Report Generation, External Data Connectors, PWA Dashboard Upgrades, Backtesting Infrastructure, Brokerage API Integration
