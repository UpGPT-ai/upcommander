/**
 * Claude Commander — Pipeline Testing Framework
 *
 * Runs the same document set through multiple pipeline configurations
 * to identify optimal chunk size, overlap, worker count, and verification
 * level settings. Results are persisted to disk for comparison.
 */
export interface PipelineConfig {
    name: string;
    chunkSize: number;
    overlapTokens: number;
    workerCount: number;
    verificationLevel: number;
    model?: string;
}
export interface PipelineTestResult {
    config: PipelineConfig;
    findings_count: number;
    unique_findings: number;
    cross_references_found: number;
    tokens_used: number;
    cost_usd: number;
    duration_ms: number;
    timestamp: string;
}
export interface ConfigComparison {
    configs: PipelineTestResult[];
    best_by_quality: string;
    best_by_cost: string;
    best_by_speed: string;
    recommendation: string;
}
/**
 * Run a document through each provided pipeline config, collect metrics, and
 * return a {@link ConfigComparison} identifying which config is best by each
 * dimension.
 *
 * NOTE: This function simulates token usage and finding counts from the
 * ingestion + chunking stages. Actual LLM calls are not issued here — this
 * is a structural / throughput test. Integration with real LLM workers
 * should wrap this with the worker dispatch layer.
 */
export declare function runPipelineTest(documentPath: string, configs: PipelineConfig[]): Promise<ConfigComparison>;
/**
 * Returns 5 standard test configurations covering a range of chunk sizes,
 * overlap ratios, worker counts, and verification levels.
 */
export declare function defaultConfigs(): PipelineConfig[];
/**
 * Persist a {@link ConfigComparison} to `<outputDir>/pipeline-test-<timestamp>.json`.
 * Creates the directory if it does not exist.
 */
export declare function saveTestResults(results: ConfigComparison, outputDir: string): void;
//# sourceMappingURL=pipeline-test.d.ts.map