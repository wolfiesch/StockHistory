/**
 * Rolling Window DCA Analysis Engine
 *
 * Core algorithm for computing DCA outcomes across all possible historical
 * rolling windows of a given horizon. Reuses the existing runDCASimulation()
 * for each window rather than reimplementing DCA logic.
 */

import type {
  PricePoint,
  DividendHistory,
  RollingWindowConfig,
  RollingWindowResult,
  WindowResult,
  PercentileBands,
  RollingWindowStats,
  HorizonYears,
  SimulationPoint,
} from '../api/types'

import { runDCASimulation } from './dcaEngine'
import {
  calculatePercentileBands,
  calculateMedian,
  categorizeReturns,
} from './percentileUtils'

/**
 * Generate all valid window start dates (first of each month).
 * A window is valid if there's sufficient forward data for the horizon.
 */
function generateWindowStartDates(
  priceHistory: PricePoint[],
  horizonYears: HorizonYears
): string[] {
  if (priceHistory.length === 0) return []

  const firstDate = new Date(priceHistory[0].date)
  const lastDate = new Date(priceHistory[priceHistory.length - 1].date)

  // Calculate the latest valid start date (horizon years before the last date)
  const latestStart = new Date(lastDate)
  latestStart.setFullYear(latestStart.getFullYear() - horizonYears)

  // If the latest start is before the first date, no valid windows exist
  if (latestStart < firstDate) return []

  // Generate first-of-month dates from first available to latest valid start
  const startDates: string[] = []
  const current = new Date(firstDate)

  // Move to first of the month
  current.setDate(1)

  while (current <= latestStart) {
    startDates.push(current.toISOString().split('T')[0])
    current.setMonth(current.getMonth() + 1)
  }

  return startDates
}

/**
 * Calculate the end date for a window given a start date and horizon.
 */
function getWindowEndDate(startDate: string, horizonYears: HorizonYears): string {
  const end = new Date(startDate)
  end.setFullYear(end.getFullYear() + horizonYears)
  return end.toISOString().split('T')[0]
}

/**
 * Extract monthly portfolio values from simulation points.
 * Returns an array where index = month offset from start.
 */
function extractMonthlyValues(
  points: SimulationPoint[],
  startDate: string,
  horizonMonths: number
): number[] {
  if (points.length === 0) return []

  // Build a map of YYYY-MM to the last point in that month
  const monthlyMap = new Map<string, number>()

  for (const point of points) {
    const monthKey = point.date.substring(0, 7) // YYYY-MM
    monthlyMap.set(monthKey, point.totalValue)
  }

  // Generate expected month keys
  const start = new Date(startDate)
  const values: number[] = []

  for (let i = 0; i <= horizonMonths; i++) {
    const monthDate = new Date(start)
    monthDate.setMonth(monthDate.getMonth() + i)
    const monthKey = monthDate.toISOString().split('T')[0].substring(0, 7)

    // Use the value if available, otherwise use the last known value
    if (monthlyMap.has(monthKey)) {
      values.push(monthlyMap.get(monthKey)!)
    } else if (values.length > 0) {
      // Carry forward last known value if month is missing (e.g., no trading data)
      values.push(values[values.length - 1])
    } else {
      values.push(0)
    }
  }

  return values
}

/**
 * Run DCA simulation for a single rolling window.
 */
function runWindowSimulation(
  priceHistory: PricePoint[],
  dividendHistory: DividendHistory[],
  config: RollingWindowConfig,
  startDate: string,
  endDate: string
): WindowResult | null {
  // Filter price history to window range
  const windowPrices = priceHistory.filter(
    (p) => p.date >= startDate && p.date <= endDate
  )

  if (windowPrices.length === 0) return null

  // Filter dividends to window range
  const windowDividends = dividendHistory.filter(
    (d) => d.exDate >= startDate && d.exDate <= endDate
  )

  // Run the DCA simulation
  const result = runDCASimulation(windowPrices, windowDividends, {
    amount: config.amount,
    frequency: config.frequency,
    startDate,
    isDRIP: config.isDRIP,
  })

  if (result.points.length === 0) return null

  // Extract monthly values for percentile band computation
  const horizonMonths = config.horizonYears * 12
  const monthlyValues = extractMonthlyValues(result.points, startDate, horizonMonths)

  return {
    startDate,
    endDate,
    totalReturn: result.totalReturn,
    cagr: result.cagr,
    finalValue: result.finalValue,
    totalInvested: result.totalInvested,
    monthlyValues,
  }
}

/**
 * Compute statistics from all window results.
 */
function computeStats(windows: WindowResult[]): RollingWindowStats {
  if (windows.length === 0) {
    return {
      windowCount: 0,
      medianReturn: 0,
      medianCAGR: 0,
      successRate: 0,
      bestWindow: null,
      worstWindow: null,
      returnDistribution: { negative: 0, low: 0, medium: 0, high: 0 },
    }
  }

  const returns = windows.map((w) => w.totalReturn)
  const cagrs = windows.map((w) => w.cagr)

  // Find best and worst windows by total return
  let bestWindow = windows[0]
  let worstWindow = windows[0]

  for (const window of windows) {
    if (window.totalReturn > bestWindow.totalReturn) {
      bestWindow = window
    }
    if (window.totalReturn < worstWindow.totalReturn) {
      worstWindow = window
    }
  }

  // Calculate success rate (positive returns)
  const successCount = returns.filter((r) => r > 0).length
  const successRate = (successCount / returns.length) * 100

  return {
    windowCount: windows.length,
    medianReturn: calculateMedian(returns),
    medianCAGR: calculateMedian(cagrs),
    successRate,
    bestWindow,
    worstWindow,
    returnDistribution: categorizeReturns(returns),
  }
}

/**
 * Compute percentile bands from all window monthly values.
 */
function computePercentileBands(
  windows: WindowResult[],
  horizonMonths: number
): { valueBands: PercentileBands; returnBands: PercentileBands } {
  if (windows.length === 0) {
    const empty: PercentileBands = {
      p10: [],
      p25: [],
      p50: [],
      p75: [],
      p90: [],
    }
    return { valueBands: empty, returnBands: empty }
  }

  // Collect values at each month offset
  const valueArrays: number[][] = []
  const returnArrays: number[][] = []

  for (let month = 0; month <= horizonMonths; month++) {
    const valuesAtMonth: number[] = []
    const returnsAtMonth: number[] = []

    for (const window of windows) {
      if (month < window.monthlyValues.length) {
        const value = window.monthlyValues[month]
        valuesAtMonth.push(value)

        // Calculate return at this month
        // We need to know the invested amount up to this month
        // For simplicity, we'll use (value - invested) / invested * 100
        // The invested amount grows monthly, so we approximate
        const monthsInvested = month + 1

        // Estimate invested amount proportionally
        const investedByMonth = window.totalInvested * (monthsInvested / (window.monthlyValues.length || 1))
        const returnAtMonth = investedByMonth > 0
          ? ((value - investedByMonth) / investedByMonth) * 100
          : 0
        returnsAtMonth.push(returnAtMonth)
      }
    }

    valueArrays.push(valuesAtMonth)
    returnArrays.push(returnsAtMonth)
  }

  return {
    valueBands: calculatePercentileBands(valueArrays),
    returnBands: calculatePercentileBands(returnArrays),
  }
}

/**
 * Determine which horizons are available given the data length.
 */
export function getAvailableHorizons(
  priceHistory: PricePoint[]
): HorizonYears[] {
  if (priceHistory.length === 0) return []

  const firstDate = new Date(priceHistory[0].date)
  const lastDate = new Date(priceHistory[priceHistory.length - 1].date)
  const yearsOfData =
    (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)

  const horizons: HorizonYears[] = []

  // Need at least horizon + 1 year to have meaningful rolling windows
  if (yearsOfData >= 6) horizons.push(5)
  if (yearsOfData >= 11) horizons.push(10)
  if (yearsOfData >= 16) horizons.push(15)
  if (yearsOfData >= 21) horizons.push(20)

  return horizons
}

/**
 * Main entry point: Run rolling window analysis.
 *
 * @param priceHistory - Complete price history for the ticker
 * @param dividendHistory - Complete dividend history for the ticker
 * @param config - Rolling window configuration
 * @returns Complete rolling window analysis result
 */
export function runRollingWindowAnalysis(
  priceHistory: PricePoint[],
  dividendHistory: DividendHistory[],
  config: RollingWindowConfig
): RollingWindowResult {
  const { horizonYears } = config
  const horizonMonths = horizonYears * 12

  // Calculate data range
  const firstDate = priceHistory.length > 0 ? priceHistory[0].date : ''
  const lastDate =
    priceHistory.length > 0 ? priceHistory[priceHistory.length - 1].date : ''
  const yearsOfData =
    priceHistory.length > 0
      ? (new Date(lastDate).getTime() - new Date(firstDate).getTime()) /
        (1000 * 60 * 60 * 24 * 365.25)
      : 0

  // Generate all valid window start dates
  const startDates = generateWindowStartDates(priceHistory, horizonYears)

  if (startDates.length === 0) {
    // Not enough data for any windows
    return {
      config,
      normalizedBands: {
        monthOffsets: [],
        valueBands: { p10: [], p25: [], p50: [], p75: [], p90: [] },
        returnBands: { p10: [], p25: [], p50: [], p75: [], p90: [] },
      },
      stats: {
        windowCount: 0,
        medianReturn: 0,
        medianCAGR: 0,
        successRate: 0,
        bestWindow: null,
        worstWindow: null,
        returnDistribution: { negative: 0, low: 0, medium: 0, high: 0 },
      },
      windows: [],
      dataRange: { firstDate, lastDate, yearsOfData },
    }
  }

  // Run simulation for each window
  const windows: WindowResult[] = []

  for (const startDate of startDates) {
    const endDate = getWindowEndDate(startDate, horizonYears)
    const result = runWindowSimulation(
      priceHistory,
      dividendHistory,
      config,
      startDate,
      endDate
    )

    if (result) {
      windows.push(result)
    }
  }

  // Compute percentile bands
  const { valueBands, returnBands } = computePercentileBands(windows, horizonMonths)

  // Generate month offsets array [0, 1, 2, ..., horizonMonths]
  const monthOffsets = Array.from({ length: horizonMonths + 1 }, (_, i) => i)

  // Compute statistics
  const stats = computeStats(windows)

  return {
    config,
    normalizedBands: {
      monthOffsets,
      valueBands,
      returnBands,
    },
    stats,
    windows,
    dataRange: { firstDate, lastDate, yearsOfData },
  }
}
