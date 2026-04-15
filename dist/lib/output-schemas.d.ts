/**
 * Claude Commander — Structured Output Schemas
 *
 * Defines the standard finding, evidence, and analysis result types
 * used across all data analysis templates. Domain-specific schemas
 * extend these base types via the schema registry.
 */
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
    excerpt: string;
    context: string;
    confidence: number;
}
/** A structured finding produced by an analysis worker. */
export interface Finding {
    finding_id: string;
    type: string;
    severity: FindingSeverity;
    title: string;
    description: string;
    evidence_chain: EvidenceLink[];
    confidence: number;
    dollar_impact?: number;
    source_documents: DocRef[];
    cross_references: string[];
    worker: string;
    verified: boolean;
    verification?: {
        stage: number;
        verified_by: string;
        original_confidence: number;
        adjusted_confidence: number;
        disagreements: string[];
    };
    created: string;
    updated: string;
}
/** The complete result of an analysis run. */
export interface AnalysisResult {
    project: string;
    template: string;
    started: string;
    completed?: string;
    status: 'in_progress' | 'complete' | 'error';
    findings: Finding[];
    summary: string;
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
/** Schema definition for domain-specific finding types. */
export interface DomainSchema {
    domain: string;
    finding_types: string[];
    required_fields: string[];
    severity_rules: Record<string, FindingSeverity>;
}
/** Register a domain-specific schema extension. */
export declare function registerSchema(domain: string, schema: DomainSchema): void;
/** Retrieve a registered schema by domain. */
export declare function getSchema(domain: string): DomainSchema | null;
/** List all registered domain schemas. */
export declare function listSchemas(): string[];
/** Generate a unique finding ID. */
export declare function generateFindingId(): string;
/** Create a new finding with defaults. */
export declare function createFinding(partial: Omit<Finding, 'finding_id' | 'verified' | 'created' | 'updated'>): Finding;
/**
 * Merge findings from multiple workers into a deduplicated, ranked list.
 *
 * Deduplication uses title similarity (>80% word overlap).
 * When duplicates are found, evidence chains are merged and the
 * higher-confidence version is kept.
 */
export declare function mergeFindings(findingArrays: Finding[][]): Finding[];
/**
 * Export findings to a specified format.
 */
export declare function exportFindings(findings: Finding[], format: 'json' | 'csv' | 'markdown'): string;
//# sourceMappingURL=output-schemas.d.ts.map