# SEM Sentinel + UpCommander — Fastcomet Integration Spec

**Purpose:** Integrate UpCommander's parallel analysis, cross-reference detection, verification pipeline, and learning system into SEM Sentinel's existing codebase on Fastcomet.

**Approach:** Library import (Option C) — no separate UpCommander server. SEM Sentinel imports UpCommander modules directly and calls them from its existing API routes.

**What changes in SEM Sentinel:** One new file + modifications to the audit route.
**What does NOT change:** Dashboard, auth, Google Ads OAuth, Supabase schema, pricing, client API.

---

## Architecture

```
SEM Sentinel (Fastcomet)
├── Existing (unchanged)
│   ├── Dashboard (Next.js pages)
│   ├── Google Ads OAuth flow
│   ├── Supabase DB (sentinel schema)
│   ├── Skills system (defaults → vertical → account → user)
│   └── API routes (/api/sentinel/*)
│
├── New: UpCommander Library (copied or npm-linked)
│   ├── lib/ingestion.ts         → CSV parsing, chunking
│   ├── lib/api-agent.ts         → Multi-model API execution
│   ├── lib/output-schemas.ts    → FindingSchema, mergeFindings
│   ├── lib/cross-reference.ts   → Entity extraction, conflict detection
│   ├── lib/verification.ts      → 5-stage finding validation
│   ├── lib/reports.ts           → CFO/PPC report generation
│   ├── lib/budget.ts            → Per-audit cost tracking
│   ├── lib/memory.ts            → Cross-audit learning
│   └── lib/connectors/sentinel-bridge.ts → CSV → SemDataRow, Finding → SentinelFinding
│
└── New: Integration Layer
    └── lib/sentinel/parallel-runner.ts  → Orchestrates parallel execution
```

---

## Step 1: Copy UpCommander modules into SEM Sentinel

Copy the following files from UpCommander's `src/lib/` into SEM Sentinel's `src/lib/commander/` directory:

```
src/lib/commander/
├── api-agent.ts
├── output-schemas.ts
├── cross-reference.ts
├── verification.ts
├── reports.ts
├── budget.ts
├── memory.ts
├── memory-context.ts
├── memory-backend.ts
├── connectors/
│   ├── base.ts
│   └── sentinel-bridge.ts
└── templates/
    └── sem-audit.ts
```

Update import paths in copied files: change `'./foo.js'` to `'./foo'` if SEM Sentinel uses a different module resolution (Next.js typically uses `moduleResolution: "node"` or `"bundler"` without .js extensions).

No changes to the module logic — only import path adjustments.

---

## Step 2: Create the parallel runner

Create `src/lib/sentinel/parallel-runner.ts` — this is the single new file that replaces sequential execution with parallel.

```typescript
/**
 * SEM Sentinel — Parallel Audit Runner
 *
 * Replaces sequential agent pipeline with parallel execution
 * using UpCommander's API agent and analysis modules.
 */

import { parseSemCsv, distributeDataToWorkers, formatFindingsForSentinel } from '../commander/connectors/sentinel-bridge';
import { ApiAgent } from '../commander/api-agent';
import { mergeFindings, createFinding, type Finding } from '../commander/output-schemas';
import { extractEntities, CrossReferenceGraph } from '../commander/cross-reference';
import { runVerification, getVerificationSummary } from '../commander/verification';
import { generateReport } from '../commander/reports';
import { MODEL_PRESETS } from '../commander/templates/sem-audit';

// Worker definitions — matches sem-audit template
const WORKERS = [
  { name: 'waste-hunter', model: MODEL_PRESETS['sonnet'], taskPrefix: 'Analyze for zero-conversion spend...' },
  { name: 'cannibal-detector', model: MODEL_PRESETS['sonnet'], taskPrefix: 'Find keywords bid across multiple campaigns...' },
  { name: 'trend-analyst', model: MODEL_PRESETS['haiku'], taskPrefix: 'Identify historical performance patterns...' },
  { name: 'pmax-auditor', model: MODEL_PRESETS['sonnet'], taskPrefix: 'Audit Performance Max campaigns...' },
  { name: 'opportunity-mapper', model: MODEL_PRESETS['haiku'], taskPrefix: 'Find missed keyword opportunities...' },
  { name: 'decision-differ', model: MODEL_PRESETS['sonnet'], taskPrefix: 'Correlate account changes with performance...' },
];

interface ParallelAuditResult {
  findings: Finding[];
  sentinelFindings: SentinelFinding[];
  crossRefSummary: CrossRefSummary;
  verificationSummary?: VerificationSummary;
  report: string;
  cost: { total_usd: number; by_worker: Record<string, number> };
  duration_ms: number;
}

/**
 * Run a parallel SEM audit on a CSV file or pre-parsed data.
 */
export async function runParallelAudit(
  csvPath: string,
  options: {
    accountName: string;
    skillConfig?: Record<string, unknown>;  // resolved skill config
    verify?: boolean;                        // run verification (default: true)
    verifyFull?: boolean;                    // all 5 stages (default: false, stages 1-3)
    budgetUsd?: number;                      // budget cap
  }
): Promise<ParallelAuditResult> {
  const start = Date.now();

  // 1. Parse CSV
  const data = await parseSemCsv(csvPath);

  // 2. Distribute to workers
  const packages = distributeDataToWorkers(data, WORKERS.map(w => w.name));

  // 3. Execute all workers in parallel
  const workerPromises = WORKERS.map(async (worker) => {
    const pkg = packages.find(p => p.worker === worker.name);
    if (!pkg || pkg.data.length === 0) return [];

    const agent = new ApiAgent({
      model: worker.model,
      systemPrompt: getWorkerSystemPrompt(worker.name, options.skillConfig),
      maxRetries: 3,
      timeoutMs: 120000,
    });

    const response = await agent.execute(
      formatDataAsTask(worker.name, pkg.data, pkg.task_description)
    );

    return parseFindingsFromResponse(response.content, worker.name);
  });

  const workerResults = await Promise.all(workerPromises);

  // 4. Merge findings
  const merged = mergeFindings(workerResults);

  // 5. Cross-reference detection
  const graph = new CrossReferenceGraph();
  for (const finding of merged) {
    const entities = extractEntities(
      finding.description + ' ' + finding.evidence_chain.map(e => e.excerpt).join(' '),
      'sem'
    );
    for (const entity of entities) {
      graph.addEntity(entity);
    }
  }
  const crossRefSummary = graph.getSummary();

  // 6. Verification (optional)
  let verificationSummary;
  if (options.verify !== false) {
    const stages = options.verifyFull ? [1, 2, 3, 4, 5] : [1, 2, 3];
    const results = runVerification(merged, {
      stages: stages as any,
      domain: 'sem',
      escalateDisagreements: true,
    });
    verificationSummary = getVerificationSummary(results);
  }

  // 7. Generate report
  const report = generateReport(merged, {
    format: 'html',
    type: 'domain-specific',
    domain: 'sem',
    title: `SEM Audit — ${options.accountName}`,
    includeEvidence: true,
    includeCrossRefs: true,
    includeVerification: !!verificationSummary,
  });

  // 8. Convert to Sentinel format
  const sentinelFindings = formatFindingsForSentinel(merged);

  return {
    findings: merged,
    sentinelFindings,
    crossRefSummary,
    verificationSummary,
    report: report.content,
    cost: { total_usd: 0, by_worker: {} }, // filled from agent responses
    duration_ms: Date.now() - start,
  };
}
```

Include helper function signatures:
- `getWorkerSystemPrompt(workerName: string, skillConfig?: Record<string, unknown>): string` — builds the system prompt from the sem-audit template's CLAUDE.md + resolved skill config
- `formatDataAsTask(workerName: string, data: SemDataRow[], taskDescription: string): string` — formats the CSV data rows as a task prompt for the worker
- `parseFindingsFromResponse(responseText: string, workerName: string): Finding[]` — parses the agent's JSON response into Finding objects

---

## Step 3: Modify the audit API route

File: `src/app/api/sentinel/audit/route.ts`

The existing route handles CSV upload and runs sequential analysis. Modify it to:

```typescript
// Existing: sequential execution
// const wasteFindings = await runWasteHunter({ auditRunId, clientId });
// const cannibalFindings = await runCannibalDetector({ auditRunId, clientId });
// ...

// New: parallel execution
import { runParallelAudit } from '@/lib/sentinel/parallel-runner';

const result = await runParallelAudit(csvFilePath, {
  accountName: account.name,
  skillConfig: resolvedSkill,  // from existing skill resolver
  verify: true,
  budgetUsd: 5.00,
});

// Store findings in Supabase (existing pattern)
for (const finding of result.sentinelFindings) {
  await supabase
    .from('sentinel.findings')
    .insert({
      audit_run_id: auditRunId,
      account_id: accountId,
      type: finding.type,
      severity: finding.severity,
      title: finding.title,
      dollar_impact: finding.dollar_impact,
      details: finding,
    });
}
```

The rest of the route (auth, file upload handling, response formatting) stays the same.

---

## Step 4: Environment variables

Add to Fastcomet's environment:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Optional (for multi-model verification):
```
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=AIza...
```

The API agent reads these from environment variables as a fallback when `~/.upcommander/config.json` doesn't exist.

---

## Step 5: Skill config → SKILL.md mapping

SEM Sentinel's skill resolver already produces a merged config object. Map it to the format the API agent expects:

```typescript
function skillConfigToPrompt(skill: ResolvedSkill): string {
  return `
## Thresholds
- Minimum spend to flag: $${(skill.agent_config?.waste_hunter?.min_spend_threshold_cents ?? 5000) / 100}
- Critical threshold: $${(skill.agent_config?.waste_hunter?.zero_conv_critical_threshold_cents ?? 50000) / 100}
- Exclude brand terms: ${skill.account_context?.brand_terms?.join(', ') ?? 'none'}
- Exclude terms under ${skill.agent_config?.waste_hunter?.exclude_terms_under_days ?? 0} days

## Business Context
- Company: ${skill.business_profile?.company_name ?? 'Unknown'}
- Industry: ${skill.business_profile?.industry ?? 'Unknown'}
- Target CPA: $${(skill.account_context?.target_cpa_cents ?? 0) / 100}
- Products: ${skill.business_profile?.products_services?.map(p => p.name).join(', ') ?? 'Unknown'}
  `.trim();
}
```

This function is called by `getWorkerSystemPrompt()` in the parallel runner.

---

## Step 6: Memory/learning persistence

SEM Sentinel uses Supabase. UpCommander uses local JSON files. For Fastcomet, store learnings in Supabase instead:

Option A (simple): Store learnings in a new `sentinel.learnings` table
Option B (quick): Use UpCommander's memory.ts with the file system (Fastcomet VPS has persistent disk)

Recommendation: Option B for initial launch (no schema changes needed), migrate to Option A when you want learnings queryable from the dashboard.

---

## Step 7: Testing the integration

1. Upload a test CSV through SEM Sentinel's existing upload flow
2. Verify the parallel runner executes (check server logs for 6 parallel API calls)
3. Verify findings appear in the dashboard with dollar_impact values
4. Compare findings against a sequential audit of the same data — should be identical or better (cross-references catch things sequential misses)
5. Check cost: should be ~$2-3 per audit

---

## What SEM Sentinel gains

| Capability | Before (Sequential) | After (Parallel) |
|-----------|---------------------|-------------------|
| Audit time | 15-30 min | 3-5 min |
| Cross-agent finding connections | None | Automatic (cross-reference engine) |
| Finding verification | None | 3-stage (or 5-stage for premium) |
| False positive detection | None | Peer review catches contradictions |
| Report formats | Basic markdown | HTML, executive summary, CFO-ready |
| Cost tracking | None | Per-audit, per-worker, with projections |
| Learning across audits | None | Facts, learnings, failures persist |
| Multi-account concurrency | 1 at a time | Limited by API rate limits (10+) |

---

## Files to create/modify in SEM Sentinel

| Action | File | Description |
|--------|------|-------------|
| CREATE | `src/lib/commander/` (directory) | Copy of UpCommander lib modules |
| CREATE | `src/lib/sentinel/parallel-runner.ts` | New parallel execution orchestrator |
| MODIFY | `src/app/api/sentinel/audit/route.ts` | Replace sequential with parallel call |
| MODIFY | `.env` | Add ANTHROPIC_API_KEY |

That's it — 1 new directory (copied), 1 new file, 1 modified route, 1 env var.

---

*Integration spec written: 2026-03-22*
*Source: UpCommander v2 at /Users/gregorybibas/.gemini/antigravity/scratch/UpCommander/*
