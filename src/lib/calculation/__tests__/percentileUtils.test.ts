import { describe, it, expect } from 'vitest'
import {
  calculatePercentile,
  calculatePercentiles,
  calculatePercentileBands,
  calculateMedian,
  calculateStats,
  categorizeReturns,
} from '../percentileUtils'

describe('calculatePercentile', () => {
  it('returns 0 for empty array', () => {
    expect(calculatePercentile([], 50)).toBe(0)
  })

  it('returns the only value for single element array', () => {
    expect(calculatePercentile([42], 50)).toBe(42)
    expect(calculatePercentile([42], 0)).toBe(42)
    expect(calculatePercentile([42], 100)).toBe(42)
  })

  it('calculates p0 as minimum value', () => {
    expect(calculatePercentile([1, 2, 3, 4, 5], 0)).toBe(1)
  })

  it('calculates p100 as maximum value', () => {
    expect(calculatePercentile([1, 2, 3, 4, 5], 100)).toBe(5)
  })

  it('calculates p50 (median) correctly for odd-length array', () => {
    expect(calculatePercentile([1, 2, 3, 4, 5], 50)).toBe(3)
  })

  it('calculates p50 (median) with interpolation for even-length array', () => {
    expect(calculatePercentile([1, 2, 3, 4], 50)).toBe(2.5)
  })

  it('uses linear interpolation for intermediate values', () => {
    // For [10, 20, 30, 40], p25 should interpolate between 10 and 20
    const result = calculatePercentile([10, 20, 30, 40], 25)
    expect(result).toBeCloseTo(17.5, 5)
  })

  it('clamps percentile to valid range', () => {
    const arr = [1, 2, 3, 4, 5]
    expect(calculatePercentile(arr, -10)).toBe(calculatePercentile(arr, 0))
    expect(calculatePercentile(arr, 110)).toBe(calculatePercentile(arr, 100))
  })

  it('handles array with duplicate values', () => {
    expect(calculatePercentile([5, 5, 5, 5, 5], 50)).toBe(5)
    expect(calculatePercentile([1, 1, 1, 5, 5, 5], 50)).toBeCloseTo(3, 5)
  })

  it('handles negative values', () => {
    expect(calculatePercentile([-10, -5, 0, 5, 10], 50)).toBe(0)
    expect(calculatePercentile([-10, -5, 0, 5, 10], 25)).toBe(-5)
  })
})

describe('calculatePercentiles', () => {
  it('returns zeros for empty array', () => {
    const result = calculatePercentiles([], [10, 50, 90])
    expect(result[10]).toBe(0)
    expect(result[50]).toBe(0)
    expect(result[90]).toBe(0)
  })

  it('calculates multiple percentiles correctly', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const result = calculatePercentiles(values, [10, 25, 50, 75, 90])

    expect(result[10]).toBeCloseTo(1.9, 1)
    expect(result[50]).toBeCloseTo(5.5, 1)
    expect(result[90]).toBeCloseTo(9.1, 1)
  })

  it('does not mutate input array', () => {
    const original = [5, 3, 1, 4, 2]
    const copy = [...original]
    calculatePercentiles(original, [50])
    expect(original).toEqual(copy)
  })

  it('handles unsorted input correctly', () => {
    // Should sort internally
    const unsorted = [5, 1, 3, 2, 4]
    const sorted = [1, 2, 3, 4, 5]
    const resultUnsorted = calculatePercentiles(unsorted, [50])
    const resultSorted = calculatePercentiles(sorted, [50])
    expect(resultUnsorted[50]).toBe(resultSorted[50])
  })
})

describe('calculatePercentileBands', () => {
  it('returns empty bands for empty input', () => {
    const result = calculatePercentileBands([])
    expect(result.p10).toEqual([])
    expect(result.p50).toEqual([])
    expect(result.p90).toEqual([])
  })

  it('calculates bands across time series', () => {
    // 3 time points, each with values from multiple windows
    const valueArrays = [
      [100, 105, 110, 95, 102], // Month 0 values from 5 windows
      [200, 210, 220, 190, 205], // Month 1 values
      [300, 315, 330, 285, 307], // Month 2 values
    ]

    const result = calculatePercentileBands(valueArrays)

    expect(result.p10).toHaveLength(3)
    expect(result.p25).toHaveLength(3)
    expect(result.p50).toHaveLength(3)
    expect(result.p75).toHaveLength(3)
    expect(result.p90).toHaveLength(3)
  })

  it('maintains p10 <= p25 <= p50 <= p75 <= p90 invariant', () => {
    const valueArrays = [
      [50, 100, 150, 200, 250],
      [60, 120, 180, 240, 300],
    ]

    const result = calculatePercentileBands(valueArrays)

    for (let i = 0; i < valueArrays.length; i++) {
      expect(result.p10[i]).toBeLessThanOrEqual(result.p25[i])
      expect(result.p25[i]).toBeLessThanOrEqual(result.p50[i])
      expect(result.p50[i]).toBeLessThanOrEqual(result.p75[i])
      expect(result.p75[i]).toBeLessThanOrEqual(result.p90[i])
    }
  })

  it('handles single value at each time point', () => {
    const valueArrays = [[100], [200], [300]]
    const result = calculatePercentileBands(valueArrays)

    // All percentiles should equal the single value at each point
    expect(result.p10).toEqual([100, 200, 300])
    expect(result.p50).toEqual([100, 200, 300])
    expect(result.p90).toEqual([100, 200, 300])
  })
})

describe('calculateMedian', () => {
  it('returns 0 for empty array', () => {
    expect(calculateMedian([])).toBe(0)
  })

  it('returns value for single element', () => {
    expect(calculateMedian([42])).toBe(42)
  })

  it('calculates median for odd-length array', () => {
    expect(calculateMedian([1, 3, 5, 7, 9])).toBe(5)
  })

  it('calculates median for even-length array with interpolation', () => {
    expect(calculateMedian([1, 2, 3, 4])).toBe(2.5)
  })

  it('handles unsorted input', () => {
    expect(calculateMedian([9, 1, 5, 3, 7])).toBe(5)
  })

  it('handles negative values', () => {
    expect(calculateMedian([-5, -3, 0, 3, 5])).toBe(0)
  })
})

describe('calculateStats', () => {
  it('returns zeros for empty array', () => {
    const result = calculateStats([])
    expect(result).toEqual({
      min: 0,
      max: 0,
      mean: 0,
      median: 0,
      stdDev: 0,
    })
  })

  it('calculates min and max correctly', () => {
    const result = calculateStats([3, 1, 4, 1, 5, 9, 2, 6])
    expect(result.min).toBe(1)
    expect(result.max).toBe(9)
  })

  it('calculates mean correctly', () => {
    const result = calculateStats([2, 4, 6, 8, 10])
    expect(result.mean).toBe(6)
  })

  it('calculates median correctly', () => {
    const result = calculateStats([2, 4, 6, 8, 10])
    expect(result.median).toBe(6)
  })

  it('calculates standard deviation correctly', () => {
    // [1, 2, 3, 4, 5] has mean 3, stddev = sqrt(2) ≈ 1.414
    const result = calculateStats([1, 2, 3, 4, 5])
    expect(result.stdDev).toBeCloseTo(1.414, 2)
  })

  it('returns 0 stdDev for single value', () => {
    const result = calculateStats([5])
    expect(result.stdDev).toBe(0)
  })

  it('returns 0 stdDev for identical values', () => {
    const result = calculateStats([5, 5, 5, 5, 5])
    expect(result.stdDev).toBe(0)
  })
})

describe('categorizeReturns', () => {
  it('returns zeros for empty array', () => {
    const result = categorizeReturns([])
    expect(result).toEqual({ negative: 0, low: 0, medium: 0, high: 0 })
  })

  it('categorizes negative returns correctly', () => {
    const result = categorizeReturns([-10, -5, -1])
    expect(result.negative).toBe(100)
    expect(result.low).toBe(0)
    expect(result.medium).toBe(0)
    expect(result.high).toBe(0)
  })

  it('categorizes low returns (0-50%) correctly', () => {
    const result = categorizeReturns([0, 10, 25, 49])
    expect(result.negative).toBe(0)
    expect(result.low).toBe(100)
    expect(result.medium).toBe(0)
    expect(result.high).toBe(0)
  })

  it('categorizes medium returns (50-100%) correctly', () => {
    const result = categorizeReturns([50, 75, 99])
    expect(result.negative).toBe(0)
    expect(result.low).toBe(0)
    expect(result.medium).toBe(100)
    expect(result.high).toBe(0)
  })

  it('categorizes high returns (>100%) correctly', () => {
    const result = categorizeReturns([100, 150, 200])
    expect(result.negative).toBe(0)
    expect(result.low).toBe(0)
    expect(result.medium).toBe(0)
    expect(result.high).toBe(100)
  })

  it('distributes returns across categories', () => {
    // 1 negative, 1 low, 1 medium, 1 high = 25% each
    const result = categorizeReturns([-10, 25, 75, 150])
    expect(result.negative).toBe(25)
    expect(result.low).toBe(25)
    expect(result.medium).toBe(25)
    expect(result.high).toBe(25)
  })

  it('handles boundary values correctly', () => {
    // 0 is low, 50 is medium, 100 is high
    const result = categorizeReturns([0, 50, 100])
    expect(result.low).toBeCloseTo(33.33, 1)
    expect(result.medium).toBeCloseTo(33.33, 1)
    expect(result.high).toBeCloseTo(33.33, 1)
  })

  it('percentages sum to 100', () => {
    const result = categorizeReturns([-50, -10, 5, 30, 60, 80, 120, 200])
    const sum = result.negative + result.low + result.medium + result.high
    expect(sum).toBeCloseTo(100)
  })
})
