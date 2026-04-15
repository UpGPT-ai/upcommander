/**
 * SEM Sentinel Bridge — connects Claude Commander to SEM Sentinel data.
 * Handles CSV data ingestion for SEM analysis and structured findings output.
 *
 * Responsibilities:
 * - Parse Google Ads search term report CSV files into typed SemDataRow objects
 * - Distribute parsed data to the appropriate audit workers based on analysis type
 * - Convert Claude Commander Finding objects to SEM Sentinel's native format
 * - Write formatted audit reports to disk for downstream consumption
 */
import { type Finding } from '../output-schemas.js';
/** A single row from a Google Ads search term performance report. */
export interface SemDataRow {
    search_term: string;
    campaign: string;
    ad_group: string;
    impressions: number;
    clicks: number;
    cost: number;
    conversions: number;
    conversion_value: number;
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
export declare function parseSemCsv(filePath: string): Promise<SemDataRow[]>;
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
export declare function distributeDataToWorkers(data: SemDataRow[], workers: string[]): WorkerDataPackage[];
/**
 * Convert Claude Commander Finding objects to SEM Sentinel's native format.
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
export declare function formatFindingsForSentinel(findings: Finding[]): SentinelFinding[];
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
export declare function writeFindingsReport(findings: Finding[], outputPath: string): void;
//# sourceMappingURL=sentinel-bridge.d.ts.map