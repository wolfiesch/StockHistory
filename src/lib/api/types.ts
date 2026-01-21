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
