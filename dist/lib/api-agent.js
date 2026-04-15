/**
 * Claude Commander — API-Based Agent Execution
 *
 * Executes agent tasks via provider APIs (Anthropic, OpenAI, Google)
 * instead of tmux sessions. Routes to the correct provider based on
 * the worker's MODEL.json configuration.
 */
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
const PRICING = {
    // Anthropic
    'claude-opus-4-6': { input: 15.00, cached_input: 1.50, output: 75.00 },
    'claude-opus-4-5': { input: 15.00, cached_input: 1.50, output: 75.00 },
    'claude-sonnet-4-6': { input: 3.00, cached_input: 0.30, output: 15.00 },
    'claude-sonnet-4-5': { input: 3.00, cached_input: 0.30, output: 15.00 },
    'claude-haiku-4-5-20251001': { input: 0.80, cached_input: 0.08, output: 4.00 },
    'claude-haiku-3-5': { input: 0.80, cached_input: 0.08, output: 4.00 },
    // OpenAI
    'gpt-4o': { input: 2.50, cached_input: 1.25, output: 10.00 },
    'gpt-4o-mini': { input: 0.15, cached_input: 0.08, output: 0.60 },
    'o3': { input: 10.00, cached_input: 5.00, output: 40.00 },
    'o3-mini': { input: 1.10, cached_input: 0.55, output: 4.40 },
    // Google
    'gemini-2.5-pro': { input: 1.25, cached_input: 0.31, output: 5.00 },
    'gemini-2.5-flash': { input: 0.075, cached_input: 0.019, output: 0.30 },
    'gemini-1.5-pro': { input: 1.25, cached_input: 0.31, output: 5.00 },
    'gemini-1.5-flash': { input: 0.075, cached_input: 0.019, output: 0.30 },
};
// Fallback pricing tiers used when model ID is not in the table above
const PRICING_FALLBACK = {
    anthropic: { input: 3.00, cached_input: 0.30, output: 15.00 },
    openai: { input: 2.50, cached_input: 1.25, output: 10.00 },
    google: { input: 1.25, cached_input: 0.31, output: 5.00 },
    custom: { input: 0.00, cached_input: 0.00, output: 0.00 },
};
/**
 * Read API keys from ~/.claude-commander/config.json.
 * Falls back to environment variables if not found in config.
 */
export function loadApiKeys() {
    const configPath = join(homedir(), '.claude-commander', 'config.json');
    let configKeys = {};
    if (existsSync(configPath)) {
        try {
            const raw = readFileSync(configPath, 'utf8');
            const parsed = JSON.parse(raw);
            configKeys = parsed.apiKeys ?? {};
        }
        catch {
            // Use environment variables as fallback
        }
    }
    // Merge config file keys with env vars (env vars used only if config value absent)
    return {
        anthropic: configKeys['anthropic'] ?? process.env['ANTHROPIC_API_KEY'] ?? '',
        openai: configKeys['openai'] ?? process.env['OPENAI_API_KEY'] ?? '',
        google: configKeys['google'] ?? process.env['GOOGLE_API_KEY'] ?? '',
    };
}
// ---------------------------------------------------------------------------
// Cost calculation
// ---------------------------------------------------------------------------
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
export function calculateCost(provider, model, inputTokens, outputTokens, cachedTokens) {
    const pricing = PRICING[model] ?? PRICING_FALLBACK[provider] ?? { input: 0, cached_input: 0, output: 0 };
    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const cachedCost = (cachedTokens / 1_000_000) * pricing.cached_input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    return inputCost + cachedCost + outputCost;
}
// ---------------------------------------------------------------------------
// Endpoint resolution
// ---------------------------------------------------------------------------
/**
 * Returns the base API endpoint for a given provider and model.
 */
export function getProviderEndpoint(provider, model) {
    switch (provider) {
        case 'anthropic':
            return 'https://api.anthropic.com/v1/messages';
        case 'openai':
            return 'https://api.openai.com/v1/chat/completions';
        case 'google':
            return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
        case 'custom':
            return '';
    }
}
// ---------------------------------------------------------------------------
// Provider-specific request builders & response parsers
// ---------------------------------------------------------------------------
/** Build the fetch options for an Anthropic API call. */
function buildAnthropicRequest(model, systemPrompt, userMessage, maxTokens, temperature, apiKey) {
    const body = {
        model,
        max_tokens: maxTokens,
        temperature,
        system: [
            {
                type: 'text',
                text: systemPrompt,
                // Prompt caching: cache the system prompt to reduce cost on repeated calls
                cache_control: { type: 'ephemeral' },
            },
        ],
        messages: [
            { role: 'user', content: userMessage },
        ],
    };
    return {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            // Required to enable prompt caching
            'anthropic-beta': 'prompt-caching-2024-07-31',
        },
        body: JSON.stringify(body),
    };
}
/** Parse Anthropic API response into AgentResponse fields. */
function parseAnthropicResponse(
// eslint-disable-next-line @typescript-eslint/no-explicit-any
data, provider, startMs) {
    const content = data.content
        ?.filter((c) => c.type === 'text')
        .map((c) => c.text ?? '')
        .join('') ?? '';
    const rawUsage = {
        input: data.usage?.input_tokens ?? 0,
        output: data.usage?.output_tokens ?? 0,
        cached: data.usage?.cache_read_input_tokens ?? 0,
    };
    const stopReason = data.stop_reason;
    const stopped_reason = stopReason === 'end_turn' ? 'end_turn' :
        stopReason === 'max_tokens' ? 'max_tokens' :
            'error';
    return {
        content,
        model: data.model ?? provider,
        provider,
        duration_ms: Date.now() - startMs,
        stopped_reason,
        rawUsage,
    };
}
/** Build the fetch options for an OpenAI API call. */
function buildOpenAIRequest(model, systemPrompt, userMessage, maxTokens, temperature, apiKey) {
    const body = {
        model,
        max_tokens: maxTokens,
        temperature,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
        ],
    };
    return {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
    };
}
/** Parse OpenAI API response into AgentResponse fields. */
function parseOpenAIResponse(
// eslint-disable-next-line @typescript-eslint/no-explicit-any
data, provider, startMs) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const choice = data.choices?.[0];
    const content = choice?.message?.content ?? '';
    const rawUsage = {
        input: data.usage?.prompt_tokens ?? 0,
        output: data.usage?.completion_tokens ?? 0,
        cached: data.usage?.prompt_tokens_details?.cached_tokens ?? 0,
    };
    const finishReason = choice?.finish_reason;
    const stopped_reason = finishReason === 'stop' ? 'end_turn' :
        finishReason === 'length' ? 'max_tokens' :
            'error';
    return {
        content,
        model: data.model ?? provider,
        provider,
        duration_ms: Date.now() - startMs,
        stopped_reason,
        rawUsage,
    };
}
/** Build the fetch options for a Google Gemini API call. */
function buildGoogleRequest(systemPrompt, userMessage, maxTokens, temperature, apiKey) {
    const body = {
        system_instruction: {
            parts: [{ text: systemPrompt }],
        },
        contents: [
            { role: 'user', parts: [{ text: userMessage }] },
        ],
        generationConfig: {
            maxOutputTokens: maxTokens,
            temperature,
        },
    };
    return {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(body),
    };
}
/** Parse Google Gemini API response into AgentResponse fields. */
function parseGoogleResponse(
// eslint-disable-next-line @typescript-eslint/no-explicit-any
data, model, provider, startMs) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const candidate = data.candidates?.[0];
    const content = candidate?.content?.parts
        ?.map((p) => p.text ?? '')
        .join('') ?? '';
    const rawUsage = {
        input: data.usageMetadata?.promptTokenCount ?? 0,
        output: data.usageMetadata?.candidatesTokenCount ?? 0,
        cached: data.usageMetadata?.cachedContentTokenCount ?? 0,
    };
    const finishReason = candidate?.finishReason;
    const stopped_reason = finishReason === 'STOP' ? 'end_turn' :
        finishReason === 'MAX_TOKENS' ? 'max_tokens' :
            'error';
    return {
        content,
        model,
        provider,
        duration_ms: Date.now() - startMs,
        stopped_reason,
        rawUsage,
    };
}
// ---------------------------------------------------------------------------
// Core HTTP helpers
// ---------------------------------------------------------------------------
/** Delay helper for exponential backoff. */
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/** Return true when the HTTP status warrants a retry. */
function isRetryable(status) {
    return status === 429 || status === 503 || status === 502 || status === 504;
}
/**
 * Execute one HTTP request with exponential backoff on retryable errors.
 * Throws on non-retryable errors or when all retries are exhausted.
 */
async function fetchWithRetry(url, options, maxRetries, timeoutMs) {
    let lastError = new Error('Unknown error');
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timer);
            if (response.ok)
                return response;
            if (isRetryable(response.status) && attempt < maxRetries) {
                // Exponential backoff: 1s, 2s, 4s …
                const backoffMs = Math.min(1000 * Math.pow(2, attempt), 30_000);
                // Honour Retry-After header if present
                const retryAfter = response.headers.get('retry-after');
                const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : backoffMs;
                await delay(waitMs);
                continue;
            }
            // Non-retryable error or retries exhausted
            const body = await response.text().catch(() => '');
            throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
        }
        catch (err) {
            clearTimeout(timer);
            if (err instanceof Error) {
                lastError = err;
                if (err.name === 'AbortError') {
                    throw new Error(`Request timed out after ${timeoutMs}ms`);
                }
                // Network errors are retryable
                if (attempt < maxRetries) {
                    const backoffMs = Math.min(1000 * Math.pow(2, attempt), 30_000);
                    await delay(backoffMs);
                    continue;
                }
            }
            throw err;
        }
    }
    throw lastError;
}
// ---------------------------------------------------------------------------
// ApiAgent class
// ---------------------------------------------------------------------------
/**
 * Multi-model API agent that routes to the correct provider (Anthropic,
 * OpenAI, or Google) based on the supplied ModelConfig.
 */
export class ApiAgent {
    config;
    apiKeys;
    systemContent;
    constructor(config) {
        this.config = {
            ...config,
            maxRetries: config.maxRetries ?? 3,
            timeoutMs: config.timeoutMs ?? 120_000,
        };
        this.apiKeys = loadApiKeys();
        this.systemContent = config.skillPrompt
            ? `${config.systemPrompt}\n\n---\n\n${config.skillPrompt}`
            : config.systemPrompt;
    }
    /**
     * Execute a single task and return the full response.
     * Automatically falls back to the model's fallback if the primary fails.
     */
    async execute(task, context) {
        const userMessage = context ? `${context}\n\n---\n\n${task}` : task;
        try {
            return await this.callProvider(this.config.model, userMessage);
        }
        catch (primaryErr) {
            const fallbackId = this.config.model.fallback;
            if (!fallbackId)
                throw primaryErr;
            console.warn(`[ApiAgent] Primary model "${this.config.model.model}" failed (${String(primaryErr)}). ` +
                `Trying fallback "${fallbackId}".`);
            // Build a fallback ModelConfig re-using provider and settings
            const fallbackModel = {
                ...this.config.model,
                model: fallbackId,
                fallback: undefined,
            };
            return await this.callProvider(fallbackModel, userMessage);
        }
    }
    /**
     * Execute a task with a streaming callback for real-time output.
     *
     * For providers that support streaming (Anthropic, OpenAI), incremental
     * text chunks are pushed to `onChunk`. Google Gemini does not support
     * streaming in this implementation; the full response is delivered as one
     * chunk when complete.
     */
    async executeStreaming(task, onChunk, context) {
        const userMessage = context ? `${context}\n\n---\n\n${task}` : task;
        try {
            return await this.callProviderStreaming(this.config.model, userMessage, onChunk);
        }
        catch (primaryErr) {
            const fallbackId = this.config.model.fallback;
            if (!fallbackId)
                throw primaryErr;
            console.warn(`[ApiAgent] Primary model "${this.config.model.model}" streaming failed (${String(primaryErr)}). ` +
                `Trying fallback "${fallbackId}".`);
            const fallbackModel = {
                ...this.config.model,
                model: fallbackId,
                fallback: undefined,
            };
            return await this.callProviderStreaming(fallbackModel, userMessage, onChunk);
        }
    }
    // -------------------------------------------------------------------------
    // Private: non-streaming provider dispatch
    // -------------------------------------------------------------------------
    async callProvider(model, userMessage) {
        const startMs = Date.now();
        switch (model.provider) {
            case 'anthropic': return this.callAnthropic(model, userMessage, startMs);
            case 'openai': return this.callOpenAI(model, userMessage, startMs);
            case 'google': return this.callGoogle(model, userMessage, startMs);
            case 'custom': throw new Error('Custom provider not supported in API mode');
        }
    }
    async callAnthropic(model, userMessage, startMs) {
        const apiKey = this.apiKeys['anthropic'] ?? '';
        if (!apiKey)
            throw new Error('Anthropic API key not configured');
        const maxTokens = model.maxTokens ?? 8192;
        const temperature = model.temperature ?? 0.4;
        const options = buildAnthropicRequest(model.model, this.systemContent, userMessage, maxTokens, temperature, apiKey);
        const resp = await fetchWithRetry(getProviderEndpoint('anthropic', model.model), options, this.config.maxRetries, this.config.timeoutMs);
        const data = await resp.json();
        const parsed = parseAnthropicResponse(data, 'anthropic', startMs);
        return this.assembleResponse(parsed, model);
    }
    async callOpenAI(model, userMessage, startMs) {
        const apiKey = this.apiKeys['openai'] ?? '';
        if (!apiKey)
            throw new Error('OpenAI API key not configured');
        const maxTokens = model.maxTokens ?? 8192;
        const temperature = model.temperature ?? 0.4;
        const options = buildOpenAIRequest(model.model, this.systemContent, userMessage, maxTokens, temperature, apiKey);
        const resp = await fetchWithRetry(getProviderEndpoint('openai', model.model), options, this.config.maxRetries, this.config.timeoutMs);
        const data = await resp.json();
        const parsed = parseOpenAIResponse(data, 'openai', startMs);
        return this.assembleResponse(parsed, model);
    }
    async callGoogle(model, userMessage, startMs) {
        const apiKey = this.apiKeys['google'] ?? '';
        if (!apiKey)
            throw new Error('Google API key not configured');
        const maxTokens = model.maxTokens ?? 8192;
        const temperature = model.temperature ?? 0.4;
        const options = buildGoogleRequest(this.systemContent, userMessage, maxTokens, temperature, apiKey);
        const resp = await fetchWithRetry(getProviderEndpoint('google', model.model), options, this.config.maxRetries, this.config.timeoutMs);
        const data = await resp.json();
        const parsed = parseGoogleResponse(data, model.model, 'google', startMs);
        return this.assembleResponse(parsed, model);
    }
    // -------------------------------------------------------------------------
    // Private: streaming provider dispatch
    // -------------------------------------------------------------------------
    async callProviderStreaming(model, userMessage, onChunk) {
        switch (model.provider) {
            case 'anthropic': return this.callAnthropicStreaming(model, userMessage, onChunk);
            case 'openai': return this.callOpenAIStreaming(model, userMessage, onChunk);
            case 'google':
                // Google streaming not implemented — fall back to non-streaming and
                // deliver the entire response as a single chunk
                {
                    const response = await this.callGoogle(model, userMessage, Date.now());
                    onChunk(response.content);
                    return response;
                }
            case 'custom':
                throw new Error('Custom provider not supported in API mode');
        }
    }
    async callAnthropicStreaming(model, userMessage, onChunk) {
        const apiKey = this.apiKeys['anthropic'] ?? '';
        if (!apiKey)
            throw new Error('Anthropic API key not configured');
        const startMs = Date.now();
        const maxTokens = model.maxTokens ?? 8192;
        const temperature = model.temperature ?? 0.4;
        const body = {
            model: model.model,
            max_tokens: maxTokens,
            temperature,
            stream: true,
            system: [
                {
                    type: 'text',
                    text: this.systemContent,
                    cache_control: { type: 'ephemeral' },
                },
            ],
            messages: [{ role: 'user', content: userMessage }],
        };
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-beta': 'prompt-caching-2024-07-31',
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
        clearTimeout(timer);
        if (!resp.ok) {
            const errText = await resp.text().catch(() => '');
            throw new Error(`Anthropic streaming error ${resp.status}: ${errText.slice(0, 200)}`);
        }
        // Parse SSE stream
        let fullContent = '';
        let inputTokens = 0;
        let outputTokens = 0;
        let cachedTokens = 0;
        let stopReason = 'end_turn';
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            for (const line of lines) {
                if (!line.startsWith('data: '))
                    continue;
                const raw = line.slice(6).trim();
                if (raw === '[DONE]')
                    break;
                try {
                    const event = JSON.parse(raw);
                    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                        const chunk = event.delta.text ?? '';
                        fullContent += chunk;
                        onChunk(chunk);
                    }
                    else if (event.type === 'message_delta' && event.delta?.stop_reason) {
                        const sr = event.delta.stop_reason;
                        stopReason = sr === 'end_turn' ? 'end_turn' : sr === 'max_tokens' ? 'max_tokens' : 'error';
                        outputTokens = event.usage?.output_tokens ?? outputTokens;
                    }
                    else if (event.type === 'message_start' && event.message?.usage) {
                        inputTokens = event.message.usage.input_tokens ?? 0;
                        cachedTokens = event.message.usage.cache_read_input_tokens ?? 0;
                    }
                }
                catch {
                    // Ignore malformed SSE lines
                }
            }
        }
        const cost = calculateCost(model.provider, model.model, inputTokens, outputTokens, cachedTokens);
        return {
            content: fullContent,
            usage: { input_tokens: inputTokens, output_tokens: outputTokens, cached_tokens: cachedTokens, cost_usd: cost },
            model: model.model,
            provider: 'anthropic',
            duration_ms: Date.now() - startMs,
            stopped_reason: stopReason,
        };
    }
    async callOpenAIStreaming(model, userMessage, onChunk) {
        const apiKey = this.apiKeys['openai'] ?? '';
        if (!apiKey)
            throw new Error('OpenAI API key not configured');
        const startMs = Date.now();
        const maxTokens = model.maxTokens ?? 8192;
        const temperature = model.temperature ?? 0.4;
        const body = {
            model: model.model,
            max_tokens: maxTokens,
            temperature,
            stream: true,
            stream_options: { include_usage: true },
            messages: [
                { role: 'system', content: this.systemContent },
                { role: 'user', content: userMessage },
            ],
        };
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
        clearTimeout(timer);
        if (!resp.ok) {
            const errText = await resp.text().catch(() => '');
            throw new Error(`OpenAI streaming error ${resp.status}: ${errText.slice(0, 200)}`);
        }
        let fullContent = '';
        let inputTokens = 0;
        let outputTokens = 0;
        let cachedTokens = 0;
        let stopReason = 'end_turn';
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            for (const line of lines) {
                if (!line.startsWith('data: '))
                    continue;
                const raw = line.slice(6).trim();
                if (raw === '[DONE]')
                    break;
                try {
                    const event = JSON.parse(raw);
                    const choice = event.choices?.[0];
                    if (choice?.delta?.content) {
                        fullContent += choice.delta.content;
                        onChunk(choice.delta.content);
                    }
                    if (choice?.finish_reason) {
                        const fr = choice.finish_reason;
                        stopReason = fr === 'stop' ? 'end_turn' : fr === 'length' ? 'max_tokens' : 'error';
                    }
                    if (event.usage) {
                        inputTokens = event.usage.prompt_tokens ?? inputTokens;
                        outputTokens = event.usage.completion_tokens ?? outputTokens;
                        cachedTokens = event.usage.prompt_tokens_details?.cached_tokens ?? cachedTokens;
                    }
                }
                catch {
                    // Ignore malformed SSE lines
                }
            }
        }
        const cost = calculateCost(model.provider, model.model, inputTokens, outputTokens, cachedTokens);
        return {
            content: fullContent,
            usage: { input_tokens: inputTokens, output_tokens: outputTokens, cached_tokens: cachedTokens, cost_usd: cost },
            model: model.model,
            provider: 'openai',
            duration_ms: Date.now() - startMs,
            stopped_reason: stopReason,
        };
    }
    // -------------------------------------------------------------------------
    // Private: assemble final AgentResponse from parsed fields
    // -------------------------------------------------------------------------
    assembleResponse(parsed, model) {
        const { rawUsage, ...rest } = parsed;
        const cost = calculateCost(model.provider, model.model, rawUsage.input, rawUsage.output, rawUsage.cached);
        return {
            ...rest,
            usage: {
                input_tokens: rawUsage.input,
                output_tokens: rawUsage.output,
                cached_tokens: rawUsage.cached,
                cost_usd: cost,
            },
        };
    }
}
// ---------------------------------------------------------------------------
// Convenience factory
// ---------------------------------------------------------------------------
/**
 * Create an ApiAgent pre-configured from a MODEL.json file on disk.
 * Reads CLAUDE.md (systemPrompt) and optionally SKILL.md from the same directory.
 *
 * @param modelJsonPath  Absolute path to the worker's MODEL.json file
 * @param claudeMdPath   Absolute path to the worker's CLAUDE.md file
 * @param skillMdPath    Optional absolute path to the worker's SKILL.md file
 * @param overrides      Optional partial config overrides
 */
export function createAgentFromFiles(modelJsonPath, claudeMdPath, skillMdPath, overrides) {
    if (!existsSync(modelJsonPath)) {
        throw new Error(`MODEL.json not found: ${modelJsonPath}`);
    }
    if (!existsSync(claudeMdPath)) {
        throw new Error(`CLAUDE.md not found: ${claudeMdPath}`);
    }
    const model = JSON.parse(readFileSync(modelJsonPath, 'utf8'));
    const systemPrompt = readFileSync(claudeMdPath, 'utf8');
    const skillPrompt = skillMdPath && existsSync(skillMdPath)
        ? readFileSync(skillMdPath, 'utf8')
        : undefined;
    return new ApiAgent({
        model,
        systemPrompt,
        skillPrompt,
        maxRetries: overrides?.maxRetries ?? 3,
        timeoutMs: overrides?.timeoutMs ?? 120_000,
    });
}
//# sourceMappingURL=api-agent.js.map