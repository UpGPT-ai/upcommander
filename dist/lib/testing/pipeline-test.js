/**
 * Claude Commander — Pipeline Testing Framework
 *
 * Runs the same document set through multiple pipeline configurations
 * to identify optimal chunk size, overlap, worker count, and verification
 * level settings. Results are persisted to disk for comparison.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ingestDocument, chunkDocument, distributeChunks } from '../ingestion.js';
import { CrossReferenceGraph, extractEntities } from '../cross-reference.js';
import { mergeFindings } from '../output-schemas.js';
// ---------------------------------------------------------------------------
// Cost estimation constants (tokens → USD, approximate)
// ---------------------------------------------------------------------------
/** Rough cost estimate: $3 per million input tokens (Sonnet-class). */
const COST_PER_TOKEN_USD = 3 / 1_000_000;
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/**
 * Estimate cost based on total tokens consumed.
 * Applies a multiplier for verification overhead.
 */
function estimateCost(tokens, verificationLevel) {
    // Each verification level adds ~20% token overhead
    const verificationMultiplier = 1 + verificationLevel * 0.2;
    return tokens * COST_PER_TOKEN_USD * verificationMultiplier;
}
/**
 * Score a config result for the balanced recommendation.
 *
 * Normalizes quality (unique findings), cost-efficiency, and speed to a
 * composite 0–1 score. Higher is better.
 */
function computeBalancedScore(result, allResults) {
    const maxQuality = Math.max(...allResults.map((r) => r.unique_findings));
    const minCostPerFinding = Math.min(...allResults.map((r) => r.unique_findings > 0 ? r.cost_usd / r.unique_findings : Infinity));
    const minDuration = Math.min(...allResults.map((r) => r.duration_ms));
    const qualityScore = maxQuality > 0 ? result.unique_findings / maxQuality : 0;
    const costPerFinding = result.unique_findings > 0 ? result.cost_usd / result.unique_findings : Infinity;
    const costScore = costPerFinding === Infinity || minCostPerFinding === 0
        ? 0
        : minCostPerFinding / costPerFinding;
    const speedScore = result.duration_ms > 0 ? minDuration / result.duration_ms : 0;
    // Weighted: quality 50%, cost 30%, speed 20%
    return qualityScore * 0.5 + costScore * 0.3 + speedScore * 0.2;
}
// ---------------------------------------------------------------------------
// Primary public API
// ---------------------------------------------------------------------------
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
export async function runPipelineTest(documentPath, configs) {
    if (configs.length === 0) {
        throw new Error('At least one PipelineConfig is required');
    }
    const results = [];
    for (const config of configs) {
        const start = Date.now();
        // Ingest the document
        const doc = await ingestDocument(documentPath);
        // Chunk it according to this config
        const chunks = chunkDocument(doc, {
            maxTokens: config.chunkSize,
            overlapTokens: config.overlapTokens,
        });
        // Distribute chunks across workers
        const assignments = distributeChunks(chunks, config.workerCount);
        // Count total tokens consumed across all assigned chunks
        const tokensUsed = assignments.reduce((sum, assignment) => sum + assignment.chunks.reduce((s, c) => s + c.token_estimate, 0), 0);
        // Build a cross-reference graph from extracted entities (structural simulation)
        const graph = new CrossReferenceGraph('general');
        const docRef = {
            document_id: doc.document_id,
            file_path: doc.metadata.file_path,
            title: doc.metadata.title,
        };
        for (const assignment of assignments) {
            for (const chunk of assignment.chunks) {
                const entities = extractEntities(chunk.text, 'general', docRef, `worker-${assignment.worker}`);
                for (const entity of entities) {
                    graph.addEntity(entity);
                }
            }
        }
        // Simulate a set of stub findings: one per worker per chunk (structural only)
        const stubFindings = assignments.map((assignment) => assignment.chunks.map((chunk) => ({
            finding_id: `${config.name}-${assignment.worker}-${chunk.chunk_id}`,
            type: 'structural',
            severity: 'info',
            title: `Chunk analysis: ${chunk.chunk_id}`,
            description: chunk.text.slice(0, 120),
            evidence_chain: [],
            confidence: 0.5,
            source_documents: [docRef],
            cross_references: [],
            worker: `worker-${assignment.worker}`,
            verified: false,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
        })));
        const merged = mergeFindings(stubFindings);
        const crossRefsFound = graph.referenceCount;
        const duration = Date.now() - start;
        results.push({
            config,
            findings_count: stubFindings.flat().length,
            unique_findings: merged.length,
            cross_references_found: crossRefsFound,
            tokens_used: tokensUsed,
            cost_usd: estimateCost(tokensUsed, config.verificationLevel),
            duration_ms: duration,
            timestamp: new Date().toISOString(),
        });
    }
    // Determine winners
    const bestByQuality = results.reduce((best, r) => r.unique_findings > best.unique_findings ? r : best);
    const bestByCost = results.reduce((best, r) => {
        const costPerFinding = r.unique_findings > 0 ? r.cost_usd / r.unique_findings : Infinity;
        const bestCostPerFinding = best.unique_findings > 0 ? best.cost_usd / best.unique_findings : Infinity;
        return costPerFinding < bestCostPerFinding ? r : best;
    });
    const bestBySpeed = results.reduce((best, r) => r.duration_ms < best.duration_ms ? r : best);
    const bestBalanced = results.reduce((best, r) => computeBalancedScore(r, results) > computeBalancedScore(best, results) ? r : best);
    return {
        configs: results,
        best_by_quality: bestByQuality.config.name,
        best_by_cost: bestByCost.config.name,
        best_by_speed: bestBySpeed.config.name,
        recommendation: bestBalanced.config.name,
    };
}
/**
 * Returns 5 standard test configurations covering a range of chunk sizes,
 * overlap ratios, worker counts, and verification levels.
 */
export function defaultConfigs() {
    return [
        {
            name: 'small-chunks-low-overlap',
            chunkSize: 1500,
            overlapTokens: 50,
            workerCount: 2,
            verificationLevel: 0,
        },
        {
            name: 'small-chunks-high-overlap',
            chunkSize: 1500,
            overlapTokens: 300,
            workerCount: 2,
            verificationLevel: 1,
        },
        {
            name: 'medium-chunks-balanced',
            chunkSize: 4000,
            overlapTokens: 200,
            workerCount: 4,
            verificationLevel: 2,
        },
        {
            name: 'large-chunks-many-workers',
            chunkSize: 8000,
            overlapTokens: 400,
            workerCount: 8,
            verificationLevel: 2,
        },
        {
            name: 'large-chunks-high-verification',
            chunkSize: 8000,
            overlapTokens: 400,
            workerCount: 6,
            verificationLevel: 4,
        },
    ];
}
/**
 * Persist a {@link ConfigComparison} to `<outputDir>/pipeline-test-<timestamp>.json`.
 * Creates the directory if it does not exist.
 */
export function saveTestResults(results, outputDir) {
    if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = join(outputDir, `pipeline-test-${timestamp}.json`);
    writeFileSync(filePath, JSON.stringify(results, null, 2), 'utf-8');
}
//# sourceMappingURL=pipeline-test.js.map