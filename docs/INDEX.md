# Claude Commander — Documentation Index

**Last Updated:** 2026-03-23

---

## Specifications

| Document | Description | Status |
|----------|-------------|--------|
| [ORIGINAL_SPEC.md](ORIGINAL_SPEC.md) | Original 8-phase platform specification (architecture, security, coordination protocol, deployment) | Complete — all 8 phases built |
| [FEATURE_UPGRADES.md](FEATURE_UPGRADES.md) | 17 feature upgrades needed for general-purpose data analysis platform | Planning |
| [UPGRADE_PLAN.md](UPGRADE_PLAN.md) | 7-phase implementation plan (Phase 0 through Phase 5 + Phase 2.5) with dependencies and estimates | Planning |

## Use Cases & Market

| Document | Description | Status |
|----------|-------------|--------|
| [USE_CASES.md](USE_CASES.md) | 8 high-value use cases with agent architectures, revenue models, and human-vs-AI comparisons | Planning |
| [PHARMA_GTM.md](PHARMA_GTM.md) | Go-to-market playbook for pharma regulatory use case (pricing, GTM strategy, 12-month path, compliance) | Planning |

## Integration Guides

| Document | Description | Status |
|----------|-------------|--------|
| [SEM_SENTINEL_INTEGRATION.md](SEM_SENTINEL_INTEGRATION.md) | Complete guide for SEM Sentinel agents — parallel audits, cross-reference detection, verification, learning system, multi-account mode | Current |

## Training & Knowledge System

| Document | Description | Status |
|----------|-------------|--------|
| [KNOWLEDGE_SYSTEM.md](KNOWLEDGE_SYSTEM.md) | Training pipeline architecture, 292 MB corpus inventory, swarm execution logs, knowledge store design, session recovery features | Current |

## Build History

| Document | Description | Status |
|----------|-------------|--------|
| [PHASE_PLAN.md](PHASE_PLAN.md) | Original 8-phase build log, CLI reference, REST API reference, architecture diagram | Complete |
| [AS_BUILT_DIFF.md](AS_BUILT_DIFF.md) | Diff between as-built state and fully planned state, with phased build plan | Current |

## Source Code

| Component | Path | Lines | Description |
|-----------|------|-------|-------------|
| Server | `src/server/index.ts` | 996 | Express + WebSocket bridge server (port 7700) + budget/findings/verify/report/audit endpoints |
| CLI | `src/cli/index.ts` | 1,379 | 25+ commands for session, coordination, memory, evolution, verification, reporting |
| Library | `src/lib/` (33 modules) | 13,333 | Core platform + ingestion, cross-ref, schemas, API agent, budget, verification, reports, compliance, backtesting, constraints, checkpoint |
| Templates | `src/lib/templates/` (7 files) | 2,086 | sem-audit, competitive-intel, legal-discovery, due-diligence, prediction-market, financial-analysis, regulatory-submission |
| Connectors | `src/lib/connectors/` (2 files) | 619 | Base interface + SEM Sentinel bridge |
| Testing | `src/lib/testing/` (4 files) | 990 | Pipeline testing, benchmarks, accuracy scoring, regression tracking |
| PWA | `public/index.html` | 1,363 | Mobile-first dark theme dashboard with voice input |
| VS Code Extension | `vscode-extension/src/` (5 files) | 1,856 | Sidebar, webview, bridge client, status bar |
| **Total** | | **~20,783** | |

## External References

| Resource | Location |
|----------|----------|
| Original spec (canonical) | `/Users/gregorybibas/.gemini/antigravity/scratch/VISION/docs/specs/CLAUDE_COMMANDER_SPEC.md` |
| SEM Sentinel spec | `/Users/gregorybibas/.gemini/antigravity/scratch/VISION/docs/agents/sentinel/SEM_SENTINEL_SPEC.md` |
| Agent operations rules | `~/.claude/library/agent-operations.md` |
| Project memory | `~/.claude/projects/-Users-gregorybibas--gemini-antigravity-scratch-Claude-Commander/memory/` |
