/**
 * Claude Commander — Usage Tracking
 *
 * Tracks per-session and per-period usage: prompts sent, tokens consumed,
 * estimated cost, and time active. Persists to ~/.claude-commander/usage/.
 *
 * Designed to give the user visibility into their Claude consumption
 * across all Commander sessions — visible in VS Code status bar and PWA.
 */
export interface ProviderUsage {
    provider: string;
    prompts: number;
    tokens_in: number;
    tokens_out: number;
    tokens_cached: number;
    cost_usd: number;
    models_used: Record<string, number>;
}
export interface SessionUsage {
    session: string;
    prompts_sent: number;
    prompts_today: number;
    tokens_in: number;
    tokens_out: number;
    tokens_cached: number;
    cost_usd: number;
    cost_today_usd: number;
    first_active: string;
    last_active: string;
    active_minutes: number;
    by_provider: Record<string, ProviderUsage>;
}
export interface DailyUsage {
    date: string;
    prompts: number;
    tokens_in: number;
    tokens_out: number;
    tokens_cached: number;
    cost_usd: number;
    sessions_active: string[];
    by_provider: Record<string, ProviderUsage>;
}
export interface UsageSummary {
    today: DailyUsage;
    week: {
        prompts: number;
        tokens_in: number;
        tokens_out: number;
        cost_usd: number;
        days: DailyUsage[];
        by_provider: Record<string, ProviderUsage>;
    };
    month: {
        prompts: number;
        tokens_in: number;
        tokens_out: number;
        cost_usd: number;
        by_provider: Record<string, ProviderUsage>;
    };
    by_session: SessionUsage[];
    updated: string;
}
export interface PromptEvent {
    session: string;
    window?: string;
    tokens_in?: number;
    tokens_out?: number;
    tokens_cached?: number;
    cost_usd?: number;
    source?: 'cli' | 'pwa' | 'vscode' | 'api';
    provider?: string;
    model?: string;
}
export declare function recordPrompt(event: PromptEvent): void;
export declare function getUsageSummary(): UsageSummary;
export declare function getSessionUsage(sessionName: string): SessionUsage | null;
export declare function resetDailyCounters(): void;
//# sourceMappingURL=usage.d.ts.map