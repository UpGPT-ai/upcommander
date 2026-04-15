/**
 * Claude Commander — Cross-Reference Detection
 *
 * Extracts entities from parallel agent outputs, builds a directed graph of
 * relationships, detects conflicts between workers, and traces reference chains
 * across documents. Designed to surface contradictions and corroborations in
 * multi-agent analysis pipelines.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
// ---------------------------------------------------------------------------
// Regex pattern banks per domain
// ---------------------------------------------------------------------------
const PATTERNS = {
    sem: [
        // Dollar amounts: $1,234.56 or $5M
        { type: 'dollar_amount', regex: /\$[\d,]+(?:\.\d{1,2})?(?:[KMBkmb])?/g },
        // SEM metrics: CTR 12.3%, CPC $0.45, ROAS 4.2x
        {
            type: 'metric',
            regex: /\b(?:CTR|CPC|CPM|ROAS|CPA|CVR|ACOS|TACOS|BLENDED ROAS|MER)\s*[:=]?\s*[\d.,]+\s*[%x$]?/gi,
        },
        // Campaign / ad group names: quoted or Title Case identifiers
        { type: 'keyword', regex: /"[^"]{3,60}"|'[^']{3,60}'/g },
        // Standalone metric percentages
        { type: 'metric', regex: /\b\d+(?:\.\d+)?%\s*(?:CTR|CVR|conversion rate)/gi },
    ],
    legal: [
        // Case law citations: Smith v. Jones, 123 F.3d 456 (9th Cir. 2001)
        {
            type: 'legal_citation',
            regex: /[A-Z][a-z]+(?: [A-Z][a-z]+)* v\.? [A-Z][a-z]+(?: [A-Z][a-z]+)*,?\s+\d+ [A-Z]\.?\d*[a-z]* \d+(?:\s*\(\w[^)]+\))?/g,
        },
        // Statutes: 42 U.S.C. § 1983, 28 C.F.R. 35
        { type: 'legal_citation', regex: /\d+\s+(?:U\.S\.C\.|C\.F\.R\.)\s*§?\s*\d+[\d.a-z-]*/gi },
        // Dates: January 5, 2023 or 01/05/2023 or 2023-01-05
        {
            type: 'date',
            regex: /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}|\b\d{1,2}\/\d{1,2}\/\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/g,
        },
        // Dollar amounts
        { type: 'dollar_amount', regex: /\$[\d,]+(?:\.\d{1,2})?(?:\s*(?:million|billion|thousand))?/gi },
        // Person names: two or more Title Case words (heuristic)
        { type: 'person', regex: /\b(?:[A-Z][a-z]+\.?\s+){1,2}[A-Z][a-z]+\b/g },
        // Organizations: LLC, Inc., Corp., LLP suffixes
        { type: 'organization', regex: /[A-Z][A-Za-z &,.']+(?:LLC|Inc\.|Corp\.|LLP|Ltd\.)\b/g },
    ],
    pharma: [
        // Chemical compounds: CamelCase or multi-word capitalized with optional numbers
        { type: 'chemical_compound', regex: /\b[A-Z][a-z]+(?:[A-Z][a-z]*)*(?:-\d+[A-Z]?)?\b/g },
        // NCT numbers (ClinicalTrials.gov)
        { type: 'study_id', regex: /\bNCT\d{8}\b/g },
        // Protocol IDs: alphanumeric with dashes
        { type: 'study_id', regex: /\b[A-Z]{2,6}-\d{3,8}(?:-\d+)?\b/g },
        // 21 CFR references
        { type: 'regulatory_reference', regex: /21\s+CFR\s+(?:Part\s+)?\d+(?:\.\d+)*/gi },
        // ICH guidelines: ICH E6, ICH Q10
        { type: 'regulatory_reference', regex: /\bICH\s+[EQS]\d+[A-Za-z0-9()]*/g },
        // Module references: Module 2.3, Module 5.3.5.1
        { type: 'document_reference', regex: /\bModule\s+\d+(?:\.\d+)+/gi },
        // Dates
        {
            type: 'date',
            regex: /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}|\b\d{1,2}\/\d{1,2}\/\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/g,
        },
    ],
    financial: [
        // Dollar amounts
        { type: 'dollar_amount', regex: /\$[\d,]+(?:\.\d{1,2})?(?:\s*(?:million|billion|thousand|[KMBkmb]))?/gi },
        // Percentages
        { type: 'metric', regex: /[-+]?\d+(?:\.\d+)?%/g },
        // Ticker symbols: $AAPL, $MSFT
        { type: 'keyword', regex: /\$[A-Z]{1,5}\b/g },
        // Dates
        {
            type: 'date',
            regex: /\b(?:Q[1-4]\s+\d{4}|\bFY\s*\d{4}|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}|\b\d{4}-\d{2}-\d{2})\b/g,
        },
        // Metric names: EBITDA, Revenue, Gross Margin, etc.
        {
            type: 'metric',
            regex: /\b(?:EBITDA|Revenue|Gross\s+Margin|Net\s+Income|EPS|P\/E|CAGR|ARR|MRR|Churn|LTV|CAC)\b/gi,
        },
    ],
    'due-diligence': [
        { type: 'dollar_amount', regex: /\$[\d,]+(?:\.\d{1,2})?(?:\s*(?:million|billion|thousand|[KMBkmb]))?/gi },
        {
            type: 'date',
            regex: /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}|\b\d{1,2}\/\d{1,2}\/\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/g,
        },
        { type: 'person', regex: /\b(?:[A-Z][a-z]+\.?\s+){1,2}[A-Z][a-z]+\b/g },
        { type: 'organization', regex: /[A-Z][A-Za-z &,.']+(?:LLC|Inc\.|Corp\.|LLP|Ltd\.)\b/g },
        {
            type: 'legal_citation',
            regex: /[A-Z][a-z]+(?: [A-Z][a-z]+)* v\.? [A-Z][a-z]+(?: [A-Z][a-z]+)*,?\s+\d+ [A-Z]\.?\d*[a-z]* \d+/g,
        },
    ],
};
/** Fallback patterns applied when no domain-specific set matches. */
const GENERAL_PATTERNS = [
    {
        type: 'date',
        regex: /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}|\b\d{1,2}\/\d{1,2}\/\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/g,
    },
    { type: 'dollar_amount', regex: /\$[\d,]+(?:\.\d{1,2})?(?:[KMBkmb])?/g },
    { type: 'person', regex: /\b(?:[A-Z][a-z]+\.?\s+){1,2}[A-Z][a-z]+\b/g },
    { type: 'organization', regex: /[A-Z][A-Za-z &,.']+(?:LLC|Inc\.|Corp\.|LLP|Ltd\.)\b/g },
];
// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------
/**
 * Generate a stable entity ID from its type, normalized value, and source
 * document. Using a deterministic ID means the same fact extracted twice
 * will collide cleanly.
 */
function makeEntityId(type, normalizedValue, documentId) {
    // Simple hash substitute: base64url of concatenated fields
    const raw = `${type}::${normalizedValue}::${documentId}`;
    return Buffer.from(raw).toString('base64url').slice(0, 32);
}
/** Normalize a raw value to a canonical form for comparison. */
function normalizeValue(raw, type) {
    switch (type) {
        case 'dollar_amount':
            // Strip commas, convert K/M/B suffixes to numbers for comparison
            return raw.replace(/[$,\s]/g, '').toLowerCase();
        case 'date':
            // Normalize to ISO date string where possible
            try {
                const d = new Date(raw);
                if (!isNaN(d.getTime()))
                    return d.toISOString().slice(0, 10);
            }
            catch {
                // fall through
            }
            return raw.trim().toLowerCase();
        case 'person':
        case 'organization':
        case 'legal_citation':
            return raw.trim().toLowerCase().replace(/\s+/g, ' ');
        default:
            return raw.trim().toLowerCase();
    }
}
/**
 * Parse a normalized dollar string to a float for numeric comparison.
 * Returns NaN if unparseable.
 */
function parseDollar(normalized) {
    let s = normalized.replace(/[^0-9.kmb]/g, '');
    const suffix = s.slice(-1);
    const multipliers = { k: 1e3, m: 1e6, b: 1e9 };
    if (multipliers[suffix]) {
        s = s.slice(0, -1);
        return parseFloat(s) * multipliers[suffix];
    }
    return parseFloat(s);
}
/**
 * Parse a normalized date string to a timestamp for numeric comparison.
 * Returns NaN if unparseable.
 */
function parseDate(normalized) {
    const d = new Date(normalized);
    return isNaN(d.getTime()) ? NaN : d.getTime();
}
// ---------------------------------------------------------------------------
// Entity extraction
// ---------------------------------------------------------------------------
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
export function extractEntities(text, domain, source, foundBy, baseConfidence = 0.75) {
    const patternSet = PATTERNS[domain] ?? GENERAL_PATTERNS;
    const seen = new Set();
    const results = [];
    for (const { type, regex } of patternSet) {
        // Reset lastIndex since regexes may be shared references
        regex.lastIndex = 0;
        let match;
        while ((match = regex.exec(text)) !== null) {
            const raw = match[0].trim();
            if (!raw || raw.length < 2)
                continue;
            const normalized = normalizeValue(raw, type);
            const dedupeKey = `${type}::${normalized}::${source.document_id}`;
            if (seen.has(dedupeKey))
                continue;
            seen.add(dedupeKey);
            const id = makeEntityId(type, normalized, source.document_id);
            results.push({
                id,
                type,
                value: normalized,
                raw_value: raw,
                source,
                found_by: foundBy,
                confidence: baseConfidence,
            });
        }
        regex.lastIndex = 0;
    }
    return results;
}
// ---------------------------------------------------------------------------
// Conflict detection helpers
// ---------------------------------------------------------------------------
/**
 * Determine conflict severity based on entity type and domain context.
 * Dollar amounts and dates are always 'critical'. Legal / pharma entities
 * are 'high'. Everything else defaults to 'medium'.
 */
function conflictSeverity(type, domain) {
    if (type === 'dollar_amount' || type === 'date')
        return 'critical';
    if (domain === 'pharma' || domain === 'legal')
        return 'high';
    return 'medium';
}
// ---------------------------------------------------------------------------
// CrossReferenceGraph
// ---------------------------------------------------------------------------
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
export class CrossReferenceGraph {
    /** All entities keyed by entity ID. */
    entities = new Map();
    /** Directed edges in the graph. */
    references = [];
    /**
     * Analysis domain — used to calibrate conflict severity.
     * Defaults to 'general'.
     */
    domain;
    /**
     * @param domain - Analysis domain key (e.g. 'pharma', 'legal').
     *                 Used for severity calibration in conflict detection.
     */
    constructor(domain = 'general') {
        this.domain = domain;
    }
    // -------------------------------------------------------------------------
    // Mutation API
    // -------------------------------------------------------------------------
    /**
     * Register an entity in the graph. If an entity with the same ID already
     * exists, the higher-confidence version is kept. This means the same fact
     * extracted by multiple workers will naturally resolve to the most confident
     * reading.
     *
     * @param entity - Entity produced by {@link extractEntities}.
     */
    addEntity(entity) {
        const existing = this.entities.get(entity.id);
        if (!existing || entity.confidence > existing.confidence) {
            this.entities.set(entity.id, entity);
        }
    }
    /**
     * Add a directed relationship between two entities.
     *
     * @param fromId       - Source entity ID.
     * @param toId         - Target entity ID.
     * @param relationship - Semantic label (e.g. 'confirms', 'contradicts').
     * @param source       - Worker that established this relationship.
     */
    addReference(fromId, toId, relationship, source) {
        // Prevent exact duplicate edges
        const duplicate = this.references.some((r) => r.from === fromId && r.to === toId && r.relationship === relationship && r.source === source);
        if (!duplicate) {
            this.references.push({ from: fromId, to: toId, relationship, source });
        }
    }
    // -------------------------------------------------------------------------
    // Conflict detection
    // -------------------------------------------------------------------------
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
    findConflicts() {
        const conflicts = [];
        // Group entities by (type, normalizedValue) across workers
        const groups = new Map();
        for (const entity of this.entities.values()) {
            const key = `${entity.type}::${entity.value}`;
            const group = groups.get(key) ?? [];
            group.push(entity);
            groups.set(key, group);
        }
        for (const [, group] of groups) {
            if (group.length < 2)
                continue;
            // Check if multiple distinct workers report this entity
            const workerSet = new Set(group.map((e) => e.found_by));
            if (workerSet.size < 2)
                continue;
            // For dollar amounts, check if numeric values differ by >10%
            if (group[0].type === 'dollar_amount') {
                const amounts = group.map((e) => parseDollar(e.value));
                const valid = amounts.filter((a) => !isNaN(a));
                if (valid.length >= 2) {
                    const min = Math.min(...valid);
                    const max = Math.max(...valid);
                    if (min === 0 || (max - min) / min > 0.1) {
                        conflicts.push(this.buildConflict(group, 'dollar_amount'));
                    }
                }
                continue;
            }
            // For dates, check if timestamps differ by >1 day (86400000 ms)
            if (group[0].type === 'date') {
                const timestamps = group.map((e) => parseDate(e.value));
                const valid = timestamps.filter((t) => !isNaN(t));
                if (valid.length >= 2) {
                    const min = Math.min(...valid);
                    const max = Math.max(...valid);
                    if (max - min > 86_400_000) {
                        conflicts.push(this.buildConflict(group, 'date'));
                    }
                }
                continue;
            }
            // Generic: different raw values for same normalized key from different workers
            const rawValues = new Set(group.map((e) => e.raw_value.toLowerCase()));
            if (rawValues.size > 1) {
                conflicts.push(this.buildConflict(group, group[0].type));
            }
        }
        // Relationship conflicts: A confirms B + C contradicts B (different workers)
        const targetRelMap = new Map();
        for (const ref of this.references) {
            const refs = targetRelMap.get(ref.to) ?? [];
            refs.push(ref);
            targetRelMap.set(ref.to, refs);
        }
        for (const [targetId, refs] of targetRelMap) {
            const confirms = refs.filter((r) => r.relationship === 'confirms');
            const contradicts = refs.filter((r) => r.relationship === 'contradicts');
            if (confirms.length > 0 && contradicts.length > 0) {
                const confirmWorkers = new Set(confirms.map((r) => r.source));
                const contradictWorkers = new Set(contradicts.map((r) => r.source));
                // Only a conflict if different workers disagree
                const overlap = [...confirmWorkers].some((w) => contradictWorkers.has(w));
                if (!overlap) {
                    const targetEntity = this.entities.get(targetId);
                    if (targetEntity) {
                        conflicts.push({
                            entity_value: targetEntity.value,
                            entity_type: targetEntity.type,
                            reports: [
                                ...confirms.map((r) => this.refToReport(r)),
                                ...contradicts.map((r) => this.refToReport(r)),
                            ],
                            severity: conflictSeverity(targetEntity.type, this.domain),
                        });
                    }
                }
            }
        }
        // Sort: critical first, then high, then medium
        const order = { critical: 0, high: 1, medium: 2 };
        return conflicts.sort((a, b) => (order[a.severity] ?? 2) - (order[b.severity] ?? 2));
    }
    /** Build a Conflict object from a group of related entities. */
    buildConflict(group, type) {
        return {
            entity_value: group[0].value,
            entity_type: type,
            reports: group.map((e) => ({
                worker: e.found_by,
                value: e.raw_value,
                source: e.source,
                confidence: e.confidence,
            })),
            severity: conflictSeverity(type, this.domain),
        };
    }
    /** Build a conflict report row from a reference (for relationship conflicts). */
    refToReport(ref) {
        const fromEntity = this.entities.get(ref.from);
        return {
            worker: ref.source,
            value: `${ref.relationship} → ${ref.to}`,
            source: fromEntity?.source ?? { document_id: 'unknown', file_path: 'unknown' },
            confidence: fromEntity?.confidence ?? 0.5,
        };
    }
    // -------------------------------------------------------------------------
    // Chain tracing
    // -------------------------------------------------------------------------
    /**
     * Follow reference links outward from a root entity up to `maxDepth` hops.
     * Returns the chain of entities encountered, in traversal order.
     * Sets `broken: true` if a referenced entity ID cannot be resolved.
     *
     * @param entityId - ID of the root entity.
     * @param maxDepth - Maximum traversal depth (default: 5).
     * @returns A {@link ReferenceChain} rooted at the given entity.
     */
    traceChain(entityId, maxDepth = 5) {
        const root = this.entities.get(entityId);
        if (!root) {
            return {
                root: this.makePlaceholder(entityId),
                links: [],
                broken: true,
            };
        }
        const links = [];
        let broken = false;
        const visited = new Set([entityId]);
        const traverse = (currentId, depth) => {
            if (depth > maxDepth)
                return;
            const outgoing = this.references.filter((r) => r.from === currentId);
            for (const ref of outgoing) {
                if (visited.has(ref.to))
                    continue;
                visited.add(ref.to);
                const target = this.entities.get(ref.to);
                if (!target) {
                    broken = true;
                    continue;
                }
                links.push({ entity: target, relationship: ref.relationship, depth });
                traverse(ref.to, depth + 1);
            }
        };
        traverse(entityId, 1);
        return { root, links, broken };
    }
    /** Create a placeholder entity for a missing ID (chain broken). */
    makePlaceholder(id) {
        return {
            id,
            type: 'document_reference',
            value: id,
            raw_value: id,
            source: { document_id: 'unknown', file_path: 'unknown' },
            found_by: 'system',
            confidence: 0,
        };
    }
    // -------------------------------------------------------------------------
    // Neighbor queries
    // -------------------------------------------------------------------------
    /**
     * Return all entities directly connected to the given entity, along with
     * the relationship label and direction.
     *
     * @param entityId - Entity to look up.
     * @returns Array of {@link Connection} objects for all neighbors.
     */
    getConnections(entityId) {
        const connections = [];
        for (const ref of this.references) {
            if (ref.from === entityId) {
                const target = this.entities.get(ref.to);
                if (target) {
                    connections.push({ entity: target, relationship: ref.relationship, direction: 'outgoing' });
                }
            }
            else if (ref.to === entityId) {
                const source = this.entities.get(ref.from);
                if (source) {
                    connections.push({ entity: source, relationship: ref.relationship, direction: 'incoming' });
                }
            }
        }
        return connections;
    }
    // -------------------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------------------
    /**
     * Compute aggregate statistics for the graph including conflict list,
     * most-referenced entities, orphaned nodes, and per-type/per-worker counts.
     *
     * @returns A {@link CrossRefSummary} snapshot.
     */
    getSummary() {
        const allEntities = [...this.entities.values()];
        const conflicts = this.findConflicts();
        // Count incoming references per entity
        const incomingCount = new Map();
        for (const ref of this.references) {
            incomingCount.set(ref.to, (incomingCount.get(ref.to) ?? 0) + 1);
        }
        // Entities with any connection (incoming or outgoing)
        const connected = new Set();
        for (const ref of this.references) {
            connected.add(ref.from);
            connected.add(ref.to);
        }
        const orphaned = allEntities.filter((e) => !connected.has(e.id));
        // Most referenced: sort descending, take top 10
        const most_referenced = allEntities
            .filter((e) => (incomingCount.get(e.id) ?? 0) > 0)
            .map((e) => ({ entity: e, reference_count: incomingCount.get(e.id) ?? 0 }))
            .sort((a, b) => b.reference_count - a.reference_count)
            .slice(0, 10);
        // Count by type
        const by_type = {};
        for (const e of allEntities) {
            by_type[e.type] = (by_type[e.type] ?? 0) + 1;
        }
        // Count by worker
        const by_worker = {};
        for (const e of allEntities) {
            by_worker[e.found_by] = (by_worker[e.found_by] ?? 0) + 1;
        }
        return {
            total_entities: allEntities.length,
            total_references: this.references.length,
            conflicts,
            most_referenced,
            orphaned,
            by_type,
            by_worker,
        };
    }
    // -------------------------------------------------------------------------
    // Persistence
    // -------------------------------------------------------------------------
    /**
     * Serialize the graph to JSON and write it to
     * `<dirPath>/.claude-coord/cross-refs/graph.json`.
     * The directory is created if it does not exist.
     *
     * @param dirPath - Root project directory.
     */
    save(dirPath) {
        const outDir = join(dirPath, '.claude-coord', 'cross-refs');
        if (!existsSync(outDir)) {
            mkdirSync(outDir, { recursive: true });
        }
        const snapshot = {
            entities: Object.fromEntries(this.entities.entries()),
            references: this.references,
        };
        const outPath = join(outDir, 'graph.json');
        writeFileSync(outPath, JSON.stringify(snapshot, null, 2), 'utf-8');
    }
    /**
     * Deserialize a graph previously written by {@link CrossReferenceGraph.save}.
     *
     * @param dirPath - Root project directory (same value passed to `save`).
     * @returns A fully restored {@link CrossReferenceGraph}.
     * @throws If the graph file does not exist or cannot be parsed.
     */
    static load(dirPath) {
        const filePath = join(dirPath, '.claude-coord', 'cross-refs', 'graph.json');
        const raw = readFileSync(filePath, 'utf-8');
        const snapshot = JSON.parse(raw);
        const graph = new CrossReferenceGraph();
        for (const entity of Object.values(snapshot.entities)) {
            graph.entities.set(entity.id, entity);
        }
        graph.references.push(...snapshot.references);
        return graph;
    }
    // -------------------------------------------------------------------------
    // Inspection helpers (useful for tests and CLI output)
    // -------------------------------------------------------------------------
    /** Return the number of entities currently registered in the graph. */
    get entityCount() {
        return this.entities.size;
    }
    /** Return the number of directed references in the graph. */
    get referenceCount() {
        return this.references.length;
    }
    /**
     * Look up a single entity by ID.
     *
     * @param id - Entity ID.
     * @returns The entity, or `undefined` if not present.
     */
    getEntity(id) {
        return this.entities.get(id);
    }
    /**
     * Return all entities of a given type.
     *
     * @param type - Entity type filter.
     */
    getEntitiesByType(type) {
        return [...this.entities.values()].filter((e) => e.type === type);
    }
    /**
     * Return all entities extracted by a specific worker.
     *
     * @param workerName - Worker agent name.
     */
    getEntitiesByWorker(workerName) {
        return [...this.entities.values()].filter((e) => e.found_by === workerName);
    }
    /**
     * Return a shallow copy of all references for inspection.
     * Mutating the returned array does not affect the graph.
     */
    getAllReferences() {
        return [...this.references];
    }
}
//# sourceMappingURL=cross-reference.js.map