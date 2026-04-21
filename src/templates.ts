/**
 * UpCommander — Template types and MODEL_PRESETS.
 *
 * Defines the shape of a project template and the set of built-in model
 * presets (Anthropic / OpenAI / Google) that individual workers can reference.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ModelProvider = 'anthropic' | 'openai' | 'google' | 'custom';

export interface ModelConfig {
  provider: ModelProvider;
  model: string;       // e.g. 'claude-sonnet-4-6', 'gpt-4o', 'gemini-2.5-pro'
  fallback?: string;   // fallback model if primary unavailable
  maxTokens?: number;  // max output tokens for this worker
  temperature?: number; // 0–1, lower = more deterministic
}

export interface WorkerDefinition {
  name: string;
  role: string;
  claudeMd: string;
  tier: number;
  model: ModelConfig;
}

export interface ProjectTemplate {
  name: string;
  description: string;
  defaultModel: ModelConfig;
  workers: WorkerDefinition[];
  outputStructure: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Model presets
// ---------------------------------------------------------------------------

/** Default model configurations by task complexity tier. */
export const MODEL_PRESETS: Record<string, ModelConfig> = {
  // High-stakes: architecture, security, cross-jurisdiction synthesis
  opus: {
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    fallback: 'claude-sonnet-4-6',
    maxTokens: 16384,
    temperature: 0.3,
  },
  // Standard: code, analysis, document review, most tasks
  sonnet: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    fallback: 'claude-haiku-4-5-20251001',
    maxTokens: 8192,
    temperature: 0.4,
  },
  // Fast/cheap: scanning, formatting, triage, simple lookups
  haiku: {
    provider: 'anthropic',
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 4096,
    temperature: 0.2,
  },
  // OpenAI models
  'gpt-4o': {
    provider: 'openai',
    model: 'gpt-4o',
    fallback: 'gpt-4o-mini',
    maxTokens: 8192,
    temperature: 0.4,
  },
  // Google models
  'gemini-pro': {
    provider: 'google',
    model: 'gemini-2.5-pro',
    maxTokens: 8192,
    temperature: 0.4,
  },
};
