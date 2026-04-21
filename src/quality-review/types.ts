export interface QualityReviewInput {
  contractPath: string;    // absolute or repo-relative path to CONTRACT.md
  files: string[];         // absolute or repo-relative paths of files to review
  repoPath: string;
  model?: string;          // default: 'claude-opus-4-7'
  apiKey?: string;         // default: ANTHROPIC_API_KEY env var
}

export type IssueSeverity = 'critical' | 'major' | 'minor';

export interface QualityIssue {
  file: string;
  line?: number;
  severity: IssueSeverity;
  description: string;
  suggestion?: string;     // max 200 chars, inline code suggestion
}

export interface QualityReviewResult {
  issues: QualityIssue[];
  overallScore: number;    // 1-10
  summary: string;         // ≤300 chars
  costUsd: number;
  durationMs: number;
  rawResponse: string;
}
