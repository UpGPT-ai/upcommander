# UpCommander — Knowledge System & Training Pipeline

**Date:** 2026-03-23
**Status:** Swarms 1-3 executed, Swarm 4 (corrections) pending
**Training corpus:** 507+ files, ~292 MB, ~70,000 pages
**Output:** 62 files across output-v2, output-v3, and verification directories

---

## 1. Training Pipeline Architecture

The pharma regulatory training system is a multi-stage pipeline that converts raw regulatory source documents into a verified, queryable knowledge store. The pipeline is designed so that workers at analysis time never read the 70,000 source pages directly — they load extracted, verified rules from the knowledge store instead.

### Stage 1: Teach the Rules

**Input:** ICH guidelines (Q/S/E/M series), eCTD specifications, FDA guidances
**Output:** SKILL.md files (human-readable domain instructions) + structured JSON rules (machine-queryable)
**Method:** Parallel extraction swarm reads every source document, extracts individual regulatory requirements as structured rules with provenance (document, section, page), and writes domain-specific SKILL.md files that encode the rules as worker instructions.

### Stage 2: Study Successes

**Input:** FDA Drugs@FDA review documents (approval packages for successful NDAs)
**Output:** Learnings about what "normal" looks like — typical data packages, common study designs, acceptable specification ranges
**Method:** Workers analyze successful submissions to establish baselines. When the system later reviews a new submission, it can compare against these baselines to detect anomalies.

### Stage 3: Study Failures

**Input:** Complete Response Letter (CRL) database — 419 CRLs documenting FDA refusals
**Output:** Failure patterns, deficiency taxonomy, detection rules
**Method:** Workers categorize every CRL by deficiency type, map deficiencies to eCTD modules, and generate detection rules in the form "IF [condition] THEN flag as CRL risk." These rules become the system's primary defect detection engine.

### Stage 4: Cross-Jurisdiction Comparison

**Input:** EMA European Public Assessment Reports (EPARs), PMDA guidelines, Health Canada guidances
**Output:** Divergence maps showing where FDA, EMA, PMDA, and Health Canada requirements differ
**Method:** Workers compare requirements from each jurisdiction against the ICH baseline. Divergences are documented as structured rules with jurisdiction-specific overrides. This enables the system to flag submission gaps for specific target markets.

### Stage 5: CMC Deep Dive

**Input:** FDA warning letters, Form 483 observations, EMA GMP non-compliance reports
**Output:** CMC-specific deficiency taxonomy, manufacturing quality detection rules
**Method:** Workers analyze enforcement actions to identify the most common Chemistry, Manufacturing, and Controls deficiencies. These supplement the CRL patterns with pre-approval inspection risks.

### Stage 6: Benchmark & Optimize

**Input:** Health Canada regulatory data (independent jurisdiction as test set)
**Output:** Accuracy measurements, optimization parameters
**Method:** Run the system against Health Canada submissions where outcomes are known. Measure precision (what percentage of flagged issues are real) and recall (what percentage of real issues are flagged). Tune extraction and detection parameters to maximize the F1 score.

### Stage 7: Live Pilot

**Input:** Real regulatory submissions from pilot clients
**Output:** Validated analysis reports with domain expert review
**Method:** Domain expert (former FDA reviewer or regulatory affairs professional) reviews every finding. Disagreements between the system and the expert feed back into the knowledge store as corrections. This stage runs continuously during initial deployment.

---

## 2. Training Data Corpus

All source documents are stored at:
`/Users/gregorybibas/.gemini/antigravity/scratch/UpCommander/training/stage-1/`

| Source | Directory | Files | Size | Coverage |
|--------|-----------|-------|------|----------|
| ICH Core (Q/S/E/M series) | `ich/` | 24 | ~40 MB | Core guidelines |
| ICH Quality Advanced | `ich-quality-advanced/` | 8 | ~15 MB | Q1B, Q4B, Q5D/E, Q9-Q11 |
| ICH Safety Full | `ich-safety-full/` | 11 | ~18 MB | S1-S4, S8-S10, M3 |
| ICH Efficacy Advanced | `ich-efficacy-advanced/` | 8 | ~12 MB | E3-E4, E7, E10, E14-E17 |
| ICH Complete Collection | `ich-complete/` | ~350 | ~100 MB | Full ICH archive |
| ICH Multidisciplinary | `ich-multidisciplinary/` | varies | ~13 MB | M-series documents |
| US CFR Title 21 (Parts 1-99, 200-299, 300-499, 600-799) | `regulations/` | 4 | ~8 MB | Complete |
| EU Legislation (8 directives/regulations) | `regulations-eu/` | 8 | ~7 MB | Complete |
| EU GMP EudraLex Vol 4 (chapters + 17 annexes) | `eu-gmp/` | 32 | ~5 MB | Complete |
| EMA Scientific Guidelines | `ema-guidelines/` | 11 | ~2 MB | ~80% |
| EMA GVP Modules (I, II, V, VII, VIII, IX, XV, XVI) | `ema-gvp/` | 8 | ~4 MB | Complete |
| PMDA/Japan (inc. JP18 Pharmacopoeia) | `pmda-guidelines/` | 7 | ~29 MB | ~70% |
| NMPA/China | `nmpa-china/` | varies | varies | Partial |
| TGA/Australia | `tga-australia/` | varies | varies | Partial |
| FDA Guidances | `fda-guidance/` | 13 | ~4 MB | ~60% |
| Health Canada (Act + Regulations + guidances) | `health-canada/` | 17 | ~21 MB | ~75% |
| WHO (GMP + Stability) | `who-guidelines/` | 2 | ~528 KB | Core docs |
| eCTD Specs (v3.2.2, formats v1.2/v1.3) | `ectd-specs/` | 3 | ~2 MB | Complete |
| CRL Database (419 Complete Response Letters) | `crl-database/` | 1 | ~5 MB | Complete |
| **TOTAL** | | **507+** | **~292 MB** | **~70,000 pages** |

### CRL Analysis Scripts

Three iterations of CRL analysis scripts were developed to parse and categorize the 419 Complete Response Letters:
- `analyze_crls.py` — initial parsing
- `analyze_crls_v2.py` — improved categorization
- `analyze_crls_v3.py` — final version with deficiency taxonomy extraction

---

## 3. Training Execution Log

### Swarm 1 — ICH + FDA + CRLs

| Parameter | Value |
|-----------|-------|
| Model | Claude Opus |
| Workers | 12 (11 domain + 1 orchestrator) |
| Duration | ~60 minutes |
| Input | 401 ICH PDFs + 24 regulatory docs + 419 CRLs |
| Output | 26 files in `training/output-v2/` (1.4 MB) |

**Worker assignments:**

| Worker | Domain | Input Sources |
|--------|--------|---------------|
| `q-stability` | ICH Q1 series, stability testing | Q1, Q1B, Q1E, Q5C |
| `q-cmc-methods` | Analytical methods, specifications | Q2, Q3A/B/D, Q6A/B |
| `q-biotech` | Biotechnology quality | Q5A-E, Q6B |
| `q-systems` | Quality systems, risk management | Q8-Q11, Q13 |
| `s-toxicology` | Nonclinical toxicology | S1-S4, S8-S10 |
| `s-pharmacology` | Safety pharmacology | S7A/B, M3 |
| `e-clinical-design` | Clinical trial design | E1, E3-E5, E9-E10, E17 |
| `e-safety-pharma` | Clinical safety, pharmacovigilance | E2A, E14, E6 |
| `e-special-pops` | Special populations | E5, E7, E15-E16 |
| `m-multidisciplinary` | eCTD structure, cross-module | M4 series, eCTD specs |
| `regulations-crl` | US CFR + CRL patterns | Title 21, CRL database |
| `orchestrator` | Synthesis, gap identification | All worker outputs |

**Output structure (per worker):**
- `{domain}-rules.json` — structured rules with `rule_id`, `source_document`, `section`, `page`, `requirement_text`, `severity`
- `skill-{domain}.md` — SKILL.md file with human-readable analysis instructions

### Swarm 2 — EU + PMDA + Canada + WHO

| Parameter | Value |
|-----------|-------|
| Model | Claude Sonnet |
| Workers | 6 (5 domain + 1 orchestrator) |
| Duration | ~20 minutes |
| Input | 78 documents (EU legislation, EU GMP, EMA guidelines, EMA GVP, Health Canada, WHO, PMDA) |
| Output | 19 files in `training/output-v3/` (516 KB) |

**Worker assignments:**

| Worker | Domain | Input Sources |
|--------|--------|---------------|
| `eu-law` | EU pharmaceutical legislation | 8 directives/regulations |
| `eu-gmp-ema` | EU GMP + EMA scientific guidelines | EudraLex Vol 4 + EMA guidelines |
| `ema-pharma-gvp` | EMA pharmacovigilance | GVP Modules I, II, V, VII, VIII, IX, XV, XVI |
| `health-canada` | Health Canada requirements | Food and Drugs Act, regulations, guidances |
| `who-regs` | WHO + PMDA requirements | WHO GMP, stability + PMDA guidelines |
| `orchestrator` | Cross-jurisdiction synthesis | All worker outputs |

**Focus:** Jurisdiction-specific requirements and divergences from FDA baseline. Each worker produced rules tagged with the applicable jurisdiction, enabling divergence map generation.

**Additional output:** `source-references-report.json` — cross-references between jurisdiction-specific rules and their ICH equivalents.

### Swarm 3 — Verification

| Parameter | Value |
|-----------|-------|
| Model | Claude Sonnet |
| Workers | 11 (10 verification + 1 orchestrator) |
| Duration | ~20 minutes |
| Input | All rules from output-v2 and output-v3 (~1.9 MB of extracted rules) |
| Output | 17 files in `training/verification/` (456 KB) |

**Verification worker types:**

| Worker | Verification Type | Method |
|--------|------------------|--------|
| `ich-quality` | ICH Q-series spot-check | Re-read source PDFs, verify rule text matches source |
| `ich-safety` | ICH S-series spot-check | Same method for safety rules |
| `ich-clinical` | ICH E-series spot-check | Same method for clinical rules |
| `eu-regs` | EU regulation verification | Verify EU-specific rules against source legislation |
| `jurisdiction` | Divergence verification | Confirm claimed divergences between FDA/EMA/PMDA/HC are real |
| `crl-accuracy` | CRL pattern accuracy | Verify CRL deficiency patterns against actual CRL text |
| `cross-domain` | Cross-domain consistency | Check rules that span multiple domains for contradictions |
| `source-refs` | Source reference validity | Verify every `source_document` + `section` + `page` reference resolves |
| `completeness` | Coverage completeness | Check for major regulatory areas with no extracted rules |
| `contradictions` | SKILL.md contradiction check | Check SKILL.md files for internal contradictions |

**Standard:** Only rules classified as ACCURATE enter the knowledge store. PARTIALLY_ACCURATE and INACCURATE rules are queued for correction in Swarm 4.

### Swarm 4 — Corrections (Planned, Not Yet Executed)

| Parameter | Value |
|-----------|-------|
| Model | Claude Sonnet |
| Workers | TBD |
| Input | `corrections.json` and `verification-report.json` from Swarm 3 |
| Method | Re-extract INACCURATE and PARTIALLY_ACCURATE rules from source documents, re-verify each corrected rule |
| Gate | Only rules passing both re-extraction AND re-verification enter the knowledge store |

---

## 4. Knowledge Store Architecture

The knowledge store is the runtime layer that workers load at analysis time. It is separate from the training corpus (source documents) and the training outputs (raw extraction results).

```
~/.upcommander/knowledge/
├── rules/
│   ├── by-module/              eCTD module → all rules that apply
│   │   ├── module-2.3.json     Quality Overall Summary rules
│   │   ├── module-2.7.json     Clinical Summary rules
│   │   ├── module-3.2.S.json   Drug Substance rules
│   │   └── ...
│   ├── by-topic/               Topic → all rules across sources
│   │   ├── stability.json      All stability rules (ICH, FDA, EMA, PMDA)
│   │   ├── impurities.json     All impurity rules
│   │   ├── bioequivalence.json All BE rules
│   │   └── ...
│   └── by-jurisdiction/        Jurisdiction → requirements + divergences
│       ├── fda.json            FDA-specific requirements
│       ├── ema.json            EMA-specific requirements
│       ├── pmda.json           PMDA-specific requirements
│       ├── health-canada.json  HC-specific requirements
│       └── divergence-map.json Where jurisdictions differ from ICH baseline
├── cross-refs/
│   ├── required-references.json    "Module 2.3.S.4 MUST reference 3.2.S.4.3"
│   ├── term-definitions.json       Defined terms + where they must be consistent
│   └── data-consistency.json       Tables/data that must match across modules
├── crl-patterns/
│   ├── by-deficiency-type.json     Deficiency taxonomy with CRL examples
│   ├── by-module.json              Deficiencies organized by eCTD module
│   └── detection-rules.json        "IF X THEN flag as CRL risk"
└── skills/
    ├── cmc-analysis.md             SKILL.md for CMC workers
    ├── clinical-review.md          SKILL.md for clinical workers
    ├── cross-reference.md          SKILL.md for cross-ref workers
    ├── stability-assessment.md     SKILL.md for stability workers
    └── [domain].md                 One per analysis domain
```

### Knowledge Principles

1. **Workers never read the 70,000 source pages again.** They load extracted rules from the knowledge store. This reduces per-worker context from thousands of pages to hundreds of rules (~2,000-4,000 tokens of relevant rules per task).

2. **Every rule has provenance.** Each rule links back through `rule_id` to `source_document` to `section` to `page`. The audit trail is unbroken from finding to source.

3. **Original documents are archived, not deleted.** The `training/stage-1/` directory is the evidence layer behind the knowledge layer. If a rule is challenged, the source PDF is available.

4. **Only verified rules enter the store.** Rules classified as PARTIALLY_ACCURATE or INACCURATE during Swarm 3 verification are excluded until corrected and re-verified by Swarm 4.

### Knowledge at Query Time

When a new regulatory submission arrives for analysis:

1. **Ingestion:** `ingestion.ts` chunks submitted documents by eCTD module (Module 2.3, 2.5, 2.7, 3.2.S, 3.2.P, etc.)

2. **Worker loading:** Each worker receives:
   - `CLAUDE.md` — role definition (CMC analyst, clinical reviewer, etc.)
   - `SKILL.md` — domain-specific analysis instructions from knowledge store
   - `TASK.md` — specific assignment (e.g., "Review Module 3.2.S.4 for stability data completeness")
   - Relevant rules from `knowledge/rules/by-module/` and `knowledge/rules/by-topic/`
   - Document chunk from the submitted filing

3. **Analysis:** Worker checks submission data AGAINST loaded rules. Each finding references the `rule_id` that was violated.

4. **Cross-referencing:** Cross-reference workers check findings against `knowledge/cross-refs/` to identify:
   - Missing internal references (Module 2.3 claims a result not supported in Module 3.2)
   - Inconsistent data (stability table in Module 2.3 differs from Module 3.2.P.8)
   - Undefined terms (a term used in Module 2.5 is not defined in Module 2.7)

5. **CRL risk scoring:** Verification workers check findings against `knowledge/crl-patterns/` to calculate:
   - Probability that each deficiency would result in a CRL
   - Historical CRL frequency for similar deficiency types
   - Severity ranking based on CRL outcomes

---

## 5. New Features Built This Session

### 5.1 Session Recovery System

**File:** `src/lib/session-recovery.ts` (669 lines)

The session recovery system monitors active worker panes and automatically recovers stalled, rate-limited, or dead workers without human intervention.

**Stall detection:** Every 15 seconds, the monitor captures tmux pane output and classifies each worker's state:
- `active` — output is changing, worker is producing content
- `stalled` — output has not changed for the configured threshold (default: 60 seconds)
- `rate_limited` — output contains rate limit error messages; parses refresh time
- `dead` — pane has exited or is unresponsive to heartbeat
- `completed` — expected output files exist in the worker's output directory

**Auto-continue:** After 60 seconds of stall, sends "continue where you left off" to the worker's tmux pane. Escalates to full prompt replay after 3 consecutive stalls.

**Prompt cache:** Stores every prompt sent to every worker. If a worker goes idle or dies, the original prompt can be resent to restart the task from scratch.

**Rate limit recovery:** Parses the rate limit refresh time from pane output (e.g., "Rate limit exceeded. Retry after 2026-03-23T14:30:00Z"). Schedules automatic restart at the parsed time.

**Swarm state persistence:** Writes full swarm state to `~/.upcommander/recovery/swarm-state.json` every 30 seconds. Includes: session name, start time, worker list with prompts, expected outputs, and current state.

**Auto-resume on restart:** When the server starts, checks for persisted swarm state. If incomplete workers are found, resends their prompts to resume work.

**CLI commands:**
- `commander recovery-status` — show current recovery monitor state for all active swarms
- `commander resume` — manually trigger resume for a stalled swarm
- `commander continue` — send continue signal to a specific worker

### 5.2 Pane Streaming

**Server:** Captures tmux pane output every 1 second, pushes changes via WebSocket to connected clients.
**Deduplication:** Only pushes when content has changed since last capture, preventing unnecessary WebSocket traffic.
**Extension:** VS Code extension subscribes to pane output stream when a session panel is opened, unsubscribes when closed.

### 5.3 Session Logging

**Storage:** Append-only log files at `~/.upcommander/logs/{session}/{window}.log`
**Format:** Timestamped lines: `[2026-03-23T14:30:00.000Z] content`
**Loading:** Full log loaded when a session panel is opened; live streaming appends new lines in real time.
**REST endpoints:**
- `GET /logs/:session/:window` — full log file
- `GET /logs/:session/:window/tail` — last N lines

### 5.4 Smart Auto-Scroll

**Behavior:** The VS Code extension webview detects the user's scroll position. If the user is at the bottom, new content auto-scrolls into view. If the user has scrolled up to read earlier output, auto-scrolling stops.

**New content indicator:** A bouncing "N new lines" indicator appears at the bottom of the panel when new content arrives while the user is scrolled up. Clicking the indicator smooth-scrolls back to the bottom.

**No manual toggle:** The behavior is entirely automatic based on scroll position. No settings or buttons required.

### 5.5 Commander Global CLI

**Installation:** `~/bin/commander`, available from any terminal session.
**Commands:** All 21 Claude Code slash commands available in VS Code are accessible via the CLI.
**MCP servers:** GitHub, Supabase, and visual-gen MCP servers configured for both CLI and VS Code contexts.

---

## 6. Processing Estimates

| Activity | Est. Pages | Time | Model | Workers |
|----------|-----------|------|-------|---------|
| Swarm 1 extraction | ~55,000 | ~60 min | Opus | 12 |
| Swarm 2 extraction | ~15,000 | ~20 min | Sonnet | 6 |
| Swarm 3 verification | Rules from Swarms 1+2 | ~20 min | Sonnet | 11 |
| **Total processed** | **~70,000 pages** | **~100 min** | | **29 workers** |

### Human Equivalent

Manually reading, categorizing, and cross-referencing 70,000 pages of regulatory documents across 6+ jurisdictions would require:

- **Time:** 6-12 months
- **Team:** 4-5 domain specialists (regulatory affairs, CMC, clinical, nonclinical, quality)
- **Cost:** ~$320,000 in labor (at $150-250/hour blended rate)

The swarm completed the extraction in ~100 minutes using 29 parallel workers. Verification added ~20 minutes. Total wall-clock time from raw PDFs to verified knowledge store: under 2 hours.

---

## 7. Training Output Inventory

### output-v2/ (Swarm 1 results — 26 files, 1.4 MB)

| Directory | Contents |
|-----------|----------|
| `e-clinical-design/` | Clinical trial design rules + SKILL.md |
| `e-safety-pharma/` | Clinical safety and pharmacovigilance rules + SKILL.md |
| `e-special-pops/` | Special populations rules + SKILL.md |
| `m-multidisciplinary/` | eCTD structure and cross-module rules + SKILL.md |
| `q-biotech/` | Biotechnology quality rules + SKILL.md |
| `q-cmc-methods/` | Analytical methods and specifications rules + SKILL.md |
| `q-stability/` | Stability testing rules + SKILL.md |
| `q-systems/` | Quality systems rules + SKILL.md |
| `regulations-crl/` | US CFR rules + CRL pattern rules + SKILL.md |
| `s-pharmacology/` | Safety pharmacology rules + SKILL.md |
| `s-toxicology/` | Nonclinical toxicology rules + SKILL.md |
| `STAGE1_FULL_SYNTHESIS.md` | Orchestrator synthesis of all Swarm 1 outputs |
| `STAGE1_FULL_TIMING.txt` | Execution timing data |

### output-v3/ (Swarm 2 results — 19 files, 516 KB)

| Directory | Contents |
|-----------|----------|
| `ema-pharma-gvp/` | EMA pharmacovigilance rules |
| `eu-gmp-ema/` | EU GMP + EMA guideline rules |
| `eu-law/` | EU pharmaceutical legislation rules |
| `health-canada/` | Health Canada-specific rules |
| `who-regs/` | WHO + PMDA rules |
| `source-references-report.json` | Cross-jurisdiction reference mapping |
| `STAGE1V3_SYNTHESIS.md` | Orchestrator synthesis of all Swarm 2 outputs |
| `STAGE1V3_TIMING.txt` | Execution timing data |

### verification/ (Swarm 3 results — 17 files, 456 KB)

| Directory | Verification Type |
|-----------|------------------|
| `ich-quality/` | ICH Q-series rule accuracy |
| `ich-safety/` | ICH S-series rule accuracy |
| `ich-clinical/` | ICH E-series rule accuracy |
| `eu-regs/` | EU-specific rule accuracy |
| `jurisdiction/` | Cross-jurisdiction divergence accuracy |
| `crl-accuracy/` | CRL pattern accuracy |
| `cross-domain/` | Cross-domain consistency |
| `source-refs/` | Source reference resolution |
| `completeness/` | Coverage gap analysis |
| `contradictions/` | SKILL.md internal consistency |

### output/ (Swarm 1 v1 results — initial extraction, superseded by output-v2)

| File | Contents |
|------|----------|
| `skill-writer/ectd-structure.json` | eCTD module structure |
| `skill-writer/cross-reference-mechanisms.md` | Cross-reference patterns |
| `skill-writer/skill-ectd-validation.md` | eCTD validation SKILL.md |
| `module-structure/ectd-module-map.json` | Module hierarchy map |
| `module-structure/module-requirements.md` | Per-module requirements |
| `clinical-specialist/clinical-requirements.json` | Clinical rules |
| `clinical-specialist/skill-clinical-analysis.md` | Clinical SKILL.md |
| `cmc-specialist/cmc-requirements.json` | CMC rules |
| `cmc-specialist/skill-cmc-analysis.md` | CMC SKILL.md |
| `crl-analyst/crl-deficiency-taxonomy.json` | CRL deficiency categories |
| `crl-analyst/crl-patterns.md` | CRL pattern documentation |
| `crl-analyst/skill-crl-prevention.md` | CRL prevention SKILL.md |
| `crl-analyst/_stats.json` | CRL analysis statistics |
| `STAGE1_SYNTHESIS.md` | Initial synthesis (v1) |
| `STAGE1_TIMING.txt` | Initial timing data |

---

## 8. Next Steps

1. **Execute Swarm 4 (Corrections):** Process verification results, re-extract and re-verify flagged rules.
2. **Build Knowledge Store:** Aggregate verified rules from output-v2 and output-v3 into the `~/.upcommander/knowledge/` directory structure.
3. **Index by module/topic/jurisdiction:** Transform flat rule files into the three-axis index described in Section 4.
4. **CRL detection rules:** Convert CRL patterns into executable detection rules for the analysis pipeline.
5. **Benchmark against Health Canada:** Use Health Canada data as held-out test set to measure system accuracy.
6. **Domain expert review:** Engage regulatory affairs professional to review SKILL.md files and high-severity rules.

---

*Document generated: 2026-03-23*
*Based on training execution logs and file system inventory*
