// OrchestratorSkeleton — ephemeral Haiku orchestrator state, persisted to .claude-coord/db/skeleton.json
// Target size ≤8 KB. Reloaded fresh each turn; destroyed on session end.

export interface OrchestratorSkeleton {
  version: 1;
  generatedAt: string;
  projectSlug: string;
  commitSha: string;

  humanDirective: string;       // last user turn, verbatim, ≤2000 chars
  priorDirectives: string[];    // last 5 user turns, truncated to 200 chars each

  plan: {
    title: string;
    status: 'drafting' | 'executing' | 'reviewing' | 'done';
    phases: Array<{
      name: string;
      state: 'pending' | 'active' | 'done' | 'blocked';
      workers: string[];
    }>;
  };

  activeWorkers: Array<{
    name: string;
    session: string;
    window: string;
    state: 'idle' | 'in_progress' | 'complete' | 'blocked' | 'error' | 'waiting_approval';
    task: string;       // ≤200 chars
    lastUpdate: string;
    costUsd: number;
  }>;

  openQuestions: string[];

  budget: {
    sessionSpent: number;
    perTurnCap: number;
    dailyCap: number;
  };

  recentLearnings: Array<{
    id: number;
    finding: string;
    confidence: string;
  }>; // top-5 from U3 learnings DB
}

export type WorkerState = OrchestratorSkeleton['activeWorkers'][number]['state'];
export type PhaseState = OrchestratorSkeleton['plan']['phases'][number]['state'];
export type PlanStatus = OrchestratorSkeleton['plan']['status'];

export interface TurnResult {
  reply: string;
  skeletonUpdated: boolean;
  traceFile: string;
  costUsd: number;
  delegatedToOpus: boolean;
}

export interface RoutingEnvelope {
  directive: string;
  filesSuspected: string[];
  contextSummary: string;
}
