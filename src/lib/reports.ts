/**
 * Claude Commander — Report Generation
 *
 * Produces formatted reports from analysis findings in multiple
 * formats (HTML, Markdown, JSON) with domain-specific templates.
 */

import type { Finding, FindingSeverity } from './output-schemas.js';
import type { CrossRefSummary } from './cross-reference.js';
import type { VerificationResult, VerificationSummary } from './verification.js';
import { getVerificationSummary } from './verification.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Severity helpers
// ---------------------------------------------------------------------------

const SEVERITY_ORDER: Record<FindingSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

const SEVERITY_EMOJI: Record<FindingSeverity, string> = {
  critical: '[CRITICAL]',
  high: '[HIGH]',
  medium: '[MEDIUM]',
  low: '[LOW]',
  info: '[INFO]',
};

function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return (b.dollar_impact ?? 0) - (a.dollar_impact ?? 0);
  });
}

function formatDollar(amount: number | undefined): string {
  if (amount == null) return '—';
  return '$' + amount.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatPct(ratio: number): string {
  return (ratio * 100).toFixed(0) + '%';
}

function pageEstimate(content: string): number {
  return Math.max(1, Math.round(content.length / 3000));
}

function currentDate(override?: string): string {
  return override ?? new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// HTML template
// ---------------------------------------------------------------------------

const HTML_CSS = `
  body { font-family: Georgia, serif; max-width: 960px; margin: 0 auto; padding: 40px 24px; color: #1a1a1a; }
  h1 { font-size: 2rem; border-bottom: 3px solid #1a1a1a; padding-bottom: 12px; }
  h2 { font-size: 1.4rem; margin-top: 2rem; border-bottom: 1px solid #ccc; padding-bottom: 6px; }
  h3 { font-size: 1.1rem; margin-top: 1.5rem; color: #333; }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: 0.9rem; }
  th { background: #f0f0f0; text-align: left; padding: 8px 12px; border: 1px solid #ccc; }
  td { padding: 7px 12px; border: 1px solid #ddd; vertical-align: top; }
  tr:nth-child(even) td { background: #fafafa; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; }
  .badge-critical { background: #fee2e2; color: #991b1b; }
  .badge-high    { background: #ffedd5; color: #9a3412; }
  .badge-medium  { background: #fef9c3; color: #854d0e; }
  .badge-low     { background: #dbeafe; color: #1e40af; }
  .badge-info    { background: #f3f4f6; color: #374151; }
  .evidence-block { background: #f8f8f8; border-left: 3px solid #ccc; padding: 8px 16px; margin: 8px 0; font-size: 0.85rem; }
  .meta { color: #666; font-size: 0.85rem; margin-bottom: 24px; }
  .narrative { background: #f0f4ff; border: 1px solid #c7d7ff; border-radius: 6px; padding: 16px 20px; margin: 1rem 0; }
  footer { margin-top: 3rem; border-top: 1px solid #ccc; padding-top: 12px; color: #888; font-size: 0.8rem; }
  @media print { body { padding: 0; } }
`.trim();

function severityBadge(sev: FindingSeverity | 'critical' | 'high' | 'medium'): string {
  return `<span class="badge badge-${sev}">${sev.toUpperCase()}</span>`;
}

function renderHtmlFinding(f: Finding, includeEvidence: boolean): string {
  let html = `
    <tr>
      <td>${escapeHtml(f.finding_id)}</td>
      <td>${escapeHtml(f.type)}</td>
      <td>${severityBadge(f.severity)}</td>
      <td><strong>${escapeHtml(f.title)}</strong><br><small>${escapeHtml(f.description.slice(0, 200))}${f.description.length > 200 ? '...' : ''}</small></td>
      <td>${formatPct(f.confidence)}</td>
      <td>${formatDollar(f.dollar_impact)}</td>
      <td>${f.verified ? 'Yes' : 'No'}</td>
      <td>${escapeHtml(f.worker)}</td>
    </tr>`;

  if (includeEvidence && f.evidence_chain.length > 0) {
    html += `<tr><td colspan="8">`;
    for (const ev of f.evidence_chain) {
      html += `<div class="evidence-block">
        <strong>${escapeHtml(ev.document.title ?? ev.document.document_id)}</strong>
        ${ev.document.page != null ? `p.${ev.document.page}` : ''}
        <br><em>&quot;${escapeHtml(ev.excerpt)}&quot;</em>
        <br><small>Confidence: ${formatPct(ev.confidence)}</small>
      </div>`;
    }
    html += `</td></tr>`;
  }

  return html;
}

// ---------------------------------------------------------------------------
// Markdown helpers
// ---------------------------------------------------------------------------

function mdTable(headers: string[], rows: string[][]): string {
  const sep = headers.map(() => '---').join(' | ');
  return [
    `| ${headers.join(' | ')} |`,
    `| ${sep} |`,
    ...rows.map((r) => `| ${r.join(' | ')} |`),
  ].join('\n');
}

function mdFinding(f: Finding, includeEvidence: boolean): string {
  let md = `### ${SEVERITY_EMOJI[f.severity]} ${f.title}\n\n`;
  md += `**ID:** ${f.finding_id}  |  **Type:** ${f.type}  |  **Severity:** ${f.severity}  |  **Confidence:** ${formatPct(f.confidence)}`;
  if (f.dollar_impact != null) md += `  |  **Impact:** ${formatDollar(f.dollar_impact)}`;
  md += `\n\n${f.description}\n`;

  if (includeEvidence && f.evidence_chain.length > 0) {
    md += `\n**Evidence:**\n\n`;
    for (const ev of f.evidence_chain) {
      const docName = ev.document.title ?? ev.document.document_id;
      const page = ev.document.page != null ? ` (p.${ev.document.page})` : '';
      md += `> *"${ev.excerpt}"*\n> — ${docName}${page} | confidence ${formatPct(ev.confidence)}\n\n`;
    }
  }

  return md;
}

// ---------------------------------------------------------------------------
// Domain-specific sections
// ---------------------------------------------------------------------------

function domainSection(findings: Finding[], domain: string, format: ReportFormat): string {
  switch (domain) {
    case 'sem':
      return semSection(findings, format);
    case 'legal':
      return legalSection(findings, format);
    case 'pharma':
      return pharmaSection(findings, format);
    case 'due-diligence':
      return dueDiligenceSection(findings, format);
    case 'financial':
      return financialSection(findings, format);
    case 'prediction-market':
      return predictionMarketSection(findings, format);
    default:
      return '';
  }
}

// SEM: waste report + cannibalization + CFO summary
function semSection(findings: Finding[], format: ReportFormat): string {
  const waste = findings.filter((f) => f.type === 'wasted_spend');
  const cannibalization = findings.filter((f) => f.type === 'cannibalization');
  const totalWaste = waste.reduce((s, f) => s + (f.dollar_impact ?? 0), 0);

  if (format === 'markdown') {
    let md = `## SEM Analysis\n\n`;
    md += `### Waste Report\n\n`;
    if (waste.length > 0) {
      md += mdTable(
        ['Term / Campaign', 'Severity', 'Wasted Spend', 'Description'],
        waste.map((f) => [f.title, f.severity, formatDollar(f.dollar_impact), f.description.slice(0, 80)]),
      );
      md += `\n\n**Total wasted spend identified:** ${formatDollar(totalWaste)}\n\n`;
    } else {
      md += `No wasted spend findings.\n\n`;
    }

    md += `### Cannibalization Report\n\n`;
    if (cannibalization.length > 0) {
      md += mdTable(
        ['Campaign A', 'Severity', 'Impact', 'Description'],
        cannibalization.map((f) => [f.title, f.severity, formatDollar(f.dollar_impact), f.description.slice(0, 80)]),
      );
    } else {
      md += `No cannibalization findings.\n\n`;
    }

    md += `### CFO Summary\n\n`;
    md += `Total identified financial impact: **${formatDollar(totalWaste)}** in recoverable wasted spend.\n\n`;
    return md;
  }

  // HTML
  let html = `<h2>SEM Analysis</h2>`;
  html += `<h3>Waste Report</h3>`;
  html += `<table><tr><th>Term / Campaign</th><th>Severity</th><th>Wasted Spend</th><th>Description</th></tr>`;
  for (const f of waste) {
    html += `<tr><td>${escapeHtml(f.title)}</td><td>${severityBadge(f.severity)}</td><td>${formatDollar(f.dollar_impact)}</td><td>${escapeHtml(f.description.slice(0, 100))}</td></tr>`;
  }
  html += `</table><p><strong>Total wasted spend:</strong> ${formatDollar(totalWaste)}</p>`;

  html += `<h3>Cannibalization Report</h3>`;
  html += `<table><tr><th>Campaign</th><th>Severity</th><th>Impact</th><th>Description</th></tr>`;
  for (const f of cannibalization) {
    html += `<tr><td>${escapeHtml(f.title)}</td><td>${severityBadge(f.severity)}</td><td>${formatDollar(f.dollar_impact)}</td><td>${escapeHtml(f.description.slice(0, 100))}</td></tr>`;
  }
  html += `</table>`;
  html += `<h3>CFO Summary</h3><p>Total identified financial impact: <strong>${formatDollar(totalWaste)}</strong>.</p>`;
  return html;
}

// Legal: privilege log + hot documents + chronology
function legalSection(findings: Finding[], format: ReportFormat): string {
  const privilege = findings.filter((f) => f.type === 'privilege');
  const hot = findings.filter((f) => f.type === 'hot_document');
  const timeline = findings
    .filter((f) => f.type === 'timeline_event')
    .sort((a, b) => a.title.localeCompare(b.title));

  if (format === 'markdown') {
    let md = `## Legal Analysis\n\n`;
    md += `### Privilege Log\n\n`;
    if (privilege.length > 0) {
      md += mdTable(
        ['Document', 'Privilege Type', 'Basis', 'Confidence'],
        privilege.map((f) => [
          f.source_documents[0]?.title ?? f.source_documents[0]?.document_id ?? '—',
          f.type,
          f.description.slice(0, 80),
          formatPct(f.confidence),
        ]),
      );
    } else {
      md += `No privilege findings.\n\n`;
    }

    md += `\n### Hot Documents\n\n`;
    hot.slice(0, 20).forEach((f, i) => {
      md += `**${i + 1}. ${f.title}** (${f.severity})\n\n`;
      if (f.evidence_chain[0]) md += `> *"${f.evidence_chain[0].excerpt}"*\n\n`;
    });

    md += `### Chronology\n\n`;
    if (timeline.length > 0) {
      md += mdTable(['Date / Event', 'Description', 'Document'], timeline.map((f) => [
        f.title,
        f.description.slice(0, 100),
        f.source_documents[0]?.document_id ?? '—',
      ]));
    }
    return md;
  }

  let html = `<h2>Legal Analysis</h2>`;
  html += `<h3>Privilege Log</h3>`;
  html += `<table><tr><th>Document</th><th>Privilege Type</th><th>Basis</th><th>Confidence</th></tr>`;
  for (const f of privilege) {
    html += `<tr><td>${escapeHtml(f.source_documents[0]?.title ?? f.source_documents[0]?.document_id ?? '—')}</td><td>${escapeHtml(f.type)}</td><td>${escapeHtml(f.description.slice(0, 100))}</td><td>${formatPct(f.confidence)}</td></tr>`;
  }
  html += `</table>`;

  html += `<h3>Hot Documents</h3>`;
  hot.slice(0, 20).forEach((f, i) => {
    html += `<p><strong>${i + 1}. ${escapeHtml(f.title)}</strong> ${severityBadge(f.severity)}`;
    if (f.evidence_chain[0]) html += `<div class="evidence-block"><em>&quot;${escapeHtml(f.evidence_chain[0].excerpt)}&quot;</em></div>`;
    html += `</p>`;
  });

  html += `<h3>Chronology</h3>`;
  html += `<table><tr><th>Date / Event</th><th>Description</th><th>Document</th></tr>`;
  for (const f of timeline) {
    html += `<tr><td>${escapeHtml(f.title)}</td><td>${escapeHtml(f.description.slice(0, 100))}</td><td>${escapeHtml(f.source_documents[0]?.document_id ?? '—')}</td></tr>`;
  }
  html += `</table>`;
  return html;
}

// Pharma: gap analysis + cross-reference report + jurisdiction comparison
function pharmaSection(findings: Finding[], format: ReportFormat): string {
  const gaps = findings.filter((f) => f.type === 'completeness_gap' || f.type === 'cmc_gap');
  const crossRefBreaks = findings.filter((f) => f.type === 'cross_reference_break');
  const jurisdictionConflicts = findings.filter((f) => f.type === 'jurisdiction_conflict');

  if (format === 'markdown') {
    let md = `## Pharma Regulatory Analysis\n\n`;
    md += `### Gap Analysis\n\n`;
    if (gaps.length > 0) {
      md += mdTable(
        ['Module / Section', 'Gap Type', 'Severity', 'Description'],
        gaps.map((f) => [f.title, f.type, f.severity, f.description.slice(0, 100)]),
      );
    } else {
      md += `No completeness gaps detected.\n\n`;
    }

    md += `\n### Cross-Reference Report\n\n`;
    if (crossRefBreaks.length > 0) {
      md += mdTable(
        ['Reference', 'Severity', 'Description'],
        crossRefBreaks.map((f) => [f.title, f.severity, f.description.slice(0, 100)]),
      );
    } else {
      md += `No broken cross-references detected.\n\n`;
    }

    md += `\n### Jurisdiction Comparison\n\n`;
    if (jurisdictionConflicts.length > 0) {
      md += mdTable(
        ['Conflict', 'Severity', 'Description'],
        jurisdictionConflicts.map((f) => [f.title, f.severity, f.description.slice(0, 100)]),
      );
    } else {
      md += `No jurisdiction conflicts detected.\n\n`;
    }
    return md;
  }

  let html = `<h2>Pharma Regulatory Analysis</h2>`;
  html += `<h3>Gap Analysis</h3>`;
  html += `<table><tr><th>Module / Section</th><th>Gap Type</th><th>Severity</th><th>Description</th></tr>`;
  for (const f of gaps) {
    html += `<tr><td>${escapeHtml(f.title)}</td><td>${escapeHtml(f.type)}</td><td>${severityBadge(f.severity)}</td><td>${escapeHtml(f.description.slice(0, 100))}</td></tr>`;
  }
  html += `</table>`;
  html += `<h3>Cross-Reference Report</h3>`;
  html += `<table><tr><th>Reference</th><th>Severity</th><th>Description</th></tr>`;
  for (const f of crossRefBreaks) {
    html += `<tr><td>${escapeHtml(f.title)}</td><td>${severityBadge(f.severity)}</td><td>${escapeHtml(f.description.slice(0, 100))}</td></tr>`;
  }
  html += `</table>`;
  html += `<h3>Jurisdiction Comparison</h3>`;
  html += `<table><tr><th>Conflict</th><th>Severity</th><th>Description</th></tr>`;
  for (const f of jurisdictionConflicts) {
    html += `<tr><td>${escapeHtml(f.title)}</td><td>${severityBadge(f.severity)}</td><td>${escapeHtml(f.description.slice(0, 100))}</td></tr>`;
  }
  html += `</table>`;
  return html;
}

// Due Diligence: risk matrix + deal-breakers + valuation adjustments
function dueDiligenceSection(findings: Finding[], format: ReportFormat): string {
  const dealBreakers = findings.filter((f) => f.type === 'deal_breaker');
  const valuationRisks = findings.filter((f) => f.type === 'valuation_risk');
  const sorted = sortFindings(findings);

  if (format === 'markdown') {
    let md = `## Due Diligence Analysis\n\n`;
    md += `### Risk Matrix\n\n`;
    md += mdTable(
      ['Risk', 'Type', 'Severity', 'Impact'],
      sorted.map((f) => [f.title, f.type, f.severity, formatDollar(f.dollar_impact)]),
    );

    md += `\n### Deal-Breaker Report\n\n`;
    if (dealBreakers.length > 0) {
      dealBreakers.forEach((f) => {
        md += `**${f.title}**\n${f.description}\n\n`;
      });
    } else {
      md += `No deal-breaker findings.\n\n`;
    }

    md += `### Valuation Adjustment Table\n\n`;
    if (valuationRisks.length > 0) {
      md += mdTable(
        ['Risk Factor', 'Estimated Impact', 'Confidence'],
        valuationRisks.map((f) => [f.title, formatDollar(f.dollar_impact), formatPct(f.confidence)]),
      );
    } else {
      md += `No valuation risk findings.\n\n`;
    }
    return md;
  }

  let html = `<h2>Due Diligence Analysis</h2>`;
  html += `<h3>Risk Matrix</h3>`;
  html += `<table><tr><th>Risk</th><th>Type</th><th>Severity</th><th>Dollar Impact</th></tr>`;
  for (const f of sorted) {
    html += `<tr><td>${escapeHtml(f.title)}</td><td>${escapeHtml(f.type)}</td><td>${severityBadge(f.severity)}</td><td>${formatDollar(f.dollar_impact)}</td></tr>`;
  }
  html += `</table>`;
  html += `<h3>Deal-Breaker Report</h3>`;
  if (dealBreakers.length > 0) {
    for (const f of dealBreakers) {
      html += `<p><strong>${escapeHtml(f.title)}</strong></p><p>${escapeHtml(f.description)}</p>`;
    }
  } else {
    html += `<p>No deal-breaker findings.</p>`;
  }
  html += `<h3>Valuation Adjustment Table</h3>`;
  html += `<table><tr><th>Risk Factor</th><th>Estimated Impact</th><th>Confidence</th></tr>`;
  for (const f of valuationRisks) {
    html += `<tr><td>${escapeHtml(f.title)}</td><td>${formatDollar(f.dollar_impact)}</td><td>${formatPct(f.confidence)}</td></tr>`;
  }
  html += `</table>`;
  return html;
}

// Financial: scenario analysis + signal consensus + risk
function financialSection(findings: Finding[], format: ReportFormat): string {
  const signals = findings.filter((f) =>
    ['vol_mispricing', 'flow_anomaly', 'insider_signal', 'earnings_divergence'].includes(f.type),
  );
  const regime = findings.filter((f) => f.type === 'regime_shift');
  const totalImpact = findings.reduce((s, f) => s + (f.dollar_impact ?? 0), 0);

  if (format === 'markdown') {
    let md = `## Financial Analysis\n\n`;
    md += `### Signal Consensus Report\n\n`;
    if (signals.length > 0) {
      md += mdTable(
        ['Signal', 'Type', 'Severity', 'Confidence', 'Impact'],
        signals.map((f) => [f.title, f.type, f.severity, formatPct(f.confidence), formatDollar(f.dollar_impact)]),
      );
    } else {
      md += `No signal findings.\n\n`;
    }

    md += `\n### Risk Report\n\n`;
    if (regime.length > 0) {
      md += mdTable(
        ['Regime Event', 'Severity', 'Impact'],
        regime.map((f) => [f.title, f.severity, formatDollar(f.dollar_impact)]),
      );
    } else {
      md += `No regime-shift findings.\n\n`;
    }

    md += `\n**Total identified financial impact:** ${formatDollar(totalImpact)}\n\n`;
    return md;
  }

  let html = `<h2>Financial Analysis</h2>`;
  html += `<h3>Signal Consensus</h3>`;
  html += `<table><tr><th>Signal</th><th>Type</th><th>Severity</th><th>Confidence</th><th>Impact</th></tr>`;
  for (const f of signals) {
    html += `<tr><td>${escapeHtml(f.title)}</td><td>${escapeHtml(f.type)}</td><td>${severityBadge(f.severity)}</td><td>${formatPct(f.confidence)}</td><td>${formatDollar(f.dollar_impact)}</td></tr>`;
  }
  html += `</table>`;
  html += `<h3>Risk Report</h3>`;
  html += `<table><tr><th>Regime Event</th><th>Severity</th><th>Impact</th></tr>`;
  for (const f of regime) {
    html += `<tr><td>${escapeHtml(f.title)}</td><td>${severityBadge(f.severity)}</td><td>${formatDollar(f.dollar_impact)}</td></tr>`;
  }
  html += `</table><p><strong>Total impact:</strong> ${formatDollar(totalImpact)}</p>`;
  return html;
}

// Prediction market: probability + signal agreement + edge
function predictionMarketSection(findings: Finding[], format: ReportFormat): string {
  const estimates = findings.filter((f) => f.type === 'probability_estimate');
  const agreements = findings.filter((f) => f.type === 'signal_agreement');
  const conflicts = findings.filter((f) => f.type === 'signal_conflict');
  const edges = findings.filter((f) => f.type === 'edge_detected');

  if (format === 'markdown') {
    let md = `## Prediction Market Analysis\n\n`;
    if (estimates.length > 0) {
      md += `### Probability Estimates\n\n`;
      md += mdTable(
        ['Event', 'Probability', 'Confidence Interval', 'Confidence'],
        estimates.map((f) => [f.title, formatPct(f.confidence), '+/-10%', formatPct(f.confidence)]),
      );
    }

    if (edges.length > 0) {
      md += `\n### Edge Calculations\n\n`;
      md += mdTable(
        ['Edge', 'Expected Value', 'Confidence'],
        edges.map((f) => [f.title, formatDollar(f.dollar_impact), formatPct(f.confidence)]),
      );
    }

    if (agreements.length > 0 || conflicts.length > 0) {
      md += `\n### Signal Agreement / Disagreement\n\n`;
      md += mdTable(
        ['Signal', 'Type', 'Confidence'],
        [...agreements, ...conflicts].map((f) => [f.title, f.type, formatPct(f.confidence)]),
      );
    }
    return md;
  }

  let html = `<h2>Prediction Market Analysis</h2>`;
  html += `<h3>Probability Estimates</h3>`;
  html += `<table><tr><th>Event</th><th>Probability</th><th>Confidence</th></tr>`;
  for (const f of estimates) {
    html += `<tr><td>${escapeHtml(f.title)}</td><td>${formatPct(f.confidence)}</td><td>${formatPct(f.confidence)}</td></tr>`;
  }
  html += `</table>`;
  html += `<h3>Edge Calculations</h3>`;
  html += `<table><tr><th>Edge</th><th>Expected Value</th><th>Confidence</th></tr>`;
  for (const f of edges) {
    html += `<tr><td>${escapeHtml(f.title)}</td><td>${formatDollar(f.dollar_impact)}</td><td>${formatPct(f.confidence)}</td></tr>`;
  }
  html += `</table>`;
  return html;
}

// ---------------------------------------------------------------------------
// Core generator
// ---------------------------------------------------------------------------

/**
 * Generate a formatted report from findings with optional verification and
 * cross-reference sections.
 */
export function generateReport(
  findings: Finding[],
  config: ReportConfig,
  verification?: VerificationResult[],
  crossRefSummary?: CrossRefSummary,
): GeneratedReport {
  const now = new Date().toISOString();

  if (config.format === 'json') {
    const payload = {
      title: config.title,
      domain: config.domain,
      author: config.author,
      date: currentDate(config.date),
      findings,
      verification: config.includeVerification ? verification : undefined,
      cross_references: config.includeCrossRefs ? crossRefSummary : undefined,
    };
    const content = JSON.stringify(payload, null, 2);
    return {
      title: config.title,
      format: 'json',
      type: config.type,
      content,
      generated_at: now,
      findings_count: findings.length,
      pages_estimate: pageEstimate(content),
    };
  }

  const maxFindings = config.maxFindings ?? 10;
  const sorted = sortFindings(findings);
  const top = sorted.slice(0, maxFindings);
  const totalImpact = findings.reduce((s, f) => s + (f.dollar_impact ?? 0), 0);
  const criticalCount = findings.filter((f) => f.severity === 'critical').length;
  const highCount = findings.filter((f) => f.severity === 'high').length;
  const docIds = new Set(findings.flatMap((f) => f.source_documents.map((d) => d.document_id)));
  const verSummary = verification ? getVerificationSummary(verification) : undefined;

  const narrative =
    `Analysis of ${docIds.size} document${docIds.size !== 1 ? 's' : ''} across the ` +
    `${config.domain} domain revealed ${findings.length} finding${findings.length !== 1 ? 's' : ''}, ` +
    `${criticalCount} critical and ${highCount} high-severity.` +
    (totalImpact > 0 ? ` Estimated total financial impact: ${formatDollar(totalImpact)}.` : '') +
    (verSummary
      ? ` Verification pipeline: ${verSummary.passed}/${verSummary.total_findings} passed, ` +
        `confidence ${formatPct(verSummary.avg_confidence_before)} to ${formatPct(verSummary.avg_confidence_after)}.`
      : '');

  let content = '';

  if (config.format === 'markdown') {
    content = buildMarkdownReport(
      config, findings, top, narrative, sorted, verification, crossRefSummary, verSummary,
    );
  } else {
    content = buildHtmlReport(
      config, findings, top, narrative, sorted, verification, crossRefSummary, verSummary,
    );
  }

  return {
    title: config.title,
    format: config.format,
    type: config.type,
    content,
    generated_at: now,
    findings_count: findings.length,
    pages_estimate: pageEstimate(content),
  };
}

// ---------------------------------------------------------------------------
// HTML builder
// ---------------------------------------------------------------------------

function buildHtmlReport(
  config: ReportConfig,
  findings: Finding[],
  top: Finding[],
  narrative: string,
  sorted: Finding[],
  _verification: VerificationResult[] | undefined,
  crossRefSummary: CrossRefSummary | undefined,
  verSummary: VerificationSummary | undefined,
): string {
  const date = currentDate(config.date);
  const isExecutive = config.type === 'executive';
  const displayFindings = isExecutive ? top : sorted;

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(config.title)}</title>
<style>${HTML_CSS}</style>
</head>
<body>
<h1>${escapeHtml(config.title)}</h1>
<p class="meta">
  Domain: <strong>${escapeHtml(config.domain)}</strong> &nbsp;|&nbsp;
  Date: <strong>${escapeHtml(date)}</strong>` +
  (config.author ? ` &nbsp;|&nbsp; Author: <strong>${escapeHtml(config.author)}</strong>` : '') +
  ` &nbsp;|&nbsp; Findings: <strong>${findings.length}</strong>
</p>

<h2>Executive Summary</h2>
<div class="narrative">${escapeHtml(narrative)}</div>

<h3>Top Findings</h3>
<ul>
${top.map((f) => `<li>${severityBadge(f.severity)} <strong>${escapeHtml(f.title)}</strong>${f.dollar_impact != null ? ' &mdash; ' + formatDollar(f.dollar_impact) : ''}</li>`).join('\n')}
</ul>`;

  // Domain-specific section
  const domSec = domainSection(findings, config.domain, 'html');
  if (domSec) html += domSec;

  // Findings table
  html += `<h2>Findings</h2>
<table>
<tr>
  <th>ID</th><th>Type</th><th>Severity</th><th>Title</th>
  <th>Confidence</th><th>Impact</th><th>Verified</th><th>Worker</th>
</tr>
${displayFindings.map((f) => renderHtmlFinding(f, config.includeEvidence)).join('\n')}
</table>`;

  // Cross-reference section
  if (config.includeCrossRefs && crossRefSummary) {
    html += `<h2>Cross-Reference Analysis</h2>
<p>Total entities: <strong>${crossRefSummary.total_entities}</strong> &nbsp;|&nbsp;
   References: <strong>${crossRefSummary.total_references}</strong> &nbsp;|&nbsp;
   Conflicts: <strong>${crossRefSummary.conflicts.length}</strong></p>`;

    if (crossRefSummary.conflicts.length > 0) {
      html += `<h3>Conflicts</h3><table><tr><th>Entity</th><th>Type</th><th>Severity</th><th>Workers</th></tr>`;
      for (const c of crossRefSummary.conflicts) {
        const workers = c.reports.map((r) => r.worker).join(', ');
        html += `<tr><td>${escapeHtml(c.entity_value)}</td><td>${escapeHtml(c.entity_type)}</td><td>${escapeHtml(c.severity)}</td><td>${escapeHtml(workers)}</td></tr>`;
      }
      html += `</table>`;
    }
  }

  // Verification section
  if (config.includeVerification && verSummary) {
    html += `<h2>Verification Summary</h2>
<table>
<tr><th>Metric</th><th>Value</th></tr>
<tr><td>Total findings verified</td><td>${verSummary.total_findings}</td></tr>
<tr><td>Passed</td><td>${verSummary.passed}</td></tr>
<tr><td>Failed</td><td>${verSummary.failed}</td></tr>
<tr><td>Escalated</td><td>${verSummary.escalated}</td></tr>
<tr><td>Avg confidence before</td><td>${formatPct(verSummary.avg_confidence_before)}</td></tr>
<tr><td>Avg confidence after</td><td>${formatPct(verSummary.avg_confidence_after)}</td></tr>
<tr><td>Completeness</td><td>${verSummary.completeness_pct}%</td></tr>
<tr><td>Broken evidence links</td><td>${verSummary.broken_links}</td></tr>
</table>`;
  }

  html += `<footer>Generated by Claude Commander &nbsp;|&nbsp; ${new Date().toISOString()}</footer>
</body>
</html>`;

  return html;
}

// ---------------------------------------------------------------------------
// Markdown builder
// ---------------------------------------------------------------------------

function buildMarkdownReport(
  config: ReportConfig,
  findings: Finding[],
  top: Finding[],
  narrative: string,
  sorted: Finding[],
  _verification: VerificationResult[] | undefined,
  crossRefSummary: CrossRefSummary | undefined,
  verSummary: VerificationSummary | undefined,
): string {
  const date = currentDate(config.date);
  const isExecutive = config.type === 'executive';
  const displayFindings = isExecutive ? top : sorted;

  let md = `# ${config.title}\n\n`;
  md += `**Domain:** ${config.domain}  |  **Date:** ${date}`;
  if (config.author) md += `  |  **Author:** ${config.author}`;
  md += `  |  **Findings:** ${findings.length}\n\n`;

  md += `## Executive Summary\n\n${narrative}\n\n`;

  md += `### Top Findings\n\n`;
  top.forEach((f, i) => {
    md += `${i + 1}. ${SEVERITY_EMOJI[f.severity]} **${f.title}**`;
    if (f.dollar_impact != null) md += ` — ${formatDollar(f.dollar_impact)}`;
    md += '\n';
  });
  md += '\n';

  // Domain-specific
  const domSec = domainSection(findings, config.domain, 'markdown');
  if (domSec) md += domSec;

  // Full findings
  if (!isExecutive) {
    md += `## All Findings\n\n`;
    for (const f of displayFindings) {
      md += mdFinding(f, config.includeEvidence) + '\n---\n\n';
    }
  }

  // Cross-references
  if (config.includeCrossRefs && crossRefSummary) {
    md += `## Cross-Reference Analysis\n\n`;
    md += `- Total entities: **${crossRefSummary.total_entities}**\n`;
    md += `- References: **${crossRefSummary.total_references}**\n`;
    md += `- Conflicts: **${crossRefSummary.conflicts.length}**\n\n`;

    if (crossRefSummary.conflicts.length > 0) {
      md += `### Conflicts\n\n`;
      md += mdTable(
        ['Entity', 'Type', 'Severity', 'Workers'],
        crossRefSummary.conflicts.map((c) => [
          c.entity_value,
          c.entity_type,
          c.severity,
          c.reports.map((r) => r.worker).join(', '),
        ]),
      );
      md += '\n\n';
    }
  }

  // Verification
  if (config.includeVerification && verSummary) {
    md += `## Verification Summary\n\n`;
    md += mdTable(
      ['Metric', 'Value'],
      [
        ['Total verified', String(verSummary.total_findings)],
        ['Passed', String(verSummary.passed)],
        ['Failed', String(verSummary.failed)],
        ['Escalated', String(verSummary.escalated)],
        ['Avg confidence before', formatPct(verSummary.avg_confidence_before)],
        ['Avg confidence after', formatPct(verSummary.avg_confidence_after)],
        ['Completeness', verSummary.completeness_pct + '%'],
        ['Broken evidence links', String(verSummary.broken_links)],
      ],
    );
    md += '\n\n';
  }

  md += `---\n*Generated by Claude Commander — ${new Date().toISOString()}*\n`;
  return md;
}

// ---------------------------------------------------------------------------
// Convenience generators
// ---------------------------------------------------------------------------

/**
 * Generate a 1-2 page executive overview, top findings by impact.
 * Uses HTML format by default.
 */
export function generateExecutiveSummary(
  findings: Finding[],
  domain: string,
  title: string,
): GeneratedReport {
  return generateReport(findings, {
    format: 'html',
    type: 'executive',
    domain,
    title,
    includeEvidence: false,
    includeCrossRefs: false,
    includeVerification: false,
    maxFindings: 10,
  });
}

/**
 * Generate a full technical report with evidence chains.
 */
export function generateTechnicalReport(
  findings: Finding[],
  domain: string,
  title: string,
): GeneratedReport {
  return generateReport(findings, {
    format: 'html',
    type: 'technical',
    domain,
    title,
    includeEvidence: true,
    includeCrossRefs: true,
    includeVerification: true,
  });
}

/**
 * Generate a domain-specific report using the appropriate template.
 */
export function generateDomainReport(
  findings: Finding[],
  domain: string,
  title: string,
): GeneratedReport {
  return generateReport(findings, {
    format: 'markdown',
    type: 'domain-specific',
    domain,
    title,
    includeEvidence: true,
    includeCrossRefs: false,
    includeVerification: false,
  });
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
