#!/usr/bin/env tsx
// CLI entry point for upc-ephemeral.sh
// Usage: npx tsx src/lib/upcommander/ephemeral/cli.ts "<directive>"

import { startEphemeralTurn } from './turn-loop';

const directive = process.argv.slice(2).join(' ').trim();
if (!directive) {
  console.error('[upc-ephemeral/cli] No directive provided.');
  process.exit(1);
}

startEphemeralTurn(directive)
  .then(result => {
    console.log('\n─── Orchestrator Reply ───');
    console.log(result.reply);
    console.log(`\n[cost: $${result.costUsd.toFixed(4)} | trace: ${result.traceFile} | opus: ${result.delegatedToOpus}]`);
  })
  .catch(err => {
    console.error('[upc-ephemeral/cli] ERROR:', err);
    process.exit(1);
  });
