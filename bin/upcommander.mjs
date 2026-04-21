#!/usr/bin/env node
// UpCommander CLI launcher.
// Resolves and executes the TypeScript CLI entrypoint via tsx at runtime
// so a single published package works with `npm install -g` and `npx`.

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const cliEntry = join(here, '..', 'src', 'cli.ts');

const require = createRequire(import.meta.url);
let tsxBin;
try {
  tsxBin = require.resolve('tsx/cli');
} catch {
  console.error('upcommander: required runtime dependency "tsx" is missing.');
  console.error('Run: npm install -g tsx @upgpt/upcommander-cli');
  process.exit(1);
}

const child = spawn(process.execPath, [tsxBin, cliEntry, ...process.argv.slice(2)], {
  stdio: 'inherit',
});
child.on('exit', code => process.exit(code ?? 0));
