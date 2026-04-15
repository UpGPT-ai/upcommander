/**
 * Claude Commander — API-Based Agent Execution
 *
 * Executes agent tasks via provider APIs (Anthropic, OpenAI, Google)
 * instead of tmux sessions. Routes to the correct provider based on
 * the worker's MODEL.json configuration.
 */
import type { ModelConfig, ModelProvider } from './templates.js';
export interface ApiAgentConfig {
    model: ModelConfig;
    systemPrompt: string;
    skillPrompt?: string;
    maxRetries: number;
    timeoutMs: number;
}
export interface AgentMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}
export interface AgentResponse {
    content: string;
    usage: {
        input_tokens: number;
        output_tokens: number;
        cached_tokens: number;
        cost_usd: number;
    };
    model: string;
    provider: string;
    duration_ms: number;
    stopped_reason: 'end_turn' | 'max_tokens' | 'error';
}
export type ExecutionMode = 'tmux' | 'api' | 'batch';
/**
 * Read API keys from ~/.claude-commander/config.json.
 * Falls back to environment variables if not found in config.
 */
export declare function loadApiKeys(): Record<string, string>;
/**
 * Calculate the USD cost for a completed API call.
 *
 * @param provider   The provider identifier
 * @param model      The model identifier (used to look up specific pricing)
 * @param inputTokens    Number of non-cached input tokens
 * @param outputTokens   Number of output tokens
 * @param cachedTokens   Number of prompt-cached input tokens
 * @returns Cost in USD
 */
export declare function calculateCost(provider: ModelProvider, model: string, inputTokens: number, outputTokens: number, cachedTokens: number): number;
/**
 * Returns the base API endpoint for a given provider and model.
 */
export declare function getProviderEndpoint(provider: ModelProvider, model: string): string;
/**
 * Multi-model API agent that routes to the correct provider (Anthropic,
 * OpenAI, or Google) based on the supplied ModelConfig.
 */
export declare class ApiAgent {
    private readonly config;
    private readonly apiKeys;
    private readonly systemContent;
    constructor(config: ApiAgentConfig);
    /**
     * Execute a single task and return the full response.
     * Automatically falls back to the model's fallback if the primary fails.
     */
    execute(task: string, context?: string): Promise<AgentResponse>;
    /**
     * Execute a task with a streaming callback for real-time output.
     *
     * For providers that support streaming (Anthropic, OpenAI), incremental
     * text chunks are pushed to `onChunk`. Google Gemini does not support
     * streaming in this implementation; the full response is delivered as one
     * chunk when complete.
     */
    executeStreaming(task: string, onChunk: (chunk: string) => void, context?: string): Promise<AgentResponse>;
    private callProvider;
    private callAnthropic;
    private callOpenAI;
    private callGoogle;
    private callProviderStreaming;
    private callAnthropicStreaming;
    private callOpenAIStreaming;
    private assembleResponse;
}
/**
 * Create an ApiAgent pre-configured from a MODEL.json file on disk.
 * Reads CLAUDE.md (systemPrompt) and optionally SKILL.md from the same directory.
 *
 * @param modelJsonPath  Absolute path to the worker's MODEL.json file
 * @param claudeMdPath   Absolute path to the worker's CLAUDE.md file
 * @param skillMdPath    Optional absolute path to the worker's SKILL.md file
 * @param overrides      Optional partial config overrides
 */
export declare function createAgentFromFiles(modelJsonPath: string, claudeMdPath: string, skillMdPath?: string, overrides?: Partial<Pick<ApiAgentConfig, 'maxRetries' | 'timeoutMs'>>): ApiAgent;
//# sourceMappingURL=api-agent.d.ts.map