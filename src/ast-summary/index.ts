import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { glob as globAsync } from 'glob';
import type { FileSummary } from './types';

const CACHE_DIR = '.claude-coord/cache/ast';
const INDEX_FILE = 'index.json';
const SUMMARIZER_PY = path.resolve(__dirname, 'summarizer.py');

// index.json shape: { [relPath: string]: { sha: string; cacheFile: string } }
type CacheIndex = Record<string, { sha: string; cacheFile: string }>;

function getCacheRoot(repoPath: string): string {
  return path.join(repoPath, CACHE_DIR);
}

function getIndexPath(repoPath: string): string {
  return path.join(getCacheRoot(repoPath), INDEX_FILE);
}

function readIndex(repoPath: string): CacheIndex {
  const indexPath = getIndexPath(repoPath);
  if (!fs.existsSync(indexPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  } catch {
    return {};
  }
}

function writeIndex(repoPath: string, index: CacheIndex): void {
  const indexPath = getIndexPath(repoPath);
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
}

function getFileSha(repoPath: string, relFile: string): string {
  const absFile = path.join(repoPath, relFile);
  try {
    return execSync(`git hash-object "${absFile}"`, { cwd: repoPath, stdio: ['pipe', 'pipe', 'pipe'] })
      .toString()
      .trim();
  } catch {
    // Fallback: hash file contents via mtime+size
    try {
      const stat = fs.statSync(absFile);
      return `mtime-${stat.mtimeMs}-${stat.size}`;
    } catch {
      return 'unknown';
    }
  }
}

function shaToPath(sha: string, relFile: string): string {
  const prefix = sha.slice(0, 2) || 'xx';
  const rest = sha.slice(2) || sha;
  const slug = relFile.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  return path.join(prefix, `${rest}-${slug}.summary.json`);
}

function runSummarizer(repoPath: string, relFile: string, sha: string): Promise<FileSummary> {
  return new Promise((resolve, reject) => {
    const args = [SUMMARIZER_PY, relFile, repoPath, sha];
    const proc = spawn('python3', args, { cwd: repoPath });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code !== 0 && !stdout) {
        reject(new Error(`summarizer.py exited ${code}: ${stderr}`));
        return;
      }
      try {
        const result = JSON.parse(stdout.trim()) as FileSummary;
        resolve(result);
      } catch (e) {
        reject(new Error(`summarizer.py output parse error: ${stdout.slice(0, 200)}`));
      }
    });
    proc.on('error', reject);
  });
}

function runSummarizerBatch(repoPath: string, files: string[], shas: Record<string, string>): Promise<FileSummary[]> {
  return new Promise((resolve, reject) => {
    const input = JSON.stringify({ files, shas, repo_root: repoPath });
    const proc = spawn('python3', [SUMMARIZER_PY], { cwd: repoPath });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      try {
        const result = JSON.parse(stdout.trim());
        if (Array.isArray(result)) resolve(result as FileSummary[]);
        else reject(new Error(`batch unexpected response: ${stdout.slice(0, 200)}`));
      } catch {
        reject(new Error(`batch parse error: ${stdout.slice(0, 200)}, stderr: ${stderr.slice(0, 200)}`));
      }
    });
    proc.on('error', reject);
    proc.stdin.write(input);
    proc.stdin.end();
  });
}

function writeSummaryToCache(repoPath: string, summary: FileSummary, cacheFile: string): void {
  const fullPath = path.join(getCacheRoot(repoPath), cacheFile);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, JSON.stringify(summary, null, 2));
}

function readSummaryFromCache(repoPath: string, cacheFile: string): FileSummary | null {
  const fullPath = path.join(getCacheRoot(repoPath), cacheFile);
  if (!fs.existsSync(fullPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(fullPath, 'utf-8')) as FileSummary;
  } catch {
    return null;
  }
}

/**
 * Compute a fresh summary for a file (no cache check).
 */
export async function summarizeFile(repoPath: string, relFile: string): Promise<FileSummary> {
  const sha = getFileSha(repoPath, relFile);
  return runSummarizer(repoPath, relFile, sha);
}

/**
 * Return cached summary if git blob SHA matches, otherwise compute and cache.
 */
export async function getOrCompute(repoPath: string, relFile: string): Promise<FileSummary> {
  const sha = getFileSha(repoPath, relFile);
  const index = readIndex(repoPath);
  const entry = index[relFile];

  if (entry && entry.sha === sha) {
    const cached = readSummaryFromCache(repoPath, entry.cacheFile);
    if (cached) return cached;
  }

  // Cache miss — compute
  const summary = await runSummarizer(repoPath, relFile, sha);
  const cacheFile = shaToPath(sha, relFile);
  writeSummaryToCache(repoPath, summary, cacheFile);
  index[relFile] = { sha, cacheFile };
  writeIndex(repoPath, index);
  return summary;
}

/**
 * Remove a file's cache entry (call after a worker writes to a file).
 */
export function invalidate(repoPath: string, relFile: string): void {
  const index = readIndex(repoPath);
  const entry = index[relFile];
  if (!entry) return;

  // Delete cache file
  const fullPath = path.join(getCacheRoot(repoPath), entry.cacheFile);
  if (fs.existsSync(fullPath)) {
    try { fs.unlinkSync(fullPath); } catch { /* ignore */ }
  }

  delete index[relFile];
  writeIndex(repoPath, index);
}

/**
 * Summarize all files matching a glob pattern, using cache for each.
 * Batch-processes uncached files for efficiency.
 */
export async function summarizeTree(repoPath: string, globPattern: string): Promise<FileSummary[]> {
  const files = await globAsync(globPattern, { cwd: repoPath, nodir: true });
  const index = readIndex(repoPath);

  const results: FileSummary[] = [];
  const toCompute: string[] = [];
  const toComputeShas: Record<string, string> = {};

  for (const f of files) {
    const sha = getFileSha(repoPath, f);
    const entry = index[f];
    if (entry && entry.sha === sha) {
      const cached = readSummaryFromCache(repoPath, entry.cacheFile);
      if (cached) {
        results.push(cached);
        continue;
      }
    }
    toCompute.push(f);
    toComputeShas[f] = sha;
  }

  if (toCompute.length > 0) {
    const computed = await runSummarizerBatch(repoPath, toCompute, toComputeShas);
    for (const summary of computed) {
      const sha = toComputeShas[summary.path] || summary.sha;
      const cacheFile = shaToPath(sha, summary.path);
      writeSummaryToCache(repoPath, summary, cacheFile);
      index[summary.path] = { sha, cacheFile };
      results.push(summary);
    }
    writeIndex(repoPath, index);
  }

  return results;
}
