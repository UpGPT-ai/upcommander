// src/lib/upcommander/ast-summary/types.ts

export interface FileSummary {
  path: string;                  // repo-relative
  sha: string;                   // git blob sha of file at the commit when summarized
  language: string;              // 'typescript' | 'python' | 'sql' | 'markdown' | ...
  imports: string[];             // raw import lines (bounded 200)
  classes: Array<{ name: string; line: number; kind: 'class'|'interface'|'type' }>;
  functions: Array<{ name: string; line: number; signature: string; docstring?: string }>;
  tokens: number;                // estimated tokens of the summary itself
  originalTokens: number;        // estimated tokens of the raw file
  generatedAt: string;           // ISO timestamp
}
