# UpCommander

Multi-agent AI coding orchestrator. Reduce cost 85% and raise quality from 5/10 to 9/10 — validated across 52+ controlled benchmark runs.

**The core insight:** What you tell the AI before it starts matters more than the model, tool, or parallelism. UpCommander generates a structured brief (CONTRACT.md) before any worker touches code. That single change accounts for 54% of the total cost reduction.

---

## Benchmark Results

| Approach | Cost | Quality |
|----------|------|---------|
| Naive baseline (no optimization) | $5.45 | 5/10 |
| + CONTRACT.md brief | $2.51 | 9/10 |
| + AST index compression | $0.85 | 9/10 |
| + Haiku orchestrator | **$0.83** | **9/10** |

**-85% cost. Quality from 5/10 to 9/10.** Same model (Sonnet 4.6). Just better scaffolding.

Full methodology: [UpCommander Benchmark Blog Post](https://upgpt.ai/blog/upcommander-benchmarks) | Benchmark data: [`evaluations/`](https://github.com/UpGPT-ai/upcommander/tree/main/evaluations)

---

## Quickstart

### Prerequisites

- Node.js 18+
- `npx tsx` available (`npm install -g tsx` or use `npx tsx` directly)
- Anthropic API key

### BYOK Setup

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Or save it permanently:
```bash
mkdir -p ~/.claude-commander
echo '{"apiKeys":{"anthropic":"sk-ant-..."}}' > ~/.claude-commander/config.json
```

### Run a task

```bash
# Generate contract + execute K2 worker (Sonnet 4.6)
npx tsx src/lib/upcommander/cli.ts run "add pagination to the notes API"

# Same + V2O quality review with Opus after
npx tsx src/lib/upcommander/cli.ts run "add pagination to the notes API" --quality

# Generate CONTRACT.md only (to review before running)
npx tsx src/lib/upcommander/cli.ts contract "add pagination to the notes API"

# Regenerate the codebase index
npx tsx src/lib/upcommander/cli.ts index

# Quality review on specific files
npx tsx src/lib/upcommander/cli.ts review src/app/api/notes/route.ts
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      cli.ts                              │
│   run | contract | index | review                       │
└───────────────────────┬─────────────────────────────────┘
                        │
          ┌─────────────▼──────────────┐
          │   index-connector/         │  ← reads .codebase-index/
          │   loadIndexContext(L0/L1)  │    L0=2K tokens, L1=8K tokens
          │   buildSystemPrompt()      │    91% compression vs raw files
          └─────────────┬──────────────┘
                        │
          ┌─────────────▼──────────────┐
          │   workers/recipe-runner.ts │  ← assembles system prompt
          │   runRecipe(K2_SOLO)       │    then calls ApiAgent
          └─────────────┬──────────────┘
                        │
          ┌─────────────▼──────────────┐
          │   api-agent.ts             │  ← multi-provider HTTP client
          │   Anthropic / OpenAI /     │    with streaming + retry
          │   Google / OpenRouter      │
          └────────────────────────────┘

Optional quality pass:
          ┌──────────────────────────────┐
          │   quality-review/            │  ← V2O: Opus one-shot review
          │   reviewFiles()              │    NO retry loop
          └──────────────────────────────┘

Optional orchestration:
          ┌──────────────────────────────┐
          │   ephemeral/                 │  ← Haiku orchestrator (-96% cost)
          │   startEphemeralTurn()       │    for multi-session workflows
          └──────────────────────────────┘
```

### Key modules

| Module | Purpose | Token cost |
|--------|---------|-----------|
| `index-connector/` | L0/L1/L2 codebase index reader | L0=~2K, L1=~8K |
| `workers/k2-solo.ts` | Default strategy: Sonnet + CONTRACT + L1 index | ~0.08/run |
| `workers/pipeline-3tier.ts` | High-stakes: Opus contract → DeepSeek impl → Sonnet review | ~5× K2 |
| `quality-review/` | V2O one-shot Opus review (no retry) | ~$0.15-0.50 |
| `ephemeral/` | Haiku orchestrator, $0.0077/turn vs $0.20 Sonnet | -96% orch cost |
| `orchestrator.ts` | Hot-reloadable routing rules (routing-rules.json) | — |
| `ast-summary/` | SHA-cached tree-sitter file summaries | -91% per-file tokens |

---

## What NOT to do

These are the most common mistakes — all empirically validated as harmful:

**1. Agent Teams (parallel workers)**
73–124% more expensive than sequential. Every agent loads the full codebase context independently. Three agents = three copies of your 21K-token CLAUDE.md. Never use unless wall-clock time has direct dollar value.

**2. Retry loops (self-evolution)**
When a model retries, it doesn't make surgical edits. It regenerates entire files. Fixing a broken import path means rewriting the whole route file — and losing all the CRUD endpoints that were correct the first time. Proved across 15 retry attempts in 3 runs. Quality degraded from 9/10 → 6/10 on retries. Use a one-shot Opus quality review instead.

**3. Skipping the contract on multi-file tasks**
For any task touching 3+ files, the CONTRACT.md costs ~$0.15 to generate and saves 47–54% on the task cost. Paid back on the first run, every time.

---

## Routing Logic

`routing-rules.json` controls which strategy runs for which task type. Hot-reloaded without app restart.

```json
{
  "default_strategy": "k2",
  "routing_rules": [
    { "condition": "task.file_count >= 3 && task.is_greenfield", "strategy": "k2" },
    { "condition": "task.type === 'high_stakes'", "strategy": "pipeline" }
  ]
}
```

### Strategies

| Strategy | When | Cost |
|----------|------|------|
| `k2` | Default — 1-5 files, cost-optimal | ~$0.08/run |
| `pipeline` | High-stakes, >$0.50 estimated | ~5× K2 |
| `sonnet_raw` | Single-file trivial fixes only | baseline |
| `opus_raw` | Architecture review, no scaffolding | expensive |

---

## Adding Worker Recipes

Drop a new file in `workers/` and reference it in `routing-rules.json`:

```typescript
// workers/my-recipe.ts
import type { WorkerRecipe } from './types';

export const MY_RECIPE: WorkerRecipe = {
  name: 'my-recipe',
  role: 'solo',
  model: 'claude-sonnet-4-6',
  system_prompt_parts: [
    { type: 'karpathy' },
    { type: 'index', level: 'L1' },
    { type: 'contract', path: 'CONTRACT.md' },
    { type: 'raw', content: 'Additional instructions...' },
  ],
  index_level: 'L1',
  max_tokens: 8192,
  budget_usd: 0.30,
};
```

---

## Programmatic API

```typescript
import {
  loadIndexContext,
  buildSystemPrompt,
  reviewFiles,
  runRecipe,
  K2_SOLO_WORKER,
} from './src/lib/upcommander';

// Load codebase context
const ctx = loadIndexContext('/path/to/repo', 'L1');
console.log(`${ctx.tokenEstimate} tokens`);

// Run a task
const result = await runRecipe(K2_SOLO_WORKER, 'add pagination to notes API', '/path/to/repo', {
  contractPath: '.claude-coord/CONTRACT.md',
  streamChunk: chunk => process.stdout.write(chunk),
});

// Quality review
const review = await reviewFiles({
  contractPath: '.claude-coord/CONTRACT.md',
  files: ['src/app/api/notes/route.ts'],
  repoPath: '/path/to/repo',
});
console.log(`Score: ${review.overallScore}/10`);
```

---

## Cost Benchmarks (N=52+ runs)

All results on Sonnet 4.6 against a real production codebase (Next.js / TypeScript / Supabase). Your numbers will differ — the directions hold, the magnitudes are setup-specific.

Full tables and methodology: [BENCHMARKS.md](./BENCHMARKS.md).

| Condition | ACs met | Quality | Cost |
|-----------|---------|---------|------|
| V1: Vague brief | 2/5 | 5/10 | $0.91 |
| V2: CONTRACT.md | 3.3/5 | 9/10 | $0.69 |
| NS: CONTRACT + retry loop | 4/5 | 6/10 | $1.40 |
| V2O: CONTRACT + Opus review | 4/5 | 9.5/10 | $1.22 |

Key findings:
- **Retry loops degrade quality** (9 → 6/10). Model regenerates whole files while fixing one issue.
- **Cross-model Opus review** improves vs same-model retry (+2.5 pts) but both worse than V2 alone on cost/quality ratio.
- **V2O (one-shot review, no retry)** is the right pattern: $0.69 generation + $0.15 review = $0.84 for 9.5/10 quality.
- **Haiku implements, Sonnet authors.** Haiku matches Sonnet quality *only* when implementing a Sonnet-written contract (7.9/10, N=3). When Haiku writes the contract itself, quality collapses to 4.9/10. Never let the cheaper model author contracts for multi-file work.
- **Drill the index: L0 → L1 → L2.** L0 (~18KB, always loaded) identifies modules. L1 (2–3KB each) gives per-module signatures. L2 is raw source, opened only when behavior matters. Sequential workers hit ~98% cache read on repeated context.
- **L1 for discovery, L2 for integration (N=1 directional).** L0 + targeted raw files scored 8.7/10 quality / 9.0 integration; L0 + L1-only scored 7.7/10 / 8.0 integration at 40% lower cost and 42% less time. L1 captures shape; drop to L2 when integration correctness matters. Full N=5 rerun queued.

See [BENCHMARKS.md](./BENCHMARKS.md) for complete tables.

---

## License

MIT — open-source, BYOK, no telemetry.

Built by [UpGPT](https://upgpt.ai). Questions: [hello@upgpt.ai](mailto:hello@upgpt.ai)
