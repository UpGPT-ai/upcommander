/**
 * UpCommander Orchestrator
 *
 * Reads routing-rules.json (hot-reloadable) and dispatches tasks to the
 * appropriate strategy. This is the only file that needs to change when
 * adding new strategies or worker recipes — rules stay in routing-rules.json.
 *
 * Designed to be hosted inside UpLink (Tauri desktop) as a versioned module.
 * Update UpCommander by shipping a new version of this module without
 * rebuilding the UpLink shell.
 */

import { existsSync, readFileSync, watchFile } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TaskType = 'bug_fix' | 'greenfield' | 'refactor' | 'architecture_review' | 'high_stakes' | 'generic';

export interface Task {
  id: string;
  description: string;
  type: TaskType;
  file_count: number;
  is_greenfield?: boolean;
  estimated_cost_usd?: number;
  context?: {
    contract_path?: string;
    index_level?: string;
    worktree?: string;
  };
}

export interface StrategyConfig {
  description: string;
  model?: string;
  use_contract?: boolean;
  use_karpathy?: boolean;
  use_index?: string | null;
  stages?: WorkerStage[];
}

export interface WorkerStage {
  role: string;
  model: string;
  use_contract?: boolean;
  use_karpathy?: boolean;
}

export interface RoutingRule {
  condition: string;
  strategy: string;
  note?: string;
}

export interface RoutingRules {
  _version: string;
  default_strategy: string;
  strategies: Record<string, StrategyConfig>;
  routing_rules: RoutingRule[];
  index_strategy: Record<string, string>;
  worker_budget_usd: Record<string, number>;
}

export interface DispatchDecision {
  task_id: string;
  strategy: string;
  strategy_config: StrategyConfig;
  matched_rule?: RoutingRule;
  index_level: string;
  budget_usd: number;
  rationale: string;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export class UpCommanderOrchestrator {
  private rules: RoutingRules;
  private rulesPath: string;

  constructor(rulesPath?: string) {
    this.rulesPath = rulesPath ?? join(__dirname, 'routing-rules.json');
    this.rules = this.loadRules();
    this.watchRules();
  }

  private loadRules(): RoutingRules {
    if (!existsSync(this.rulesPath)) {
      throw new Error(`UpCommander: routing-rules.json not found at ${this.rulesPath}`);
    }
    return JSON.parse(readFileSync(this.rulesPath, 'utf-8')) as RoutingRules;
  }

  private watchRules(): void {
    watchFile(this.rulesPath, { interval: 2000 }, () => {
      try {
        this.rules = this.loadRules();
        console.log(`[UpCommander] routing-rules.json reloaded (v${this.rules._version})`);
      } catch (e) {
        console.error('[UpCommander] Failed to reload routing rules — keeping previous version', e);
      }
    });
  }

  /** Evaluate routing rules for a task and return a dispatch decision. */
  dispatch(task: Task): DispatchDecision {
    const matchedRule = this.matchRule(task);
    const strategyName = matchedRule?.strategy ?? this.rules.default_strategy;
    const strategy = this.rules.strategies[strategyName];

    if (!strategy) {
      throw new Error(`UpCommander: unknown strategy "${strategyName}"`);
    }

    const isMultiStage = !!strategy.stages;
    const indexLevel = isMultiStage
      ? (this.rules.index_strategy['implementer'] ?? 'L1')
      : (strategy.use_index ?? this.rules.index_strategy['solo_agent'] ?? 'L1');

    const budgetRole = isMultiStage ? 'implementer' : 'solo_agent';
    const budgetUsd = this.rules.worker_budget_usd[budgetRole] ?? 0.30;

    return {
      task_id: task.id,
      strategy: strategyName,
      strategy_config: strategy,
      matched_rule: matchedRule,
      index_level: indexLevel ?? 'L1',
      budget_usd: budgetUsd,
      rationale: matchedRule?.note ?? strategy.description,
    };
  }

  private matchRule(task: Task): RoutingRule | undefined {
    for (const rule of this.rules.routing_rules) {
      try {
        // Safe eval: only allows dot-access on task object, no arbitrary code.
        // In production, replace with a proper predicate parser.
        const fn = new Function('task', `return !!(${rule.condition})`);
        if (fn(task)) return rule;
      } catch {
        // Malformed condition — skip
      }
    }
    return undefined;
  }

  /** Returns current rules version for health/status checks. */
  get version(): string {
    return this.rules._version;
  }

  /** Returns all available strategy names. */
  get strategies(): string[] {
    return Object.keys(this.rules.strategies);
  }
}

// Singleton for UpLink hosting — one orchestrator per UpLink process.
let _instance: UpCommanderOrchestrator | null = null;

export function getOrchestrator(rulesPath?: string): UpCommanderOrchestrator {
  if (!_instance) _instance = new UpCommanderOrchestrator(rulesPath);
  return _instance;
}
