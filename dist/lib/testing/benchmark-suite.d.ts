/**
 * Claude Commander — Benchmark Suite
 *
 * Gold-standard test sets with known findings and cross-references. Used to
 * measure pipeline accuracy against human-validated ground truth. Suites are
 * stored as JSON files and loaded on demand.
 */
import type { Finding } from '../output-schemas.js';
export interface KnownFinding {
    type: string;
    title: string;
    severity: string;
    /** Terms that should appear (60%+) in a matched finding's title + description. */
    keywords: string[];
}
export interface KnownCrossRef {
    entity_a: string;
    entity_b: string;
    relationship: string;
}
export interface BenchmarkSuite {
    name: string;
    domain: string;
    description: string;
    /** Path to the test data file used as pipeline input. */
    data_path: string;
    known_findings: KnownFinding[];
    known_cross_refs: KnownCrossRef[];
}
/**
 * Load a benchmark suite from a JSON file at `suitePath`.
 *
 * @throws If the file does not exist or cannot be parsed as a {@link BenchmarkSuite}.
 */
export declare function loadBenchmarkSuite(suitePath: string): BenchmarkSuite;
/**
 * Persist a {@link BenchmarkSuite} to `outputPath` as pretty-printed JSON.
 * Creates parent directories if needed.
 */
export declare function saveBenchmarkSuite(suite: BenchmarkSuite, outputPath: string): void;
/**
 * Create a {@link BenchmarkSuite} from a set of human-validated findings.
 *
 * Each finding is converted to a {@link KnownFinding} by extracting its type,
 * title, severity, and a keyword list derived from significant words in the
 * title and description (words longer than 4 characters, excluding stopwords).
 *
 * @param findings  - Human-validated findings to use as gold standard.
 * @param domain    - Analysis domain (e.g. 'legal', 'pharma').
 * @param name      - Short identifier for the suite (e.g. 'pharma-nda-q1').
 * @param dataPath  - Path to the test data file (optional, can be set later).
 * @param description - Human-readable description of the suite.
 */
export declare function createBenchmarkFromFindings(findings: Finding[], domain: string, name: string, dataPath?: string, description?: string): BenchmarkSuite;
/**
 * List all available benchmark suites in `benchmarkDir`.
 * Returns full paths to `.json` files.
 *
 * Defaults to `~/.claude-commander/benchmarks/` if no dir is specified.
 */
export declare function listBenchmarks(benchmarkDir?: string): string[];
/**
 * Get the name of a benchmark suite from its file path (without extension).
 */
export declare function benchmarkNameFromPath(suitePath: string): string;
//# sourceMappingURL=benchmark-suite.d.ts.map