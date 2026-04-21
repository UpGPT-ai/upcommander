/**
 * UpCommander Worker Types
 *
 * A "worker recipe" defines how a single agent executes within a strategy.
 * New recipes are dropped into workers/ and referenced by routing-rules.json.
 * No orchestrator changes required.
 */

export interface WorkerRecipe {
  name: string;
  role: WorkerRole;
  model: string;
  system_prompt_parts: SystemPromptPart[];
  index_level: 'L0' | 'L1' | 'L2' | null;
  max_tokens: number;
  budget_usd: number;
}

export type WorkerRole = 'contract_generator' | 'implementer' | 'reviewer' | 'solo';

export type SystemPromptPart =
  | { type: 'karpathy' }           // inject ~/.claude/library/karpathy-skills.md
  | { type: 'contract'; path: string }   // inject CONTRACT.md
  | { type: 'index'; level: string }     // inject codebase index at given level
  | { type: 'raw'; content: string };    // literal text

export interface WorkerResult {
  recipe_name: string;
  role: WorkerRole;
  model_used: string;
  success: boolean;
  output?: string;
  cost_usd?: number;
  duration_ms?: number;
  error?: string;
}
