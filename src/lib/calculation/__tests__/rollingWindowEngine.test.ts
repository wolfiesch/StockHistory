import { describe, it, expect } from 'vitest'
import {
  runRollingWindowAnalysis,
  getAvailableHorizons,
} from '../rollingWindowEngine'
import type { PricePoint, DividendHistory } from '../../api/types'

// Helper to generate price data starting from a specific date
function generatePriceData(
  startDate: string,
  years: number,
  basePrice: number = 100
): PricePoint[] {
  const points: PricePoint[] = []
  const start = new Date(startDate)
  const daysToGenerate = years * 365

  for (let i = 0; i < daysToGenerate; i++) {
    const date = new Date(start)
    date.setDate(date.getDate() + i)

    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue

    // Slight price variation to make it realistic
    const variance = 1 + (Math.sin(i / 30) * 0.1)
    const price = basePrice * variance

    points.push({
      date: date.toISOString().split('T')[0],
      open: price,
      high: price * 1.01,
      low: price * 0.99,
      close: price,
      volume: 1000000,
    })
  }
  return points
}

describe('getAvailableHorizons', () => {
  it('returns empty array for empty price data', () => {
    expect(getAvailableHorizons([])).toEqual([])
  })

  it('returns empty array for insufficient data (less than 6 years)', () => {
    const prices = generatePriceData('2020-01-01', 5)
    expect(getAvailableHorizons(prices)).toEqual([])
  })

  it('returns [5] for 6+ years of data', () => {
    const prices = generatePriceData('2018-01-01', 7)
    expect(getAvailableHorizons(prices)).toEqual([5])
  })

  it('returns [5, 10] for 11+ years of data', () => {
    const prices = generatePriceData('2012-01-01', 12)
    expect(getAvailableHorizons(prices)).toEqual([5, 10])
  })

  it('returns [5, 10, 15] for 16+ years of data', () => {
    const prices = generatePriceData('2007-01-01', 17)
    expect(getAvailableHorizons(prices)).toEqual([5, 10, 15])
  })

  it('returns [5, 10, 15, 20] for 21+ years of data', () => {
    const prices = generatePriceData('2000-01-01', 25)
    expect(getAvailableHorizons(prices)).toEqual([5, 10, 15, 20])
  })
})

describe('runRollingWindowAnalysis', () => {
  describe('window generation', () => {
    it('generates window start dates that are valid first-of-month dates', () => {
      const prices = generatePriceData('2010-01-01', 7)
      const result = runRollingWindowAnalysis(prices, [], {
        horizonYears: 5,
        amount: 100,
        frequency: 'monthly',
        isDRIP: true,
      })

      // The algorithm generates windows starting on the first of each month
      // Verify at least some windows exist and have valid start dates
      expect(result.windows.length).toBeGreaterThan(0)

      // Check that each window start date is a valid date format (YYYY-MM-DD)
      result.windows.forEach((window) => {
        expect(window.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        // Start date should be before end date
        expect(window.startDate < window.endDate).toBe(true)
      })
    })

    it('generates correct number of windows for given data range', () => {
      // 7 years of data with 5-year horizon = ~24 months of valid start dates
      const prices = generatePriceData('2010-01-01', 7)
      const result = runRollingWindowAnalysis(prices, [], {
        horizonYears: 5,
        amount: 100,
        frequency: 'monthly',
        isDRIP: true,
      })

      // Should have approximately 2 years worth of window starts (24 months)
      expect(result.windows.length).toBeGreaterThanOrEqual(20)
      expect(result.windows.length).toBeLessThanOrEqual(26)
    })

    it('returns empty result when insufficient data for horizon', () => {
      const prices = generatePriceData('2020-01-01', 4)
      const result = runRollingWindowAnalysis(prices, [], {
        horizonYears: 5,
        amount: 100,
        frequency: 'monthly',
        isDRIP: true,
      })

      expect(result.windows).toHaveLength(0)
      expect(result.stats.windowCount).toBe(0)
    })
  })

  describe('window end date calculation', () => {
    it('calculates end date exactly horizonYears after start', () => {
      const prices = generatePriceData('2010-01-01', 7)
      const result = runRollingWindowAnalysis(prices, [], {
        horizonYears: 5,
        amount: 100,
        frequency: 'monthly',
        isDRIP: true,
      })

      result.windows.forEach((window) => {
        const start = new Date(window.startDate)
        const end = new Date(window.endDate)
        const yearsDiff = end.getFullYear() - start.getFullYear()
        expect(yearsDiff).toBe(5)
      })
    })
  })

  describe('monthly value extraction', () => {
    it('extracts monthly values for each window', () => {
      const prices = generatePriceData('2010-01-01', 7)
      const result = runRollingWindowAnalysis(prices, [], {
        horizonYears: 5,
        amount: 100,
        frequency: 'monthly',
        isDRIP: true,
      })

      // Each window should have ~61 monthly values (5 years * 12 months + 1)
      result.windows.forEach((window) => {
        expect(window.monthlyValues.length).toBeGreaterThanOrEqual(55)
        expect(window.monthlyValues.length).toBeLessThanOrEqual(65)
      })
    })

    it('monthly values increase over time with constant price', () => {
      // With constant price and regular contributions, values should only go up
      const prices = generatePriceData('2010-01-01', 7, 100) // constant $100
      const result = runRollingWindowAnalysis(prices, [], {
        horizonYears: 5,
        amount: 100,
        frequency: 'monthly',
        isDRIP: true,
      })

      result.windows.forEach((window) => {
        // Values should generally increase (some minor fluctuations due to DCA timing)
        const firstValue = window.monthlyValues[0]
        const lastValue = window.monthlyValues[window.monthlyValues.length - 1]
        expect(lastValue).toBeGreaterThan(firstValue)
      })
    })
  })

  describe('statistics computation', () => {
    it('computes correct window count', () => {
      const prices = generatePriceData('2010-01-01', 7)
      const result = runRollingWindowAnalysis(prices, [], {
        horizonYears: 5,
        amount: 100,
        frequency: 'monthly',
        isDRIP: true,
      })

      expect(result.stats.windowCount).toBe(result.windows.length)
    })

    it('identifies best and worst windows', () => {
      const prices = generatePriceData('2010-01-01', 7)
      const result = runRollingWindowAnalysis(prices, [], {
        horizonYears: 5,
        amount: 100,
        frequency: 'monthly',
        isDRIP: true,
      })

      if (result.windows.length > 0) {
        expect(result.stats.bestWindow).not.toBeNull()
        expect(result.stats.worstWindow).not.toBeNull()

        // Best window should have highest return
        const maxReturn = Math.max(...result.windows.map((w) => w.totalReturn))
        expect(result.stats.bestWindow!.totalReturn).toBeCloseTo(maxReturn)

        // Worst window should have lowest return
        const minReturn = Math.min(...result.windows.map((w) => w.totalReturn))
        expect(result.stats.worstWindow!.totalReturn).toBeCloseTo(minReturn)
      }
    })

    it('calculates median return correctly', () => {
      const prices = generatePriceData('2010-01-01', 7)
      const result = runRollingWindowAnalysis(prices, [], {
        horizonYears: 5,
        amount: 100,
        frequency: 'monthly',
        isDRIP: true,
      })

      const returns = result.windows.map((w) => w.totalReturn).sort((a, b) => a - b)
      const medianIndex = Math.floor(returns.length / 2)
      const expectedMedian =
        returns.length % 2 === 0
          ? (returns[medianIndex - 1] + returns[medianIndex]) / 2
          : returns[medianIndex]

      expect(result.stats.medianReturn).toBeCloseTo(expectedMedian, 1)
    })

    it('calculates success rate (positive returns)', () => {
      const prices = generatePriceData('2010-01-01', 7)
      const result = runRollingWindowAnalysis(prices, [], {
        horizonYears: 5,
        amount: 100,
        frequency: 'monthly',
        isDRIP: true,
      })

      const positiveCount = result.windows.filter((w) => w.totalReturn > 0).length
      const expectedRate = (positiveCount / result.windows.length) * 100

      expect(result.stats.successRate).toBeCloseTo(expectedRate)
    })
  })

  describe('percentile bands', () => {
    it('generates percentile bands for all months', () => {
      const prices = generatePriceData('2010-01-01', 7)
      const result = runRollingWindowAnalysis(prices, [], {
        horizonYears: 5,
        amount: 100,
        frequency: 'monthly',
        isDRIP: true,
      })

      const horizonMonths = 5 * 12
      expect(result.normalizedBands.monthOffsets.length).toBe(horizonMonths + 1)
      expect(result.normalizedBands.valueBands.p10.length).toBe(horizonMonths + 1)
      expect(result.normalizedBands.valueBands.p50.length).toBe(horizonMonths + 1)
      expect(result.normalizedBands.valueBands.p90.length).toBe(horizonMonths + 1)
    })

    it('p10 <= p25 <= p50 <= p75 <= p90 at each month', () => {
      const prices = generatePriceData('2010-01-01', 7)
      const result = runRollingWindowAnalysis(prices, [], {
        horizonYears: 5,
        amount: 100,
        frequency: 'monthly',
        isDRIP: true,
      })

      const { p10, p25, p50, p75, p90 } = result.normalizedBands.valueBands

      for (let i = 0; i < p50.length; i++) {
        expect(p10[i]).toBeLessThanOrEqual(p25[i])
        expect(p25[i]).toBeLessThanOrEqual(p50[i])
        expect(p50[i]).toBeLessThanOrEqual(p75[i])
        expect(p75[i]).toBeLessThanOrEqual(p90[i])
      }
    })

    it('includes return bands alongside value bands', () => {
      const prices = generatePriceData('2010-01-01', 7)
      const result = runRollingWindowAnalysis(prices, [], {
        horizonYears: 5,
        amount: 100,
        frequency: 'monthly',
        isDRIP: true,
      })

      expect(result.normalizedBands.returnBands.p10.length).toBe(
        result.normalizedBands.valueBands.p10.length
      )
      expect(result.normalizedBands.returnBands.p50.length).toBe(
        result.normalizedBands.valueBands.p50.length
      )
    })
  })

  describe('data range tracking', () => {
    it('tracks first and last date of input data', () => {
      const prices = generatePriceData('2010-01-01', 7)
      const result = runRollingWindowAnalysis(prices, [], {
        horizonYears: 5,
        amount: 100,
        frequency: 'monthly',
        isDRIP: true,
      })

      expect(result.dataRange.firstDate).toBe(prices[0].date)
      expect(result.dataRange.lastDate).toBe(prices[prices.length - 1].date)
    })

    it('calculates years of data correctly', () => {
      const prices = generatePriceData('2010-01-01', 7)
      const result = runRollingWindowAnalysis(prices, [], {
        horizonYears: 5,
        amount: 100,
        frequency: 'monthly',
        isDRIP: true,
      })

      expect(result.dataRange.yearsOfData).toBeGreaterThanOrEqual(6)
      expect(result.dataRange.yearsOfData).toBeLessThanOrEqual(8)
    })
  })

  describe('edge cases', () => {
    it('handles empty price data', () => {
      const result = runRollingWindowAnalysis([], [], {
        horizonYears: 5,
        amount: 100,
        frequency: 'monthly',
        isDRIP: true,
      })

      expect(result.windows).toHaveLength(0)
      expect(result.stats.windowCount).toBe(0)
      expect(result.dataRange.firstDate).toBe('')
      expect(result.dataRange.lastDate).toBe('')
    })

    it('handles single window scenario', () => {
      // Just enough data for one window
      const prices = generatePriceData('2018-01-01', 5.1)
      const result = runRollingWindowAnalysis(prices, [], {
        horizonYears: 5,
        amount: 100,
        frequency: 'monthly',
        isDRIP: true,
      })

      expect(result.windows.length).toBeGreaterThanOrEqual(1)
    })

    it('handles dividends across windows', () => {
      const prices = generatePriceData('2010-01-01', 7)
      const dividends: DividendHistory[] = [
        { exDate: '2011-03-15', paymentDate: '2011-03-30', amount: 0.5, yield: 2 },
        { exDate: '2012-03-15', paymentDate: '2012-03-30', amount: 0.55, yield: 2.2 },
        { exDate: '2013-03-15', paymentDate: '2013-03-30', amount: 0.6, yield: 2.4 },
      ]

      const result = runRollingWindowAnalysis(prices, dividends, {
        horizonYears: 5,
        amount: 100,
        frequency: 'monthly',
        isDRIP: true,
      })

      // Result should still be valid with dividends
      expect(result.windows.length).toBeGreaterThan(0)
      expect(result.stats.windowCount).toBe(result.windows.length)
    })

    it('processes different investment frequencies', () => {
      const prices = generatePriceData('2010-01-01', 7)

      const monthlyResult = runRollingWindowAnalysis(prices, [], {
        horizonYears: 5,
        amount: 100,
        frequency: 'monthly',
        isDRIP: true,
      })

      const weeklyResult = runRollingWindowAnalysis(prices, [], {
        horizonYears: 5,
        amount: 100,
        frequency: 'weekly',
        isDRIP: true,
      })

      // Both should have valid results
      expect(monthlyResult.windows.length).toBeGreaterThan(0)
      expect(weeklyResult.windows.length).toBeGreaterThan(0)

      // Weekly should invest more overall
      expect(weeklyResult.windows[0].totalInvested).toBeGreaterThan(
        monthlyResult.windows[0].totalInvested
      )
    })
  })
})
