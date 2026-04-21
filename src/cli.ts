#!/usr/bin/env node
/**
 * UpCommander CLI
 *
 * Usage:
 *   npx tsx src/lib/upcommander/cli.ts run "add pagination to notes API"
 *   npx tsx src/lib/upcommander/cli.ts run "..." --quality
 *   npx tsx src/lib/upcommander/cli.ts contract "describe the task"
 *   npx tsx src/lib/upcommander/cli.ts index
 *   npx tsx src/lib/upcommander/cli.ts review src/app/api/notes/route.ts
 *
 * BYOK setup:
 *   export ANTHROPIC_API_KEY=sk-ant-...
 *   # or: npx tsx cli.ts run "..." (will error with a helpful message if key missing)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import Anthropic from '@anthropic-ai/sdk';

import { loadIndexContext, buildSystemPrompt } from './index-connector';
import { reviewFiles } from './quality-review';
import { runRecipe } from './workers/recipe-runner';
import { K2_SOLO_WORKER } from './workers/k2-solo';

const REPO_PATH = process.cwd();
const COORD_DIR = path.join(REPO_PATH, '.claude-coord');
const CONTRACT_PATH = path.join(COORD_DIR, 'CONTRACT.md');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureCoordDir(): void {
  if (!fs.existsSync(COORD_DIR)) fs.mkdirSync(COORD_DIR, { recursive: true });
}

function requireApiKey(): string {
  const key = process.env['ANTHROPIC_API_KEY'] ?? '';
  if (!key) {
    console.error('[upc] ERROR: ANTHROPIC_API_KEY is not set.');
    console.error('  Set it with: export ANTHROPIC_API_KEY=sk-ant-...');
    console.error('  Or save it: echo ANTHROPIC_API_KEY=sk-ant-... >> .env.local');
    process.exit(1);
  }
  return key;
}

function printCost(usd: number): void {
  console.log(`\n[cost: $${usd.toFixed(4)}]`);
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function cmdIndex(): Promise<void> {
  console.log('[upc] Regenerating codebase index...');
  try {
    execSync('npx tsx scripts/generate-codebase-index-tree.ts', {
      cwd: REPO_PATH,
      stdio: 'inherit',
    });
    // Quick sanity check
    const ctx = loadIndexContext(REPO_PATH, 'L0');
    console.log(`\n[upc] Index ready. L0 summary (${ctx.tokenEstimate} tokens):`);
    console.log(ctx.text.split('\n').slice(0, 10).join('\n'));
  } catch (e) {
    console.error('[upc] Index generation failed:', e);
    process.exit(1);
  }
}

async function cmdContract(task: string): Promise<void> {
  const apiKey = requireApiKey();
  ensureCoordDir();

  console.log(`[upc] Generating CONTRACT.md for: ${task.slice(0, 80)}...`);

  const l0 = loadIndexContext(REPO_PATH, 'L0');
  const client = new Anthropic({ apiKey });

  const systemPrompt = `You are an expert TypeScript architect generating a CONTRACT.md for a multi-file coding task.
A CONTRACT.md specifies: exact TypeScript interfaces, DB column names, import paths, SQL conventions, API response formats, and explicit non-goals.
Include exact file paths, exact exported function signatures, and acceptance criteria that can be checked with grep.
Output ONLY the raw markdown for CONTRACT.md — no preamble, no explanation, no code fences around the whole document.`;

  const userMessage = `TASK: ${task}\n\n${l0.text}`;
  const startMs = Date.now();

  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const contractContent = (response.content as Array<{ type: string; text?: string }>)
    .filter(b => b.type === 'text')
    .map(b => b.text ?? '')
    .join('');

  fs.writeFileSync(CONTRACT_PATH, contractContent, 'utf-8');

  const inputTokens  = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  const costUsd = (inputTokens / 1_000_000) * 15.0 + (outputTokens / 1_000_000) * 75.0;

  console.log(`\n[upc] CONTRACT.md written → ${path.relative(REPO_PATH, CONTRACT_PATH)}`);
  console.log(`[upc] Preview:\n${contractContent.slice(0, 300)}...`);
  printCost(costUsd);
  console.log(`[duration: ${Date.now() - startMs}ms]`);
}

async function cmdRun(task: string, withQuality: boolean): Promise<void> {
  const apiKey = requireApiKey();
  ensureCoordDir();

  // Step 1: Generate CONTRACT.md if not present (or always generate fresh)
  console.log('\n[upc] Step 1/2: Generating CONTRACT.md...');
  await cmdContract(task);

  // Step 2: Execute K2 solo worker
  console.log('\n[upc] Step 2/2: Executing K2 worker (Sonnet 4.6 + contract + L1 index)...');
  const result = await runRecipe(
    K2_SOLO_WORKER,
    task,
    REPO_PATH,
    {
      contractPath: CONTRACT_PATH,
      streamChunk: (chunk) => process.stdout.write(chunk),
    }
  );

  if (!result.success) {
    console.error(`\n[upc] Worker failed: ${result.error}`);
    process.exit(1);
  }

  printCost(result.cost_usd ?? 0);

  // Step 3 (optional): V2O quality review
  if (withQuality && result.output) {
    // Parse written files from output (heuristic: look for file paths in the output)
    const fileMatches = result.output.match(/(?:src|supabase)\/[^\s"'`]+\.(?:ts|tsx|sql)/g) ?? [];
    const uniqueFiles = [...new Set(fileMatches)].filter(f => fs.existsSync(path.join(REPO_PATH, f)));

    if (uniqueFiles.length > 0) {
      console.log(`\n[upc] Running V2O quality review on ${uniqueFiles.length} file(s)...`);
      const review = await reviewFiles({
        contractPath: CONTRACT_PATH,
        files: uniqueFiles,
        repoPath: REPO_PATH,
        apiKey,
      });

      console.log(`\n=== Quality Review ===`);
      console.log(`Score: ${review.overallScore}/10`);
      console.log(`Summary: ${review.summary}`);
      if (review.issues.length > 0) {
        console.log('\nIssues:');
        for (const issue of review.issues) {
          const loc = issue.line ? `:${issue.line}` : '';
          console.log(`  [${issue.severity.toUpperCase()}] ${issue.file}${loc} — ${issue.description}`);
          if (issue.suggestion) console.log(`    → ${issue.suggestion}`);
        }
      } else {
        console.log('No issues found.');
      }
      printCost(review.costUsd);
    } else {
      console.log('[upc] No written files detected — skipping quality review.');
    }
  }
}

async function cmdReview(files: string[]): Promise<void> {
  const apiKey = requireApiKey();

  if (!fs.existsSync(CONTRACT_PATH)) {
    console.error(`[upc] No CONTRACT.md found at ${path.relative(REPO_PATH, CONTRACT_PATH)}`);
    console.error('  Run: npx tsx src/lib/upcommander/cli.ts contract "describe the task" first');
    process.exit(1);
  }

  const existingFiles = files.filter(f => {
    const abs = path.isAbsolute(f) ? f : path.join(REPO_PATH, f);
    return fs.existsSync(abs);
  });

  if (existingFiles.length === 0) {
    console.error('[upc] None of the specified files exist');
    process.exit(1);
  }

  console.log(`[upc] Reviewing ${existingFiles.length} file(s) with Opus...`);

  const review = await reviewFiles({
    contractPath: CONTRACT_PATH,
    files: existingFiles,
    repoPath: REPO_PATH,
    apiKey,
  });

  console.log(`\nScore: ${review.overallScore}/10`);
  console.log(`Summary: ${review.summary}`);

  if (review.issues.length > 0) {
    console.log('\nIssues:');
    for (const issue of review.issues) {
      const loc = issue.line ? `:${issue.line}` : '';
      console.log(`  [${issue.severity.toUpperCase()}] ${issue.file}${loc}`);
      console.log(`    ${issue.description}`);
      if (issue.suggestion) console.log(`    Fix: ${issue.suggestion}`);
    }
  } else {
    console.log('\nNo issues found.');
  }

  printCost(review.costUsd);
}

function printHelp(): void {
  console.log(`
UpCommander CLI — AI-assisted multi-file coding

COMMANDS:
  run "<task>"         Generate contract + execute K2 worker
  run "<task>" --quality  Same + V2O Opus quality review after
  contract "<task>"    Generate CONTRACT.md only (Opus, ~$0.15)
  index                Regenerate the .codebase-index/ tree
  review <files...>    Run V2O quality review on existing files

BYOK SETUP:
  export ANTHROPIC_API_KEY=sk-ant-...
  # or save to: ~/.claude-commander/config.json

EXAMPLES:
  npx tsx src/lib/upcommander/cli.ts run "add notes CRUD to platform"
  npx tsx src/lib/upcommander/cli.ts run "refactor auth middleware" --quality
  npx tsx src/lib/upcommander/cli.ts review src/app/api/v1/notes/route.ts

COST BENCHMARKS (N=49+ runs on Sonnet 4.6):
  Naive baseline:          $5.45
  + CONTRACT:              $2.51  (-54%)
  + AST index compression: $0.85  (-85%)
  + Haiku orchestrator:    $0.83  (-85% total)
  `);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'run': {
      const task = args[1];
      if (!task) { console.error('[upc] Usage: upc run "<task>"'); process.exit(1); }
      const withQuality = args.includes('--quality');
      await cmdRun(task, withQuality);
      break;
    }

    case 'contract': {
      const task = args[1];
      if (!task) { console.error('[upc] Usage: upc contract "<task>"'); process.exit(1); }
      await cmdContract(task);
      break;
    }

    case 'index':
      await cmdIndex();
      break;

    case 'review': {
      const files = args.slice(1);
      if (files.length === 0) { console.error('[upc] Usage: upc review <files...>'); process.exit(1); }
      await cmdReview(files);
      break;
    }

    default:
      printHelp();
      if (command && command !== '--help' && command !== 'help') process.exit(1);
  }
}

main().catch(err => {
  console.error('[upc] Fatal error:', err);
  process.exit(1);
});
