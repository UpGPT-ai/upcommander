/**
 * Claude Commander — Cross-Reference Detection
 *
 * Extracts entities from parallel agent outputs, builds a directed graph of
 * relationships, detects conflicts between workers, and traces reference chains
 * across documents. Designed to surface contradictions and corroborations in
 * multi-agent analysis pipelines.
 */
import type { DocRef } from './output-schemas.js';
/** All recognized semantic entity categories across supported analysis domains. */
export type EntityType = 'person' | 'organization' | 'date' | 'dollar_amount' | 'legal_citation' | 'chemical_compound' | 'regulatory_reference' | 'keyword' | 'study_id' | 'document_reference' | 'metric';
/** A single named entity extracted from agent output. */
export interface Entity {
    /** Stable unique identifier derived from type + normalized value + source. */
    id: string;
    type: EntityType;
    /** Lowercased / trimmed canonical form used for deduplication and matching. */
    value: string;
    /** Original text as it appeared in the source. */
    raw_value: string;
    /** Document in which this entity was found. */
    source: DocRef;
    /** Name of the worker agent that extracted this entity. */
    found_by: string;
    /** Extraction confidence, 0–1. */
    confidence: number;
}
/** A directed relationship between two entities. */
export interface Reference {
    /** Source entity ID. */
    from: string;
    /** Target entity ID. */
    to: string;
    /**
     * Semantic relationship label.
     * Common values: 'references', 'contradicts', 'confirms', 'supersedes'.
     */
    relationship: string;
    /** Worker that established this reference. */
    source: string;
}
/** A disagreement between two or more workers about the same entity. */
export interface Conflict {
    /** Normalized entity value that triggered the conflict. */
    entity_value: string;
    entity_type: EntityType;
    /** All worker reports that contribute to the conflict. */
    reports: Array<{
        worker: string;
        value: string;
        source: DocRef;
        confidence: number;
    }>;
    /** How serious the conflict is. Dollar/date discrepancies are always critical. */
    severity: 'critical' | 'high' | 'medium';
}
/** A linear path through the entity graph starting from a root entity. */
export interface ReferenceChain {
    root: Entity;
    links: Array<{
        entity: Entity;
        relationship: string;
        depth: number;
    }>;
    /** True when the chain contains a reference to an entity that cannot be resolved. */
    broken: boolean;
}
/** A single neighbor of an entity in the graph. */
export interface Connection {
    entity: Entity;
    relationship: string;
    direction: 'outgoing' | 'incoming';
}
/** Aggregate statistics for the entire cross-reference graph. */
export interface CrossRefSummary {
    total_entities: number;
    total_references: number;
    conflicts: Conflict[];
    /** Entities sorted by how often they are referenced by others. */
    most_referenced: Array<{
        entity: Entity;
        reference_count: number;
    }>;
    /** Entities with no outgoing or incoming connections. */
    orphaned: Entity[];
    /** Entity count grouped by EntityType. */
    by_type: Record<string, number>;
    /** Entity count grouped by worker name. */
    by_worker: Record<string, number>;
}
/**
 * Extract structured entities from a block of text using domain-specific
 * regex patterns. Entities are deduplicated by (type, normalizedValue, documentId).
 *
 * @param text      - Raw text output from an analysis worker.
 * @param domain    - Analysis domain key: 'sem' | 'legal' | 'pharma' | 'financial' | 'due-diligence'.
 * @param source    - Document reference that the text originated from.
 * @param foundBy   - Name of the worker agent that produced the text.
 * @param baseConfidence - Default extraction confidence, defaults to 0.75.
 * @returns Deduplicated array of extracted entities.
 */
export declare function extractEntities(text: string, domain: string, source: DocRef, foundBy: string, baseConfidence?: number): Entity[];
/**
 * Directed graph of entities and their relationships. This is the central
 * data structure for cross-reference analysis. Workers register their
 * extracted entities; the graph detects conflicts and traces chains.
 *
 * @example
 * ```ts
 * const graph = new CrossReferenceGraph('pharma');
 * const entities = extractEntities(workerOutput, 'pharma', docRef, 'worker-1');
 * entities.forEach(e => graph.addEntity(e));
 * graph.addReference(entityA.id, entityB.id, 'confirms', 'worker-1');
 * const conflicts = graph.findConflicts();
 * ```
 */
export declare class CrossReferenceGraph {
    /** All entities keyed by entity ID. */
    private readonly entities;
    /** Directed edges in the graph. */
    private readonly references;
    /**
     * Analysis domain — used to calibrate conflict severity.
     * Defaults to 'general'.
     */
    private readonly domain;
    /**
     * @param domain - Analysis domain key (e.g. 'pharma', 'legal').
     *                 Used for severity calibration in conflict detection.
     */
    constructor(domain?: string);
    /**
     * Register an entity in the graph. If an entity with the same ID already
     * exists, the higher-confidence version is kept. This means the same fact
     * extracted by multiple workers will naturally resolve to the most confident
     * reading.
     *
     * @param entity - Entity produced by {@link extractEntities}.
     */
    addEntity(entity: Entity): void;
    /**
     * Add a directed relationship between two entities.
     *
     * @param fromId       - Source entity ID.
     * @param toId         - Target entity ID.
     * @param relationship - Semantic label (e.g. 'confirms', 'contradicts').
     * @param source       - Worker that established this relationship.
     */
    addReference(fromId: string, toId: string, relationship: string, source: string): void;
    /**
     * Scan the graph for entities that different workers report with
     * contradictory values. Three conflict modes are detected:
     *
     * 1. **Value conflict** — same normalized value reported by ≥2 workers with
     *    different raw representations.
     * 2. **Dollar conflict** — numeric amounts for the same entity differ by >10%.
     * 3. **Relationship conflict** — one worker 'confirms' a target while another
     *    'contradicts' it.
     *
     * @returns Array of detected conflicts, sorted with 'critical' first.
     */
    findConflicts(): Conflict[];
    /** Build a Conflict object from a group of related entities. */
    private buildConflict;
    /** Build a conflict report row from a reference (for relationship conflicts). */
    private refToReport;
    /**
     * Follow reference links outward from a root entity up to `maxDepth` hops.
     * Returns the chain of entities encountered, in traversal order.
     * Sets `broken: true` if a referenced entity ID cannot be resolved.
     *
     * @param entityId - ID of the root entity.
     * @param maxDepth - Maximum traversal depth (default: 5).
     * @returns A {@link ReferenceChain} rooted at the given entity.
     */
    traceChain(entityId: string, maxDepth?: number): ReferenceChain;
    /** Create a placeholder entity for a missing ID (chain broken). */
    private makePlaceholder;
    /**
     * Return all entities directly connected to the given entity, along with
     * the relationship label and direction.
     *
     * @param entityId - Entity to look up.
     * @returns Array of {@link Connection} objects for all neighbors.
     */
    getConnections(entityId: string): Connection[];
    /**
     * Compute aggregate statistics for the graph including conflict list,
     * most-referenced entities, orphaned nodes, and per-type/per-worker counts.
     *
     * @returns A {@link CrossRefSummary} snapshot.
     */
    getSummary(): CrossRefSummary;
    /**
     * Serialize the graph to JSON and write it to
     * `<dirPath>/.claude-coord/cross-refs/graph.json`.
     * The directory is created if it does not exist.
     *
     * @param dirPath - Root project directory.
     */
    save(dirPath: string): void;
    /**
     * Deserialize a graph previously written by {@link CrossReferenceGraph.save}.
     *
     * @param dirPath - Root project directory (same value passed to `save`).
     * @returns A fully restored {@link CrossReferenceGraph}.
     * @throws If the graph file does not exist or cannot be parsed.
     */
    static load(dirPath: string): CrossReferenceGraph;
    /** Return the number of entities currently registered in the graph. */
    get entityCount(): number;
    /** Return the number of directed references in the graph. */
    get referenceCount(): number;
    /**
     * Look up a single entity by ID.
     *
     * @param id - Entity ID.
     * @returns The entity, or `undefined` if not present.
     */
    getEntity(id: string): Entity | undefined;
    /**
     * Return all entities of a given type.
     *
     * @param type - Entity type filter.
     */
    getEntitiesByType(type: EntityType): Entity[];
    /**
     * Return all entities extracted by a specific worker.
     *
     * @param workerName - Worker agent name.
     */
    getEntitiesByWorker(workerName: string): Entity[];
    /**
     * Return a shallow copy of all references for inspection.
     * Mutating the returned array does not affect the graph.
     */
    getAllReferences(): Reference[];
}
//# sourceMappingURL=cross-reference.d.ts.map