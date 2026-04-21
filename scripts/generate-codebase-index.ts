#!/usr/bin/env npx tsx
/**
 * Codebase Index Generator
 *
 * Generates a structured JSON index of the codebase that AI sessions
 * can parse in ~10K tokens instead of reading 374K tokens of source.
 *
 * Run: npx tsx scripts/generate-codebase-index.ts
 * Output: .codebase-index.json (gitignored, regenerated on demand)
 *
 * Hook into builds: add to package.json scripts:
 *   "predev": "npx tsx scripts/generate-codebase-index.ts"
 *   "prebuild": "npx tsx scripts/generate-codebase-index.ts"
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const OUTPUT = path.join(ROOT, '.codebase-index.json');

interface FileEntry {
  /** Exported symbols (functions, classes, interfaces, types, consts) */
  exports: string[];
  /** Function signatures: name(params): returnType */
  signatures: string[];
  /** Imported platform modules */
  platformImports: string[];
  /** Line count */
  lines: number;
  /** File purpose (from first JSDoc comment or header) */
  description?: string;
}

interface TableEntry {
  schema: string;
  table: string;
  columns: string[];
}

interface RouteEntry {
  path: string;
  methods: string[];
  auth: string;
}

interface CodebaseIndex {
  generated: string;
  stats: {
    totalFiles: number;
    totalLines: number;
    totalExports: number;
    platformModules: number;
    apiRoutes: number;
    dbTables: number;
  };
  /** Platform modules: platform/{module}/{file} → exports + signatures */
  platform: Record<string, FileEntry>;
  /** Product modules: {product}/{file} → exports */
  products: Record<string, FileEntry>;
  /** API routes: /api/... → methods + auth */
  routes: RouteEntry[];
  /** Database tables from migrations */
  tables: TableEntry[];
  /** Components: components/{path} → exports */
  components: Record<string, FileEntry>;
}

function extractExports(content: string): string[] {
  const exports: string[] = [];
  const re = /export\s+(?:async\s+)?(?:function|const|class|interface|type|enum)\s+(\w+)/g;
  let match;
  while ((match = re.exec(content)) !== null) {
    exports.push(match[1]);
  }
  // Also catch "export { X, Y } from ..."
  const reExport = /export\s*\{\s*([^}]+)\}/g;
  while ((match = reExport.exec(content)) !== null) {
    const names = match[1].split(',').map(s => s.trim().split(/\s+as\s+/).pop()!.trim());
    exports.push(...names.filter(n => n && !n.startsWith('//')));
  }
  return [...new Set(exports)].slice(0, 15);
}

function extractSignatures(content: string): string[] {
  const sigs: string[] = [];
  const re = /export\s+(?:async\s+)?function\s+(\w+)\s*(\([^)]*\))\s*(?::\s*([^\n{]+))?/g;
  let match;
  while ((match = re.exec(content)) !== null) {
    const name = match[1];
    const params = match[2].replace(/\s+/g, ' ').trim();
    const ret = match[3]?.trim().replace(/\s*\{$/, '') || 'void';
    sigs.push(`${name}${params}: ${ret}`);
  }
  return sigs.slice(0, 8);
}

function extractPlatformImports(content: string): string[] {
  const imports: string[] = [];
  const re = /from\s+['"](@\/lib\/platform\/[^'"]+)['"]/g;
  let match;
  while ((match = re.exec(content)) !== null) {
    imports.push(match[1]);
  }
  return [...new Set(imports)].slice(0, 5);
}

function extractDescription(content: string): string | undefined {
  // First JSDoc block or /** comment
  const match = content.match(/\/\*\*\s*\n\s*\*\s*(.+?)(?:\n|\*\/)/);
  if (match) return match[1].trim().slice(0, 100);
  // Or first line comment
  const lineMatch = content.match(/^\/\/\s*(.+)/m);
  if (lineMatch) return lineMatch[1].trim().slice(0, 100);
  return undefined;
}

function extractRoutes(routeDir: string): RouteEntry[] {
  const routes: RouteEntry[] = [];

  function walk(dir: string, routePath: string) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const segment = entry.name.startsWith('[') ? entry.name : entry.name;
        walk(path.join(dir, entry.name), `${routePath}/${segment}`);
      } else if (entry.name === 'route.ts' || entry.name === 'route.tsx') {
        const content = fs.readFileSync(path.join(dir, entry.name), 'utf-8');
        const methods: string[] = [];
        for (const m of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
          if (content.includes(`export async function ${m}`) || content.includes(`export function ${m}`)) {
            methods.push(m);
          }
        }
        const auth = content.includes('authenticateV1') ? 'authenticateV1' :
                      content.includes('requireCronAuth') ? 'cron' :
                      content.includes('auth') ? 'custom' : 'none';
        if (methods.length > 0) {
          routes.push({ path: routePath, methods, auth });
        }
      }
    }
  }

  walk(routeDir, '');
  return routes;
}

function extractTables(migrationsDir: string): TableEntry[] {
  const tables: TableEntry[] = [];
  if (!fs.existsSync(migrationsDir)) return tables;

  for (const file of fs.readdirSync(migrationsDir).sort()) {
    if (!file.endsWith('.sql')) continue;
    const content = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

    const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\.(\w+)\s*\(([^;]+)\)/gi;
    let match;
    while ((match = re.exec(content)) !== null) {
      const schema = match[1];
      const table = match[2];
      const body = match[3];
      const columns = body.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('--') && !line.startsWith('CONSTRAINT') && !line.startsWith('UNIQUE') && !line.startsWith('CHECK'))
        .map(line => {
          const colMatch = line.match(/^(\w+)\s+(\w+)/);
          return colMatch ? `${colMatch[1]} ${colMatch[2]}` : null;
        })
        .filter(Boolean) as string[];

      tables.push({ schema, table, columns: columns.slice(0, 20) });
    }
  }
  return tables;
}

function indexDirectory(dir: string, prefix: string): Record<string, FileEntry> {
  const result: Record<string, FileEntry> = {};
  if (!fs.existsSync(dir)) return result;

  function walk(currentDir: string) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'dist') continue;

      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const relPath = path.relative(path.dirname(dir), fullPath);
        const exports = extractExports(content);

        if (exports.length > 0) {
          result[relPath] = {
            exports,
            signatures: extractSignatures(content),
            platformImports: extractPlatformImports(content),
            lines: content.split('\n').length,
            description: extractDescription(content),
          };
        }
      }
    }
  }

  walk(dir);
  return result;
}

// --- Main ---

console.log('Generating codebase index...');

const platform = indexDirectory(path.join(SRC, 'lib/platform'), 'platform');
const products: Record<string, FileEntry> = {};

for (const product of ['upwrite', 'uplift', 'upschedule', 'uproute', 'upseek', 'upvault', 'uphelm', 'uplens', 'upnudge', 'upinbox']) {
  const productIndex = indexDirectory(path.join(SRC, 'lib', product), product);
  Object.assign(products, productIndex);
}

const components = indexDirectory(path.join(SRC, 'components/platform'), 'components/platform');
const routes = extractRoutes(path.join(SRC, 'app/api'));
const tables = extractTables(path.join(ROOT, 'supabase/migrations'));

const index: CodebaseIndex = {
  generated: new Date().toISOString(),
  stats: {
    totalFiles: Object.keys(platform).length + Object.keys(products).length + Object.keys(components).length,
    totalLines: [...Object.values(platform), ...Object.values(products), ...Object.values(components)]
      .reduce((sum, e) => sum + e.lines, 0),
    totalExports: [...Object.values(platform), ...Object.values(products), ...Object.values(components)]
      .reduce((sum, e) => sum + e.exports.length, 0),
    platformModules: Object.keys(platform).length,
    apiRoutes: routes.length,
    dbTables: tables.length,
  },
  platform,
  products,
  routes,
  tables,
  components,
};

const json = JSON.stringify(index, null, 2);
fs.writeFileSync(OUTPUT, json);

const compactSize = JSON.stringify(index).length;
console.log(`Index generated: ${OUTPUT}`);
console.log(`  Files indexed: ${index.stats.totalFiles}`);
console.log(`  Total exports: ${index.stats.totalExports}`);
console.log(`  API routes: ${index.stats.apiRoutes}`);
console.log(`  DB tables: ${index.stats.dbTables}`);
console.log(`  Index size: ${(compactSize / 1024).toFixed(1)}KB (~${Math.round(compactSize / 4).toLocaleString()} tokens)`);
console.log(`  vs reading all source: ~374K tokens (${Math.round(374000 / (compactSize / 4))}x compression)`);
