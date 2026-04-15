/**
 * A/B testing for worker role definitions (CLAUDE.md variants).
 *
 * Tests are stored in ~/.claude-commander/ab-tests/{id}.json
 * Current CLAUDE.md for a worker lives at ~/.claude-commander/roles/{worker}.md
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RoleVariant {
  id: string;
  worker: string;
  version: 'A' | 'B';
  claudeMd: string;
  tasksRun: number;
  avgQuality: number;
  rejectionRate: number;
  status: 'active' | 'promoted' | 'retired';
  created: string;
}

export interface ABTest {
  id: string;
  worker: string;
  variantA: RoleVariant;
  variantB: RoleVariant;
  minSample: number; // minimum tasks before deciding (default 10)
  status: 'running' | 'concluded';
  winner?: 'A' | 'B';
  created: string;
  concluded?: string;
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const BASE_DIR = join(homedir(), '.claude-commander');
const AB_TESTS_DIR = join(BASE_DIR, 'ab-tests');
const ROLES_DIR = join(BASE_DIR, 'roles');

function ensureDirs(): void {
  for (const dir of [AB_TESTS_DIR, ROLES_DIR]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function readTest(id: string): ABTest {
  const file = join(AB_TESTS_DIR, `${id}.json`);
  if (!existsSync(file)) {
    throw new Error(`AB test not found: ${id}`);
  }
  return JSON.parse(readFileSync(file, 'utf8')) as ABTest;
}

function saveTest(test: ABTest): void {
  ensureDirs();
  writeFileSync(
    join(AB_TESTS_DIR, `${test.id}.json`),
    JSON.stringify(test, null, 2),
    { mode: 0o600 }
  );
}

function readCurrentClaudeMd(worker: string): string {
  const file = join(ROLES_DIR, `${worker}.md`);
  if (!existsSync(file)) {
    return `# ${worker}\n\nDefault role definition for worker: ${worker}.\n`;
  }
  return readFileSync(file, 'utf8');
}

function makeVariant(
  worker: string,
  version: 'A' | 'B',
  claudeMd: string
): RoleVariant {
  return {
    id: randomUUID(),
    worker,
    version,
    claudeMd,
    tasksRun: 0,
    avgQuality: 0,
    rejectionRate: 0,
    status: 'active',
    created: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create an A/B test for a worker.
 * The current CLAUDE.md becomes variant A; the challenger becomes variant B.
 *
 * Throws if the worker already has a running test.
 */
export function createABTest(
  worker: string,
  challengerClaudeMd: string,
  minSample = 10
): ABTest {
  ensureDirs();

  const existing = getActiveTest(worker);
  if (existing) {
    throw new Error(
      `Worker "${worker}" already has a running AB test: ${existing.id}`
    );
  }

  const currentClaudeMd = readCurrentClaudeMd(worker);

  const test: ABTest = {
    id: randomUUID(),
    worker,
    variantA: makeVariant(worker, 'A', currentClaudeMd),
    variantB: makeVariant(worker, 'B', challengerClaudeMd),
    minSample,
    status: 'running',
    created: new Date().toISOString(),
  };

  saveTest(test);
  return test;
}

/**
 * Return the currently running A/B test for a worker, or null if none.
 */
export function getActiveTest(worker: string): ABTest | null {
  if (!existsSync(AB_TESTS_DIR)) return null;

  for (const file of readdirSync(AB_TESTS_DIR)) {
    if (!file.endsWith('.json')) continue;
    try {
      const test = JSON.parse(
        readFileSync(join(AB_TESTS_DIR, file), 'utf8')
      ) as ABTest;
      if (test.worker === worker && test.status === 'running') {
        return test;
      }
    } catch {
      // Skip malformed files
    }
  }
  return null;
}

/**
 * List all A/B tests (all statuses).
 */
export function listABTests(): ABTest[] {
  if (!existsSync(AB_TESTS_DIR)) return [];
  const results: ABTest[] = [];
  for (const file of readdirSync(AB_TESTS_DIR)) {
    if (!file.endsWith('.json')) continue;
    try {
      results.push(
        JSON.parse(readFileSync(join(AB_TESTS_DIR, file), 'utf8')) as ABTest
      );
    } catch {
      // Skip malformed files
    }
  }
  return results;
}

/**
 * Record the result of a task run under a specific variant.
 * Updates running averages for quality and rejection rate.
 */
export function recordABResult(
  testId: string,
  variant: 'A' | 'B',
  quality: number,
  rejected: boolean
): void {
  const test = readTest(testId);
  if (test.status !== 'running') {
    throw new Error(`AB test ${testId} is not running (status: ${test.status})`);
  }

  const v = variant === 'A' ? test.variantA : test.variantB;

  // Incremental average update
  const n = v.tasksRun + 1;
  v.avgQuality = (v.avgQuality * v.tasksRun + quality) / n;
  v.rejectionRate = (v.rejectionRate * v.tasksRun + (rejected ? 1 : 0)) / n;
  v.tasksRun = n;

  saveTest(test);
}

/**
 * Evaluate whether a test has enough data to declare a winner.
 * Both variants must have at least minSample tasks.
 *
 * Winner selection:
 *   - Higher avgQuality AND lower rejectionRate → clear winner
 *   - If one metric is significantly better (>10% improvement) and the other
 *     is neutral, declare that variant the winner
 */
export function evaluateTest(
  testId: string
): { concluded: boolean; winner?: 'A' | 'B'; reason?: string } {
  const test = readTest(testId);
  const { variantA: a, variantB: b, minSample } = test;

  if (a.tasksRun < minSample || b.tasksRun < minSample) {
    return { concluded: false };
  }

  const qualityDiff = b.avgQuality - a.avgQuality;     // positive = B better
  const rejectionDiff = a.rejectionRate - b.rejectionRate; // positive = B better

  const SIGNIFICANT_QUALITY = 0.5;  // 0.5 quality points
  const SIGNIFICANT_REJECTION = 0.05; // 5 percentage points

  const bBetterQuality = qualityDiff > SIGNIFICANT_QUALITY;
  const aBetterQuality = qualityDiff < -SIGNIFICANT_QUALITY;
  const bBetterRejection = rejectionDiff > SIGNIFICANT_REJECTION;
  const aBetterRejection = rejectionDiff < -SIGNIFICANT_REJECTION;

  let winner: 'A' | 'B' | undefined;
  let reason: string | undefined;

  if (bBetterQuality && bBetterRejection) {
    winner = 'B';
    reason = `Variant B has higher quality (+${qualityDiff.toFixed(2)}) and lower rejection rate (-${(rejectionDiff * 100).toFixed(1)}pp)`;
  } else if (aBetterQuality && aBetterRejection) {
    winner = 'A';
    reason = `Variant A has higher quality (+${(-qualityDiff).toFixed(2)}) and lower rejection rate (+${(-rejectionDiff * 100).toFixed(1)}pp retained)`;
  } else if (bBetterQuality && !aBetterRejection) {
    winner = 'B';
    reason = `Variant B has significantly higher quality (+${qualityDiff.toFixed(2)}) with comparable rejection rate`;
  } else if (aBetterQuality && !bBetterRejection) {
    winner = 'A';
    reason = `Variant A has significantly higher quality (+${(-qualityDiff).toFixed(2)}) with comparable rejection rate`;
  } else if (bBetterRejection && !aBetterQuality) {
    winner = 'B';
    reason = `Variant B has significantly lower rejection rate (-${(rejectionDiff * 100).toFixed(1)}pp) with comparable quality`;
  } else if (aBetterRejection && !bBetterQuality) {
    winner = 'A';
    reason = `Variant A has significantly lower rejection rate (+${(-rejectionDiff * 100).toFixed(1)}pp retained) with comparable quality`;
  } else {
    // No significant difference — retain current (A)
    winner = 'A';
    reason = 'No significant difference found; retaining current role definition (A)';
  }

  return { concluded: true, winner, reason };
}

/**
 * Conclude a test and promote the winning CLAUDE.md variant.
 * Saves the winner's claudeMd to ~/.claude-commander/roles/{worker}.md
 */
export function promoteWinner(testId: string): void {
  ensureDirs();
  const test = readTest(testId);

  if (test.status === 'concluded') {
    throw new Error(`AB test ${testId} is already concluded`);
  }

  const evaluation = evaluateTest(testId);
  if (!evaluation.concluded || !evaluation.winner) {
    throw new Error(
      `AB test ${testId} cannot be concluded yet — not enough data (need ${test.minSample} tasks per variant)`
    );
  }

  const winner = evaluation.winner;
  const winnerVariant = winner === 'A' ? test.variantA : test.variantB;

  // Save winning CLAUDE.md
  writeFileSync(
    join(ROLES_DIR, `${test.worker}.md`),
    winnerVariant.claudeMd,
    { mode: 0o600 }
  );

  // Update variant statuses
  test.variantA.status = winner === 'A' ? 'promoted' : 'retired';
  test.variantB.status = winner === 'B' ? 'promoted' : 'retired';

  test.status = 'concluded';
  test.winner = winner;
  test.concluded = new Date().toISOString();

  saveTest(test);
}
