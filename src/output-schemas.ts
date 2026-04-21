/**
 * Claude Commander — Structured Output Schemas
 *
 * Defines the standard finding, evidence, and analysis result types
 * used across all data analysis templates. Domain-specific schemas
 * extend these base types via the schema registry.
 */

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

/** Severity levels for findings, ordered from most to least critical. */
export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/** Reference to a specific location within a source document. */
export interface DocRef {
  document_id: string;
  file_path: string;
  title?: string;
  page?: number;
  row?: number;
  section?: string;
}

/** A single link in an evidence chain — ties a finding to its source. */
export interface EvidenceLink {
  document: DocRef;
  excerpt: string;       // the specific text that supports the finding
  context: string;       // surrounding context for the excerpt
  confidence: number;    // 0-1, how strongly this evidence supports the finding
}

/** A structured finding produced by an analysis worker. */
export interface Finding {
  finding_id: string;
  type: string;                    // domain-specific type (e.g. 'waste', 'gap', 'conflict')
  severity: FindingSeverity;
  title: string;
  description: string;
  evidence_chain: EvidenceLink[];
  confidence: number;              // 0-1, composite confidence across all evidence
  dollar_impact?: number;          // estimated financial impact if applicable
  source_documents: DocRef[];
  cross_references: string[];      // IDs of related findings
  worker: string;                  // which worker produced this finding
  verified: boolean;               // whether verification pipeline has run
  verification?: {
    stage: number;                 // 0-4 (which stage completed)
    verified_by: string;           // worker that verified
    original_confidence: number;
    adjusted_confidence: number;
    disagreements: string[];       // notes from peer review
  };
  created: string;                 // ISO timestamp
  updated: string;                 // ISO timestamp
}

/** The complete result of an analysis run. */
export interface AnalysisResult {
  project: string;
  template: string;
  started: string;                 // ISO timestamp
  completed?: string;              // ISO timestamp (null if in progress)
  status: 'in_progress' | 'complete' | 'error';
  findings: Finding[];
  summary: string;                 // human-readable summary
  metadata: {
    documents_ingested: number;
    chunks_distributed: number;
    workers_used: number;
    total_tokens: number;
    total_cost_usd: number;
    cross_references_found: number;
    conflicts_detected: number;
  };
}

// ---------------------------------------------------------------------------
// Domain-specific schema extensions
// ---------------------------------------------------------------------------

/** Schema definition for domain-specific finding types. */
export interface DomainSchema {
  domain: string;
  finding_types: string[];         // valid type values for this domain
  required_fields: string[];       // fields required beyond base Finding
  severity_rules: Record<string, FindingSeverity>; // type → default severity
}

/** Registry of domain schemas. */
const schemaRegistry = new Map<string, DomainSchema>();

/** Register a domain-specific schema extension. */
export function registerSchema(domain: string, schema: DomainSchema): void {
  schemaRegistry.set(domain, schema);
}

/** Retrieve a registered schema by domain. */
export function getSchema(domain: string): DomainSchema | null {
  return schemaRegistry.get(domain) ?? null;
}

/** List all registered domain schemas. */
export function listSchemas(): string[] {
  return Array.from(schemaRegistry.keys());
}

// ---------------------------------------------------------------------------
// Built-in domain schemas
// ---------------------------------------------------------------------------

registerSchema('sem', {
  domain: 'sem',
  finding_types: [
    'wasted_spend',
    'cannibalization',
    'missed_opportunity',
    'trend_anomaly',
    'pmax_inefficiency',
    'decision_impact',
  ],
  required_fields: ['dollar_impact'],
  severity_rules: {
    wasted_spend: 'high',
    cannibalization: 'high',
    missed_opportunity: 'medium',
    trend_anomaly: 'info',
    pmax_inefficiency: 'medium',
    decision_impact: 'medium',
  },
});

registerSchema('legal', {
  domain: 'legal',
  finding_types: [
    'privilege',
    'hot_document',
    'issue_code',
    'timeline_event',
    'custodian_link',
    'contradiction',
  ],
  required_fields: [],
  severity_rules: {
    privilege: 'critical',
    hot_document: 'high',
    issue_code: 'medium',
    timeline_event: 'info',
    custodian_link: 'low',
    contradiction: 'high',
  },
});

registerSchema('pharma', {
  domain: 'pharma',
  finding_types: [
    'cmc_gap',
    'cross_reference_break',
    'labeling_inconsistency',
    'safety_signal',
    'data_integrity',
    'jurisdiction_conflict',
    'completeness_gap',
    'comparability_issue',
  ],
  required_fields: [],
  severity_rules: {
    cmc_gap: 'critical',
    cross_reference_break: 'critical',
    labeling_inconsistency: 'high',
    safety_signal: 'critical',
    data_integrity: 'critical',
    jurisdiction_conflict: 'high',
    completeness_gap: 'high',
    comparability_issue: 'high',
  },
});

registerSchema('due-diligence', {
  domain: 'due-diligence',
  finding_types: [
    'deal_breaker',
    'valuation_risk',
    'integration_risk',
    'legal_liability',
    'ip_concern',
    'employment_risk',
    'regulatory_risk',
    'customer_concentration',
  ],
  required_fields: ['dollar_impact'],
  severity_rules: {
    deal_breaker: 'critical',
    valuation_risk: 'high',
    integration_risk: 'medium',
    legal_liability: 'high',
    ip_concern: 'high',
    employment_risk: 'medium',
    regulatory_risk: 'high',
    customer_concentration: 'medium',
  },
});

registerSchema('prediction-market', {
  domain: 'prediction-market',
  finding_types: [
    'probability_estimate',
    'signal_agreement',
    'signal_conflict',
    'base_rate',
    'edge_detected',
  ],
  required_fields: [],
  severity_rules: {
    probability_estimate: 'info',
    signal_agreement: 'info',
    signal_conflict: 'medium',
    base_rate: 'info',
    edge_detected: 'high',
  },
});

registerSchema('financial', {
  domain: 'financial',
  finding_types: [
    'vol_mispricing',
    'flow_anomaly',
    'insider_signal',
    'earnings_divergence',
    'regime_shift',
    'correlation_break',
  ],
  required_fields: ['dollar_impact'],
  severity_rules: {
    vol_mispricing: 'high',
    flow_anomaly: 'medium',
    insider_signal: 'high',
    earnings_divergence: 'medium',
    regime_shift: 'critical',
    correlation_break: 'high',
  },
});

// ---------------------------------------------------------------------------
// Finding operations
// ---------------------------------------------------------------------------

/** Generate a unique finding ID. */
export function generateFindingId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `f_${ts}_${rand}`;
}

/** Create a new finding with defaults. */
export function createFinding(
  partial: Omit<Finding, 'finding_id' | 'verified' | 'created' | 'updated'>
): Finding {
  return {
    ...partial,
    finding_id: generateFindingId(),
    verified: false,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
  };
}

/**
 * Merge findings from multiple workers into a deduplicated, ranked list.
 *
 * Deduplication uses title similarity (>80% word overlap).
 * When duplicates are found, evidence chains are merged and the
 * higher-confidence version is kept.
 */
export function mergeFindings(findingArrays: Finding[][]): Finding[] {
  const all = findingArrays.flat();
  const merged: Finding[] = [];

  for (const finding of all) {
    const duplicate = merged.find((existing) =>
      wordOverlap(existing.title, finding.title) > 0.8
    );

    if (duplicate) {
      // Merge evidence chains
      for (const evidence of finding.evidence_chain) {
        const alreadyHas = duplicate.evidence_chain.some(
          (e) =>
            e.document.document_id === evidence.document.document_id &&
            e.excerpt === evidence.excerpt
        );
        if (!alreadyHas) {
          duplicate.evidence_chain.push(evidence);
        }
      }

      // Merge source documents
      for (const doc of finding.source_documents) {
        if (!duplicate.source_documents.some((d) => d.document_id === doc.document_id)) {
          duplicate.source_documents.push(doc);
        }
      }

      // Merge cross-references
      for (const ref of finding.cross_references) {
        if (!duplicate.cross_references.includes(ref)) {
          duplicate.cross_references.push(ref);
        }
      }

      // Keep higher confidence
      if (finding.confidence > duplicate.confidence) {
        duplicate.confidence = finding.confidence;
        duplicate.description = finding.description;
      }

      // Sum dollar impact
      if (finding.dollar_impact && duplicate.dollar_impact) {
        duplicate.dollar_impact += finding.dollar_impact;
      } else if (finding.dollar_impact) {
        duplicate.dollar_impact = finding.dollar_impact;
      }

      duplicate.updated = new Date().toISOString();
    } else {
      merged.push({ ...finding });
    }
  }

  // Sort by severity (critical first), then confidence (highest first)
  const severityOrder: Record<FindingSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
  };

  merged.sort((a, b) => {
    const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return b.confidence - a.confidence;
  });

  return merged;
}

/**
 * Export findings to a specified format.
 */
export function exportFindings(
  findings: Finding[],
  format: 'json' | 'csv' | 'markdown'
): string {
  switch (format) {
    case 'json':
      return JSON.stringify(findings, null, 2);

    case 'csv': {
      const headers = [
        'finding_id', 'type', 'severity', 'title', 'confidence',
        'dollar_impact', 'verified', 'evidence_count', 'worker', 'created',
      ];
      const rows = findings.map((f) => [
        f.finding_id,
        f.type,
        f.severity,
        `"${f.title.replace(/"/g, '""')}"`,
        f.confidence.toFixed(2),
        f.dollar_impact?.toFixed(2) ?? '',
        f.verified ? 'true' : 'false',
        f.evidence_chain.length.toString(),
        f.worker,
        f.created,
      ]);
      return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    }

    case 'markdown': {
      const lines = [
        '| ID | Type | Severity | Title | Confidence | Impact | Verified |',
        '|---|---|---|---|---|---|---|',
      ];
      for (const f of findings) {
        lines.push(
          `| ${f.finding_id} | ${f.type} | ${f.severity} | ${f.title} | ${(f.confidence * 100).toFixed(0)}% | ${f.dollar_impact ? '$' + f.dollar_impact.toLocaleString() : '—'} | ${f.verified ? 'Yes' : 'No'} |`
        );
      }
      return lines.join('\n');
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Calculate word overlap ratio between two strings (0-1). */
function wordOverlap(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}
