import * as fs from 'node:fs';
import * as path from 'node:path';
import type { OrchestratorSkeleton } from './types';

const SKELETON_PATH = path.resolve(process.cwd(), '.claude-coord/db/skeleton.json');

export function readSkeleton(): OrchestratorSkeleton | null {
  try {
    const raw = fs.readFileSync(SKELETON_PATH, 'utf-8');
    return JSON.parse(raw) as OrchestratorSkeleton;
  } catch {
    return null;
  }
}

export function writeSkeleton(skeleton: OrchestratorSkeleton): void {
  const dir = path.dirname(SKELETON_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  skeleton.generatedAt = new Date().toISOString();

  // Enforce size constraints before persisting
  if (skeleton.humanDirective.length > 2000) {
    skeleton.humanDirective = skeleton.humanDirective.slice(0, 2000);
  }
  skeleton.priorDirectives = skeleton.priorDirectives
    .slice(-5)
    .map(d => d.slice(0, 200));
  skeleton.recentLearnings = skeleton.recentLearnings.slice(0, 5);

  const json = JSON.stringify(skeleton, null, 2);
  // Warn if approaching 8 KB target
  if (json.length > 8192) {
    console.warn(`[skeleton] WARNING: skeleton.json is ${json.length} bytes (target ≤8192)`);
  }

  // Atomic write via temp file
  const tmp = SKELETON_PATH + '.tmp';
  fs.writeFileSync(tmp, json, 'utf-8');
  fs.renameSync(tmp, SKELETON_PATH);
}

export function updateWorkerState(
  skeleton: OrchestratorSkeleton,
  workerName: string,
  patch: Partial<OrchestratorSkeleton['activeWorkers'][number]>,
): OrchestratorSkeleton {
  const existing = skeleton.activeWorkers.find(w => w.name === workerName);
  if (existing) {
    Object.assign(existing, patch, { lastUpdate: new Date().toISOString() });
  } else {
    skeleton.activeWorkers.push({
      name: workerName,
      session: patch.session ?? '',
      window: patch.window ?? '',
      state: patch.state ?? 'idle',
      task: (patch.task ?? '').slice(0, 200),
      lastUpdate: new Date().toISOString(),
      costUsd: patch.costUsd ?? 0,
    });
  }
  return skeleton;
}

export function initSkeleton(projectSlug: string, commitSha: string): OrchestratorSkeleton {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    projectSlug,
    commitSha,
    humanDirective: '',
    priorDirectives: [],
    plan: {
      title: 'Untitled',
      status: 'drafting',
      phases: [],
    },
    activeWorkers: [],
    openQuestions: [],
    budget: {
      sessionSpent: 0,
      perTurnCap: 0.10,
      dailyCap: 5.00,
    },
    recentLearnings: [],
  };
}
