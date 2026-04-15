/**
 * SEM Sentinel Bridge — connects UpCommander to SEM Sentinel data.
 * Handles CSV data ingestion for SEM analysis and structured findings output.
 *
 * Responsibilities:
 * - Parse Google Ads search term report CSV files into typed SemDataRow objects
 * - Distribute parsed data to the appropriate audit workers based on analysis type
 * - Convert UpCommander Finding objects to SEM Sentinel's native format
 * - Write formatted audit reports to disk for downstream consumption
 */

import { createReadStream, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join } from 'node:path';
import { type Finding } from '../output-schemas.js';
import { BaseConnector, registerConnector } from './base.js';

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

/** A single row from a Google Ads search term performance report. */
export interface SemDataRow {
  search_term: string;
  campaign: string;
  ad_group: string;
  impressions: number;
  clicks: number;
  cost: number;              // in account currency (e.g. USD)
  conversions: number;
  conversion_value: number;  // revenue value attributed to conversions
}

/** A bundle of data destined for one specific audit worker. */
export interface WorkerDataPackage {
  worker: string;
  data: SemDataRow[];
  task_description: string;
}

/** SEM Sentinel's native finding format (for API/export compatibility). */
export interface SentinelFinding {
  finding_id: string;
  type: string;
  severity: string;
  title: string;
  dollar_impact: number;
  search_terms: string[];
  campaigns: string[];
  evidence: string;
}

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

/**
 * Parse a Google Ads search term report CSV file into typed SemDataRow objects.
 *
 * Expected column headers (case-insensitive, order-independent):
 *   Search term, Campaign, Ad group, Impressions, Clicks, Cost, Conversions, Conv. value
 *
 * Rows with missing required columns are silently skipped.
 *
 * @param filePath Absolute path to the CSV file
 * @returns Array of parsed SemDataRow objects
 */
export async function parseSemCsv(filePath: string): Promise<SemDataRow[]> {
  return new Promise((resolve, reject) => {
    const rows: SemDataRow[] = [];
    let headers: string[] = [];
    let isFirstLine = true;

    const rl = createInterface({
      input: createReadStream(filePath, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });

    rl.on('line', (rawLine) => {
      const line = rawLine.trim();
      if (!line) return;

      if (isFirstLine) {
        // Parse headers, normalising to lowercase + trimmed
        headers = parseCsvLine(line).map((h) => h.toLowerCase().trim());
        isFirstLine = false;
        return;
      }

      const values = parseCsvLine(line);
      const rowMap: Record<string, string> = {};
      for (let i = 0; i < headers.length; i++) {
        rowMap[headers[i]] = values[i] ?? '';
      }

      // Map flexible column name aliases to canonical fields
      const search_term =
        rowMap['search term'] ?? rowMap['search_term'] ?? rowMap['query'] ?? '';
      const campaign = rowMap['campaign'] ?? rowMap['campaign name'] ?? '';
      const ad_group = rowMap['ad group'] ?? rowMap['ad_group'] ?? rowMap['adgroup'] ?? '';

      if (!search_term || !campaign) return; // skip malformed rows

      const row: SemDataRow = {
        search_term,
        campaign,
        ad_group,
        impressions: parseMetric(rowMap['impressions']),
        clicks: parseMetric(rowMap['clicks']),
        cost: parseMetric(rowMap['cost']),
        conversions: parseMetric(rowMap['conversions']),
        conversion_value: parseMetric(
          rowMap['conv. value'] ?? rowMap['conversion_value'] ?? rowMap['conv value'] ?? '0'
        ),
      };

      rows.push(row);
    });

    rl.on('close', () => resolve(rows));
    rl.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Data distribution
// ---------------------------------------------------------------------------

/**
 * Split parsed SEM data into worker-specific packages based on analysis type.
 *
 * Distribution rules:
 * - waste-hunter: all rows (needs full picture to spot zero-conversion spend)
 * - cannibal-detector: only rows where the same search_term appears in multiple campaigns
 * - trend-analyst: all rows with impressions > 0 (needs volume for trend calculation)
 * - pmax-auditor: only rows from campaigns with "pmax" or "performance max" in the name
 * - opportunity-mapper: rows with conversions > 0 OR (impressions > 100 AND conversions == 0)
 * - decision-differ: all rows (needs full picture to correlate changes)
 *
 * Workers not in the target list receive an empty package.
 *
 * @param data Parsed SEM data rows
 * @param workers List of worker names to distribute to
 * @returns Array of WorkerDataPackage, one per worker
 */
export function distributeDataToWorkers(
  data: SemDataRow[],
  workers: string[]
): WorkerDataPackage[] {
  // Pre-compute: which search terms appear in multiple campaigns?
  const termCampaignMap = new Map<string, Set<string>>();
  for (const row of data) {
    const campaigns = termCampaignMap.get(row.search_term) ?? new Set<string>();
    campaigns.add(row.campaign);
    termCampaignMap.set(row.search_term, campaigns);
  }
  const cannibalizedTerms = new Set(
    [...termCampaignMap.entries()]
      .filter(([, campaigns]) => campaigns.size > 1)
      .map(([term]) => term)
  );

  // Pre-compute: PMax campaign names
  const pmaxPattern = /pmax|performance.?max/i;
  const pmaxCampaigns = new Set(
    data
      .filter((r) => pmaxPattern.test(r.campaign))
      .map((r) => r.campaign)
  );

  const packages: WorkerDataPackage[] = [];

  for (const worker of workers) {
    let workerData: SemDataRow[];
    let taskDescription: string;

    switch (worker) {
      case 'waste-hunter':
        workerData = data;
        taskDescription =
          `Analyze all ${data.length} search term rows. ` +
          `Identify terms with spend > 0 and conversions == 0. ` +
          `Group by campaign and ad group. Calculate total wasted spend per group.`;
        break;

      case 'cannibal-detector':
        workerData = data.filter((r) => cannibalizedTerms.has(r.search_term));
        taskDescription =
          `Analyze ${workerData.length} rows representing ${cannibalizedTerms.size} ` +
          `search terms that appear across multiple campaigns. ` +
          `Calculate CPC differences and estimate overpayment from internal bid inflation.`;
        break;

      case 'trend-analyst':
        workerData = data.filter((r) => r.impressions > 0);
        taskDescription =
          `Analyze ${workerData.length} rows with impression data. ` +
          `Calculate rolling averages, identify seasonal patterns, ` +
          `and flag statistical anomalies in CTR, CPC, and conversion rate.`;
        break;

      case 'pmax-auditor':
        workerData = data.filter((r) => pmaxCampaigns.has(r.campaign));
        taskDescription =
          `Analyze ${workerData.length} rows from ${pmaxCampaigns.size} PMax campaigns. ` +
          `Compare PMax performance against non-PMax benchmarks in the same account. ` +
          `Identify underperforming asset groups and Smart Bidding target vs. actual gaps.`;
        break;

      case 'opportunity-mapper':
        workerData = data.filter(
          (r) => r.conversions > 0 || (r.impressions > 100 && r.conversions === 0)
        );
        taskDescription =
          `Analyze ${workerData.length} rows: converting terms and high-impression zero-conversion terms. ` +
          `Find converting terms with low impression share. ` +
          `Build recommended negative keyword list from high-spend zero-conversion terms.`;
        break;

      case 'decision-differ':
        workerData = data;
        taskDescription =
          `Analyze all ${data.length} rows for before/after change correlations. ` +
          `If a change history log is available in data/, parse it and correlate ` +
          `each change event with the 7-day pre/post performance delta.`;
        break;

      default:
        // Unknown worker — send empty package
        workerData = [];
        taskDescription = `No specific data distribution defined for worker "${worker}".`;
    }

    packages.push({ worker, data: workerData, task_description: taskDescription });
  }

  return packages;
}

// ---------------------------------------------------------------------------
// Format conversion
// ---------------------------------------------------------------------------

/**
 * Convert UpCommander Finding objects to SEM Sentinel's native format.
 *
 * Maps:
 * - finding.finding_id → sentinel.finding_id
 * - finding.type → sentinel.type
 * - finding.severity → sentinel.severity
 * - finding.title → sentinel.title
 * - finding.dollar_impact → sentinel.dollar_impact (0 if absent)
 * - entities extracted from evidence_chain → sentinel.search_terms and sentinel.campaigns
 * - finding.description → sentinel.evidence
 *
 * @param findings Array of Finding objects from the audit workers
 * @returns Array of SentinelFinding objects in Sentinel's native format
 */
export function formatFindingsForSentinel(findings: Finding[]): SentinelFinding[] {
  return findings.map((f) => {
    // Extract search terms and campaigns from evidence chain excerpts
    const searchTerms = new Set<string>();
    const campaigns = new Set<string>();

    for (const link of f.evidence_chain) {
      // Heuristic: excerpts often contain "search_term: X, campaign: Y" patterns
      const termMatch = link.excerpt.match(/search[_ ]?term[:\s]+"?([^",\n]+)"?/i);
      if (termMatch?.[1]) searchTerms.add(termMatch[1].trim());

      const campaignMatch = link.excerpt.match(/campaign[:\s]+"?([^",\n]+)"?/i);
      if (campaignMatch?.[1]) campaigns.add(campaignMatch[1].trim());
    }

    // Also extract from cross_references that look like keyword entities
    for (const ref of f.cross_references) {
      if (ref.startsWith('kw:')) searchTerms.add(ref.slice(3));
      if (ref.startsWith('campaign:')) campaigns.add(ref.slice(9));
    }

    const sentinel: SentinelFinding = {
      finding_id: f.finding_id,
      type: f.type,
      severity: f.severity,
      title: f.title,
      dollar_impact: f.dollar_impact ?? 0,
      search_terms: Array.from(searchTerms),
      campaigns: Array.from(campaigns),
      evidence: f.description,
    };

    return sentinel;
  });
}

// ---------------------------------------------------------------------------
// Report writing
// ---------------------------------------------------------------------------

/**
 * Write a structured audit report to disk, containing both the raw findings
 * JSON and a human-readable Markdown summary.
 *
 * Output files:
 *   <outputPath>/findings.json — full Finding array
 *   <outputPath>/sentinel-findings.json — SentinelFinding array (Sentinel-compatible)
 *   <outputPath>/audit-report.md — human-readable Markdown report
 *
 * @param findings Array of Finding objects to include in the report
 * @param outputPath Absolute directory path where report files will be written
 */
export function writeFindingsReport(findings: Finding[], outputPath: string): void {
  // 1. Write raw findings JSON
  writeFileSync(
    join(outputPath, 'findings.json'),
    JSON.stringify(findings, null, 2),
    'utf8'
  );

  // 2. Write Sentinel-compatible findings JSON
  const sentinelFindings = formatFindingsForSentinel(findings);
  writeFileSync(
    join(outputPath, 'sentinel-findings.json'),
    JSON.stringify(sentinelFindings, null, 2),
    'utf8'
  );

  // 3. Write human-readable Markdown report
  const report = buildMarkdownReport(findings, sentinelFindings);
  writeFileSync(join(outputPath, 'audit-report.md'), report, 'utf8');
}

// ---------------------------------------------------------------------------
// SEM Sentinel Connector implementation
// ---------------------------------------------------------------------------

/**
 * DataConnector implementation for SEM Sentinel CSV data.
 * Wraps parseSemCsv() behind the standard connector interface.
 */
class SentinelBridgeConnector extends BaseConnector {
  readonly name = 'sentinel-csv';

  private connected = false;
  private config: Record<string, unknown> = {};

  async connect(config: Record<string, unknown>): Promise<void> {
    // Validate that a data directory is provided
    if (!config['dataDir'] && !config['filePath']) {
      throw new Error(
        'SentinelBridgeConnector requires "dataDir" or "filePath" in config.'
      );
    }
    this.config = config;
    this.connected = true;
  }

  async query(params: Record<string, unknown>): Promise<SemDataRow[]> {
    this.assertConnected();

    const filePath =
      (params['filePath'] as string) ??
      (this.config['filePath'] as string) ??
      join(this.config['dataDir'] as string, 'search-terms.csv');

    return parseSemCsv(filePath);
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.config = {};
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// Register the connector so it can be retrieved by name
registerConnector('sentinel-csv', new SentinelBridgeConnector());

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Parse a single CSV line, respecting double-quoted fields that may contain commas.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        // Escaped quote inside a quoted field
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  fields.push(current.trim());
  return fields;
}

/**
 * Parse a numeric metric string from a CSV cell, stripping currency symbols,
 * percentage signs, and thousand-separator commas.
 *
 * Returns 0 for empty, non-numeric, or "--" values.
 */
function parseMetric(raw: string | undefined): number {
  if (!raw || raw === '--' || raw === '') return 0;
  const cleaned = raw.replace(/[$,%]/g, '').replace(/,/g, '').trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Build a Markdown audit report from findings.
 */
function buildMarkdownReport(
  findings: Finding[],
  sentinelFindings: SentinelFinding[]
): string {
  const timestamp = new Date().toISOString();
  const totalImpact = findings.reduce((sum, f) => sum + (f.dollar_impact ?? 0), 0);

  const criticalCount = findings.filter((f) => f.severity === 'critical').length;
  const highCount = findings.filter((f) => f.severity === 'high').length;
  const mediumCount = findings.filter((f) => f.severity === 'medium').length;

  const lines: string[] = [
    `# SEM Audit Report`,
    ``,
    `_Generated: ${timestamp}_`,
    ``,
    `## Executive Summary`,
    ``,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Total Findings | ${findings.length} |`,
    `| Critical | ${criticalCount} |`,
    `| High | ${highCount} |`,
    `| Medium | ${mediumCount} |`,
    `| Total Dollar Impact | $${totalImpact.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} |`,
    ``,
    `## Findings`,
    ``,
    `| ID | Type | Severity | Title | Impact | Worker |`,
    `|---|---|---|---|---|---|`,
  ];

  for (const f of findings) {
    const impact = f.dollar_impact
      ? `$${f.dollar_impact.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : '—';
    lines.push(
      `| ${f.finding_id} | ${f.type} | ${f.severity} | ${f.title} | ${impact} | ${f.worker} |`
    );
  }

  lines.push(``, `## Sentinel-Compatible Findings`, ``);
  lines.push(`\`\`\`json`);
  lines.push(JSON.stringify(sentinelFindings, null, 2));
  lines.push(`\`\`\``);

  return lines.join('\n');
}
