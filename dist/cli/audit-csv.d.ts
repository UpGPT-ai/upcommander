#!/usr/bin/env node
/**
 * Claude Commander — Local CSV SEM Audit Runner
 *
 * Runs a parallel SEM audit on a Google Ads search term CSV file.
 * Uses API-based execution when ANTHROPIC_API_KEY is available,
 * falls back to tmux-based execution via Claude Commander server.
 *
 * Usage:
 *   npx tsx src/cli/audit-csv.ts /path/to/search-terms.csv [options]
 *
 * Options:
 *   --output <dir>    Output directory (default: ./audit-output)
 *   --verify          Run verification pipeline (stages 1-2)
 *   --verify-full     Run full verification (stages 1-5)
 *   --budget <usd>    Set budget cap in USD
 *   --account <name>  Account name for reports (default: from filename)
 */
export {};
//# sourceMappingURL=audit-csv.d.ts.map