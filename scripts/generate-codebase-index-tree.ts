#!/usr/bin/env npx tsx
/**
 * Codebase Index Tree Generator
 *
 * Emits a drill-down navigation tree for the codebase.
 * Each directory gets its own JSON node at .codebase-index/<slug>.json.
 *
 * L0 = top-level big branches (lib, app, components, ...)
 * L1 = medium branches inside a big branch
 * L2 = files + exports inside a medium branch
 * L3+ = deeper as the directory tree warrants (large monorepos)
 *
 * Agents navigate top-down: pick a branch → pick a sub-branch → read source.
 * Source bundles (.source.md) are emitted for leaf directories only, on demand.
 *
 * Run: npx tsx scripts/generate-codebase-index-tree.ts [--with-source]
 */

import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, '..');
const SRC_ROOTS = ['src', 'supabase/migrations'];
const OUT_DIR = path.join(ROOT, '.codebase-index');
const IGNORE = new Set(['node_modules', '.next', 'dist', '.git', '__pycache__', '.turbo']);
const TS_EXTS = new Set(['.ts', '.tsx']);
const WITH_SOURCE = process.argv.includes('--with-source');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FileNode {
  type: 'file';
  name: string;
  lines: number;
  exports: string[];
  signatures: string[];
  purpose?: string;
}

interface DirNode {
  type: 'dir';
  name: string;
  path: string;        // relative to ROOT
  slug: string;        // filename-safe slug, maps to .codebase-index/<slug>.json
  purpose?: string;
  file_count: number;  // recursive .ts/.tsx count
  line_count: number;  // recursive
  depth: number;       // depth from src root (0 = top-level)
  children_dirs: DirNodeRef[];
  children_files: FileNode[];
}

interface DirNodeRef {
  name: string;
  slug: string;        // pointer to .codebase-index/<slug>.json
  purpose?: string;
  file_count: number;
  line_count: number;
  depth: number;
}

interface TreeIndex {
  generated: string;
  root: string;
  total_dirs: number;
  total_files: number;
  total_lines: number;
  top_branches: DirNodeRef[];
}

// ---------------------------------------------------------------------------
// Extraction helpers
// ---------------------------------------------------------------------------

function extractExports(content: string): string[] {
  const out: string[] = [];
  const re = /export\s+(?:async\s+)?(?:function|const|class|interface|type|enum)\s+(\w+)/g;
  let m;
  while ((m = re.exec(content)) !== null) out.push(m[1]);
  const re2 = /export\s*\{([^}]+)\}/g;
  while ((m = re2.exec(content)) !== null) {
    for (const s of m[1].split(',')) {
      const name = s.trim().split(/\s+as\s+/).pop()?.trim();
      if (name && !name.startsWith('//')) out.push(name);
    }
  }
  return [...new Set(out)];
}

function extractSignatures(content: string): string[] {
  const out: string[] = [];
  const re = /export\s+(?:async\s+)?function\s+(\w+)\s*(\([^)]{0,200}\))\s*(?::\s*([^\n{]{0,80}))?/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const params = m[2].replace(/\s+/g, ' ').trim();
    const ret = m[3]?.trim().replace(/\s*\{$/, '') ?? 'void';
    out.push(`${m[1]}${params}: ${ret}`);
  }
  return out.slice(0, 10);
}

function extractPurpose(dirPath: string): string | undefined {
  // Try index.ts, index.tsx, then first .ts file by name
  const candidates = ['index.ts', 'index.tsx'];
  for (const f of candidates) {
    const fp = path.join(dirPath, f);
    if (fs.existsSync(fp)) {
      const content = fs.readFileSync(fp, 'utf-8');
      const jsdoc = content.match(/\/\*\*\s*\n\s*\*\s*(.+?)(?:\n|\*\/)/);
      if (jsdoc) return jsdoc[1].trim().slice(0, 120);
      const line = content.match(/^\/\/\s*(.+)/m);
      if (line) return line[1].trim().slice(0, 120);
    }
  }
  // First .ts file alphabetically
  try {
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.ts') || f.endsWith('.tsx')).sort();
    if (files[0]) {
      const content = fs.readFileSync(path.join(dirPath, files[0]), 'utf-8');
      const jsdoc = content.match(/\/\*\*\s*\n\s*\*\s*(.+?)(?:\n|\*\/)/);
      if (jsdoc) return jsdoc[1].trim().slice(0, 120);
      const line = content.match(/^\/\/\s*(.+)/m);
      if (line) return line[1].trim().slice(0, 120);
    }
  } catch { /* ignore */ }
  return undefined;
}

function slugify(relPath: string): string {
  return relPath.replace(/[/\\]/g, '-').replace(/[^a-zA-Z0-9-_]/g, '_');
}

// ---------------------------------------------------------------------------
// Walk
// ---------------------------------------------------------------------------

let totalDirs = 0;
let totalFiles = 0;
let totalLines = 0;
const allNodes: DirNode[] = [];

function walkDir(absPath: string, relPath: string, depth: number): { file_count: number; line_count: number } {
  if (!fs.existsSync(absPath)) return { file_count: 0, line_count: 0 };

  const entries = fs.readdirSync(absPath, { withFileTypes: true });
  const childDirs = entries.filter(e => e.isDirectory() && !IGNORE.has(e.name));
  const childFiles = entries.filter(e => e.isFile() && TS_EXTS.has(path.extname(e.name)));

  // Recurse into subdirs first to get counts
  const subDirRefs: DirNodeRef[] = [];
  let totalSubFiles = 0;
  let totalSubLines = 0;

  for (const dir of childDirs) {
    const childRel = path.join(relPath, dir.name);
    const childAbs = path.join(absPath, dir.name);
    const { file_count, line_count } = walkDir(childAbs, childRel, depth + 1);
    if (file_count === 0) continue; // skip empty dirs
    const childSlug = slugify(childRel);
    const purpose = extractPurpose(childAbs);
    subDirRefs.push({ name: dir.name, slug: childSlug, purpose, file_count, line_count, depth: depth + 1 });
    totalSubFiles += file_count;
    totalSubLines += line_count;
  }

  // Process files at this level
  const fileNodes: FileNode[] = [];
  let localLines = 0;
  for (const file of childFiles) {
    const fp = path.join(absPath, file.name);
    const content = fs.readFileSync(fp, 'utf-8');
    const lines = content.split('\n').length;
    localLines += lines;
    totalFiles++;
    totalLines += lines;

    const purpose = (() => {
      const j = content.match(/\/\*\*\s*\n\s*\*\s*(.+?)(?:\n|\*\/)/);
      if (j) return j[1].trim().slice(0, 120);
      const l = content.match(/^\/\/\s*(.+)/m);
      if (l) return l[1].trim().slice(0, 120);
    })();

    fileNodes.push({
      type: 'file',
      name: file.name,
      lines,
      exports: extractExports(content),
      signatures: extractSignatures(content),
      purpose,
    });
  }

  const slug = slugify(relPath);
  const purpose = extractPurpose(absPath);
  const file_count = (childFiles.length) + totalSubFiles;
  const line_count = localLines + totalSubLines;

  const node: DirNode = {
    type: 'dir',
    name: path.basename(relPath),
    path: relPath,
    slug,
    purpose,
    file_count,
    line_count,
    depth,
    children_dirs: subDirRefs,
    children_files: fileNodes,
  };

  allNodes.push(node);
  totalDirs++;

  // Emit source bundle for leaf dirs (no subdir children with files)
  if (WITH_SOURCE && subDirRefs.length === 0 && fileNodes.length > 0) {
    const bundleParts: string[] = [];
    for (const f of fileNodes) {
      const content = fs.readFileSync(path.join(absPath, f.name), 'utf-8');
      bundleParts.push(`## ${f.name}\n\`\`\`typescript\n${content}\n\`\`\``);
    }
    const bundlePath = path.join(OUT_DIR, `${slug}.source.md`);
    fs.writeFileSync(bundlePath, bundleParts.join('\n\n'));
  }

  return { file_count, line_count };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log('Generating codebase index tree...');
fs.mkdirSync(OUT_DIR, { recursive: true });

const topRefs: DirNodeRef[] = [];

for (const srcRoot of SRC_ROOTS) {
  const absRoot = path.join(ROOT, srcRoot);
  if (!fs.existsSync(absRoot)) continue;

  const entries = fs.readdirSync(absRoot, { withFileTypes: true });
  const topDirs = entries.filter(e => e.isDirectory() && !IGNORE.has(e.name));
  const topFiles = entries.filter(e => e.isFile() && TS_EXTS.has(path.extname(e.name)));

  // Top-level files (flat, e.g. src/middleware.ts)
  for (const f of topFiles) {
    const fp = path.join(absRoot, f.name);
    const content = fs.readFileSync(fp, 'utf-8');
    totalFiles++;
    totalLines += content.split('\n').length;
  }

  for (const dir of topDirs) {
    const relPath = path.join(srcRoot, dir.name);
    const absPath = path.join(absRoot, dir.name);
    const { file_count, line_count } = walkDir(absPath, relPath, 1);
    if (file_count === 0) continue;
    const slug = slugify(relPath);
    const purpose = extractPurpose(absPath);
    topRefs.push({ name: `${srcRoot}/${dir.name}`, slug, purpose, file_count, line_count, depth: 0 });
  }
}

// Write each node JSON
for (const node of allNodes) {
  const outPath = path.join(OUT_DIR, `${node.slug}.json`);
  fs.writeFileSync(outPath, JSON.stringify(node, null, 2));
}

// Write root index
const index: TreeIndex = {
  generated: new Date().toISOString(),
  root: ROOT,
  total_dirs: totalDirs,
  total_files: totalFiles,
  total_lines: totalLines,
  top_branches: topRefs,
};
fs.writeFileSync(path.join(OUT_DIR, 'index.json'), JSON.stringify(index, null, 2));

// Stats
const nodeFiles = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.json'));
const sourceBundles = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.source.md'));
const indexSizeKb = (JSON.stringify(index).length / 1024).toFixed(1);
const totalNodeSizeKb = (nodeFiles.reduce((sum, f) => {
  return sum + fs.statSync(path.join(OUT_DIR, f)).size;
}, 0) / 1024).toFixed(1);

console.log(`\nTree generated → .codebase-index/`);
console.log(`  Root index:    .codebase-index/index.json  (${indexSizeKb}KB)`);
console.log(`  Directory nodes: ${nodeFiles.length} files (${totalNodeSizeKb}KB total)`);
if (sourceBundles.length > 0) console.log(`  Source bundles: ${sourceBundles.length} .source.md files`);
console.log(`  Dirs indexed:  ${totalDirs}`);
console.log(`  Files indexed: ${totalFiles}`);
console.log(`  Total lines:   ${totalLines.toLocaleString()}`);
console.log(`\nNavigation:  index.json → top_branches[] → each .json → children_dirs[] → deeper .json`);
console.log(`Source read: add --with-source to emit leaf .source.md bundles`);
