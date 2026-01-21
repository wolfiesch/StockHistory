import { describe, it, expect } from 'vitest'
import { runDCASimulation, formatCurrency, formatPercent, formatShares } from '../dcaEngine'
import type { PricePoint, DividendHistory } from '../../api/types'

// Helper to generate price data for every calendar day (simulates all trading days)
function generatePriceData(
  startDate: string,
  months: number,
  pricePerShare: number
): PricePoint[] {
  const points: PricePoint[] = []
  const start = new Date(startDate)
  const daysToGenerate = months * 31 // Generate extra days to cover full months

  for (let i = 0; i < daysToGenerate; i++) {
    const date = new Date(start)
    date.setDate(date.getDate() + i)

    points.push({
      date: date.toISOString().split('T')[0],
      open: pricePerShare,
      high: pricePerShare,
      low: pricePerShare,
      close: pricePerShare,
      volume: 1000000,
    })
  }
  return points
}

describe('runDCASimulation', () => {
  describe('basic investment calculation', () => {
    it('calculates correct shares for constant price', () => {
      // $100/month for ~12 months at $10/share
      // Note: depending on calendar, may get 12 or 13 investments
      const prices = generatePriceData('2023-01-01', 12, 10)
      const config = {
        amount: 100,
        frequency: 'monthly' as const,
        startDate: '2023-01-01',
        isDRIP: true,
      }

      const result = runDCASimulation(prices, [], config)

      // Should be 12 or 13 investments depending on calendar
      expect(result.totalInvested).toBeGreaterThanOrEqual(1200)
      expect(result.totalInvested).toBeLessThanOrEqual(1300)
      // Shares = invested / price
      expect(result.finalShares).toBe(result.totalInvested / 10)
      // At constant price, final value equals total invested
      expect(result.finalValue).toBeCloseTo(result.totalInvested, 0)
      expect(result.totalReturn).toBeCloseTo(0, 1) // 0% return
    })

    it('accumulates shares weekly at constant price', () => {
      // $50/week for ~5 weeks at $25/share = 2 shares/week
      const prices = generatePriceData('2023-01-01', 2, 25) // 2 months to ensure enough data
      const config = {
        amount: 50,
        frequency: 'weekly' as const,
        startDate: '2023-01-01',
        isDRIP: true,
      }

      const result = runDCASimulation(prices, [], config)

      // 2 months = ~8-9 weeks, 2 shares each = 16+ shares
      expect(result.finalShares).toBeGreaterThanOrEqual(16)
      expect(result.totalInvested).toBeGreaterThanOrEqual(400)
    })

    it('handles biweekly frequency', () => {
      const prices = generatePriceData('2023-01-01', 2, 50)
      const config = {
        amount: 200,
        frequency: 'biweekly' as const,
        startDate: '2023-01-01',
        isDRIP: true,
      }

      const result = runDCASimulation(prices, [], config)

      // ~2 investments per month for 2 months = ~4 investments
      expect(result.finalShares).toBeGreaterThanOrEqual(12) // 4 * (200/50) = 16
    })
  })

  describe('dividend handling with DRIP enabled', () => {
    it('reinvests dividends into additional shares', () => {
      const prices = generatePriceData('2023-01-01', 3, 10)
      const dividends: DividendHistory[] = [
        {
          exDate: '2023-02-01',
          paymentDate: '2023-02-15',
          amount: 0.5, // $0.50 per share
          yield: 5,
        },
      ]
      const config = {
        amount: 100,
        frequency: 'monthly' as const,
        startDate: '2023-01-01',
        isDRIP: true,
      }

      const result = runDCASimulation(prices, dividends, config)

      // After first month: 10 shares
      // Dividend: 10 * $0.50 = $5 → 0.5 more shares at $10
      // Total before second investment: 10.5 shares
      expect(result.finalShares).toBeGreaterThan(30) // More than 3 * 10 due to DRIP
      expect(result.totalDividends).toBe(0) // Dividends reinvested, not accumulated
    })
  })

  describe('dividend handling with DRIP disabled', () => {
    it('accumulates cash dividends without buying shares', () => {
      const prices = generatePriceData('2023-01-01', 3, 10)
      const dividends: DividendHistory[] = [
        {
          exDate: '2023-02-01',
          paymentDate: '2023-02-15',
          amount: 0.5,
          yield: 5,
        },
      ]
      const config = {
        amount: 100,
        frequency: 'monthly' as const,
        startDate: '2023-01-01',
        isDRIP: false,
      }

      const result = runDCASimulation(prices, dividends, config)

      // Without DRIP: 3 months * 10 shares = 30 shares exactly
      expect(result.finalShares).toBeCloseTo(30, 0)
      // Dividends accumulated: 10 shares * $0.50 = $5
      expect(result.totalDividends).toBeGreaterThan(0)
      // Total value includes cash dividends
      expect(result.finalValue).toBeGreaterThan(result.totalInvested)
    })
  })

  describe('edge cases', () => {
    it('returns empty result for empty price data', () => {
      const config = {
        amount: 100,
        frequency: 'monthly' as const,
        startDate: '2023-01-01',
        isDRIP: true,
      }

      const result = runDCASimulation([], [], config)

      expect(result.points).toHaveLength(0)
      expect(result.finalShares).toBe(0)
      expect(result.totalInvested).toBe(0)
      expect(result.totalDividends).toBe(0)
      expect(result.finalValue).toBe(0)
      expect(result.totalReturn).toBe(0)
      expect(result.cagr).toBe(0)
    })

    it('adjusts start date when before available data', () => {
      // Price data starts 2023-06-01 but config says 2023-01-01
      const prices = generatePriceData('2023-06-01', 3, 10)
      const config = {
        amount: 100,
        frequency: 'monthly' as const,
        startDate: '2023-01-01', // Before data exists
        isDRIP: true,
      }

      const result = runDCASimulation(prices, [], config)

      // Should still work, starting from first available date
      expect(result.totalInvested).toBeGreaterThan(0)
      expect(result.finalShares).toBeGreaterThan(0)
      // First point should be at or after June 2023
      expect(result.points[0].date >= '2023-06-01').toBe(true)
    })

    it('handles dividends with zero shares (no dividend received)', () => {
      const prices = generatePriceData('2023-01-01', 1, 10)
      const dividends: DividendHistory[] = [
        {
          exDate: '2023-01-02', // Before first investment
          paymentDate: '2023-01-15',
          amount: 1.0,
          yield: 10,
        },
      ]
      const config = {
        amount: 100,
        frequency: 'monthly' as const,
        startDate: '2023-01-03', // After dividend ex-date
        isDRIP: true,
      }

      const result = runDCASimulation(prices, dividends, config)

      // Should not receive any dividends since we had 0 shares on ex-date
      expect(result.totalDividends).toBe(0)
    })

    it('handles multiple dividends on same day', () => {
      const prices = generatePriceData('2023-01-01', 3, 10)
      const dividends: DividendHistory[] = [
        {
          exDate: '2023-02-15', // After first monthly investment
          paymentDate: '2023-02-28',
          amount: 0.25,
          yield: 2.5,
        },
        {
          exDate: '2023-02-15', // Same day
          paymentDate: '2023-02-28',
          amount: 0.25,
          yield: 2.5,
        },
      ]
      const config = {
        amount: 100,
        frequency: 'monthly' as const,
        startDate: '2023-01-01',
        isDRIP: false,
      }

      const result = runDCASimulation(prices, dividends, config)

      // After Jan investment: 10 shares
      // After Feb 1 investment: 20 shares
      // Feb 15 dividend: 20 shares * $0.50 total = $10
      expect(result.totalDividends).toBeGreaterThan(0)
    })
  })

  describe('return calculations', () => {
    it('calculates positive returns when price increases', () => {
      // Start at $10, end at $20
      const prices: PricePoint[] = []
      const start = new Date('2023-01-01')
      for (let i = 0; i < 250; i++) {
        const date = new Date(start)
        date.setDate(date.getDate() + i)
        if (date.getDay() === 0 || date.getDay() === 6) continue
        // Price goes from $10 to $20 over the period
        const price = 10 + (i / 250) * 10
        prices.push({
          date: date.toISOString().split('T')[0],
          open: price,
          high: price,
          low: price,
          close: price,
          volume: 1000000,
        })
      }

      const config = {
        amount: 100,
        frequency: 'monthly' as const,
        startDate: '2023-01-01',
        isDRIP: true,
      }

      const result = runDCASimulation(prices, [], config)

      expect(result.totalReturn).toBeGreaterThan(0)
      expect(result.finalValue).toBeGreaterThan(result.totalInvested)
    })

    it('calculates negative returns when price decreases', () => {
      // Start at $20, end at $10
      const prices: PricePoint[] = []
      const start = new Date('2023-01-01')
      for (let i = 0; i < 250; i++) {
        const date = new Date(start)
        date.setDate(date.getDate() + i)
        if (date.getDay() === 0 || date.getDay() === 6) continue
        // Price goes from $20 to $10 over the period
        const price = 20 - (i / 250) * 10
        prices.push({
          date: date.toISOString().split('T')[0],
          open: price,
          high: price,
          low: price,
          close: price,
          volume: 1000000,
        })
      }

      const config = {
        amount: 100,
        frequency: 'monthly' as const,
        startDate: '2023-01-01',
        isDRIP: true,
      }

      const result = runDCASimulation(prices, [], config)

      expect(result.totalReturn).toBeLessThan(0)
      expect(result.finalValue).toBeLessThan(result.totalInvested)
    })
  })
})

describe('formatters', () => {
  describe('formatCurrency', () => {
    it('formats positive values', () => {
      expect(formatCurrency(1234)).toBe('$1,234')
    })

    it('formats large values with commas', () => {
      expect(formatCurrency(1234567)).toBe('$1,234,567')
    })

    it('rounds to whole dollars', () => {
      expect(formatCurrency(1234.56)).toBe('$1,235')
    })
  })

  describe('formatPercent', () => {
    it('formats positive percentage with plus sign', () => {
      expect(formatPercent(12.345)).toBe('+12.35%')
    })

    it('formats negative percentage', () => {
      expect(formatPercent(-5.5)).toBe('-5.50%')
    })

    it('formats zero', () => {
      expect(formatPercent(0)).toBe('+0.00%')
    })
  })

  describe('formatShares', () => {
    it('formats to 4 decimal places', () => {
      expect(formatShares(10.123456)).toBe('10.1235')
    })

    it('pads with zeros', () => {
      expect(formatShares(5)).toBe('5.0000')
    })
  })
})
