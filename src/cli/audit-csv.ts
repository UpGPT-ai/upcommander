#!/usr/bin/env node
/**
 * Claude Commander — Local CSV SEM Audit Runner
 *
 * Runs a parallel SEM audit on a Google Ads search term CSV file.
 * Uses API-based execution when ANTHROPIC_API_KEY is available,
 * falls back to tmux-based execution via Claude Commander server.
 *
 * Usage:
 *   npx tsx src/cli/audit-csv.ts /path/to/search-terms.csv [options]
 *
 * Options:
 *   --output <dir>    Output directory (default: ./audit-output)
 *   --verify          Run verification pipeline (stages 1-2)
 *   --verify-full     Run full verification (stages 1-5)
 *   --budget <usd>    Set budget cap in USD
 *   --account <name>  Account name for reports (default: from filename)
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { homedir } from 'node:os';

import {
  parseSemCsv,
  distributeDataToWorkers,
  writeFindingsReport,
} from '../lib/connectors/sentinel-bridge.js';
import {
  type Finding,
  createFinding,
  mergeFindings,
} from '../lib/output-schemas.js';
import { extractEntities, CrossReferenceGraph } from '../lib/cross-reference.js';
import {
  runVerification,
  getVerificationSummary,
  type VerificationStage,
} from '../lib/verification.js';
import { generateReport } from '../lib/reports.js';
import { setBudget, checkBudget, recordSpend } from '../lib/budget.js';
import { ApiAgent, loadApiKeys } from '../lib/api-agent.js';
import { MODEL_PRESETS } from '../lib/templates.js';
import { saveLearning } from '../lib/memory.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEM_WORKERS = [
  'waste-hunter',
  'cannibal-detector',
  'trend-analyst',
  'pmax-auditor',
  'opportunity-mapper',
  'decision-differ',
] as const;

type SemWorker = typeof SEM_WORKERS[number];

const WORKER_SYSTEM_PROMPTS: Record<SemWorker, string> = {
  'waste-hunter': `You are the waste-hunter agent in an SEM audit. Analyze the search term data provided and identify all zero-conversion terms with significant spend. Group terms by campaign and ad group to surface systematic waste patterns. Calculate total wasted spend per group. Focus on terms where cost > 0 and conversions == 0.`,
  'cannibal-detector': `You are the cannibal-detector agent in an SEM audit. Analyze search terms that appear across multiple campaigns simultaneously. Calculate CPC differences between campaigns bidding on the same terms and estimate the overpayment due to internal bid inflation. Flag ad groups within the same campaign that target overlapping intent.`,
  'trend-analyst': `You are the trend-analyst agent in an SEM audit. Analyze impression and click data to identify performance patterns, anomalies, and seasonal trends. Flag any metric that deviates significantly from account averages. Identify day-of-week skews and impression share trends that signal Quality Score erosion.`,
  'pmax-auditor': `You are the pmax-auditor agent in an SEM audit. Identify all Performance Max campaigns in the dataset and compare their performance against non-PMax benchmarks. Flag underperforming asset groups and Smart Bidding target vs. actual gaps. Identify PMax cannibalization of branded search.`,
  'opportunity-mapper': `You are the opportunity-mapper agent in an SEM audit. Find converting keywords with low impression share (undertapped opportunities) and build a recommended negative keyword list from high-spend zero-conversion terms. Identify "golden terms" with conversion rates far above the account average that should be added as exact match keywords.`,
  'decision-differ': `You are the decision-differ agent in an SEM audit. Analyze the full dataset to identify before/after change correlations. Look for patterns suggesting recent bid adjustments, budget changes, or keyword status changes that had measurable negative impact. Correlate performance outliers with potential account changes.`,
};

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  csvPath: string;
  outputDir: string;
  verify: boolean;
  verifyFull: boolean;
  budgetUsd: number | null;
  accountName: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printUsage();
    process.exit(0);
  }

  const csvPath = resolve(args[0]);
  let outputDir = resolve('./audit-output');
  let verify = false;
  let verifyFull = false;
  let budgetUsd: number | null = null;
  let accountName = '';

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--output' && args[i + 1]) {
      outputDir = resolve(args[++i]);
    } else if (arg === '--verify') {
      verify = true;
    } else if (arg === '--verify-full') {
      verifyFull = true;
    } else if (arg === '--budget' && args[i + 1]) {
      budgetUsd = parseFloat(args[++i]);
    } else if (arg === '--account' && args[i + 1]) {
      accountName = args[++i];
    }
  }

  if (!accountName) {
    accountName = basename(csvPath, '.csv').replace(/[_-]/g, ' ');
  }

  return { csvPath, outputDir, verify, verifyFull, budgetUsd, accountName };
}

function printUsage(): void {
  process.stdout.write(`
Claude Commander — SEM Audit CSV Runner

Usage:
  npx tsx src/cli/audit-csv.ts <csv-file> [options]

Options:
  --output <dir>    Output directory (default: ./audit-output)
  --verify          Run verification pipeline (stages 1-2)
  --verify-full     Run full verification (stages 1-5)
  --budget <usd>    Set budget cap in USD (e.g. 5.00)
  --account <name>  Account name for reports (default: derived from filename)

Examples:
  npx tsx src/cli/audit-csv.ts ./search-terms.csv
  npx tsx src/cli/audit-csv.ts ./search-terms.csv --output ./results --verify --budget 3.00
`.trimStart());
}

// ---------------------------------------------------------------------------
// Progress output (stderr)
// ---------------------------------------------------------------------------

function log(msg: string): void {
  process.stderr.write(`[audit-csv] ${msg}\n`);
}

function logSection(title: string): void {
  process.stderr.write(`\n[audit-csv] === ${title} ===\n`);
}

// ---------------------------------------------------------------------------
// Finding extraction from agent response
// ---------------------------------------------------------------------------

function extractFindingsFromResponse(
  responseText: string,
  worker: SemWorker
): Finding[] {
  // Look for a JSON array in the response (possibly wrapped in a code block)
  const jsonPatterns = [
    /```json\s*([\s\S]*?)```/i,
    /```\s*([\s\S]*?)```/,
    /(\[[\s\S]*\])/,
  ];

  for (const pattern of jsonPatterns) {
    const match = responseText.match(pattern);
    if (!match) continue;

    const raw = (match[1] ?? match[0]).trim();
    if (!raw.startsWith('[')) continue;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = JSON.parse(raw) as any[];
      const findings: Finding[] = [];

      for (const item of parsed) {
        if (!item || typeof item !== 'object') continue;

        const finding = createFinding({
          type: String(item['type'] ?? 'wasted_spend'),
          severity: item['severity'] ?? 'medium',
          title: String(item['title'] ?? 'Untitled finding'),
          description: String(item['description'] ?? ''),
          evidence_chain: buildEvidenceChain(item['evidence'] ?? []),
          confidence: typeof item['confidence'] === 'number' ? item['confidence'] : 0.8,
          dollar_impact: typeof item['dollar_impact'] === 'number' ? item['dollar_impact'] : undefined,
          source_documents: [{ document_id: 'search-term-report', file_path: 'data/search-terms.csv' }],
          cross_references: [],
          worker,
        });

        findings.push(finding);
      }

      if (findings.length > 0) return findings;
    } catch {
      // Try next pattern
    }
  }

  log(`  [${worker}] Could not parse structured findings — creating summary finding`);

  // Fallback: wrap the text response as a single info finding
  return [
    createFinding({
      type: 'audit_summary',
      severity: 'info',
      title: `${worker} analysis output`,
      description: responseText.slice(0, 2000),
      evidence_chain: [{
        document: { document_id: 'search-term-report', file_path: 'data/search-terms.csv' },
        excerpt: 'See agent response',
        context: '',
        confidence: 0.5,
      }],
      confidence: 0.5,
      source_documents: [{ document_id: 'search-term-report', file_path: 'data/search-terms.csv' }],
      cross_references: [],
      worker,
    }),
  ];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildEvidenceChain(evidence: any[]): Finding['evidence_chain'] {
  if (!Array.isArray(evidence)) return [];

  return evidence.slice(0, 10).map((ev) => ({
    document: { document_id: 'search-term-report', file_path: 'data/search-terms.csv' },
    excerpt: [
      ev['search_term'] ? `search_term: "${String(ev['search_term'])}"` : '',
      ev['campaign']    ? `campaign: "${String(ev['campaign'])}"` : '',
      ev['cost']        ? `cost: $${String(ev['cost'])}` : '',
      ev['conversions'] !== undefined ? `conversions: ${String(ev['conversions'])}` : '',
    ].filter(Boolean).join(', '),
    context: String(ev['ad_group'] ?? ''),
    confidence: 0.9,
  }));
}

// ---------------------------------------------------------------------------
// Mode 1: API execution
// ---------------------------------------------------------------------------

async function runWithApi(
  args: CliArgs,
  apiKey: string,
): Promise<Finding[][]> {
  logSection('API Execution Mode');
  log(`Running 6 workers in parallel via Anthropic API`);

  if (args.budgetUsd !== null) {
    setBudget(args.outputDir, args.budgetUsd);
    log(`Budget cap set: $${args.budgetUsd.toFixed(2)}`);
  }

  const data = await parseSemCsv(args.csvPath);
  log(`Parsed ${data.length} rows from ${basename(args.csvPath)}`);

  const packages = distributeDataToWorkers(data, [...SEM_WORKERS]);
  log(`Distributed data to ${packages.length} workers`);

  const workerTasks = packages.map(async (pkg): Promise<Finding[]> => {
    const worker = pkg.worker as SemWorker;
    const systemPrompt = WORKER_SYSTEM_PROMPTS[worker] ??
      `You are the ${worker} agent in an SEM audit.`;

    const dataPreview = pkg.data.slice(0, 500); // cap to avoid huge prompts
    const csvRows = [
      'search_term,campaign,ad_group,impressions,clicks,cost,conversions,conversion_value',
      ...dataPreview.map((r) =>
        `"${r.search_term}","${r.campaign}","${r.ad_group}",${r.impressions},${r.clicks},${r.cost},${r.conversions},${r.conversion_value}`
      ),
    ].join('\n');

    const taskPrompt = `## Data Package for ${worker}
${pkg.task_description}

## CSV Data (${pkg.data.length} rows${pkg.data.length > 500 ? ', showing first 500' : ''})
\`\`\`csv
${csvRows}
\`\`\`

## Output Format
Return your findings as a JSON array. Each finding must have:
{
  "type": "wasted_spend" | "cannibalization" | "missed_opportunity" | "trend_anomaly" | "pmax_inefficiency" | "decision_impact",
  "severity": "critical" | "high" | "medium" | "low",
  "title": "short description",
  "description": "detailed explanation with specific terms and amounts",
  "dollar_impact": number,
  "confidence": number (0-1),
  "evidence": [{"search_term": "...", "campaign": "...", "cost": number, "conversions": number}]
}

Return ONLY the JSON array. No other text.`;

    const budgetCheck = checkBudget(args.outputDir);
    if (budgetCheck.exceeded) {
      log(`  [${worker}] SKIPPED — budget exceeded`);
      return [];
    }

    const agent = new ApiAgent({
      model: MODEL_PRESETS['sonnet']!,
      systemPrompt,
      maxRetries: 2,
      timeoutMs: 120_000,
    });

    log(`  [${worker}] Starting (${pkg.data.length} rows)...`);
    const startMs = Date.now();

    try {
      const response = await agent.execute(taskPrompt);
      const durationSec = ((Date.now() - startMs) / 1000).toFixed(1);

      log(`  [${worker}] Done in ${durationSec}s — $${response.usage.cost_usd.toFixed(4)} — ${response.usage.output_tokens} output tokens`);

      if (args.budgetUsd !== null) {
        recordSpend(args.outputDir, {
          worker,
          model: response.model,
          tokens_input: response.usage.input_tokens,
          tokens_output: response.usage.output_tokens,
          tokens_cached: response.usage.cached_tokens,
          cost_usd: response.usage.cost_usd,
          timestamp: new Date().toISOString(),
        });
      }

      return extractFindingsFromResponse(response.content, worker);
    } catch (err) {
      log(`  [${worker}] ERROR: ${String(err)}`);
      return [];
    }
  });

  return Promise.all(workerTasks);
}

// ---------------------------------------------------------------------------
// Mode 2: tmux fallback — print instructions
// ---------------------------------------------------------------------------

async function runTmuxMode(args: CliArgs): Promise<Finding[][]> {
  logSection('tmux Execution Mode (no API key)');

  const data = await parseSemCsv(args.csvPath);
  log(`Parsed ${data.length} rows from ${basename(args.csvPath)}`);

  const packages = distributeDataToWorkers(data, [...SEM_WORKERS]);

  // Write distribution files so user can manually trigger workers
  for (const pkg of packages) {
    const pkgDir = resolve(args.outputDir, 'distribution');
    mkdirSync(pkgDir, { recursive: true });
    const outFile = resolve(pkgDir, `${pkg.worker}.json`);
    writeFileSync(outFile, JSON.stringify(pkg, null, 2), 'utf8');
  }

  process.stdout.write(`
=== SEM Audit — Manual Execution Instructions ===

No ANTHROPIC_API_KEY found. To run this audit via the Claude Commander server:

1. Ensure the server is running:
   http://127.0.0.1:7700

2. Initialise a SEM audit project:
   npx tsx src/cli/index.ts init --template sem-audit --name "${args.accountName}"

3. Copy your CSV into the project data directory:
   cp "${args.csvPath}" <project-dir>/data/search-terms.csv

4. Data packages for each worker have been pre-distributed to:
   ${resolve(args.outputDir, 'distribution')}/

5. Monitor agent progress via the PWA:
   http://127.0.0.1:7700

6. Once all workers are complete, collect findings from:
   <project-dir>/.claude-coord/*/RESULT.md

To enable API mode, set your API key:
   export ANTHROPIC_API_KEY=sk-ant-...

Then re-run this command.
`);

  return [];
}

// ---------------------------------------------------------------------------
// Post-processing: cross-reference, verify, report
// ---------------------------------------------------------------------------

async function postProcess(
  args: CliArgs,
  allFindings: Finding[][],
): Promise<Finding[]> {
  logSection('Post-Processing');

  const merged = mergeFindings(allFindings);
  log(`Merged findings: ${merged.length} total (deduplicated)`);

  if (merged.length === 0) {
    log('No findings to process.');
    return [];
  }

  // Cross-reference detection
  log('Running cross-reference entity extraction...');
  const graph = new CrossReferenceGraph('sem');

  for (const finding of merged) {
    const docRef = {
      document_id: 'search-term-report',
      file_path: 'data/search-terms.csv',
    };

    const entities = extractEntities(
      `${finding.title} ${finding.description}`,
      'sem',
      docRef,
      finding.worker,
    );

    for (const entity of entities) {
      graph.addEntity(entity);
    }
  }

  const crossRefSummary = graph.getSummary();
  log(`Cross-reference graph: ${crossRefSummary.total_entities} entities, ${crossRefSummary.conflicts.length} conflicts`);

  // Verification
  let verifiedFindings = merged;

  if (args.verifyFull || args.verify) {
    const stages: VerificationStage[] = args.verifyFull
      ? [1, 2, 3, 4, 5]
      : [1, 2];

    log(`Running verification pipeline (stages ${stages.join(', ')})...`);
    const verificationResults = runVerification(merged, {
      stages,
      domain: 'sem',
      escalateDisagreements: true,
    });

    const summary = getVerificationSummary(verificationResults);
    log(`Verification: ${summary.passed}/${summary.total_findings} passed — avg confidence ${(summary.avg_confidence_after * 100).toFixed(0)}%`);

    // Apply verified status back to findings
    const resultMap = new Map(verificationResults.map((r) => [r.finding_id, r]));
    verifiedFindings = merged.map((f) => {
      const result = resultMap.get(f.finding_id);
      if (!result) return f;
      return {
        ...f,
        verified: true,
        confidence: result.adjusted_confidence,
        verification: {
          stage: Math.max(...result.stages_completed, 0),
          verified_by: result.verified_by,
          original_confidence: result.original_confidence,
          adjusted_confidence: result.adjusted_confidence,
          disagreements: result.disagreements.map((d) => d.issue),
        },
      };
    });
  }

  return verifiedFindings;
}

// ---------------------------------------------------------------------------
// Output writing
// ---------------------------------------------------------------------------

function writeOutputs(
  args: CliArgs,
  findings: Finding[],
): void {
  logSection('Writing Output Files');

  mkdirSync(args.outputDir, { recursive: true });

  // findings.json, sentinel-findings.json, audit-report.md
  writeFindingsReport(findings, args.outputDir);
  log(`Written: findings.json`);
  log(`Written: sentinel-findings.json`);
  log(`Written: audit-report.md`);

  // Generate a richer Markdown report via the reports module
  const report = generateReport(findings, {
    format: 'markdown',
    type: 'executive',
    domain: 'sem',
    title: `SEM Audit — ${args.accountName}`,
    includeEvidence: true,
    includeCrossRefs: false,
    includeVerification: args.verify || args.verifyFull,
  });

  writeFileSync(
    resolve(args.outputDir, 'executive-report.md'),
    report.content,
    'utf8',
  );
  log(`Written: executive-report.md`);
}

// ---------------------------------------------------------------------------
// Learning extraction
// ---------------------------------------------------------------------------

function saveLearnings(
  args: CliArgs,
  findings: Finding[],
  totalCostUsd: number,
): void {
  const totalImpact = findings.reduce((s, f) => s + (f.dollar_impact ?? 0), 0);
  const criticalCount = findings.filter((f) => f.severity === 'critical').length;
  const highCount = findings.filter((f) => f.severity === 'high').length;

  try {
    saveLearning({
      title: `SEM Audit — ${args.accountName}`,
      content: [
        `Account: ${args.accountName}`,
        `Input: ${basename(args.csvPath)}`,
        `Findings: ${findings.length} total (${criticalCount} critical, ${highCount} high)`,
        `Total dollar impact: $${totalImpact.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
        `Analysis cost: $${totalCostUsd.toFixed(4)}`,
        `Output: ${args.outputDir}`,
        `Workers run: ${SEM_WORKERS.join(', ')}`,
        `Verification: ${args.verifyFull ? 'full (1-5)' : args.verify ? 'partial (1-2)' : 'none'}`,
      ].join('\n'),
      domain: 'sem',
      tags: ['sem-audit', 'google-ads', 'csv', 'api-mode'],
      source: {
        project: args.accountName,
        worker: 'audit-csv-cli',
        task: 'sem-audit',
      },
    });
    log('Learning saved to memory');
  } catch {
    // Non-fatal — memory write failure should not abort the script
  }
}

// ---------------------------------------------------------------------------
// Print final summary to stdout
// ---------------------------------------------------------------------------

function printSummary(args: CliArgs, findings: Finding[]): void {
  const totalImpact = findings.reduce((s, f) => s + (f.dollar_impact ?? 0), 0);
  const bySeverity = {
    critical: findings.filter((f) => f.severity === 'critical').length,
    high:     findings.filter((f) => f.severity === 'high').length,
    medium:   findings.filter((f) => f.severity === 'medium').length,
    low:      findings.filter((f) => f.severity === 'low').length,
    info:     findings.filter((f) => f.severity === 'info').length,
  };

  process.stdout.write(`\n`);
  process.stdout.write(`SEM Audit Complete — ${args.accountName}\n`);
  process.stdout.write(`${'='.repeat(50)}\n`);
  process.stdout.write(`Findings: ${findings.length}\n`);
  process.stdout.write(`  Critical: ${bySeverity.critical}  High: ${bySeverity.high}  Medium: ${bySeverity.medium}  Low: ${bySeverity.low}  Info: ${bySeverity.info}\n`);
  process.stdout.write(`Total Dollar Impact: $${totalImpact.toLocaleString('en-US', { maximumFractionDigits: 0 })}\n`);
  process.stdout.write(`\nOutput files:\n`);
  process.stdout.write(`  ${args.outputDir}/findings.json\n`);
  process.stdout.write(`  ${args.outputDir}/sentinel-findings.json\n`);
  process.stdout.write(`  ${args.outputDir}/audit-report.md\n`);
  process.stdout.write(`  ${args.outputDir}/executive-report.md\n`);
  process.stdout.write(`\n`);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs();

  // Validate input file
  if (!existsSync(args.csvPath)) {
    process.stderr.write(`Error: CSV file not found: ${args.csvPath}\n`);
    process.exit(1);
  }

  log(`Starting SEM audit for: ${args.accountName}`);
  log(`Input: ${args.csvPath}`);
  log(`Output: ${args.outputDir}`);

  // Ensure output directory exists before API calls so budget/spend files land there
  mkdirSync(args.outputDir, { recursive: true });

  // Determine execution mode
  const apiKeys = loadApiKeys();
  const hasApiKey = Boolean(apiKeys['anthropic']);

  let allFindingArrays: Finding[][];

  if (hasApiKey) {
    allFindingArrays = await runWithApi(args, apiKeys['anthropic']!);
  } else {
    allFindingArrays = await runTmuxMode(args);
    if (allFindingArrays.length === 0) {
      // tmux mode: instructions printed, nothing more to do
      process.exit(0);
    }
  }

  // Post-process: merge, cross-reference, verify
  const findings = await postProcess(args, allFindingArrays);

  // Write output files
  if (findings.length > 0) {
    writeOutputs(args, findings);
  } else {
    log('No findings produced — skipping output files.');
  }

  // Save learnings to memory
  const budgetStatus = checkBudget(args.outputDir);
  const totalCostUsd = args.budgetUsd !== null
    ? (args.budgetUsd ?? 0) - budgetStatus.remaining
    : 0;

  saveLearnings(args, findings, totalCostUsd);

  // Print summary
  printSummary(args, findings);
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${String(err)}\n`);
  process.exit(1);
});
