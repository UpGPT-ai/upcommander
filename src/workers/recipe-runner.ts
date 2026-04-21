/**
 * Recipe Runner — ties index-connector + api-agent together.
 * Given a WorkerRecipe + task, assembles the full system prompt and executes.
 */

import { ApiAgent, loadApiKeys } from '../api-agent';
import { buildSystemPrompt } from '../index-connector';
import type { WorkerRecipe, WorkerResult } from './types';
import type { ModelConfig } from '../templates';

export interface RecipeRunOptions {
  contractPath?: string;
  karpathyPath?: string;
  focusPaths?: string[];
  streamChunk?: (chunk: string) => void;
}

/**
 * Execute a WorkerRecipe against a task string.
 * Assembles the system prompt (karpathy + index + contract parts) then calls the API.
 */
export async function runRecipe(
  recipe: WorkerRecipe,
  task: string,
  repoPath: string,
  opts: RecipeRunOptions = {},
): Promise<WorkerResult> {
  const startMs = Date.now();

  const { text: systemPrompt } = await buildSystemPrompt(recipe, repoPath, {
    contractPath: opts.contractPath,
    karpathyPath: opts.karpathyPath,
    focusPaths:   opts.focusPaths,
  });

  // Resolve provider from model string
  const model = recipe.model;
  const provider = model.startsWith('claude-')           ? 'anthropic'
                 : model.startsWith('gpt-') || model.startsWith('o3') ? 'openai'
                 : model.startsWith('gemini-')           ? 'google'
                 : model.includes('/')                   ? 'custom'  // OpenRouter style
                 : 'anthropic';

  const modelConfig: ModelConfig = {
    model,
    provider: provider as ModelConfig['provider'],
    maxTokens: recipe.max_tokens,
    temperature: 0.4,
  };

  const agent = new ApiAgent({
    model: modelConfig,
    systemPrompt,
    maxRetries: 2,
    timeoutMs: 180_000,
  });

  try {
    const response = opts.streamChunk
      ? await agent.executeStreaming(task, opts.streamChunk)
      : await agent.execute(task);

    return {
      recipe_name: recipe.name,
      role: recipe.role,
      model_used: response.model,
      success: response.stopped_reason === 'end_turn',
      output: response.content,
      cost_usd: response.usage.cost_usd,
      duration_ms: Date.now() - startMs,
    };
  } catch (err) {
    return {
      recipe_name: recipe.name,
      role: recipe.role,
      model_used: model,
      success: false,
      error: String(err),
      duration_ms: Date.now() - startMs,
    };
  }
}

/**
 * Check whether required API keys are present for the models in given recipes.
 * Returns a list of missing key names.
 */
export function checkApiKeys(recipes: WorkerRecipe[]): string[] {
  const keys = loadApiKeys();
  const missing: string[] = [];

  for (const r of recipes) {
    if (r.model.startsWith('claude-') && !keys['anthropic']) {
      if (!missing.includes('ANTHROPIC_API_KEY')) missing.push('ANTHROPIC_API_KEY');
    } else if ((r.model.startsWith('gpt-') || r.model.startsWith('o3')) && !keys['openai']) {
      if (!missing.includes('OPENAI_API_KEY')) missing.push('OPENAI_API_KEY');
    } else if (r.model.startsWith('gemini-') && !keys['google']) {
      if (!missing.includes('GOOGLE_API_KEY')) missing.push('GOOGLE_API_KEY');
    }
  }

  return missing;
}
