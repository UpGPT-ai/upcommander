/**
 * Claude Commander — Report Generation
 *
 * Produces formatted reports from analysis findings in multiple
 * formats (HTML, Markdown, JSON) with domain-specific templates.
 */
import type { Finding } from './output-schemas.js';
import type { CrossRefSummary } from './cross-reference.js';
import type { VerificationResult } from './verification.js';
export type ReportFormat = 'html' | 'markdown' | 'json';
export type ReportType = 'executive' | 'technical' | 'domain-specific';
export interface ReportConfig {
    format: ReportFormat;
    type: ReportType;
    domain: string;
    title: string;
    author?: string;
    date?: string;
    /** Include full evidence chains in the output. */
    includeEvidence: boolean;
    /** Include cross-reference analysis section. */
    includeCrossRefs: boolean;
    /** Include verification results section. */
    includeVerification: boolean;
    /** Limit findings shown in executive summary (default 10). */
    maxFindings?: number;
}
export interface GeneratedReport {
    title: string;
    format: ReportFormat;
    type: ReportType;
    content: string;
    generated_at: string;
    findings_count: number;
    /** Rough page count estimate for print (approx 3000 chars/page). */
    pages_estimate: number;
}
/**
 * Generate a formatted report from findings with optional verification and
 * cross-reference sections.
 */
export declare function generateReport(findings: Finding[], config: ReportConfig, verification?: VerificationResult[], crossRefSummary?: CrossRefSummary): GeneratedReport;
/**
 * Generate a 1-2 page executive overview, top findings by impact.
 * Uses HTML format by default.
 */
export declare function generateExecutiveSummary(findings: Finding[], domain: string, title: string): GeneratedReport;
/**
 * Generate a full technical report with evidence chains.
 */
export declare function generateTechnicalReport(findings: Finding[], domain: string, title: string): GeneratedReport;
/**
 * Generate a domain-specific report using the appropriate template.
 */
export declare function generateDomainReport(findings: Finding[], domain: string, title: string): GeneratedReport;
//# sourceMappingURL=reports.d.ts.map