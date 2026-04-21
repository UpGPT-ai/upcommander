/**
 * 3-Tier Pipeline Workers — Opus → DeepSeek → Sonnet
 *
 * Opus generates a verified CONTRACT, DeepSeek implements cheaply,
 * Sonnet reviews and patches. Use for high-stakes or expensive tasks.
 * ~5x cost of K2 but higher quality ceiling.
 */

import type { WorkerRecipe } from './types';

export const PIPELINE_CONTRACT_GENERATOR: WorkerRecipe = {
  name: 'pipeline-contract-generator',
  role: 'contract_generator',
  model: 'claude-opus-4-7',
  system_prompt_parts: [
    { type: 'karpathy' },
    { type: 'index', level: 'L0' },
  ],
  index_level: 'L0',
  max_tokens: 4096,
  budget_usd: 0.25,
};

const V3_OUTPUT_DISCIPLINE = `## Output Discipline (V3)

Write ONLY code. No preamble, no explanation, no summary.
For each file you create or modify, output the complete final file wrapped in a code fence with the file path:
\`\`\`typescript path/to/file.ts
<full file content>
\`\`\`

Do not emit partial files. Do not emit the same file twice. Do not emit files you did not change.`;

export const PIPELINE_IMPLEMENTER: WorkerRecipe = {
  name: 'pipeline-implementer',
  role: 'implementer',
  model: 'deepseek/deepseek-chat-v3.1',
  system_prompt_parts: [
    { type: 'index', level: 'L1' },
    { type: 'contract', path: 'CONTRACT.md' },
    { type: 'raw', content: V3_OUTPUT_DISCIPLINE },
  ],
  index_level: 'L1',
  max_tokens: 8192,
  budget_usd: 0.15,
};

export const PIPELINE_REVIEWER: WorkerRecipe = {
  name: 'pipeline-reviewer',
  role: 'reviewer',
  model: 'claude-sonnet-4-6',
  system_prompt_parts: [
    { type: 'karpathy' },
    { type: 'index', level: 'L1' },
    { type: 'contract', path: 'CONTRACT.md' },
  ],
  index_level: 'L1',
  max_tokens: 4096,
  budget_usd: 0.15,
};
