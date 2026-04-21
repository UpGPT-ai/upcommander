/**
 * UpCommander — Multi-Agent Orchestration Module
 *
 * Hosted inside UpLink desktop (Tauri). Versioned as a swappable module so
 * routing improvements ship without rebuilding the UpLink shell.
 *
 * Three update lanes:
 *  1. routing-rules.json hot-reload  — tune routing thresholds (no app restart)
 *  2. Module update                  — new worker recipes or orchestrator changes
 *  3. Full UpLink update             — shell/UI/bridge changes only
 */

export { UpCommanderOrchestrator, getOrchestrator } from './orchestrator';
export type { Task, TaskType, DispatchDecision, StrategyConfig, WorkerStage, RoutingRules } from './orchestrator';

export { ApiAgent } from './api-agent';
export type { ApiAgentConfig, AgentMessage } from './api-agent';

export { ProjectBudget } from './budget';
export type { BudgetAlert, SpendRecord } from './budget';

export * from './output-schemas';
export * from './workers/types';

export { loadIndexContext, buildSystemPrompt } from './index-connector';
export type { IndexContext, ResolvedSystemPrompt } from './index-connector';

export { reviewFiles } from './quality-review';
export type { QualityReviewInput, QualityReviewResult, QualityIssue } from './quality-review/types';

export { runRecipe, checkApiKeys } from './workers/recipe-runner';

export { K2_SOLO_WORKER } from './workers/k2-solo';
export { PIPELINE_CONTRACT_GENERATOR, PIPELINE_IMPLEMENTER, PIPELINE_REVIEWER } from './workers/pipeline-3tier';
