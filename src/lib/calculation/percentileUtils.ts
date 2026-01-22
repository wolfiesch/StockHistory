/**
 * Percentile Calculation Utilities
 *
 * Statistical helper functions for computing percentiles from arrays of values.
 * Uses linear interpolation for percentile estimation (same method as NumPy's default).
 */

import type { PercentileBands } from '../api/types'

/**
 * Calculate a single percentile from a sorted array of numbers.
 * Uses linear interpolation between adjacent values.
 *
 * @param sortedValues - Pre-sorted array of numbers (ascending)
 * @param percentile - Percentile to calculate (0-100)
 * @returns The value at the given percentile
 */
export function calculatePercentile(
  sortedValues: number[],
  percentile: number
): number {
  if (sortedValues.length === 0) return 0
  if (sortedValues.length === 1) return sortedValues[0]

  // Clamp percentile to valid range
  const p = Math.max(0, Math.min(100, percentile))

  // Calculate the index
  const n = sortedValues.length
  const rank = (p / 100) * (n - 1)
  const lowerIndex = Math.floor(rank)
  const upperIndex = Math.ceil(rank)
  const fraction = rank - lowerIndex

  // Linear interpolation
  if (lowerIndex === upperIndex) {
    return sortedValues[lowerIndex]
  }

  return (
    sortedValues[lowerIndex] * (1 - fraction) +
    sortedValues[upperIndex] * fraction
  )
}

/**
 * Calculate multiple percentiles from an array of numbers.
 * Sorts the array once, then calculates all requested percentiles.
 *
 * @param values - Array of numbers (does not need to be sorted)
 * @param percentiles - Array of percentiles to calculate (0-100)
 * @returns Object mapping each percentile to its value
 */
export function calculatePercentiles(
  values: number[],
  percentiles: number[]
): Record<number, number> {
  if (values.length === 0) {
    return Object.fromEntries(percentiles.map((p) => [p, 0]))
  }

  // Sort once for all percentile calculations
  const sorted = [...values].sort((a, b) => a - b)

  return Object.fromEntries(
    percentiles.map((p) => [p, calculatePercentile(sorted, p)])
  )
}

/**
 * Calculate percentile bands for an array of value arrays.
 * Each inner array represents values at a specific time point (month offset).
 *
 * @param valueArrays - Array where each element contains all values at that time offset
 * @returns PercentileBands with p10, p25, p50, p75, p90 arrays
 */
export function calculatePercentileBands(
  valueArrays: number[][]
): PercentileBands {
  const p10: number[] = []
  const p25: number[] = []
  const p50: number[] = []
  const p75: number[] = []
  const p90: number[] = []

  for (const values of valueArrays) {
    const percentiles = calculatePercentiles(values, [10, 25, 50, 75, 90])
    p10.push(percentiles[10])
    p25.push(percentiles[25])
    p50.push(percentiles[50])
    p75.push(percentiles[75])
    p90.push(percentiles[90])
  }

  return { p10, p25, p50, p75, p90 }
}

/**
 * Calculate the median (50th percentile) of an array.
 *
 * @param values - Array of numbers
 * @returns The median value
 */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return calculatePercentile(sorted, 50)
}

/**
 * Calculate basic statistics for an array of numbers.
 *
 * @param values - Array of numbers
 * @returns Object with min, max, mean, median, stdDev
 */
export function calculateStats(values: number[]): {
  min: number
  max: number
  mean: number
  median: number
  stdDev: number
} {
  if (values.length === 0) {
    return { min: 0, max: 0, mean: 0, median: 0, stdDev: 0 }
  }

  const sorted = [...values].sort((a, b) => a - b)
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  const sum = values.reduce((acc, v) => acc + v, 0)
  const mean = sum / values.length
  const median = calculatePercentile(sorted, 50)

  // Calculate standard deviation
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2))
  const avgSquaredDiff =
    squaredDiffs.reduce((acc, v) => acc + v, 0) / values.length
  const stdDev = Math.sqrt(avgSquaredDiff)

  return { min, max, mean, median, stdDev }
}

/**
 * Categorize return values into distribution buckets.
 *
 * @param returns - Array of return percentages
 * @returns Object with percentage of returns in each category
 */
export function categorizeReturns(returns: number[]): {
  negative: number // < 0%
  low: number // 0-50%
  medium: number // 50-100%
  high: number // > 100%
} {
  if (returns.length === 0) {
    return { negative: 0, low: 0, medium: 0, high: 0 }
  }

  let negative = 0
  let low = 0
  let medium = 0
  let high = 0

  for (const r of returns) {
    if (r < 0) negative++
    else if (r < 50) low++
    else if (r < 100) medium++
    else high++
  }

  const total = returns.length
  return {
    negative: (negative / total) * 100,
    low: (low / total) * 100,
    medium: (medium / total) * 100,
    high: (high / total) * 100,
  }
}
