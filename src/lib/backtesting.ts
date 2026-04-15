/**
 * Historical Backtesting Infrastructure
 *
 * Provides backtesting computation, performance metrics (Sharpe, Sortino,
 * max drawdown), strategy comparison, and result persistence.
 * Used by the financial-analysis template to validate trade strategies
 * against historical data before live deployment.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RiskConstraints {
  /** Maximum % of capital per single position (e.g. 0.05 = 5%) */
  max_position_pct: number;
  /** Maximum portfolio drawdown before halting new trades (e.g. 0.15 = 15%) */
  max_drawdown_pct: number;
  /** Maximum % of capital in any one sector (e.g. 0.25 = 25%) */
  max_sector_exposure_pct: number;
  /** Maximum portfolio correlation coefficient (e.g. 0.7) */
  max_correlation: number;
  /** Maximum USD loss in a single trading day */
  max_daily_loss_usd: number;
}

export interface BacktestConfig {
  strategy_name: string;
  /** Path to historical data file (CSV or JSON) */
  data_source: string;
  start_date: string;
  end_date: string;
  initial_capital: number;
  constraints: RiskConstraints;
}

export interface BacktestResult {
  strategy_name: string;
  period: { start: string; end: string };
  trades: number;
  win_rate: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  max_drawdown_pct: number;
  total_return_pct: number;
  annualized_return_pct: number;
  profit_factor: number;
  avg_trade_pnl: number;
  best_trade: number;
  worst_trade: number;
  /** Number of times a risk constraint was triggered (blocking or warning) */
  constraints_triggered: number;
  equity_curve: Array<{ date: string; equity: number }>;
}

export interface TradeRecord {
  date: string;
  direction: 'long' | 'short';
  instrument: string;
  entry_price: number;
  exit_price: number;
  /** Number of units / contracts */
  size: number;
  pnl: number;
  holding_period_days: number;
  /** Which worker/agent generated this trade signal */
  signal_source: string;
}

// ---------------------------------------------------------------------------
// Core metrics
// ---------------------------------------------------------------------------

/**
 * Calculate annualized Sharpe ratio from a series of periodic returns.
 *
 * @param returns Array of periodic returns (e.g. daily: 0.01 = 1%)
 * @param riskFreeRate Annual risk-free rate (default 0.05 = 5%)
 * @param periodsPerYear Trading periods per year (default 252 for daily)
 */
export function calculateSharpe(
  returns: number[],
  riskFreeRate = 0.05,
  periodsPerYear = 252
): number {
  if (returns.length < 2) return 0;

  const periodicRiskFree = riskFreeRate / periodsPerYear;
  const excessReturns = returns.map((r) => r - periodicRiskFree);

  const mean = excessReturns.reduce((a, b) => a + b, 0) / excessReturns.length;
  const variance =
    excessReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) /
    (excessReturns.length - 1);
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;

  return (mean / stdDev) * Math.sqrt(periodsPerYear);
}

/**
 * Calculate annualized Sortino ratio (penalizes only downside volatility).
 *
 * @param returns Array of periodic returns
 * @param riskFreeRate Annual risk-free rate (default 0.05)
 * @param periodsPerYear Trading periods per year (default 252)
 */
export function calculateSortino(
  returns: number[],
  riskFreeRate = 0.05,
  periodsPerYear = 252
): number {
  if (returns.length < 2) return 0;

  const periodicRiskFree = riskFreeRate / periodsPerYear;
  const excessReturns = returns.map((r) => r - periodicRiskFree);

  const mean = excessReturns.reduce((a, b) => a + b, 0) / excessReturns.length;

  // Downside deviation: only count returns below the target (0)
  const downsideReturns = excessReturns.filter((r) => r < 0);
  if (downsideReturns.length === 0) return mean > 0 ? Infinity : 0;

  const downsideVariance =
    downsideReturns.reduce((sum, r) => sum + r ** 2, 0) / excessReturns.length;
  const downsideDeviation = Math.sqrt(downsideVariance);

  if (downsideDeviation === 0) return 0;

  return (mean / downsideDeviation) * Math.sqrt(periodsPerYear);
}

/**
 * Calculate maximum drawdown from an equity curve.
 *
 * @param equityCurve Array of equity values (e.g. [10000, 10200, 9800, ...])
 * @returns Maximum drawdown as a positive decimal (e.g. 0.15 = 15% drawdown)
 */
export function calculateMaxDrawdown(equityCurve: number[]): number {
  if (equityCurve.length === 0) return 0;

  let peak = equityCurve[0];
  let maxDd = 0;

  for (const equity of equityCurve) {
    if (equity > peak) {
      peak = equity;
    }
    const drawdown = peak > 0 ? (peak - equity) / peak : 0;
    if (drawdown > maxDd) {
      maxDd = drawdown;
    }
  }

  return maxDd;
}

// ---------------------------------------------------------------------------
// Constraint checking within backtest
// ---------------------------------------------------------------------------

/**
 * Check if a proposed trade violates the risk constraints.
 * Returns the number of violations found.
 */
function checkTradeConstraints(
  config: BacktestConfig,
  tradeSize: number,
  currentEquity: number,
  currentDrawdown: number,
  dailyPnl: number
): number {
  let violations = 0;

  // Max position size
  if (currentEquity > 0) {
    const positionPct = Math.abs(tradeSize) / currentEquity;
    if (positionPct > config.constraints.max_position_pct) violations++;
  }

  // Max drawdown halt
  if (currentDrawdown > config.constraints.max_drawdown_pct) violations++;

  // Max daily loss
  if (dailyPnl < -config.constraints.max_daily_loss_usd) violations++;

  return violations;
}

// ---------------------------------------------------------------------------
// Main backtest runner
// ---------------------------------------------------------------------------

/**
 * Run a backtest simulation over the provided trade records.
 *
 * Applies the risk constraints on each trade and builds the equity curve.
 * Trades that would violate hard constraints are counted but NOT applied
 * to the equity curve (they are blocked).
 *
 * @param config Backtest configuration including constraints
 * @param trades List of historical trade records to replay
 * @returns Complete backtest result with performance metrics
 */
export function runBacktest(
  config: BacktestConfig,
  trades: TradeRecord[]
): BacktestResult {
  // Sort trades by date
  const sorted = [...trades].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Filter trades within the configured date range
  const inRange = sorted.filter((t) => {
    const d = new Date(t.date);
    return d >= new Date(config.start_date) && d <= new Date(config.end_date);
  });

  // Build equity curve
  let equity = config.initial_capital;
  let peakEquity = equity;
  let constraintsTriggered = 0;
  let currentDate = '';
  let dailyPnl = 0;

  const equityCurve: Array<{ date: string; equity: number }> = [
    { date: config.start_date, equity },
  ];
  const appliedTrades: TradeRecord[] = [];
  const periodicReturns: number[] = [];

  for (const trade of inRange) {
    // Reset daily P&L on new day
    if (trade.date !== currentDate) {
      if (currentDate !== '') {
        const prevEquity = equityCurve[equityCurve.length - 1].equity;
        periodicReturns.push(prevEquity > 0 ? dailyPnl / prevEquity : 0);
      }
      currentDate = trade.date;
      dailyPnl = 0;
    }

    const currentDrawdown = peakEquity > 0 ? (peakEquity - equity) / peakEquity : 0;
    const tradeValueSize = Math.abs(trade.entry_price * trade.size);

    const violations = checkTradeConstraints(
      config,
      tradeValueSize,
      equity,
      currentDrawdown,
      dailyPnl
    );

    if (violations > 0) {
      constraintsTriggered += violations;
      // Blocked trade — do not apply P&L
      continue;
    }

    // Apply trade
    appliedTrades.push(trade);
    equity += trade.pnl;
    dailyPnl += trade.pnl;

    if (equity > peakEquity) peakEquity = equity;

    equityCurve.push({ date: trade.date, equity });
  }

  // Add final equity point
  if (equityCurve[equityCurve.length - 1].date !== config.end_date) {
    equityCurve.push({ date: config.end_date, equity });
  }

  // Performance metrics
  const maxDrawdown = calculateMaxDrawdown(equityCurve.map((p) => p.equity));
  const totalReturn = (equity - config.initial_capital) / config.initial_capital;

  // Annualized return: compound annual growth rate
  const startMs = new Date(config.start_date).getTime();
  const endMs = new Date(config.end_date).getTime();
  const years = (endMs - startMs) / (365.25 * 24 * 60 * 60 * 1000);
  const annualizedReturn =
    years > 0 ? Math.pow(1 + totalReturn, 1 / years) - 1 : 0;

  // Win rate and profit factor
  const winners = appliedTrades.filter((t) => t.pnl > 0);
  const losers = appliedTrades.filter((t) => t.pnl < 0);
  const winRate = appliedTrades.length > 0 ? winners.length / appliedTrades.length : 0;
  const grossProfit = winners.reduce((sum, t) => sum + t.pnl, 0);
  const grossLoss = Math.abs(losers.reduce((sum, t) => sum + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  const avgTradePnl =
    appliedTrades.length > 0
      ? appliedTrades.reduce((sum, t) => sum + t.pnl, 0) / appliedTrades.length
      : 0;

  const pnls = appliedTrades.map((t) => t.pnl);
  const bestTrade = pnls.length > 0 ? Math.max(...pnls) : 0;
  const worstTrade = pnls.length > 0 ? Math.min(...pnls) : 0;

  const sharpe = calculateSharpe(periodicReturns);
  const sortino = calculateSortino(periodicReturns);

  return {
    strategy_name: config.strategy_name,
    period: { start: config.start_date, end: config.end_date },
    trades: appliedTrades.length,
    win_rate: winRate,
    sharpe_ratio: sharpe,
    sortino_ratio: sortino,
    max_drawdown_pct: maxDrawdown,
    total_return_pct: totalReturn,
    annualized_return_pct: annualizedReturn,
    profit_factor: profitFactor,
    avg_trade_pnl: avgTradePnl,
    best_trade: bestTrade,
    worst_trade: worstTrade,
    constraints_triggered: constraintsTriggered,
    equity_curve: equityCurve,
  };
}

// ---------------------------------------------------------------------------
// Comparison and export
// ---------------------------------------------------------------------------

/**
 * Compare multiple backtest results and produce a markdown table.
 */
export function compareStrategies(results: BacktestResult[]): string {
  if (results.length === 0) return '_No results to compare._';

  const header = [
    '| Strategy | Trades | Win% | Sharpe | Sortino | Max DD | Total Return | Ann. Return | Profit Factor | Constraints Hit |',
    '|---|---|---|---|---|---|---|---|---|---|',
  ];

  const rows = results.map((r) => {
    const f = (n: number, decimals = 2) => n.toFixed(decimals);
    const pct = (n: number) => (n * 100).toFixed(1) + '%';

    return [
      `| ${r.strategy_name}`,
      r.trades.toString(),
      pct(r.win_rate),
      f(r.sharpe_ratio),
      f(r.sortino_ratio),
      pct(r.max_drawdown_pct),
      pct(r.total_return_pct),
      pct(r.annualized_return_pct),
      f(r.profit_factor),
      r.constraints_triggered.toString() + ' |',
    ].join(' | ');
  });

  return [...header, ...rows].join('\n');
}

/**
 * Save a backtest result to disk as JSON.
 *
 * @param result The backtest result to save
 * @param outputDir Directory path to write the result file
 */
export function saveBacktestResult(result: BacktestResult, outputDir: string): void {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const safeName = result.strategy_name.replace(/[^a-z0-9_-]/gi, '_');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backtest_${safeName}_${timestamp}.json`;

  writeFileSync(
    join(outputDir, filename),
    JSON.stringify(result, null, 2),
    'utf8'
  );
}

/**
 * Load a previously saved backtest result from disk.
 *
 * @param filePath Absolute path to the backtest JSON file
 */
export function loadBacktestResult(filePath: string): BacktestResult {
  const raw = readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as BacktestResult;
}

// ---------------------------------------------------------------------------
// Helpers — available for downstream use
// ---------------------------------------------------------------------------

/**
 * Convert an equity curve to a series of daily returns.
 */
export function equityCurveToReturns(
  curve: Array<{ date: string; equity: number }>
): number[] {
  const returns: number[] = [];
  for (let i = 1; i < curve.length; i++) {
    const prev = curve[i - 1].equity;
    const curr = curve[i].equity;
    returns.push(prev > 0 ? (curr - prev) / prev : 0);
  }
  return returns;
}

/**
 * Calculate the Calmar ratio (annualized return / max drawdown).
 * Higher is better. Returns 0 if max drawdown is 0.
 */
export function calculateCalmar(result: BacktestResult): number {
  if (result.max_drawdown_pct === 0) return 0;
  return result.annualized_return_pct / result.max_drawdown_pct;
}
