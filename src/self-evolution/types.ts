// src/lib/upcommander/self-evolution/types.ts

export interface AcceptanceCriterion {
  id: string;           // "AC-1", "AC-2" — line-stable id
  text: string;         // criterion text from CONTRACT.md
  checkCommand?: string; // optional shell command (e.g., "npx tsc --noEmit")
  checkPattern?: string; // optional grep pattern on files_produced
}

export interface SelfGradeResult {
  criterion: AcceptanceCriterion;
  passed: boolean;
  evidence: string;     // file:line or command output snippet
  confidence: 'confirmed' | 'likely' | 'hypothesis';
}

export interface AttemptRecord {
  attemptN: number;     // 1-indexed
  approach: string;     // one-sentence description of the approach
  grades: SelfGradeResult[];
  allPassed: boolean;
  durationSeconds: number;
  costUsd: number;
}

// Extension to existing AgentStatus (in src/lib/coordination.ts):
export interface AgentStatusSelfEvolution {
  attempts?: AttemptRecord[];
  maxAttempts: number;  // default 3 (2 narrow retries + broaden)
  broadenRequest?: {
    reason: string;
    suggestedScope: string;
  };
}
