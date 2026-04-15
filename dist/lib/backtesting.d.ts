/**
 * Historical Backtesting Infrastructure
 *
 * Provides backtesting computation, performance metrics (Sharpe, Sortino,
 * max drawdown), strategy comparison, and result persistence.
 * Used by the financial-analysis template to validate trade strategies
 * against historical data before live deployment.
 */
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
    period: {
        start: string;
        end: string;
    };
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
    equity_curve: Array<{
        date: string;
        equity: number;
    }>;
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
/**
 * Calculate annualized Sharpe ratio from a series of periodic returns.
 *
 * @param returns Array of periodic returns (e.g. daily: 0.01 = 1%)
 * @param riskFreeRate Annual risk-free rate (default 0.05 = 5%)
 * @param periodsPerYear Trading periods per year (default 252 for daily)
 */
export declare function calculateSharpe(returns: number[], riskFreeRate?: number, periodsPerYear?: number): number;
/**
 * Calculate annualized Sortino ratio (penalizes only downside volatility).
 *
 * @param returns Array of periodic returns
 * @param riskFreeRate Annual risk-free rate (default 0.05)
 * @param periodsPerYear Trading periods per year (default 252)
 */
export declare function calculateSortino(returns: number[], riskFreeRate?: number, periodsPerYear?: number): number;
/**
 * Calculate maximum drawdown from an equity curve.
 *
 * @param equityCurve Array of equity values (e.g. [10000, 10200, 9800, ...])
 * @returns Maximum drawdown as a positive decimal (e.g. 0.15 = 15% drawdown)
 */
export declare function calculateMaxDrawdown(equityCurve: number[]): number;
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
export declare function runBacktest(config: BacktestConfig, trades: TradeRecord[]): BacktestResult;
/**
 * Compare multiple backtest results and produce a markdown table.
 */
export declare function compareStrategies(results: BacktestResult[]): string;
/**
 * Save a backtest result to disk as JSON.
 *
 * @param result The backtest result to save
 * @param outputDir Directory path to write the result file
 */
export declare function saveBacktestResult(result: BacktestResult, outputDir: string): void;
/**
 * Load a previously saved backtest result from disk.
 *
 * @param filePath Absolute path to the backtest JSON file
 */
export declare function loadBacktestResult(filePath: string): BacktestResult;
/**
 * Convert an equity curve to a series of daily returns.
 */
export declare function equityCurveToReturns(curve: Array<{
    date: string;
    equity: number;
}>): number[];
/**
 * Calculate the Calmar ratio (annualized return / max drawdown).
 * Higher is better. Returns 0 if max drawdown is 0.
 */
export declare function calculateCalmar(result: BacktestResult): number;
//# sourceMappingURL=backtesting.d.ts.map