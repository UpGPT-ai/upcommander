/**
 * UpCommander Self-Evolution Module
 *
 * Implements acceptance-gated retry per:
 * docs/specs/contracts/UPCOMMANDER_SELF-EVOLUTION_CONTRACT.md §3–§5
 *
 * Key design note (Tsinghua NLH March 2026):
 * - Self-grading by the same worker is +4.8 SWE-bench, +2.7 OSWorld.
 * - Verifier agents HURT (-0.8 / -8.4). Do NOT add a second-agent pass here.
 * - Multi-candidate search HURT (-2.4 / -5.6). Retry is strictly sequential.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import type {
  AcceptanceCriterion,
  AttemptRecord,
  SelfGradeResult,
} from './types';

// ---------------------------------------------------------------------------
// parseAcceptanceCriteria
// ---------------------------------------------------------------------------

/**
 * Parse `## Acceptance Criteria` from a CONTRACT.md file.
 * Extracts each `- [ ]` line and assigns a stable id (AC-1, AC-2, …).
 */
export function parseAcceptanceCriteria(contractPath: string): AcceptanceCriterion[] {
  if (!existsSync(contractPath)) {
    throw new Error(`Contract not found: ${contractPath}`);
  }

  const text = readFileSync(contractPath, 'utf-8');
  const lines = text.split('\n');

  let inSection = false;
  const criteria: AcceptanceCriterion[] = [];
  let counter = 0;

  for (const line of lines) {
    if (/^##\s+Acceptance Criteria/i.test(line)) {
      inSection = true;
      continue;
    }
    // Stop at the next ## section
    if (inSection && /^##\s/.test(line)) {
      break;
    }
    if (inSection && /^\s*-\s*\[\s*[x ]?\s*\]/.test(line)) {
      counter++;
      // Strip the checkbox prefix to get the criterion text
      const text = line.replace(/^\s*-\s*\[\s*[x ]?\s*\]\s*/, '').trim();

      // Detect `checkCommand` hint: backtick shell commands like `npx tsc --noEmit`
      const cmdMatch = text.match(/`([^`]+)`/);
      const criterion: AcceptanceCriterion = {
        id: `AC-${counter}`,
        text,
        checkCommand: cmdMatch ? cmdMatch[1] : undefined,
      };
      criteria.push(criterion);
    }
  }

  return criteria;
}

// ---------------------------------------------------------------------------
// selfGrade
// ---------------------------------------------------------------------------

/**
 * Grade each AcceptanceCriterion against the files that were produced.
 * Priority: checkCommand > checkPattern > file-existence reasoning.
 */
export function selfGrade(
  criteria: AcceptanceCriterion[],
  filesProduced: string[],
): SelfGradeResult[] {
  return criteria.map((criterion) => {
    // 1. Shell command check
    if (criterion.checkCommand) {
      try {
        const output = execSync(criterion.checkCommand, {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        return {
          criterion,
          passed: true,
          evidence: output.trim().slice(0, 200) || '(no output — clean exit)',
          confidence: 'confirmed',
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          criterion,
          passed: false,
          evidence: msg.slice(0, 200),
          confidence: 'confirmed',
        };
      }
    }

    // 2. Grep pattern check
    if (criterion.checkPattern) {
      const pattern = new RegExp(criterion.checkPattern);
      for (const filePath of filesProduced) {
        if (!existsSync(filePath)) continue;
        const content = readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (pattern.test(lines[i])) {
            return {
              criterion,
              passed: true,
              evidence: `${filePath}:${i + 1}`,
              confidence: 'confirmed',
            };
          }
        }
      }
      return {
        criterion,
        passed: false,
        evidence: `Pattern /${criterion.checkPattern}/ not found in ${filesProduced.length} file(s)`,
        confidence: 'confirmed',
      };
    }

    // 3. File-existence reasoning: check that at least one produced file exists
    const existing = filesProduced.filter(existsSync);
    if (existing.length > 0) {
      return {
        criterion,
        passed: true,
        evidence: existing[0],
        confidence: 'hypothesis',
      };
    }

    return {
      criterion,
      passed: false,
      evidence: 'No files produced exist on disk',
      confidence: 'hypothesis',
    };
  });
}

// ---------------------------------------------------------------------------
// runWithRetry
// ---------------------------------------------------------------------------

export interface WorkerTask {
  /** Absolute path to the CONTRACT.md for this task */
  contractPath: string;
  /** Files this task is expected to produce */
  filesProduced: string[];
  /** The async function that performs the task */
  execute: (attemptN: number) => Promise<void>;
  /** Budget per attempt in USD (hard cap = 3 × budget) */
  budgetUsd?: number;
  /** Override max attempts (default 3) */
  maxAttempts?: number;
  /** Callback to write attempt record to .claude-coord/workers/<name>/attempts/ */
  onAttemptComplete?: (record: AttemptRecord) => Promise<void>;
}

/**
 * Run a worker task with acceptance-gated retry.
 *
 * - Attempt 1: execute, self-grade.
 * - If failing and attemptN < maxAttempts: retry with same criteria.
 * - If still failing at maxAttempts: return the final AttemptRecord[] for
 *   the orchestrator to write broaden-request.md and set state='blocked'.
 *
 * Returns all attempt records for audit trail.
 */
export async function runWithRetry(task: WorkerTask): Promise<AttemptRecord[]> {
  const maxAttempts = task.maxAttempts ?? 3;
  const criteria = parseAcceptanceCriteria(task.contractPath);
  const records: AttemptRecord[] = [];

  for (let attemptN = 1; attemptN <= maxAttempts; attemptN++) {
    const start = Date.now();

    await task.execute(attemptN);

    const durationSeconds = (Date.now() - start) / 1000;
    const grades = selfGrade(criteria, task.filesProduced);
    const allPassed = grades.every((g) => g.passed);

    const record: AttemptRecord = {
      attemptN,
      approach: `Attempt ${attemptN} of ${maxAttempts}`,
      grades,
      allPassed,
      durationSeconds,
      costUsd: 0, // caller fills from token usage if available
    };

    records.push(record);

    if (task.onAttemptComplete) {
      await task.onAttemptComplete(record);
    }

    if (allPassed) {
      break;
    }
  }

  return records;
}
