// Core stock data types for DCA visualization

export interface PricePoint {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface DividendHistory {
  exDate: string
  paymentDate: string
  amount: number
  yield: number
}

export interface APIError {
  message: string
  code: string
  status: number
}

// DCA-specific types
export type InvestmentFrequency = 'weekly' | 'biweekly' | 'monthly'

export interface DCAConfig {
  ticker: string
  amount: number              // Investment amount per period
  frequency: InvestmentFrequency
  startDate: string           // ISO date string
  isDRIP: boolean             // Dividend reinvestment
}

export interface SimulationPoint {
  date: string
  principal: number           // Total invested
  dividends: number           // Cumulative dividends (if !DRIP, else 0)
  marketValue: number         // Current value of all shares
  shares: number              // Total shares owned
  totalValue: number          // marketValue + dividends (for non-DRIP)
}

export interface SimulationResult {
  points: SimulationPoint[]
  finalShares: number
  totalInvested: number
  totalDividends: number
  finalValue: number
  totalReturn: number         // Percentage
  cagr: number               // Compound annual growth rate
}

// API response types
export interface StockDataResponse {
  prices: PricePoint[]
  dividends: DividendHistory[]
  symbol: string
  name?: string
}

// ============================================
// Rolling Window DCA Analysis Types
// ============================================

export type HorizonYears = 5 | 10 | 15 | 20
export type ViewMode = 'single' | 'rolling'
export type RollingXAxisMode = 'normalized' | 'calendar'

export interface RollingWindowConfig {
  ticker: string
  amount: number
  frequency: InvestmentFrequency
  horizonYears: HorizonYears
  isDRIP: boolean
}

/**
 * Result from a single rolling window simulation
 */
export interface WindowResult {
  startDate: string
  endDate: string
  totalReturn: number      // Percentage gain/loss
  cagr: number             // Compound annual growth rate
  finalValue: number       // Final portfolio value
  totalInvested: number    // Total amount invested
  monthlyValues: number[]  // Portfolio value at each month offset (0, 1, 2, ...)
}

/**
 * Percentile bands for visualization
 */
export interface PercentileBands {
  p10: number[]   // 10th percentile (worst 10%)
  p25: number[]   // 25th percentile
  p50: number[]   // 50th percentile (median)
  p75: number[]   // 75th percentile
  p90: number[]   // 90th percentile (best 10%)
}

/**
 * Summary statistics for rolling window analysis
 */
export interface RollingWindowStats {
  windowCount: number           // Total number of windows analyzed
  medianReturn: number          // Median total return across all windows
  medianCAGR: number            // Median CAGR
  successRate: number           // % of windows with positive return
  bestWindow: WindowResult | null
  worstWindow: WindowResult | null
  returnDistribution: {
    negative: number            // % of windows with negative return
    low: number                 // 0-50% return
    medium: number              // 50-100% return
    high: number                // 100%+ return
  }
}

/**
 * Complete rolling window analysis result
 */
export interface RollingWindowResult {
  config: RollingWindowConfig
  normalizedBands: {
    monthOffsets: number[]      // [0, 1, 2, ..., horizonMonths]
    valueBands: PercentileBands // Portfolio value at each offset
    returnBands: PercentileBands // Return % at each offset
  }
  stats: RollingWindowStats
  windows: WindowResult[]       // All individual window results
  dataRange: {
    firstDate: string
    lastDate: string
    yearsOfData: number
  }
}

/**
 * Data point for rolling analysis chart
 */
export interface RollingChartDataPoint {
  // For normalized mode: month index (0, 1, 2, ...)
  // For calendar mode: UTC timestamp
  time: number
  p10: number
  p25: number
  p50: number
  p75: number
  p90: number
}
