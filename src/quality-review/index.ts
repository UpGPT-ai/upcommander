/**
 * UpCommander Quality Review — V2O One-Shot
 *
 * Opus reads full file content + CONTRACT.md and returns a structured review.
 * One call only — no retry loop. The retry loop is what causes quality regression
 * (model regenerates entire files while fixing one issue, destroying correct sections).
 *
 * Use this AFTER Sonnet generation, not instead of a good brief.
 * Cost: ~$0.15-0.50/review. Quality gain: 7.5 → 9.5/10 avg (N=5 benchmarks).
 */

import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { QualityReviewInput, QualityReviewResult, QualityIssue } from './types';

// claude-opus-4-7 pricing per million tokens
const OPUS_INPUT_PER_M  = 15.00;
const OPUS_CACHED_PER_M =  1.50;
const OPUS_OUTPUT_PER_M = 75.00;

const REVIEW_SYSTEM_PROMPT = `You are a senior TypeScript engineer reviewing code against a CONTRACT.md specification.

Your job: identify concrete issues with specific file references and line numbers.
Be surgical — only flag real problems, not style preferences.
A "critical" issue means the code doesn't meet an acceptance criterion or will throw at runtime.
A "major" issue means a correctness problem that degrades quality.
A "minor" issue means a polish problem.

Output ONLY valid JSON — no prose before or after. Use this exact schema:
{
  "score": <integer 1-10>,
  "summary": "<≤300 chars describing overall quality>",
  "issues": [
    {
      "file": "<relative file path>",
      "line": <line number or null>,
      "severity": "critical|major|minor",
      "description": "<what is wrong>",
      "suggestion": "<optional: specific fix in ≤200 chars>"
    }
  ]
}`;

function resolveFilePath(filePath: string, repoPath: string): string {
  if (path.isAbsolute(filePath)) return filePath;
  return path.join(repoPath, filePath);
}

function readFile(filePath: string): string {
  // Read ALL bytes — no line limit. The V2O N=5 benchmark failed because
  // truncation at 100 lines hid missing endpoints from Opus.
  return fs.readFileSync(filePath, 'utf-8');
}

function buildUserMessage(contractContent: string, fileContents: Array<{ path: string; content: string }>): string {
  const parts: string[] = [];

  parts.push('CONTRACT:');
  parts.push(contractContent);
  parts.push('');
  parts.push('FILES TO REVIEW:');

  for (const { path: filePath, content } of fileContents) {
    parts.push(`=== ${filePath} ===`);
    parts.push(content);
    parts.push('');
  }

  return parts.join('\n');
}

function parseReviewResponse(raw: string): { issues: QualityIssue[]; overallScore: number; summary: string } {
  // Strip any accidental markdown fences
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return {
      issues: [],
      overallScore: 5,
      summary: `Review parse error — raw: ${raw.slice(0, 100)}`,
    };
  }

  const score = typeof parsed['score'] === 'number' ? Math.min(10, Math.max(1, parsed['score'])) : 5;
  const summary = typeof parsed['summary'] === 'string' ? parsed['summary'].slice(0, 300) : '';

  const rawIssues = Array.isArray(parsed['issues']) ? parsed['issues'] as unknown[] : [];
  const issues: QualityIssue[] = rawIssues
    .filter((i): i is Record<string, unknown> => typeof i === 'object' && i !== null)
    .map(i => ({
      file:        typeof i['file']        === 'string' ? i['file']               : 'unknown',
      line:        typeof i['line']        === 'number' ? i['line']               : undefined,
      severity:    ['critical', 'major', 'minor'].includes(i['severity'] as string)
                     ? i['severity'] as QualityIssue['severity']
                     : 'minor',
      description: typeof i['description'] === 'string' ? i['description']        : '',
      suggestion:  typeof i['suggestion']  === 'string'
                     ? (i['suggestion'] as string).slice(0, 200)
                     : undefined,
    }));

  return { issues, overallScore: score, summary };
}

/**
 * Run a one-shot Opus quality review against a CONTRACT.md.
 * Never call this in a loop — one call, one review.
 */
export async function reviewFiles(input: QualityReviewInput): Promise<QualityReviewResult> {
  const { repoPath, model = 'claude-opus-4-7' } = input;
  const apiKey = input.apiKey ?? process.env['ANTHROPIC_API_KEY'] ?? '';
  if (!apiKey) throw new Error('quality-review: ANTHROPIC_API_KEY not set');

  // Resolve and read CONTRACT.md
  const contractAbsPath = resolveFilePath(input.contractPath, repoPath);
  if (!fs.existsSync(contractAbsPath)) {
    throw new Error(`quality-review: CONTRACT.md not found at ${contractAbsPath}`);
  }
  const contractContent = readFile(contractAbsPath);

  // Resolve and read all review files — no truncation
  const fileContents: Array<{ path: string; content: string }> = [];
  for (const f of input.files) {
    const absPath = resolveFilePath(f, repoPath);
    if (!fs.existsSync(absPath)) {
      console.warn(`[quality-review] skipping missing file: ${f}`);
      continue;
    }
    fileContents.push({ path: f, content: readFile(absPath) });
  }

  if (fileContents.length === 0) {
    throw new Error('quality-review: no readable files provided');
  }

  const client = new Anthropic({ apiKey });
  const userMessage = buildUserMessage(contractContent, fileContents);
  const startMs = Date.now();

  const response = await client.messages.create({
    model,
    max_tokens: 2048,
    system: REVIEW_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const rawResponse = (response.content as Array<{ type: string; text?: string }>)
    .filter(b => b.type === 'text')
    .map(b => b.text ?? '')
    .join('');

  const durationMs = Date.now() - startMs;

  // Cost calculation
  const inputTokens  = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  const cachedTokens = (response.usage as Record<string, unknown>)['cache_read_input_tokens'] as number ?? 0;
  const costUsd = (inputTokens / 1_000_000) * OPUS_INPUT_PER_M
                + (cachedTokens / 1_000_000) * OPUS_CACHED_PER_M
                + (outputTokens / 1_000_000) * OPUS_OUTPUT_PER_M;

  const { issues, overallScore, summary } = parseReviewResponse(rawResponse);

  return { issues, overallScore, summary, costUsd, durationMs, rawResponse };
}
