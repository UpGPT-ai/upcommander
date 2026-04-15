# Claude Commander — Data Analysis Platform Upgrade Plan

**Current:** Programming-focused multi-agent orchestrator (~9,945 lines)
**Target:** General-purpose parallel data analysis and intelligence platform (~15,200 lines)
**Estimated new code:** ~5,250 lines across 10 new modules

---

## Overview

Claude Commander currently orchestrates Claude Code sessions via tmux, with file-based coordination (STATUS.json, TASK.md, SYNTHESIS.md), templates, memory, performance tracking, A/B testing, drift detection, and a mobile PWA. This upgrade plan extends that foundation into a domain-agnostic parallel analysis engine capable of ingesting documents, extracting structured findings, cross-referencing entities across agents, and generating verified, professional-grade reports.

SEM Sentinel — a separate SEM auditing AI agent platform with 34 agent/library files running on the VISION/UpGPT platform — is the first integration target. SEM Sentinel currently runs agents sequentially. This upgrade enables parallel execution, cross-account intelligence, verified findings, and live data connectivity.

---

## Phase 0 — Foundation Layer (Core Infrastructure)

**Goal:** The 3 modules that every subsequent use case depends on.

### 0A. Document Ingestion Pipeline (`src/lib/ingestion.ts`)

- `ingestDocument(filePath)` — detect type (PDF, DOCX, CSV, XLSX, JSON, XML, TXT), extract text
- `chunkDocument(text, options)` — split into agent-digestible segments respecting section boundaries
  - Options: `maxTokens` (default 4000), `overlapTokens` (default 200), `preserveHeaders` (true)
- `distributeChunks(chunks, workerCount)` — assign chunks to workers with overlap windows
- `DocumentRegistry` class — tracks which worker has analyzed which chunks
- Metadata extraction: title, author, date, document type, section headers, page count
- Support for batch ingestion (directory of files)
- Dependencies: `pdf-parse` (PDF), `mammoth` (DOCX), `xlsx` (spreadsheets)

### 0B. Structured Output Schemas (`src/lib/output-schemas.ts`)

- `FindingSchema` interface:
  ```typescript
  {
    finding_id: string;
    type: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    title: string;
    description: string;
    evidence_chain: EvidenceLink[];
    confidence: number;           // 0-1
    dollar_impact?: number;
    source_documents: DocRef[];
    cross_references: string[];
  }
  ```
- `EvidenceLink` interface: `{ document_id, page/row, excerpt, context }`
- `AnalysisResult` interface: `{ project, template, started, completed, findings, summary, metadata }`
- `mergeFindings(findingsFromMultipleWorkers)` — deduplicate by similarity, merge evidence chains, rank by severity × confidence
- `exportFindings(findings, format)` — JSON, CSV, markdown table
- Domain-specific schema extensions registered via `registerSchema(domain, schema)`

### 0C. Cross-Reference Detection Engine (`src/lib/cross-reference.ts`)

- `extractEntities(text, domain)` — extract names, dates, dollar amounts, citations, identifiers based on domain
- `CrossReferenceGraph` class — directed graph of entity relationships across documents and agents
- `addReference(entityA, entityB, relationship, source)` — build graph
- `findConflicts()` — detect contradictory findings about the same entity from different agents
- `traceChain(entityId)` — follow reference chain through multiple documents
- `getSummary()` — top conflicts, most-referenced entities, orphaned references
- Storage: JSON graph files in project's `.claude-coord/cross-refs/`

### 0D. RESULT.md / SUMMARY.md Coordination Chain

- Extend coordination protocol from single SYNTHESIS.md to three-level chain:
  - RESULT.md — raw findings per subagent (most granular)
  - SUMMARY.md — worker-level summary aggregating subagent RESULT.md files
  - SYNTHESIS.md — orchestrator-level synthesis aggregating worker SUMMARY.md files
- Each level links to the level below via file references
- Chain creates the audit trail required by FDA/EMA for documented AI decision-making
- For pharma/regulated use: chain is immutable once finalized (append-only, cryptographic hashes)
- Update `coordination.ts`: new `writeResult()`, `writeSummary()` functions, update `initCoordination()` to create RESULT.md template
- Update CLAUDE.md generator: workers instructed to write RESULT.md, orchestrators to write SUMMARY.md

### Integration Points

- Coordination protocol updated: STATUS.json gains `findings_count` and `entities_extracted` fields
- SYNTHESIS.md template updated to include structured findings section
- Worker CLAUDE.md gains instructions for outputting structured findings

### Estimated Scope

~1,400 lines across 4 new modules

---

## Phase 1 — Analysis Templates and SEM Sentinel Integration

**Goal:** First domain-specific templates and immediate SEM Sentinel value.

### 1A. Template System Refactor

- Move from single `templates.ts` to `src/lib/templates/` directory
- `src/lib/templates/index.ts` — template registry and loader
- `src/lib/templates/base.ts` — shared template logic
- Each template in its own file: `dev.ts`, `research.ts`, `sem-audit.ts`, `legal-discovery.ts`, etc.
- Template interface extended:
  ```typescript
  interface AnalysisTemplate extends ProjectTemplate {
    inputTypes: string[];           // accepted file types
    outputSchema: string;           // registered schema name
    crossRefRules: CrossRefRule[];  // what entities to extract
    verificationLevel: 0 | 1 | 2;  // how much verification
    budgetProfile: BudgetProfile;   // token allocation strategy
  }
  ```

### 1B. SEM Audit Template (`src/lib/templates/sem-audit.ts`)

Workers matching SEM Sentinel Layer 1 agents:

| Worker Role | Function |
|---|---|
| `waste-hunter` | Zero-conversion spend identification |
| `cannibal-detector` | Cross-campaign keyword overlap |
| `trend-analyst` | Historical performance patterns |
| `pmax-auditor` | Smart Bidding verification |
| `opportunity-mapper` | Missed keyword opportunities |
| `decision-differ` | Historical decision audit |

- Input: CSV data files (search terms, campaigns, performance metrics)
- Output schema: SEM Sentinel finding format (`finding_id`, `severity`, `evidence_chain`, `dollar_impact`)
- Cross-reference rules: keyword entity extraction, campaign-to-keyword mapping
- CLAUDE.md per worker includes SEM-specific analysis instructions

### 1C. SEM Sentinel Bridge (`src/lib/connectors/sentinel-bridge.ts`)

- Pull data from Google Ads API via SEM Sentinel's existing `google-ads-client.ts` patterns
- Push structured findings back to SEM Sentinel's database schema
- Multi-account orchestration: spawn one Account Orchestrator per client account
- Cross-account synthesis for agency and multi-brand clients

### 1D. Competitive Intelligence Template (`src/lib/templates/competitive-intel.ts`)

- Workers: `pricing-monitor`, `job-posting-analyst`, `patent-tracker`, `review-sentiment`, `news-scanner`, `synthesis`
- Designed for continuous monitoring (re-run daily/weekly)
- Output: daily brief, anomaly alerts, weekly deep-dive

### 1E. SKILL.md Context File Support

- Add SKILL.md as third context file alongside CLAUDE.md and TASK.md
- SKILL.md contains domain-specific analysis instructions per task type
- Templates define available SKILL.md files per worker role
- Prompt-cached separately from CLAUDE.md for cost efficiency (~1,200 tokens per skill file)
- Example: pharma template has skills for "CMC gap analysis", "cross-reference tracing", "labeling consistency check"
- Example: SEM template has skills for "waste identification", "cannibalization detection", "trend analysis"
- Update coordination.ts to write SKILL.md during task assignment
- Update CLAUDE.md generator to reference SKILL.md loading

### SEM Sentinel Impact

| Dimension | Before | After |
|---|---|---|
| Execution model | Sequential agents | All 6 backward agents in parallel |
| Audit time | 15-30 min per account | 3-5 min per account |
| Account concurrency | Single account | 10 accounts simultaneously (agency tier) |
| Cross-account intelligence | Not possible | Cross-account cannibalization detection |
| Agency pricing justification | Limited | Cross-account features justify $500/month add-on |

### Estimated Scope

~800 lines (templates) + ~300 lines (sentinel bridge) + ~100 lines (SKILL.md support)

---

## Phase 2 — API Agent Execution and Cost Management

**Goal:** Move from tmux-only execution to direct API calls for data analysis tasks. Add budget controls.

### 2A. API-Based Agent Execution (`src/lib/api-agent.ts`)

- `ApiAgent` class — executes agent tasks via Anthropic Messages API
- Prompt construction: system prompt (CLAUDE.md) + task (TASK.md) + document chunks
- Prompt caching: CLAUDE.md and skill definitions cached (90% cost reduction on repeated calls)
- Streaming response handler for real-time progress updates via WebSocket
- Token counting per call (input/output/cached) reported to performance tracking
- Rate limit management with exponential backoff
- Batch API support for non-urgent analysis (50% cost reduction)
- Mode selection: `execution_mode: 'tmux' | 'api' | 'batch'` per template
- Fallback: if API call fails, fall back to tmux execution

**Multi-Model Routing (foundation already built in templates.ts)**
- Each worker's MODEL.json specifies provider, model, fallback, maxTokens, temperature
- ApiAgent reads MODEL.json at task start and routes to the correct provider API
- Supported providers: Anthropic (Claude), OpenAI (GPT-4o, o3), Google (Gemini)
- Provider-specific API clients with unified response interface
- Automatic fallback: if primary model fails or rate-limits, fall back to the model specified in `fallback` field
- Token counting normalized across providers for consistent cost tracking
- Provider API keys managed in `~/.claude-commander/config.json` under `apiKeys` section:
  ```json
  {
    "apiKeys": {
      "anthropic": "sk-ant-...",
      "openai": "sk-...",
      "google": "AIza..."
    }
  }
  ```

### 2B. Cost and Budget Management (`src/lib/budget.ts`)

- `ProjectBudget` interface: `{ total_usd, spent_usd, allocated: Record<workerRole, number>, alerts: BudgetAlert[] }`
- `setBudget(projectPath, budget)` — set project-level budget cap
- `recordSpend(projectPath, worker, tokens, cost)` — track spend per API call
- `checkBudget(projectPath)` — returns remaining budget, triggers alerts at 75%/90%/100%
- Hard stop enforcement: agents cannot execute when budget is exhausted
- Cost projection: `estimateCost(documentVolume, template)` — predict cost before starting
- Budget allocation by template profile (e.g., 60% analysis workers, 20% cross-reference, 20% synthesis)
- Real-time cost dashboard data served via new API endpoint

### 2C. Server and PWA Updates

- New endpoints: `POST /budget/:project`, `GET /budget/:project`, `GET /cost/estimate`
- PWA: cost tracking panel, budget alerts, cost-per-finding metric
- WebSocket: `cost_update` event type for real-time spend tracking

### Estimated Scope

~600 lines (api-agent) + ~300 lines (budget) + ~200 lines (server/PWA updates)

---

## Phase 2.5 — Analysis Pipeline Testing Framework

**Goal:** Systematic testing infrastructure to measure and optimize network performance.

### 2.5A. Pipeline Testing Framework (`src/lib/testing/pipeline-test.ts`)

- Run the same document set through multiple configurations
- Vary: chunk size, overlap tokens, worker count, verification level, synthesis prompt
- Measure per configuration: finding count, finding quality (human-scored), cross-reference recall, cross-reference precision, cost, time
- Produce optimization surface: what configuration maximizes quality per dollar for each template
- Store results in `~/.claude-commander/test-results/`

### 2.5B. Benchmark Suites (`src/lib/testing/benchmark-suite.ts`)

- Standard test document sets per domain with known findings (human-annotated gold standard)
- SEM benchmark: known-waste CSV with pre-identified waste, cannibalization, and opportunities
- Legal benchmark: annotated discovery set with known privilege, hot documents, timeline events
- Pharma benchmark: annotated CMC section with known gaps and cross-reference issues
- Benchmarks stored in `~/.claude-commander/benchmarks/`

### 2.5C. Accuracy Scoring (`src/lib/testing/accuracy-scorer.ts`)

- Precision: of all findings the system reports, what percentage are real
- Recall: of all known findings in the gold standard, what percentage does the system find
- F1 score: harmonic mean of precision and recall
- Cross-reference recall: of all known cross-references, what percentage are detected
- Human-in-the-loop scoring: CLI command to rate finding quality (1-10)

### 2.5D. Regression Tracking (`src/lib/testing/regression-tracker.ts`)

- Run benchmark suite automatically when templates or pipeline code changes
- Track historical scores over time
- Alert when template changes degrade quality below baseline
- Integration with existing drift detection system

### Model Comparison Testing

- Test the same task with different models to measure quality/cost tradeoff
- Produces model comparison matrix: model × task_type → quality, cost, time
- Feeds into template optimization: recommend optimal model for each worker role
- Integration with existing A/B testing: test model A vs model B for same worker role

### Estimated Scope

~600 lines across 4 new modules in `src/lib/testing/`

---

## Phase 3 — Verification and Report Generation

**Goal:** Trust layer — every finding verified and traceable. Professional output.

### 3A. Verification Pipeline (`src/lib/verification.ts`)

Expanded to a five-stage pipeline for regulated use cases:

1. **Self-check** — agent re-reads its own findings and confirms evidence supports conclusion
2. **Peer review** — second agent reviews findings from first agent, flags disagreements
3. **Synthesis check** — orchestrator checks cross-agent consistency
4. **Completeness audit** (regulated use cases) — requirements checklist agent checks what is present vs what is required for the specific submission/analysis type. For pharma: all eCTD modules, all required studies, all critical quality attributes. For legal: all custodians covered, all date ranges, all issue codes
5. **Evidence chain walk** (regulated use cases) — independently traverse every link in the evidence chain: source document → page → excerpt → entity → cross-reference → conclusion. Each link verified separately. Broken links flagged as critical findings.

Templates define which verification stages are required (SEM: stages 1-3, pharma: all 5 stages).

Additional pharma-grade features:
- Gap-to-complete report: "These required sections/studies/data points are NOT present in the document set"
- Statistical confidence on aggregate findings (not just per-finding confidence)
- Reference validation against authoritative databases (FDA guidances, ICH guidelines, USP monographs)
- 21 CFR Part 11 compliant audit trail: append-only log with cryptographic hashes, electronic signatures, record retention

Additional behaviors (all use cases):
- Confidence scoring: each finding receives a 0-1 confidence score based on evidence strength
- Disagreement escalation: when peer review disagrees, finding is escalated to human review queue
- Verification metadata attached to every finding: `{ verified_by, verification_stage, original_confidence, adjusted_confidence }`
- Integration with approval queue: unverified critical findings require human approval before delivery

### 3B. Report Generation (`src/lib/reports.ts`)

- `generateReport(findings, template, format)` — produce formatted output
- Templates: executive summary (1-2 pages), technical detail (full findings), domain-specific formats
- Formats: HTML, Markdown, JSON
- Executive summary generator: ranks findings by impact, produces narrative with key numbers
- Evidence chain renderer: for each finding, shows document → page → excerpt → conclusion
- Table and chart data preparation (client renders charts)

Domain-specific report templates:

| Domain | Report Types |
|---|---|
| SEM | Waste report, cannibalization report, CFO summary |
| Legal | Privilege log, hot document list, chronology |
| Due Diligence | Risk matrix, deal-breaker report |
| Pharma | Gap analysis, cross-reference report, jurisdiction comparison |

### 3C. CLI and PWA Updates

- CLI: `verify <project>`, `report <project> --format html --type executive`
- PWA: findings browser with filter/sort by severity, type, document, and confidence; report preview; download button
- Server: `GET /findings/:project`, `POST /verify/:project`, `GET /report/:project`

### Estimated Scope

~800 lines (verification) + ~500 lines (reports) + ~200 lines (CLI/PWA/server)

---

## Phase 4 — External Connectors and Advanced Templates

**Goal:** Connect to external data sources. Enable prediction markets, legal, and financial use cases.

### 4A. Connector Interface (`src/lib/connectors/base.ts`)

- Abstract `DataConnector` interface: `connect()`, `query()`, `stream()`, `disconnect()`
- Connector registry: `registerConnector(name, connector)`
- Configuration: connectors configured per project in `.claude-coord/connectors.json`

### 4B. Connector Implementations

| File | Purpose |
|---|---|
| `src/lib/connectors/web-search.ts` | Web search integration (prediction markets, competitive intel) |
| `src/lib/connectors/financial-data.ts` | Market data, options chains, SEC filings |
| `src/lib/connectors/google-ads.ts` | Google Ads API (adapted from SEM Sentinel's existing client) |

Future connectors are pluggable and added per use case: legal databases, patent databases, PubMed.

### 4C. Advanced Analysis Templates

| Template | File | Use Case |
|---|---|---|
| Legal Discovery | `src/lib/templates/legal-discovery.ts` | Privilege review, issue coding, hot documents, chronology |
| Due Diligence | `src/lib/templates/due-diligence.ts` | Financial, legal, IP, employment, regulatory parallel workstreams |
| Prediction Markets | `src/lib/templates/prediction-market.ts` | Multi-source research, probability estimation, edge calculation |
| Financial Analysis | `src/lib/templates/financial-analysis.ts` | Earnings analysis, options pricing, multi-factor synthesis |

### 4D. Pharma Regulatory Template (Long-Lead)

- `src/lib/templates/regulatory-submission.ts` — eCTD module structure, FDA/EMA/PMDA requirements
- Most complex template in the system; requires domain expert validation before production use
- Ships as beta with documentation noting it requires regulatory professional oversight

### 4E. Brokerage API Connectors

- `src/lib/connectors/interactive-brokers.ts` — TWS API (most common institutional)
- `src/lib/connectors/alpaca.ts` — modern REST API with paper trading
- `src/lib/connectors/tastytrade.ts` — options-focused API
- Read-only by default (positions, P&L, market data)
- Execution requires explicit human approval per trade OR pre-approved strategy with hard constraints
- Paper trading mode for strategy validation

### 4F. Backtesting Infrastructure (`src/lib/backtesting.ts`)

- Historical data replay through analysis pipeline
- Strategy validation metrics: Sharpe, Sortino, max drawdown, win rate, profit factor
- Regime comparison: current vs historical analogs
- A/B testing for strategies against same historical data
- Results stored alongside live performance metrics

### 4G. Risk Management Hard Constraints (`src/lib/constraints.ts`)

- Risk configuration per project: max position size, max drawdown, max sector exposure
- Hard constraint enforcement at orchestrator level — blocks action if violated
- Circuit breaker: max drawdown triggers system-wide position block
- Constraint check before any execution action
- Audit log of all constraint checks (pass/fail)
- Applicable beyond trading: budget hard stops, document scope limits

### 4H. 21 CFR Part 11 Compliance Module (`src/lib/compliance.ts`)

- Immutable audit trail with cryptographic hash chain (each entry hashes the previous)
- Electronic signatures: who approved/reviewed, when, with what authority
- Configurable record retention periods per project type
- FDA-compatible audit trail export format
- Integration with RESULT.md → SUMMARY.md → SYNTHESIS.md chain

### Estimated Scope

~800 lines (connectors) + ~600 lines (templates) + ~850 lines (trading infrastructure) + ~400 lines (compliance)

---

## Phase 5 — PWA Dashboard and Polish

**Goal:** Full analysis dashboard on mobile. Production hardening.

### 5A. PWA Dashboard Upgrades

- Document upload interface: drag-and-drop, multi-file, progress indicator
- Analysis progress visualization: document coverage heat map, findings counter, confidence distribution
- Findings browser with filtering by severity, type, document, and confidence
- Cross-reference graph visualization: interactive entity relationship view
- Report preview and PDF download
- Template selection wizard for new analysis projects

### 5B. Production Hardening

- Error recovery: if an agent crashes mid-analysis, resume from last checkpoint
- Partial results: serve findings as they are produced, not only at completion
- Rate limiting per project to prevent runaway cost
- API key rotation support
- Audit log expansion for compliance use cases

### 5C. Documentation

- Template authoring guide: how to create custom analysis templates
- API documentation for integration with external systems (including SEM Sentinel)
- Deployment guide: local, VPS, and cloud

### Estimated Scope

~800 lines (PWA) + ~300 lines (hardening) + documentation

---

## Timeline and Dependencies

```
Phase 0 ──────────► Phase 1 ──────────► Phase 2
(Foundation)        (Templates + SEM)   (API + Budget)
                                              │
                                              ▼
                                         Phase 2.5
                                         (Testing Framework)
                                              │
                                              ▼
                         Phase 3 ◄──────── Phase 4
                         (Verify + Report)  (Connectors + Templates)
                                              │
                                              ▼
                                          Phase 5
                                          (Dashboard + Polish)
```

| Phase | Depends On | New Files | Est. Lines | Priority |
|---|---|---|---|---|
| 0 | Nothing | 4 | ~1,400 | P0 — blocks everything |
| 1 | Phase 0 | 6+ | ~1,200 | P0 — SEM Sentinel value |
| 2 | Phase 0 | 2 | ~1,100 | P1 — required for scale |
| 2.5 | Phase 0+1 | 4 | ~600 | P1 — network optimization |
| 3 | Phase 2 | 2 | ~1,500 | P1 — required for trust |
| 4 | Phase 0 | 10+ | ~2,650 | P2 — per use case |
| 5 | All above | PWA + docs | ~1,100 | P2 — polish |

**Total: ~9,550 lines of new/modified code**
**Combined platform: ~19,500 lines**

---

## SEM Sentinel Upgrade Path

### What Changes for SEM Sentinel

**Phase 0 + 1 (Immediate):**
- SEM Sentinel's backward agents are orchestrated by Claude Commander in parallel
- Agency clients receive 10-account simultaneous analysis
- Cross-account cannibalization detection becomes possible
- Audit time drops from 15-30 minutes to 3-5 minutes per account

**Phase 2:**
- API-based execution means SEM Sentinel agents run without tmux overhead
- Cost tracking per audit enables accurate per-client billing
- Budget caps prevent runaway API costs on large accounts

**Phase 3:**
- Verification pipeline ensures every waste finding is double-checked before delivery
- Report generation produces CFO-ready and PPC-team reports automatically
- Evidence chains make findings defensible: "you spent $X on these Y terms with Z conversions — here is the data"

**Phase 4:**
- Google Ads connector enables live data pull instead of CSV upload
- Competitive tracker connector enables monitoring of competitor ad strategies
- Financial data connector enables LTV-backed CPA calculations

### Net Result

SEM Sentinel moves from a partially-built sequential tool to a fully parallel, verified, report-generating intelligence platform.

| Stage | What It Delivers |
|---|---|
| Phase 0+1 | Claude Commander becomes the execution engine for SEM Sentinel's agents |
| Phase 2+3 | API execution and verification make it production-grade |
| Phase 4 | External connectors complete the data pipeline |
| Ongoing | SEM Sentinel's own dashboard consumes Claude Commander's API for structured findings |

---

## Pharma Go-To-Market Strategy

This section captures the market entry strategy for the pharma regulatory use case.

### Domain Expert Co-Founder (Non-Negotiable)

- Former FDA reviewer or regulatory affairs VP with RAC certification
- Structure: equity + revenue share, not full-time hire
- Sources: RAPS membership directory, LinkedIn ("FDA" + "regulatory affairs" + "former"), ProPharma Group alumni, biotech conference speaker lists
- Role: domain language, existing relationships, credibility layer, output validation

### Target Buyer: Series A/B Biotechs

- $10M-$150M raised, pre-IND or IND stage
- Have one regulatory affairs director who is stretched thin
- Cannot afford $500/hour former-FDA consultants
- Making existential regulatory decisions in real time

### Pricing Anchored to Value, Not Cost

Four value anchors:

1. Cost substitution floor: $8-15M in consulting/labor for typical NDA
2. CRL avoidance premium: P(CMC CRL prevented) x $250M average delay cost = $50M expected value
3. Stock price floor: 30-76% drops on CRL (Replimune -76%, Fortress Biotech -30%)
4. Acceleration upside: $1B+ for 6-month acceleration on blockbuster drug

### FDA Elsa AI Angle

FDA deployed Elsa (agency-wide AI assistant) June 2025. Capabilities: summarize adverse event trends, compare product labels, identify inconsistencies. Product pitch: "The FDA is now using agentic AI to review your submission. We use the same class of system to analyze your submission before it reaches them, so you're not surprised by what they find."

### 12-Month Path

- Months 1-2: Find and structure relationship with domain expert co-founder. Build CLAUDE.md templates for regulatory document analysis.
- Months 3-4: Run system on 2-3 public NDA submissions as proof-of-concept. Domain expert reviews output quality.
- Months 5-6: First paid pilot client ($15-25K) — pre-submission gap analysis. Deliver in 10 days.
- Months 7-9: Second and third clients via referral. Raise price to $40-60K.
- Months 10-12: Case study ready, references available, price to $100K+. Target RAPS Annual Conference (3,000+ regulatory professionals).

---

## Cost Model Reference

**Operational Cost Model (API-Based Execution)**

The $200/month Claude Max subscription cannot support 50 concurrent agents — it would exhaust the weekly allocation in ~1.4 hours of concurrent operation. The agent fleet must run on API pay-as-you-go billing.

**Current API pricing (Sonnet 4.6, March 2026):**
- Input tokens: $3/million (uncached), $0.30/million (cached)
- Output tokens: $15/million

**Per-agent, per-task cost (with context-clearing design):**
- Context at task start: CLAUDE.md (800 tokens, cached) + TASK.md (400 tokens) + SKILL.md (1,200 tokens, cached)
- Mid-task API calls: ~30,000 tokens, 80% cached
- Output per task: ~8,000 tokens
- Total per task: ~$0.15-0.18

**System cost by configuration:**

| Configuration | Active Agents | Cost/Day | Cost/Month |
|---|---|---|---|
| Light (4 workers, 1 project) | 4 | $6.80 | $204 |
| Medium (15 workers, 3 projects) | 15 | $25.50 | $765 |
| Production (30 workers, tuned) | 30 | $51.00 | $1,530 |
| Full scale (50 workers) | 50 | $85.00 | $2,550 |
| Multi-account (3 API keys, 100 workers) | 100 | $170.00 | $5,100 |

---

## Build Strategy

Following agent-operations.md principles:

| Phase | Build Approach | Model |
|---|---|---|
| Phase 0 | Sequential — each module depends on design decisions from prior | Sonnet |
| Phase 1 | 3 parallel agents: template refactor, SEM template, competitive intel template | Sonnet |
| Phase 2 | 2 parallel agents: API agent, budget system | Sonnet |
| Phase 3 | 2 parallel agents: verification, reports | Sonnet |
| Phase 4 | 4 parallel agents: connector base, 3 connector implementations | Sonnet |
| Phase 5 | 3 parallel agents: PWA, hardening, docs | Sonnet |

Architecture decisions and cross-module integration reviews use Opus.

---

*Plan written: 2026-03-22*
*Based on Claude Commander v1 codebase at ~9,945 lines across 27 source files*
