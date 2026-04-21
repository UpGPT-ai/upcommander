# UpCommander — Agent Rules

This repo ships the tooling that implements the rules below. When working inside it, follow them yourself — eat our own dog food.

See [BENCHMARKS.md](./BENCHMARKS.md) for the empirical evidence behind each rule.

---

## Rule 1 — Write the CONTRACT first

For any task touching 3+ files, generate a CONTRACT.md **before** writing code. The contract specifies:

- Exact TypeScript interfaces
- Exact DB columns and SQL conventions (`CREATE TABLE IF NOT EXISTS`, no `DROP POLICY`)
- Exact import paths
- Exact API response format
- Explicit non-goals

Proven −54% cost, −60% time, quality 5 → 9/10 on N=20. Skip only for single-file tasks where overhead exceeds savings.

---

## Rule 2 — Drill the codebase index: L0 → L1 → L2

Before any multi-file task, **read `.codebase-index-l0.json` first**.

| Level | File | Read when |
|---|---|---|
| L0 | `.codebase-index-l0.json` (~18KB) | Always first — identifies modules |
| L1 | `.codebase-index/<slug>.json` (2–3KB) | Per module the task touches — exact signatures |
| L2 | raw source file | Only when implementation behavior (not just shape) matters |

**Never use Glob or Grep for codebase structure discovery when the index exists.** Use them only for targeted string verification inside a known file.

Empirical tradeoff (N=1 directional): L1-only context scores 7.7/10 at $1.59; L0+raw-file context scores 8.7/10 at $2.67. L1 is great for well-scoped tasks; drop to L2 when integration correctness matters.

### Keeping the index fresh

The pre-commit hook regenerates on every `src/` change. Manual regeneration:

```bash
npx tsx scripts/generate-codebase-index-tree.ts
```

---

## Rule 3 — Model routing

- **Sonnet** writes contracts and makes design decisions.
- **Haiku** implements against a well-formed contract.
- **Opus** grades and reviews — not for primary implementation.

Never let Haiku author contracts for multi-file work. Quality collapse from 7.9 → 4.9/10 on N=3.

---

## Rule 4 — Orchestration mode

Default: **sequential**. Sequential workers share the warm prompt cache (98% read hit measured). Upgrade only when wall-clock is the binding constraint.

| Mode | When | Cache | Cost |
|---|---|---|---|
| Sequential | 1–5 files, coupled work, large codebase | Excellent | Cheapest |
| Staggered (60s gaps) | 3–8 independent files, quality matters | Good | ~60% of parallel |
| Parallel | 6+ truly independent files | Poor | Most expensive |

For staggered/parallel: run one primer call to warm cache before launching workers.

---

## Rule 5 — No retry loops, no extra review pass

Retry loops degrade quality (9 → 6/10) because models regenerate whole files, losing correct sections. Don't build them. Don't use them.

One-shot Opus review adds zero quality when the contract is good (+56% cost for 0 pt gain). Write a better brief; don't pay for a review.

---

## Rule 6 — Never Agent Teams for cost-sensitive work

Anthropic Agent Teams cost 73–124% more than sequential execution at equivalent quality. Each agent loads the full codebase context independently. Use sequential UpCommander instead.
