# SEM Sentinel ↔ UpCommander Integration Spec

**Date:** 2026-03-22
**Deployment:** SEM Sentinel on Fastcomet, UpCommander modules imported as library
**Approach:** Option C — library import, no separate server process

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Fastcomet VPS                                          │
│                                                         │
│  SEM Sentinel (Next.js)                                 │
│  ├── Existing: Dashboard, Auth, Google Ads OAuth        │
│  ├── Existing: Supabase (sentinel.findings, etc.)       │
│  ├── Existing: Skill system (defaults → vertical →      │
│  │             account → user)                          │
│  │                                                      │
│  ├── NEW: lib/sentinel/parallel-runner.ts               │
│  │   └── Imports UpCommander modules:              │
│  │       ├── ingestion.ts    (CSV parsing + chunking)   │
│  │       ├── api-agent.ts    (parallel API execution)   │
│  │       ├── output-schemas.ts (FindingSchema)          │
│  │       ├── cross-reference.ts (entity detection)      │
│  │       ├── verification.ts (3-stage for SEM)          │
│  │       ├── reports.ts      (CFO/PPC reports)          │
│  │       ├── budget.ts       (cost tracking per audit)  │
│  │       └── memory.ts       (learning across audits)   │
│  │                                                      │
│  └── Existing: Store findings → sentinel.findings       │
│                                                         │
│  ↕ API calls to:                                        │
│  Anthropic (Claude Sonnet/Haiku for workers)            │
│  OpenAI (optional cross-provider verification)          │
└─────────────────────────────────────────────────────────┘
```

**What does NOT change in SEM Sentinel:**
- Dashboard, auth, Google Ads OAuth — unchanged
- Database schema (`sentinel.findings`, `sentinel.audit_runs`, etc.) — unchanged
- Skill system (4-layer inheritance) — unchanged
- Client-facing API routes — unchanged
- Pricing tiers — unchanged

**What does NOT change in UpCommander:**
- Nothing. Its modules are general-purpose libraries.

---

## Integration File: `lib/sentinel/parallel-runner.ts`

This is the single new file in SEM Sentinel that replaces the sequential agent pipeline with parallel execution.

### Interface

```typescript
import { parseSemCsv, distributeDataToWorkers, formatFindingsForSentinel } from 'upcommander/connectors/sentinel-bridge';
import { ApiAgent } from 'upcommander/api-agent';
import { mergeFindings } from 'upcommander/output-schemas';
import { CrossReferenceGraph } from 'upcommander/cross-reference';
import { runVerification } from 'upcommander/verification';
import { recordCost } from 'upcommander/budget';

export interface ParallelAuditConfig {
  auditRunId: string;
  accountId: string;
  clientId: string;
  csvPath: string;              // path to Google Ads search term CSV
  skill: ResolvedSkill;         // merged skill config from Sentinel's skill system
  budget?: number;              // optional cost cap in USD
  verificationLevel?: 1 | 2 | 3; // default 3 for SEM
}

export interface ParallelAuditResult {
  findings: SentinelFinding[];  // Sentinel-native format, ready for DB insert
  crossReferences: CrossRefSummary;
  cost: { total_usd: number; by_worker: Record<string, number> };
  duration_ms: number;
  workers: { name: string; model: string; findings_count: number; cost_usd: number }[];
}
```

### Execution Flow

```typescript
export async function runParallelAudit(config: ParallelAuditConfig): Promise<ParallelAuditResult> {
  const startTime = Date.now();

  // 1. Parse CSV into structured rows
  const rows = await parseSemCsv(config.csvPath);

  // 2. Distribute data to workers (each gets specialized subset)
  const workerPackages = distributeDataToWorkers(rows);

  // 3. Convert Sentinel skill config → SKILL.md content per worker
  const skillMds = convertSkillToSkillMd(config.skill);

  // 4. Build CLAUDE.md prompts per worker (from sem-audit template)
  const workerConfigs = buildWorkerConfigs(workerPackages, skillMds, config);

  // 5. Execute all workers IN PARALLEL via API
  const agents = workerConfigs.map(wc =>
    new ApiAgent({
      model: wc.model,           // sonnet for analysis, haiku for triage
      systemPrompt: wc.claudeMd, // role definition
      skillPrompt: wc.skillMd,   // domain-specific thresholds from Sentinel skills
    })
  );

  const results = await Promise.all(
    agents.map((agent, i) => agent.execute(workerConfigs[i].task))
  );

  // 6. Parse structured findings from each worker's output
  const allFindings = results.flatMap(r => parseFindings(r.content));

  // 7. Cross-reference detection
  const xrefGraph = new CrossReferenceGraph();
  for (const finding of allFindings) {
    xrefGraph.addFromFinding(finding);
  }
  const conflicts = xrefGraph.findConflicts();

  // 8. Merge and deduplicate findings (80% word overlap = duplicate)
  const merged = mergeFindings(allFindings);

  // 9. Verification (stages 1-3 for SEM)
  const verified = await runVerification(merged, {
    stages: config.verificationLevel ?? 3,
    model: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  });

  // 10. Convert to Sentinel-native format
  const sentinelFindings = formatFindingsForSentinel(verified);

  // 11. Track cost
  const totalCost = results.reduce((sum, r) => sum + r.usage.cost_usd, 0);

  return {
    findings: sentinelFindings,
    crossReferences: xrefGraph.getSummary(),
    cost: {
      total_usd: totalCost,
      by_worker: Object.fromEntries(
        results.map((r, i) => [workerConfigs[i].name, r.usage.cost_usd])
      ),
    },
    duration_ms: Date.now() - startTime,
    workers: results.map((r, i) => ({
      name: workerConfigs[i].name,
      model: r.model,
      findings_count: parseFindings(r.content).length,
      cost_usd: r.usage.cost_usd,
    })),
  };
}
```

### Skill → SKILL.md Conversion

SEM Sentinel's 4-layer skill system (defaults → vertical → account → user) resolves to a single `ResolvedSkill` object. This function converts it to SKILL.md content that UpCommander workers understand:

```typescript
function convertSkillToSkillMd(skill: ResolvedSkill): Record<string, string> {
  return {
    'waste-hunter': `
# Waste Detection Skill

## Thresholds
- Minimum spend to flag: $${(skill.agent_config?.waste_hunter?.min_spend_threshold_cents ?? 5000) / 100}
- Critical waste threshold: $${(skill.agent_config?.waste_hunter?.zero_conv_critical_threshold_cents ?? 50000) / 100}
- High waste threshold: $${(skill.agent_config?.waste_hunter?.zero_conv_high_threshold_cents ?? 10000) / 100}
- Exclude brand terms: ${skill.agent_config?.waste_hunter?.exclude_brand_terms ?? false}
- Exclude terms under ${skill.agent_config?.waste_hunter?.exclude_terms_under_days ?? 0} days old

## Brand Terms to Exclude
${(skill.account_context?.brand_terms ?? []).map(t => '- "' + t + '"').join('\n')}

## Business Context
- Company: ${skill.business_profile?.company_name ?? 'Unknown'}
- Industry: ${skill.business_profile?.industry ?? 'Unknown'}
- Target CPA: $${(skill.account_context?.target_cpa_cents ?? 0) / 100}
`,
    'cannibal-detector': `
# Cannibalization Detection Skill

## Rules
- Flag keywords appearing in 2+ campaigns with >20% CPC variance
- Calculate wasted spend from CPC inflation due to self-competition
- Identify which campaign should own each keyword based on historical performance

## Business Context
- Products/Services: ${(skill.business_profile?.products_services ?? []).map(p => p.name).join(', ')}
`,
    // ... similar for trend-analyst, pmax-auditor, opportunity-mapper, decision-differ
  };
}
```

### Worker Model Assignment (SEM Template)

```
waste-hunter       → sonnet   (nuanced spend analysis)
cannibal-detector  → sonnet   (cross-campaign pattern detection)
trend-analyst      → haiku    (statistical pattern scan — speed over depth)
pmax-auditor       → sonnet   (Smart Bidding verification)
opportunity-mapper → haiku    (keyword gap scanning — high volume)
decision-differ    → sonnet   (historical correlation analysis)
orchestrator       → sonnet   (synthesis and deduplication)
```

---

## Integration into SEM Sentinel's Existing Audit Route

### Current Route (Sequential)

```typescript
// Current: /api/sentinel/audit/route.ts
export async function POST(req: NextRequest) {
  const { accountId, clientId } = await req.json();

  // Sequential execution — each waits for the previous
  const wasteFindings = await runWasteHunter({ auditRunId, clientId });
  const cannibalFindings = await runCannibalDetector({ auditRunId, clientId });
  const trendFindings = await runTrendAnalyst({ auditRunId, clientId });
  // ... etc

  // Store findings
  await supabase.from('sentinel.findings').insert(allFindings);
}
```

### Updated Route (Parallel)

```typescript
// Updated: /api/sentinel/audit/route.ts
import { runParallelAudit } from '@/lib/sentinel/parallel-runner';

export async function POST(req: NextRequest) {
  const { accountId, clientId, csvPath } = await req.json();

  // Resolve skill config (existing Sentinel logic — unchanged)
  const skill = await resolveSkill(clientId);

  // Run parallel audit via UpCommander modules
  const result = await runParallelAudit({
    auditRunId: crypto.randomUUID(),
    accountId,
    clientId,
    csvPath,
    skill,
    verificationLevel: 3,
  });

  // Store findings in existing Sentinel DB (unchanged schema)
  await supabase.from('sentinel.findings').insert(result.findings);

  // Store audit metadata
  await supabase.from('sentinel.audit_runs').update({
    cost_usd: result.cost.total_usd,
    duration_ms: result.duration_ms,
    findings_count: result.findings.length,
    workers: result.workers,
  }).eq('id', auditRunId);

  return NextResponse.json({
    findings_count: result.findings.length,
    cost_usd: result.cost.total_usd,
    duration_ms: result.duration_ms,
    cross_references: result.crossReferences,
  });
}
```

---

## Learning System Integration

After each audit, findings and performance data feed back into UpCommander's memory system:

```typescript
// After audit completes, record learnings
import { saveFact, saveLearning } from 'upcommander/memory';

// Record domain fact
if (result.findings.some(f => f.type === 'wasted_spend' && f.severity === 'critical')) {
  await saveFact({
    fact: `Account ${accountId}: critical waste detected, ${result.findings.filter(f => f.type === 'wasted_spend').length} waste findings`,
    domain: 'sem',
    project: clientId,
    source: `audit-${auditRunId}`,
  });
}

// Record performance for model optimization
import { recordTaskCompletion } from 'upcommander/performance';

for (const worker of result.workers) {
  await recordTaskCompletion(worker.name, result.duration_ms / 60000, false, 8);
}
```

---

## Deployment Steps on Fastcomet

### Prerequisites

- Fastcomet VPS (not shared hosting) — needs Node.js 20+
- `ANTHROPIC_API_KEY` set in environment

### Step 1: Add UpCommander as a dependency

```bash
# Option A: npm package (when published)
cd /path/to/sem-sentinel
npm install upcommander

# Option B: Git submodule (before publishing)
git submodule add https://github.com/antigravity/upcommander.git lib/upcommander
```

### Step 2: Add the integration file

Create `lib/sentinel/parallel-runner.ts` with the code from this spec.

### Step 3: Update the audit route

Replace the sequential execution in `/api/sentinel/audit/route.ts` with the `runParallelAudit()` call.

### Step 4: Add API key configuration

```bash
# In Fastcomet environment variables (or .env.local)
ANTHROPIC_API_KEY=sk-ant-...
```

### Step 5: Test with a CSV

Upload a test CSV via the existing SEM Sentinel upload route. The parallel-runner executes 6 workers simultaneously. Check `sentinel.findings` table for results.

---

## Cost Model per Audit

| Account Size | Rows | Workers | Est. Cost | Est. Time |
|---|---|---|---|---|
| Small (<10K terms) | <10,000 | 6 | $0.15-0.30 | 30-60s |
| Medium (10K-100K) | 10,000-100,000 | 6 | $0.30-0.80 | 1-3 min |
| Large (100K-1M) | 100,000-1,000,000 | 6 | $0.80-2.50 | 3-5 min |
| Enterprise (1M+) | 1,000,000+ | 6 + chunking | $2.50-8.00 | 5-10 min |

At agency tier (10 accounts/day): $3-25/day in API costs.

---

## Multi-Account Agency Mode

For agency clients running 10+ accounts:

```typescript
// Run 10 accounts simultaneously
const results = await Promise.all(
  accountCsvPaths.map(acct => runParallelAudit({
    auditRunId: crypto.randomUUID(),
    accountId: acct.accountId,
    clientId,
    csvPath: acct.csvPath,
    skill: resolvedSkill,
  }))
);

// Cross-account cannibalization detection
const crossAccountGraph = new CrossReferenceGraph();
for (const result of results) {
  crossAccountGraph.mergeFrom(result.crossReferences);
}
const crossAccountConflicts = crossAccountGraph.findConflicts();
// → "keyword 'ed treatment' in Account 1 AND Account 3 — cannibalizing"
```

---

## What This Enables

| Capability | Before (Sequential) | After (Parallel + UpCommander) |
|---|---|---|
| Audit speed | 15-30 min/account | 1-5 min/account |
| Account concurrency | 1 at a time | 10+ simultaneous |
| Cross-account intelligence | Not possible | Keyword cannibalization across accounts |
| Finding verification | None | 3-stage verification pipeline |
| Evidence chains | Text descriptions | Structured: CSV row → finding → recommendation |
| Cost tracking | Not tracked | Per-audit, per-worker, per-model |
| Learning across audits | None | Facts, learnings, failures persisted |
| Model optimization | Single model | Mixed (sonnet for analysis, haiku for scanning) |
| Cross-worker patterns | Not possible | Entity graph detects linked findings |

---

*Spec written: 2026-03-22*
*For SEM Sentinel deployment on Fastcomet VPS*
