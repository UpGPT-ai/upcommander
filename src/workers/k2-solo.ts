/**
 * K2 Solo Worker — Sonnet 4.6 + Karpathy + CONTRACT
 *
 * Benchmark V3 winner: 53/60 quality at ~$0.08/run.
 * Use for single-agent tasks (1-3 files). Default strategy.
 */

import type { WorkerRecipe } from './types';

const V3_OUTPUT_DISCIPLINE = `## Output Discipline (V3)

Write ONLY code. No preamble, no explanation, no "here's what I did" summary.
For each file you create or modify, output the complete final file wrapped in a code fence with the file path:
\`\`\`typescript path/to/file.ts
<full file content>
\`\`\`

Do not emit partial files. Do not emit the same file twice. Do not emit files you did not change.
If a file requires no changes, do not include it in your output.`;

export const K2_SOLO_WORKER: WorkerRecipe = {
  name: 'k2-solo',
  role: 'solo',
  model: 'claude-sonnet-4-6',
  system_prompt_parts: [
    { type: 'karpathy' },
    { type: 'index', level: 'L1' },
    { type: 'contract', path: 'CONTRACT.md' },
    { type: 'raw', content: V3_OUTPUT_DISCIPLINE },
  ],
  index_level: 'L1',
  max_tokens: 8192,
  budget_usd: 0.30,
};
