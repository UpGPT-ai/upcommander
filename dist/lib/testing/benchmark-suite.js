/**
 * Claude Commander — Benchmark Suite
 *
 * Gold-standard test sets with known findings and cross-references. Used to
 * measure pipeline accuracy against human-validated ground truth. Suites are
 * stored as JSON files and loaded on demand.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, } from 'node:fs';
import { homedir } from 'node:os';
import { join, extname, basename } from 'node:path';
// ---------------------------------------------------------------------------
// Default storage location
// ---------------------------------------------------------------------------
const DEFAULT_BENCHMARK_DIR = join(homedir(), '.claude-commander', 'benchmarks');
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function ensureDir(dir) {
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
}
// ---------------------------------------------------------------------------
// Primary API
// ---------------------------------------------------------------------------
/**
 * Load a benchmark suite from a JSON file at `suitePath`.
 *
 * @throws If the file does not exist or cannot be parsed as a {@link BenchmarkSuite}.
 */
export function loadBenchmarkSuite(suitePath) {
    if (!existsSync(suitePath)) {
        throw new Error(`Benchmark suite not found: ${suitePath}`);
    }
    const raw = readFileSync(suitePath, 'utf-8');
    const parsed = JSON.parse(raw);
    // Basic shape validation
    if (!parsed.name || !parsed.domain || !Array.isArray(parsed.known_findings)) {
        throw new Error(`Invalid benchmark suite format in: ${suitePath}`);
    }
    return {
        name: parsed.name,
        domain: parsed.domain,
        description: parsed.description ?? '',
        data_path: parsed.data_path ?? '',
        known_findings: parsed.known_findings,
        known_cross_refs: parsed.known_cross_refs ?? [],
    };
}
/**
 * Persist a {@link BenchmarkSuite} to `outputPath` as pretty-printed JSON.
 * Creates parent directories if needed.
 */
export function saveBenchmarkSuite(suite, outputPath) {
    const dir = outputPath.replace(/\/[^/]+$/, '');
    if (dir)
        ensureDir(dir);
    writeFileSync(outputPath, JSON.stringify(suite, null, 2), 'utf-8');
}
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
export function createBenchmarkFromFindings(findings, domain, name, dataPath = '', description = '') {
    const knownFindings = findings.map((f) => ({
        type: f.type,
        title: f.title,
        severity: f.severity,
        keywords: extractKeywords(`${f.title} ${f.description}`),
    }));
    // Build cross-refs: pair findings that share cross_reference IDs
    const knownCrossRefs = [];
    const seen = new Set();
    for (const finding of findings) {
        for (const refId of finding.cross_references) {
            const key = [finding.finding_id, refId].sort().join('::');
            if (seen.has(key))
                continue;
            seen.add(key);
            const related = findings.find((f) => f.finding_id === refId);
            if (related) {
                knownCrossRefs.push({
                    entity_a: finding.title,
                    entity_b: related.title,
                    relationship: 'cross_references',
                });
            }
        }
    }
    return {
        name,
        domain,
        description,
        data_path: dataPath,
        known_findings: knownFindings,
        known_cross_refs: knownCrossRefs,
    };
}
/**
 * List all available benchmark suites in `benchmarkDir`.
 * Returns full paths to `.json` files.
 *
 * Defaults to `~/.claude-commander/benchmarks/` if no dir is specified.
 */
export function listBenchmarks(benchmarkDir) {
    const dir = benchmarkDir ?? DEFAULT_BENCHMARK_DIR;
    if (!existsSync(dir)) {
        return [];
    }
    const entries = readdirSync(dir, { withFileTypes: true });
    return entries
        .filter((e) => e.isFile() && extname(e.name).toLowerCase() === '.json')
        .map((e) => join(dir, e.name))
        .sort();
}
/**
 * Get the name of a benchmark suite from its file path (without extension).
 */
export function benchmarkNameFromPath(suitePath) {
    return basename(suitePath, '.json');
}
// ---------------------------------------------------------------------------
// Keyword extraction helper
// ---------------------------------------------------------------------------
const STOPWORDS = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by',
    'for', 'from', 'has', 'have', 'in', 'is', 'it', 'its', 'not', 'of',
    'on', 'or', 'that', 'the', 'their', 'there', 'they', 'this', 'to',
    'was', 'were', 'which', 'with', 'would',
]);
/**
 * Extract significant keywords from text.
 * Returns lowercase words longer than 4 characters, excluding stopwords.
 * Deduplicates and returns up to 20 terms.
 */
function extractKeywords(text) {
    const words = text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 4 && !STOPWORDS.has(w));
    return [...new Set(words)].slice(0, 20);
}
//# sourceMappingURL=benchmark-suite.js.map