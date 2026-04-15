/**
 * Document ingestion, chunking, and distribution for the data analysis pipeline.
 *
 * Supports: .pdf, .docx, .csv, .xlsx, .json, .xml, .txt, .md
 *
 * Optional heavy parsers (pdf-parse, mammoth, xlsx) are loaded via dynamic
 * import so the module works without them — it falls back gracefully when they
 * are absent.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { join, basename, extname } from 'node:path';
import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Internal types for the registry persistence file
// ---------------------------------------------------------------------------

interface ChunkRecord {
  chunk_id: string;
  worker?: string;
  analyzed: boolean;
}

interface DocumentRecord {
  document_id: string;
  metadata: DocumentMetadata;
  chunks: ChunkRecord[];
}

interface RegistryStore {
  documents: Record<string, DocumentRecord>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SUPPORTED_EXTENSIONS = new Set([
  '.pdf', '.docx', '.csv', '.xlsx', '.json', '.xml', '.txt', '.md',
]);

/** Rough token estimation: 1 token ≈ 4 characters. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Extract Markdown / reStructuredText / ATX-style section headings. */
function extractSections(text: string): string[] {
  const headingPattern = /^#{1,6}\s+.+|^.+\n[=\-]{2,}/gm;
  const matches = text.match(headingPattern) ?? [];
  return matches.map((h) => h.split('\n')[0].replace(/^#+\s*/, '').trim());
}

/** Parse a CSV string into a flat text representation. */
function parseCsv(raw: string): { text: string; rowCount: number } {
  const rows: string[][] = [];
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    if (!line.trim()) continue;
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current);
    rows.push(fields);
  }

  const text = rows.map((r) => r.join('\t')).join('\n');
  return { text, rowCount: rows.length };
}

// ---------------------------------------------------------------------------
// File-type extractors
// ---------------------------------------------------------------------------

async function extractPdf(filePath: string): Promise<{ text: string; pageCount?: number }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfParse = (await import('pdf-parse' as any)) as any;
    const buffer = readFileSync(filePath);
    const data = await (pdfParse.default ?? pdfParse)(buffer);
    return { text: data.text as string, pageCount: data.numpages as number };
  } catch {
    // pdf-parse not available — return raw buffer content as latin-1 string
    const buffer = readFileSync(filePath);
    return { text: buffer.toString('latin1') };
  }
}

async function extractDocx(filePath: string): Promise<{ text: string }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mammoth = (await import('mammoth' as any)) as any;
    const result = await (mammoth.default ?? mammoth).extractRawText({ path: filePath });
    return { text: result.value as string };
  } catch {
    // mammoth not available — read raw bytes as utf-8 best-effort
    const buffer = readFileSync(filePath);
    return { text: buffer.toString('utf-8') };
  }
}

async function extractXlsx(filePath: string): Promise<{ text: string; rowCount?: number }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const XLSX = (await import('xlsx' as any)) as any;
    const lib = XLSX.default ?? XLSX;
    const workbook = lib.readFile(filePath);
    const lines: string[] = [];
    let totalRows = 0;
    for (const sheetName of workbook.SheetNames as string[]) {
      const sheet = workbook.Sheets[sheetName];
      const csv: string = lib.utils.sheet_to_csv(sheet);
      const parsed = parseCsv(csv);
      lines.push(`=== Sheet: ${sheetName} ===`, parsed.text);
      totalRows += parsed.rowCount;
    }
    return { text: lines.join('\n'), rowCount: totalRows };
  } catch {
    return {
      text: '[XLSX parsing unavailable: install the "xlsx" package to extract spreadsheet content]',
    };
  }
}

// ---------------------------------------------------------------------------
// Primary public API
// ---------------------------------------------------------------------------

/**
 * Ingest a single document from `filePath`.
 *
 * Detects the file type by extension, extracts plain text, and returns an
 * {@link IngestedDocument} enriched with metadata (title, size, sections,
 * page/row counts where applicable).
 */
export async function ingestDocument(filePath: string): Promise<IngestedDocument> {
  const stat = statSync(filePath);
  const ext = extname(filePath).toLowerCase();
  const title = basename(filePath, ext);

  let text = '';
  let pageCount: number | undefined;
  let rowCount: number | undefined;

  switch (ext) {
    case '.pdf': {
      const result = await extractPdf(filePath);
      text = result.text;
      pageCount = result.pageCount;
      break;
    }
    case '.docx': {
      const result = await extractDocx(filePath);
      text = result.text;
      break;
    }
    case '.csv': {
      const raw = readFileSync(filePath, 'utf-8');
      const result = parseCsv(raw);
      text = result.text;
      rowCount = result.rowCount;
      break;
    }
    case '.xlsx': {
      const result = await extractXlsx(filePath);
      text = result.text;
      rowCount = result.rowCount;
      break;
    }
    case '.json':
    case '.xml':
    case '.txt':
    case '.md': {
      text = readFileSync(filePath, 'utf-8');
      break;
    }
    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }

  const sections = extractSections(text);

  const metadata: DocumentMetadata = {
    title,
    file_path: filePath,
    file_size: stat.size,
    file_type: ext.replace('.', ''),
    page_count: pageCount,
    row_count: rowCount,
    sections,
    ingested_at: new Date().toISOString(),
  };

  return {
    document_id: randomUUID(),
    text,
    metadata,
  };
}

/**
 * Split an {@link IngestedDocument} into overlapping {@link DocumentChunk}s.
 *
 * The algorithm respects section boundaries detected via heading patterns and
 * prepends the active section header to each chunk when `preserveHeaders` is
 * enabled. Adjacent chunks share `overlapTokens` worth of text so that no
 * cross-boundary context is lost.
 */
export function chunkDocument(
  doc: IngestedDocument,
  options: ChunkOptions = {},
): DocumentChunk[] {
  const maxTokens = options.maxTokens ?? 4000;
  const overlapTokens = options.overlapTokens ?? 200;
  const preserveHeaders = options.preserveHeaders ?? true;

  const maxChars = maxTokens * 4;
  const overlapChars = overlapTokens * 4;

  const text = doc.text;
  const chunks: DocumentChunk[] = [];

  // Build a map of character-offset → section heading for this document
  const headingRegex = /^(#{1,6}\s+.+|.+\n[=\-]{2,})/gm;
  const sectionMap: Array<{ offset: number; heading: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = headingRegex.exec(text)) !== null) {
    const rawHeading = m[0].split('\n')[0].replace(/^#+\s*/, '').trim();
    sectionMap.push({ offset: m.index, heading: rawHeading });
  }

  /** Return the active section heading at a given character offset. */
  function sectionAt(offset: number): string | undefined {
    let active: string | undefined;
    for (const entry of sectionMap) {
      if (entry.offset <= offset) active = entry.heading;
      else break;
    }
    return active;
  }

  let pos = 0;
  let chunkIndex = 0;
  let overlapCarry = '';

  while (pos < text.length) {
    const section = sectionAt(pos);
    const headerPrefix =
      preserveHeaders && section ? `## ${section}\n\n` : '';
    const availableChars = maxChars - headerPrefix.length;

    const raw = overlapCarry + text.slice(pos, pos + availableChars - overlapCarry.length);
    const chunkText = headerPrefix + raw;

    const start_offset = pos;
    const end_offset = Math.min(pos + availableChars, text.length);

    chunks.push({
      chunk_id: `${doc.document_id}:chunk:${chunkIndex}`,
      document_id: doc.document_id,
      text: chunkText,
      start_offset,
      end_offset,
      section,
      token_estimate: estimateTokens(chunkText),
    });

    // Advance position, leaving overlap for the next chunk
    const advance = availableChars - overlapChars - overlapCarry.length;
    if (advance <= 0) {
      // Safety valve: always make progress
      pos = end_offset;
      overlapCarry = '';
    } else {
      pos += advance;
      // Carry over the tail of the current raw slice as overlap
      overlapCarry =
        overlapChars > 0
          ? raw.slice(Math.max(0, raw.length - overlapChars))
          : '';
    }

    chunkIndex++;
  }

  return chunks;
}

/**
 * Distribute {@link DocumentChunk}s across `workerCount` workers using
 * round-robin assignment, augmented with adjacent-chunk overlap so each worker
 * receives the immediate neighbours of its primary chunks for cross-boundary
 * context.
 *
 * Returns one {@link WorkerAssignment} per worker (0-indexed).
 */
export function distributeChunks(
  chunks: DocumentChunk[],
  workerCount: number,
): WorkerAssignment[] {
  if (workerCount <= 0) throw new Error('workerCount must be a positive integer');
  if (chunks.length === 0) return Array.from({ length: workerCount }, (_, i) => ({ worker: i, chunks: [] }));

  // Primary assignment via round-robin
  const primaryMap = new Map<number, DocumentChunk[]>();
  for (let w = 0; w < workerCount; w++) primaryMap.set(w, []);

  chunks.forEach((chunk, idx) => {
    primaryMap.get(idx % workerCount)!.push(chunk);
  });

  // Build a lookup from chunk_id → index in `chunks`
  const chunkIndex = new Map(chunks.map((c, i) => [c.chunk_id, i]));

  const assignments: WorkerAssignment[] = [];

  for (let w = 0; w < workerCount; w++) {
    const primary = primaryMap.get(w)!;
    const extraIds = new Set<string>();

    for (const chunk of primary) {
      const idx = chunkIndex.get(chunk.chunk_id)!;
      // Add left neighbour
      if (idx > 0) extraIds.add(chunks[idx - 1].chunk_id);
      // Add right neighbour
      if (idx < chunks.length - 1) extraIds.add(chunks[idx + 1].chunk_id);
    }

    // Merge primary + neighbours, preserving original chunk order
    const primaryIds = new Set(primary.map((c) => c.chunk_id));
    const overlap = chunks.filter((c) => extraIds.has(c.chunk_id) && !primaryIds.has(c.chunk_id));

    // Sort by position in the original array for coherent reading order
    const combined = [...primary, ...overlap].sort(
      (a, b) => chunkIndex.get(a.chunk_id)! - chunkIndex.get(b.chunk_id)!,
    );

    assignments.push({ worker: w, chunks: combined });
  }

  return assignments;
}

// ---------------------------------------------------------------------------
// Document Registry
// ---------------------------------------------------------------------------

/**
 * Tracks ingested documents, chunk assignments, and analysis progress.
 *
 * State is persisted to `<projectRoot>/.claude-coord/document-registry.json`
 * so it survives process restarts and is visible to all agents sharing the
 * same coordination directory.
 */
export class DocumentRegistry {
  private store: RegistryStore = { documents: {} };
  private readonly storePath: string;

  constructor(projectRoot: string) {
    const coordDir = join(projectRoot, '.claude-coord');
    if (!existsSync(coordDir)) {
      mkdirSync(coordDir, { recursive: true });
    }
    this.storePath = join(coordDir, 'document-registry.json');
    this.load();
  }

  private load(): void {
    if (existsSync(this.storePath)) {
      try {
        const raw = readFileSync(this.storePath, 'utf-8');
        this.store = JSON.parse(raw) as RegistryStore;
      } catch {
        this.store = { documents: {} };
      }
    }
  }

  private persist(): void {
    writeFileSync(this.storePath, JSON.stringify(this.store, null, 2), 'utf-8');
  }

  /**
   * Register an ingested document and return its `document_id`.
   *
   * If the document has already been registered (same `document_id`), the
   * existing record is returned without modification.
   */
  registerDocument(doc: IngestedDocument): string {
    if (!this.store.documents[doc.document_id]) {
      this.store.documents[doc.document_id] = {
        document_id: doc.document_id,
        metadata: doc.metadata,
        chunks: [],
      };
      this.persist();
    }
    return doc.document_id;
  }

  /**
   * Record that `worker` has been assigned `chunkId` within `documentId`.
   *
   * Adds the chunk record if it does not yet exist.
   */
  assignChunk(documentId: string, chunkId: string, worker: string): void {
    const record = this.store.documents[documentId];
    if (!record) throw new Error(`Unknown document: ${documentId}`);

    let chunkRecord = record.chunks.find((c) => c.chunk_id === chunkId);
    if (!chunkRecord) {
      chunkRecord = { chunk_id: chunkId, analyzed: false };
      record.chunks.push(chunkRecord);
    }
    chunkRecord.worker = worker;
    this.persist();
  }

  /**
   * Mark a specific chunk as fully analyzed.
   */
  markAnalyzed(documentId: string, chunkId: string): void {
    const record = this.store.documents[documentId];
    if (!record) throw new Error(`Unknown document: ${documentId}`);

    const chunkRecord = record.chunks.find((c) => c.chunk_id === chunkId);
    if (!chunkRecord) {
      record.chunks.push({ chunk_id: chunkId, analyzed: true });
    } else {
      chunkRecord.analyzed = true;
    }
    this.persist();
  }

  /**
   * Return analysis progress for a single document.
   */
  getProgress(documentId: string): { total: number; analyzed: number; percentage: number } {
    const record = this.store.documents[documentId];
    if (!record) throw new Error(`Unknown document: ${documentId}`);

    const total = record.chunks.length;
    const analyzed = record.chunks.filter((c) => c.analyzed).length;
    const percentage = total === 0 ? 0 : Math.round((analyzed / total) * 100);
    return { total, analyzed, percentage };
  }

  /**
   * Return aggregate coverage statistics across all registered documents.
   */
  getCoverage(): { documents: number; chunks: number; analyzed: number } {
    const records = Object.values(this.store.documents);
    const documents = records.length;
    const chunks = records.reduce((sum, r) => sum + r.chunks.length, 0);
    const analyzed = records.reduce(
      (sum, r) => sum + r.chunks.filter((c) => c.analyzed).length,
      0,
    );
    return { documents, chunks, analyzed };
  }
}

// ---------------------------------------------------------------------------
// Batch ingestion
// ---------------------------------------------------------------------------

/**
 * Ingest all supported documents found directly inside `dirPath`.
 *
 * Hidden files (prefixed with `.`) and subdirectories are skipped. Returns
 * one {@link IngestedDocument} per successfully parsed file; errors on
 * individual files are logged to stderr and that file is omitted from results.
 */
export async function ingestDirectory(dirPath: string): Promise<IngestedDocument[]> {
  const entries = readdirSync(dirPath, { withFileTypes: true });
  const results: IngestedDocument[] = [];

  for (const entry of entries) {
    // Skip hidden entries and sub-directories
    if (entry.name.startsWith('.')) continue;
    if (entry.isDirectory()) continue;

    const ext = extname(entry.name).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(ext)) continue;

    const fullPath = join(dirPath, entry.name);
    try {
      const doc = await ingestDocument(fullPath);
      results.push(doc);
    } catch (err) {
      process.stderr.write(
        `[ingestion] Skipping ${fullPath}: ${err instanceof Error ? err.message : String(err)}\n`,
      );
    }
  }

  return results;
}
