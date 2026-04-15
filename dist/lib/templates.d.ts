/**
 * Template registry and management system for Claude Commander.
 *
 * Provides 6 built-in project templates (dev, research, book, campaign,
 * video, custom) plus support for user-created custom templates stored
 * in ~/.claude-commander/templates/.
 */
/**
 * Supported AI model providers and their model identifiers.
 * Workers can be assigned different models based on task complexity.
 */
export type ModelProvider = 'anthropic' | 'openai' | 'google' | 'custom';
export interface ModelConfig {
    provider: ModelProvider;
    model: string;
    fallback?: string;
    maxTokens?: number;
    temperature?: number;
}
/**
 * Model hierarchy (enforced):
 *   DEFAULT → Sonnet: All workers, all standard tasks
 *   CHEAP   → Haiku:  Scanning, triage, formatting, simple lookups
 *   DEEP    → Opus:   ONLY when deep reasoning is explicitly required
 *                      (architecture decisions, cross-jurisdiction synthesis,
 *                       adversarial testing, complex multi-step reasoning)
 *
 * Workers default to Sonnet unless explicitly overridden.
 * Opus should be used sparingly — most tasks do not require it.
 */
export declare const MODEL_PRESETS: Record<string, ModelConfig>;
export interface WorkerDefinition {
    name: string;
    role: string;
    claudeMd: string;
    tier: number;
    model?: ModelConfig;
}
export interface ProjectTemplate {
    name: string;
    description: string;
    workers: WorkerDefinition[];
    outputStructure: Record<string, string>;
    defaultModel?: ModelConfig;
}
/**
 * Return all 6 built-in templates keyed by their short name.
 */
export declare function getBuiltinTemplates(): Record<string, ProjectTemplate>;
/**
 * Retrieve a single template by name (built-in or custom).
 * Returns null if not found.
 */
export declare function getTemplate(name: string): ProjectTemplate | null;
/**
 * List all available templates (built-in + custom) as a summary array.
 */
export declare function listTemplates(): {
    name: string;
    description: string;
    workers: string[];
}[];
/**
 * Create a custom template from user-supplied inputs and persist it to
 * ~/.claude-commander/templates/{name}.json.
 */
export declare function createCustomTemplate(name: string, description: string, workers: WorkerDefinition[]): ProjectTemplate;
/**
 * Load all user-created custom templates from disk.
 * Returns an empty object if the templates directory doesn't exist.
 */
export declare function loadCustomTemplates(): Record<string, ProjectTemplate>;
/**
 * Apply a template to a project path.
 *
 * Steps:
 * 1. Validate that the tmux session does not already exist
 * 2. Initialize the .claude-coord/ coordination structure
 * 3. Write each worker's CLAUDE.md into the project directory
 * 4. Write the orchestrator's CLAUDE.md
 * 5. Create the tmux session with all workers
 */
export declare function applyTemplate(template: ProjectTemplate, projectPath: string, projectName: string): void;
//# sourceMappingURL=templates.d.ts.map