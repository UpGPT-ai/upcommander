/**
 * Document ingestion, chunking, and distribution for the data analysis pipeline.
 *
 * Supports: .pdf, .docx, .csv, .xlsx, .json, .xml, .txt, .md
 *
 * Optional heavy parsers (pdf-parse, mammoth, xlsx) are loaded via dynamic
 * import so the module works without them — it falls back gracefully when they
 * are absent.
 */
export interface DocumentMetadata {
    title: string;
    file_path: string;
    file_size: number;
    file_type: string;
    page_count?: number;
    row_count?: number;
    sections: string[];
    ingested_at: string;
}
export interface IngestedDocument {
    document_id: string;
    text: string;
    metadata: DocumentMetadata;
}
export interface ChunkOptions {
    /** Maximum tokens per chunk. Default: 4000. */
    maxTokens?: number;
    /** Tokens of overlap between adjacent chunks. Default: 200. */
    overlapTokens?: number;
    /** Prepend the active section header to each chunk. Default: true. */
    preserveHeaders?: boolean;
}
export interface DocumentChunk {
    chunk_id: string;
    document_id: string;
    text: string;
    /** Character offset where this chunk starts in the original text. */
    start_offset: number;
    /** Character offset where this chunk ends in the original text. */
    end_offset: number;
    /** Section heading this chunk falls under, if any. */
    section?: string;
    token_estimate: number;
}
export interface WorkerAssignment {
    worker: number;
    chunks: DocumentChunk[];
}
/**
 * Ingest a single document from `filePath`.
 *
 * Detects the file type by extension, extracts plain text, and returns an
 * {@link IngestedDocument} enriched with metadata (title, size, sections,
 * page/row counts where applicable).
 */
export declare function ingestDocument(filePath: string): Promise<IngestedDocument>;
/**
 * Split an {@link IngestedDocument} into overlapping {@link DocumentChunk}s.
 *
 * The algorithm respects section boundaries detected via heading patterns and
 * prepends the active section header to each chunk when `preserveHeaders` is
 * enabled. Adjacent chunks share `overlapTokens` worth of text so that no
 * cross-boundary context is lost.
 */
export declare function chunkDocument(doc: IngestedDocument, options?: ChunkOptions): DocumentChunk[];
/**
 * Distribute {@link DocumentChunk}s across `workerCount` workers using
 * round-robin assignment, augmented with adjacent-chunk overlap so each worker
 * receives the immediate neighbours of its primary chunks for cross-boundary
 * context.
 *
 * Returns one {@link WorkerAssignment} per worker (0-indexed).
 */
export declare function distributeChunks(chunks: DocumentChunk[], workerCount: number): WorkerAssignment[];
/**
 * Tracks ingested documents, chunk assignments, and analysis progress.
 *
 * State is persisted to `<projectRoot>/.claude-coord/document-registry.json`
 * so it survives process restarts and is visible to all agents sharing the
 * same coordination directory.
 */
export declare class DocumentRegistry {
    private store;
    private readonly storePath;
    constructor(projectRoot: string);
    private load;
    private persist;
    /**
     * Register an ingested document and return its `document_id`.
     *
     * If the document has already been registered (same `document_id`), the
     * existing record is returned without modification.
     */
    registerDocument(doc: IngestedDocument): string;
    /**
     * Record that `worker` has been assigned `chunkId` within `documentId`.
     *
     * Adds the chunk record if it does not yet exist.
     */
    assignChunk(documentId: string, chunkId: string, worker: string): void;
    /**
     * Mark a specific chunk as fully analyzed.
     */
    markAnalyzed(documentId: string, chunkId: string): void;
    /**
     * Return analysis progress for a single document.
     */
    getProgress(documentId: string): {
        total: number;
        analyzed: number;
        percentage: number;
    };
    /**
     * Return aggregate coverage statistics across all registered documents.
     */
    getCoverage(): {
        documents: number;
        chunks: number;
        analyzed: number;
    };
}
/**
 * Ingest all supported documents found directly inside `dirPath`.
 *
 * Hidden files (prefixed with `.`) and subdirectories are skipped. Returns
 * one {@link IngestedDocument} per successfully parsed file; errors on
 * individual files are logged to stderr and that file is omitted from results.
 */
export declare function ingestDirectory(dirPath: string): Promise<IngestedDocument[]>;
//# sourceMappingURL=ingestion.d.ts.map