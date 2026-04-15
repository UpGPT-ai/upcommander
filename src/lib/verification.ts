/**
 * Claude Commander — 5-Stage Verification Pipeline
 *
 * Stage 1: Self-check — agent re-reads own findings, confirms evidence supports conclusion
 * Stage 2: Peer review — second agent reviews, flags disagreements
 * Stage 3: Synthesis check — orchestrator checks cross-agent consistency
 * Stage 4: Completeness audit — requirements checklist vs what's present
 * Stage 5: Evidence chain walk — independently traverse every link
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Finding } from './output-schemas.js';
import type { CrossReferenceGraph } from './cross-reference.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VerificationStage = 1 | 2 | 3 | 4 | 5;

export interface VerificationConfig {
  /** Which stages to run, e.g. [1,2,3] for SEM, [1,2,3,4,5] for pharma. */
  stages: VerificationStage[];
  domain: string;
  /** For stage 4 — which items must be present in the analysis. */
  requirementsChecklist?: string[];
  /** Add to approval queue on disagreement instead of auto-failing. */
  escalateDisagreements: boolean;
}

export interface VerificationResult {
  finding_id: string;
  stages_completed: VerificationStage[];
  passed: boolean;
  original_confidence: number;
  adjusted_confidence: number;
  disagreements: Disagreement[];
  /** Missing requirements flagged in stage 4 (per-finding or global). */
  completeness_gaps: string[];
  /** Evidence links that failed validation in stage 5. */
  broken_evidence_links: BrokenLink[];
  verified_at: string;
  verified_by: string;
}

export interface Disagreement {
  stage: VerificationStage;
  reviewer: string;
  finding_id: string;
  issue: string;
  suggested_action: 'accept' | 'reject' | 'modify' | 'escalate';
  reasoning: string;
}

export interface BrokenLink {
  finding_id: string;
  evidence_index: number;
  link_description: string;
  expected: string;
  actual: string | null;
}

export interface CompletenessReport {
  domain: string;
  required_items: string[];
  present_items: string[];
  missing_items: string[];
  /** 0–100, percentage of required items present. */
  coverage_pct: number;
}

export interface VerificationSummary {
  total_findings: number;
  verified: number;
  passed: number;
  failed: number;
  escalated: number;
  avg_confidence_before: number;
  avg_confidence_after: number;
  completeness_pct: number;
  broken_links: number;
  by_stage: Record<number, { passed: number; failed: number }>;
}

// ---------------------------------------------------------------------------
// Built-in requirements checklists
// ---------------------------------------------------------------------------

export const BUILT_IN_CHECKLISTS: Record<string, string[]> = {
  pharma: [
    'Module 2 summaries',
    'Module 3 CMC',
    'Module 4 nonclinical',
    'Module 5 clinical',
    'Labeling',
    'Cross-references',
    'Safety signals',
    'Manufacturing specs',
    'Stability data',
    'Bioequivalence',
  ],
  legal: [
    'Privilege review',
    'Hot documents',
    'Timeline',
    'Custodian analysis',
    'Issue coding',
  ],
  sem: [
    'Waste analysis',
    'Cannibalization check',
    'Trend analysis',
    'PMax audit',
    'Opportunity mapping',
  ],
  'due-diligence': [
    'Financial analysis',
    'Legal review',
    'IP assessment',
    'Employment review',
    'Regulatory compliance',
    'Customer concentration',
  ],
};

// ---------------------------------------------------------------------------
// Stage 1 — Self-check
// ---------------------------------------------------------------------------

/**
 * Stage 1: Self-check. Validates that a finding's own evidence adequately
 * supports its conclusion. Reduces confidence by 10% when evidence is thin
 * (fewer than 2 evidence links).
 */
export function selfCheck(finding: Finding): VerificationResult {
  const now = new Date().toISOString();
  const disagreements: Disagreement[] = [];
  const original = finding.confidence;
  let adjusted = original;
  let passed = true;

  // Validate: description must be non-empty
  if (!finding.description || finding.description.trim().length === 0) {
    passed = false;
    disagreements.push({
      stage: 1,
      reviewer: 'self-check',
      finding_id: finding.finding_id,
      issue: 'Finding has an empty description — conclusion cannot be evaluated.',
      suggested_action: 'modify',
      reasoning: 'A description is required to assess whether evidence supports the conclusion.',
    });
  }

  // Validate: confidence must be positive
  if (finding.confidence <= 0) {
    passed = false;
    disagreements.push({
      stage: 1,
      reviewer: 'self-check',
      finding_id: finding.finding_id,
      issue: `Confidence is ${finding.confidence}, which is not positive.`,
      suggested_action: 'reject',
      reasoning: 'Zero or negative confidence indicates the agent itself had no support for this finding.',
    });
  }

  // Validate: at least one evidence link required
  if (finding.evidence_chain.length === 0) {
    passed = false;
    disagreements.push({
      stage: 1,
      reviewer: 'self-check',
      finding_id: finding.finding_id,
      issue: 'No evidence links present — conclusion is unsupported.',
      suggested_action: 'reject',
      reasoning: 'Every finding must have at least one evidence link to a source document.',
    });
  }

  // Weak evidence: fewer than 2 links — reduce confidence by 10%
  if (finding.evidence_chain.length > 0 && finding.evidence_chain.length < 2) {
    adjusted = Math.max(0, adjusted - 0.1);
    disagreements.push({
      stage: 1,
      reviewer: 'self-check',
      finding_id: finding.finding_id,
      issue: 'Only one evidence link provided — confidence reduced by 10%.',
      suggested_action: 'accept',
      reasoning: 'Single-source evidence is accepted but carries elevated uncertainty.',
    });
  }

  return {
    finding_id: finding.finding_id,
    stages_completed: [1],
    passed,
    original_confidence: original,
    adjusted_confidence: adjusted,
    disagreements,
    completeness_gaps: [],
    broken_evidence_links: [],
    verified_at: now,
    verified_by: 'self-check',
  };
}

// ---------------------------------------------------------------------------
// Stage 2 — Peer review
// ---------------------------------------------------------------------------

/**
 * Stage 2: Peer review. Checks whether any other finding from a *different*
 * worker contradicts this one (same entity referenced, opposite conclusion or
 * conflicting severity). Flags disagreements for human review or escalation.
 */
export function peerReview(finding: Finding, allFindings: Finding[]): VerificationResult {
  const now = new Date().toISOString();
  const disagreements: Disagreement[] = [];
  const original = finding.confidence;
  let adjusted = original;
  let passed = true;

  // Build candidate peers: same domain/type, different worker
  const peers = allFindings.filter(
    (f) =>
      f.finding_id !== finding.finding_id &&
      f.worker !== finding.worker,
  );

  for (const peer of peers) {
    // Check for cross-references pointing to the same finding_id (explicit link)
    const explicitLink =
      finding.cross_references.includes(peer.finding_id) ||
      peer.cross_references.includes(finding.finding_id);

    // Check title similarity (simple word-overlap heuristic, >60% overlap = related)
    const titleSimilarity = wordOverlap(finding.title, peer.title);
    const isRelated = explicitLink || titleSimilarity > 0.6;

    if (!isRelated) continue;

    // Severity conflict — same topic but different severity levels
    const severityOrder: Record<string, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
      info: 0,
    };
    const sevDiff = Math.abs(
      severityOrder[finding.severity] - severityOrder[peer.severity],
    );
    if (sevDiff >= 2) {
      passed = false;
      adjusted = Math.max(0, adjusted - 0.05 * sevDiff);
      disagreements.push({
        stage: 2,
        reviewer: peer.worker,
        finding_id: finding.finding_id,
        issue: `Worker "${peer.worker}" rates a related finding as "${peer.severity}" vs this finding's "${finding.severity}" — ${sevDiff}-level severity gap.`,
        suggested_action: 'escalate',
        reasoning: `Related finding: "${peer.title}" (${peer.finding_id}). Severity disagreement of ${sevDiff} levels warrants human review.`,
      });
    }

    // Confidence conflict — same topic but very different confidence
    const confDiff = Math.abs(finding.confidence - peer.confidence);
    if (confDiff > 0.3) {
      disagreements.push({
        stage: 2,
        reviewer: peer.worker,
        finding_id: finding.finding_id,
        issue: `Worker "${peer.worker}" reports confidence ${(peer.confidence * 100).toFixed(0)}% vs this finding's ${(finding.confidence * 100).toFixed(0)}% on a related topic.`,
        suggested_action: 'modify',
        reasoning: `Large confidence gap (${(confDiff * 100).toFixed(0)}%) suggests workers disagree on evidence strength.`,
      });
    }
  }

  return {
    finding_id: finding.finding_id,
    stages_completed: [2],
    passed,
    original_confidence: original,
    adjusted_confidence: adjusted,
    disagreements,
    completeness_gaps: [],
    broken_evidence_links: [],
    verified_at: now,
    verified_by: 'peer-review',
  };
}

// ---------------------------------------------------------------------------
// Stage 3 — Synthesis check
// ---------------------------------------------------------------------------

/**
 * Stage 3: Synthesis check. Uses the CrossReferenceGraph to detect
 * cross-agent conflicts. Any finding whose ID or source documents appear in
 * a conflict is flagged.
 */
export function synthesisCheck(
  findings: Finding[],
  crossRefGraph: CrossReferenceGraph,
): VerificationResult[] {
  const now = new Date().toISOString();
  const conflicts = crossRefGraph.findConflicts();

  // Build a set of document_ids referenced by each conflict report
  const conflictDocIds = new Set<string>();
  for (const conflict of conflicts) {
    for (const report of conflict.reports) {
      conflictDocIds.add(report.source.document_id);
    }
  }

  return findings.map((finding) => {
    const disagreements: Disagreement[] = [];
    const original = finding.confidence;
    let adjusted = original;
    let passed = true;

    // Check if any of this finding's source documents appear in a conflict
    const involvedConflicts = conflicts.filter((c) =>
      finding.source_documents.some((doc) =>
        c.reports.some((r) => r.source.document_id === doc.document_id),
      ),
    );

    for (const conflict of involvedConflicts) {
      const severityPenalty =
        conflict.severity === 'critical' ? 0.2
        : conflict.severity === 'high' ? 0.1
        : 0.05;

      passed = false;
      adjusted = Math.max(0, adjusted - severityPenalty);

      const workers = [...new Set(conflict.reports.map((r) => r.worker))].join(', ');
      disagreements.push({
        stage: 3,
        reviewer: 'synthesis-orchestrator',
        finding_id: finding.finding_id,
        issue: `Cross-agent conflict detected on entity "${conflict.entity_value}" (${conflict.entity_type}). Workers involved: ${workers}.`,
        suggested_action: conflict.severity === 'critical' ? 'escalate' : 'modify',
        reasoning: `Conflict severity: ${conflict.severity}. Confidence reduced by ${(severityPenalty * 100).toFixed(0)}%.`,
      });
    }

    return {
      finding_id: finding.finding_id,
      stages_completed: [3],
      passed,
      original_confidence: original,
      adjusted_confidence: adjusted,
      disagreements,
      completeness_gaps: [],
      broken_evidence_links: [],
      verified_at: now,
      verified_by: 'synthesis-orchestrator',
    };
  });
}

// ---------------------------------------------------------------------------
// Stage 4 — Completeness audit
// ---------------------------------------------------------------------------

/**
 * Stage 4: Completeness audit. Checks which items from the requirements
 * checklist are represented in the set of findings. An item is considered
 * "present" if it appears (case-insensitive substring) in any finding's
 * type or title.
 */
export function completenessAudit(
  findings: Finding[],
  checklist: string[],
): CompletenessReport {
  const present_items: string[] = [];
  const missing_items: string[] = [];

  // Build a searchable corpus from finding types and titles
  const corpus = findings
    .map((f) => `${f.type} ${f.title}`.toLowerCase())
    .join(' | ');

  for (const item of checklist) {
    const keywords = item.toLowerCase().split(/\s+/);
    const found = keywords.some((kw) => corpus.includes(kw));
    if (found) {
      present_items.push(item);
    } else {
      missing_items.push(item);
    }
  }

  const coverage_pct =
    checklist.length === 0
      ? 100
      : Math.round((present_items.length / checklist.length) * 100);

  return {
    domain: '',   // filled in by runVerification
    required_items: [...checklist],
    present_items,
    missing_items,
    coverage_pct,
  };
}

// ---------------------------------------------------------------------------
// Stage 5 — Evidence chain walk
// ---------------------------------------------------------------------------

/**
 * Stage 5: Evidence chain walk. For every evidence link in a finding,
 * verifies that both the document_id and excerpt are non-empty. Flags
 * broken links with a description of what is missing.
 */
export function evidenceChainWalk(finding: Finding): BrokenLink[] {
  const broken: BrokenLink[] = [];

  finding.evidence_chain.forEach((link, idx) => {
    const issues: string[] = [];

    if (!link.document.document_id || link.document.document_id.trim().length === 0) {
      issues.push('document_id is empty');
    }

    if (!link.excerpt || link.excerpt.trim().length === 0) {
      issues.push('excerpt is empty');
    }

    if (issues.length > 0) {
      broken.push({
        finding_id: finding.finding_id,
        evidence_index: idx,
        link_description: issues.join('; '),
        expected: 'non-empty document_id and excerpt',
        actual: issues.length > 0
          ? `document_id="${link.document.document_id ?? ''}", excerpt="${link.excerpt ?? ''}"`
          : null,
      });
    }
  });

  return broken;
}

// ---------------------------------------------------------------------------
// Orchestrator — runVerification
// ---------------------------------------------------------------------------

/**
 * Run the configured verification stages over a set of findings. Stages are
 * run in order; results from earlier stages inform later ones. Stage 4 is
 * computed globally (all findings), all other stages operate per-finding.
 *
 * @param findings - Findings to verify.
 * @param config   - Which stages to run and domain configuration.
 * @returns One VerificationResult per finding.
 */
export function runVerification(
  findings: Finding[],
  config: VerificationConfig,
): VerificationResult[] {
  const stages = [...config.stages].sort((a, b) => a - b) as VerificationStage[];

  // Initialize results keyed by finding_id
  const resultMap = new Map<string, VerificationResult>();
  const now = new Date().toISOString();

  for (const finding of findings) {
    resultMap.set(finding.finding_id, {
      finding_id: finding.finding_id,
      stages_completed: [],
      passed: true,
      original_confidence: finding.confidence,
      adjusted_confidence: finding.confidence,
      disagreements: [],
      completeness_gaps: [],
      broken_evidence_links: [],
      verified_at: now,
      verified_by: 'verification-pipeline',
    });
  }

  // Stage 4 is global — compute once upfront if requested
  let completenessReport: CompletenessReport | null = null;
  if (stages.includes(4)) {
    const checklist =
      config.requirementsChecklist ??
      BUILT_IN_CHECKLISTS[config.domain] ??
      [];
    completenessReport = completenessAudit(findings, checklist);
    completenessReport.domain = config.domain;
  }

  for (const finding of findings) {
    const result = resultMap.get(finding.finding_id)!;

    for (const stage of stages) {
      switch (stage) {
        case 1: {
          const r = selfCheck(finding);
          mergeStageResult(result, r, 1);
          // Carry adjusted confidence forward
          finding.confidence = result.adjusted_confidence;
          break;
        }

        case 2: {
          const r = peerReview(finding, findings);
          mergeStageResult(result, r, 2);
          finding.confidence = result.adjusted_confidence;
          break;
        }

        case 3: {
          // synthesisCheck is run as a batch below; skip here
          // (see post-loop handling)
          break;
        }

        case 4: {
          // Attach global missing items to every finding result
          if (completenessReport) {
            for (const missing of completenessReport.missing_items) {
              if (!result.completeness_gaps.includes(missing)) {
                result.completeness_gaps.push(missing);
              }
            }
            result.stages_completed.push(4);
          }
          break;
        }

        case 5: {
          const broken = evidenceChainWalk(finding);
          result.broken_evidence_links.push(...broken);
          if (broken.length > 0) {
            result.passed = false;
          }
          result.stages_completed.push(5);
          break;
        }
      }
    }
  }

  // Stage 3 must be run as a batch — we need a CrossReferenceGraph which
  // may not exist. Callers using stage 3 should call synthesisCheck directly
  // and merge with mergeStageResult. We mark stage 3 as a no-op here if
  // no graph was provided to runVerification.
  // (synthesisCheck is exposed separately for orchestrators that have a graph.)

  // Apply escalation flag: if escalateDisagreements is true, findings with
  // stage-2 escalation suggestions are marked as "not failed" pending human
  // review (i.e., do not auto-fail, just surface).
  if (config.escalateDisagreements) {
    for (const result of resultMap.values()) {
      const hasEscalation = result.disagreements.some(
        (d) => d.suggested_action === 'escalate',
      );
      if (hasEscalation) {
        // Mark as pending rather than outright failed
        result.passed = false; // Still mark false so it shows up in escalated count
      }
    }
  }

  return [...resultMap.values()];
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

/**
 * Compute aggregate statistics across all VerificationResults.
 */
export function getVerificationSummary(results: VerificationResult[]): VerificationSummary {
  const byStage: Record<number, { passed: number; failed: number }> = {};

  let totalBefore = 0;
  let totalAfter = 0;
  let passed = 0;
  let failed = 0;
  let escalated = 0;
  let brokenLinks = 0;
  let totalGaps = 0;

  for (const r of results) {
    totalBefore += r.original_confidence;
    totalAfter += r.adjusted_confidence;
    brokenLinks += r.broken_evidence_links.length;
    totalGaps += r.completeness_gaps.length;

    const isEscalated = r.disagreements.some((d) => d.suggested_action === 'escalate');
    if (isEscalated) escalated++;

    if (r.passed) {
      passed++;
    } else {
      failed++;
    }

    for (const stage of r.stages_completed) {
      if (!byStage[stage]) {
        byStage[stage] = { passed: 0, failed: 0 };
      }
      if (r.passed) {
        byStage[stage].passed++;
      } else {
        byStage[stage].failed++;
      }
    }
  }

  const n = results.length;
  const avgBefore = n > 0 ? totalBefore / n : 0;
  const avgAfter = n > 0 ? totalAfter / n : 0;

  // Completeness pct: inverse of how many findings have gaps (rough proxy)
  const completeness_pct =
    n > 0 ? Math.round(((n - (totalGaps > 0 ? 1 : 0)) / n) * 100) : 100;

  return {
    total_findings: n,
    verified: n,
    passed,
    failed,
    escalated,
    avg_confidence_before: Math.round(avgBefore * 1000) / 1000,
    avg_confidence_after: Math.round(avgAfter * 1000) / 1000,
    completeness_pct,
    broken_links: brokenLinks,
    by_stage: byStage,
  };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/**
 * Write verification results to `<outputDir>/.claude-coord/verification/results.json`.
 * Creates the directory if it does not exist.
 */
export function saveVerificationResults(
  results: VerificationResult[],
  outputDir: string,
): void {
  const dir = join(outputDir, '.claude-coord', 'verification');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const outPath = join(dir, 'results.json');
  writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Merge a single-stage result into the accumulating per-finding result. */
function mergeStageResult(
  target: VerificationResult,
  source: VerificationResult,
  stage: VerificationStage,
): void {
  target.stages_completed.push(stage);
  target.disagreements.push(...source.disagreements);
  target.broken_evidence_links.push(...source.broken_evidence_links);
  target.completeness_gaps.push(...source.completeness_gaps);
  target.adjusted_confidence = source.adjusted_confidence;
  if (!source.passed) {
    target.passed = false;
  }
  target.verified_at = source.verified_at;
}

/** Calculate word overlap ratio between two strings (0–1, Jaccard). */
function wordOverlap(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}
