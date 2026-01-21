/**
 * DCA Simulation Engine
 *
 * Core pure-function logic for Dollar Cost Averaging simulation.
 * No side effects - takes input data and configuration, returns simulation results.
 */

import type {
  PricePoint,
  DividendHistory,
  DCAConfig,
  SimulationPoint,
  SimulationResult,
  InvestmentFrequency,
} from '../api/types'

/**
 * Get investment dates based on frequency
 */
function getInvestmentDates(
  startDate: string,
  endDate: string,
  frequency: InvestmentFrequency
): Set<string> {
  const dates = new Set<string>()
  const start = new Date(startDate)
  const end = new Date(endDate)

  const current = new Date(start)

  while (current <= end) {
    dates.add(current.toISOString().split('T')[0])

    switch (frequency) {
      case 'weekly':
        current.setDate(current.getDate() + 7)
        break
      case 'biweekly':
        current.setDate(current.getDate() + 14)
        break
      case 'monthly':
        current.setMonth(current.getMonth() + 1)
        break
    }
  }

  return dates
}

/**
 * Find the nearest trading day for a given date
 */
function findNearestTradingDay(
  targetDate: string,
  priceMap: Map<string, PricePoint>,
  maxDaysForward: number = 7
): string | null {
  const target = new Date(targetDate)

  for (let i = 0; i <= maxDaysForward; i++) {
    const checkDate = new Date(target)
    checkDate.setDate(checkDate.getDate() + i)
    const dateStr = checkDate.toISOString().split('T')[0]

    if (priceMap.has(dateStr)) {
      return dateStr
    }
  }

  return null
}

/**
 * Build a map of ex-dividend dates to dividend amounts
 */
function buildDividendMap(dividends: DividendHistory[]): Map<string, number> {
  const map = new Map<string, number>()

  for (const div of dividends) {
    if (div.exDate && div.amount > 0) {
      // Accumulate if multiple dividends on same day (unlikely but possible)
      const existing = map.get(div.exDate) || 0
      map.set(div.exDate, existing + div.amount)
    }
  }

  return map
}

/**
 * Calculate CAGR (Compound Annual Growth Rate)
 */
function calculateCAGR(
  initialValue: number,
  finalValue: number,
  years: number
): number {
  if (initialValue <= 0 || years <= 0) return 0
  return (Math.pow(finalValue / initialValue, 1 / years) - 1) * 100
}

/**
 * Main DCA simulation function
 */
export function runDCASimulation(
  priceHistory: PricePoint[],
  dividendHistory: DividendHistory[],
  config: Omit<DCAConfig, 'ticker'>
): SimulationResult {
  const { amount, frequency, startDate, isDRIP } = config

  if (priceHistory.length === 0) {
    return {
      points: [],
      finalShares: 0,
      totalInvested: 0,
      totalDividends: 0,
      finalValue: 0,
      totalReturn: 0,
      cagr: 0,
    }
  }

  // Build lookup maps
  const priceMap = new Map<string, PricePoint>()
  for (const point of priceHistory) {
    priceMap.set(point.date, point)
  }

  const dividendMap = buildDividendMap(dividendHistory)

  // Get first and last available dates
  const firstDate = priceHistory[0].date
  const lastDate = priceHistory[priceHistory.length - 1].date

  // Adjust start date if before available data
  const effectiveStart = startDate < firstDate ? firstDate : startDate

  // Get scheduled investment dates
  const investmentDates = getInvestmentDates(effectiveStart, lastDate, frequency)

  // Simulation state
  let totalShares = 0
  let totalInvested = 0
  let cumulativeDividends = 0

  const points: SimulationPoint[] = []

  // Track which investment dates we've processed
  const processedInvestments = new Set<string>()

  // Iterate through each trading day
  for (const pricePoint of priceHistory) {
    const { date, close: price } = pricePoint

    if (date < effectiveStart) continue

    // Check for dividend on this day (based on ex-date)
    const dividendAmount = dividendMap.get(date)
    if (dividendAmount && totalShares > 0) {
      const dividendReceived = dividendAmount * totalShares

      if (isDRIP) {
        // Reinvest dividends - buy more shares
        const newShares = dividendReceived / price
        totalShares += newShares
      } else {
        // Accumulate cash dividends
        cumulativeDividends += dividendReceived
      }
    }

    // Check if this is an investment date
    // Find the closest scheduled date that maps to this trading day
    for (const scheduledDate of investmentDates) {
      if (processedInvestments.has(scheduledDate)) continue

      const tradingDate = findNearestTradingDay(scheduledDate, priceMap)
      if (tradingDate === date) {
        // Make investment
        const sharesBought = amount / price
        totalShares += sharesBought
        totalInvested += amount
        processedInvestments.add(scheduledDate)
      }
    }

    // Calculate current market value
    const marketValue = totalShares * price

    // Record simulation point
    points.push({
      date,
      principal: totalInvested,
      dividends: cumulativeDividends,
      marketValue,
      shares: totalShares,
      totalValue: marketValue + cumulativeDividends,
    })
  }

  // Calculate final metrics
  const finalValue = points.length > 0
    ? points[points.length - 1].totalValue
    : 0

  const totalReturn = totalInvested > 0
    ? ((finalValue - totalInvested) / totalInvested) * 100
    : 0

  // Calculate years for CAGR
  const startMs = new Date(effectiveStart).getTime()
  const endMs = new Date(lastDate).getTime()
  const years = (endMs - startMs) / (1000 * 60 * 60 * 24 * 365.25)

  const cagr = calculateCAGR(totalInvested, finalValue, years)

  return {
    points,
    finalShares: totalShares,
    totalInvested,
    totalDividends: cumulativeDividends,
    finalValue,
    totalReturn,
    cagr,
  }
}

/**
 * Calculate metrics for display
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

export function formatShares(shares: number): string {
  return shares.toFixed(4)
}
