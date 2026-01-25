import { describe, it, expect, beforeEach } from 'vitest'
import {
  useRollingAnalysisStore,
  selectStats,
  selectWindows,
  selectDataRange,
} from '@/store/rollingAnalysisStore'
import type {
  RollingWindowResult,
  WindowResult,
  RollingChartDataPoint,
} from '@/lib/api/types'

// Helper to create a mock rolling window result
function createMockRollingResult(
  windowCount: number = 5
): RollingWindowResult {
  const windows: WindowResult[] = []

  for (let i = 0; i < windowCount; i++) {
    const startYear = 2010 + i
    windows.push({
      startDate: `${startYear}-01-01`,
      endDate: `${startYear + 5}-01-01`,
      totalReturn: 30 + i * 10, // 30%, 40%, 50%, etc.
      cagr: 5 + i,
      finalValue: 7000 + i * 500,
      totalInvested: 6000,
      monthlyValues: Array(61).fill(0).map((_, j) => 100 + j * 10),
    })
  }

  return {
    config: {
      horizonYears: 5,
      amount: 100,
      frequency: 'monthly',
      isDRIP: true,
    },
    normalizedBands: {
      monthOffsets: Array(61).fill(0).map((_, i) => i),
      valueBands: {
        p10: Array(61).fill(6000),
        p25: Array(61).fill(6500),
        p50: Array(61).fill(7000),
        p75: Array(61).fill(7500),
        p90: Array(61).fill(8000),
      },
      returnBands: {
        p10: Array(61).fill(20),
        p25: Array(61).fill(30),
        p50: Array(61).fill(40),
        p75: Array(61).fill(50),
        p90: Array(61).fill(60),
      },
    },
    stats: {
      windowCount,
      medianReturn: 50,
      medianCAGR: 7,
      successRate: 100,
      bestWindow: windows[windowCount - 1],
      worstWindow: windows[0],
      returnDistribution: { negative: 0, low: 20, medium: 40, high: 40 },
    },
    windows,
    dataRange: {
      firstDate: '2010-01-01',
      lastDate: '2020-12-31',
      yearsOfData: 11,
    },
  }
}

describe('Rolling Analysis Store', () => {
  beforeEach(() => {
    // Reset store before each test
    useRollingAnalysisStore.getState().clearResults()
  })

  describe('initial state', () => {
    it('starts with null result', () => {
      const state = useRollingAnalysisStore.getState()
      expect(state.result).toBeNull()
    })

    it('starts with empty chart data', () => {
      const state = useRollingAnalysisStore.getState()
      expect(state.chartData).toEqual([])
    })

    it('starts with isComputing false', () => {
      const state = useRollingAnalysisStore.getState()
      expect(state.isComputing).toBe(false)
    })

    it('starts with null error', () => {
      const state = useRollingAnalysisStore.getState()
      expect(state.error).toBeNull()
    })

    it('has default available horizons', () => {
      const state = useRollingAnalysisStore.getState()
      expect(state.availableHorizons).toEqual([5, 10, 15, 20])
    })
  })

  describe('setResult', () => {
    it('stores the rolling window result', () => {
      const mockResult = createMockRollingResult()
      useRollingAnalysisStore.getState().setResult(mockResult)

      const state = useRollingAnalysisStore.getState()
      expect(state.result).toEqual(mockResult)
    })

    it('clears computing state when result is set', () => {
      useRollingAnalysisStore.getState().setComputing(true)
      expect(useRollingAnalysisStore.getState().isComputing).toBe(true)

      useRollingAnalysisStore.getState().setResult(createMockRollingResult())
      expect(useRollingAnalysisStore.getState().isComputing).toBe(false)
    })

    it('clears error state when result is set', () => {
      useRollingAnalysisStore.getState().setError('Previous error')
      expect(useRollingAnalysisStore.getState().error).toBe('Previous error')

      useRollingAnalysisStore.getState().setResult(createMockRollingResult())
      expect(useRollingAnalysisStore.getState().error).toBeNull()
    })
  })

  describe('setComputing', () => {
    it('sets isComputing to true', () => {
      useRollingAnalysisStore.getState().setComputing(true)
      expect(useRollingAnalysisStore.getState().isComputing).toBe(true)
    })

    it('sets isComputing to false', () => {
      useRollingAnalysisStore.getState().setComputing(true)
      useRollingAnalysisStore.getState().setComputing(false)
      expect(useRollingAnalysisStore.getState().isComputing).toBe(false)
    })

    it('clears error when starting computation', () => {
      useRollingAnalysisStore.getState().setError('Some error')
      useRollingAnalysisStore.getState().setComputing(true)
      expect(useRollingAnalysisStore.getState().error).toBeNull()
    })
  })

  describe('setError', () => {
    it('stores the error message', () => {
      useRollingAnalysisStore.getState().setError('Analysis failed')
      expect(useRollingAnalysisStore.getState().error).toBe('Analysis failed')
    })

    it('clears computing state when error is set', () => {
      useRollingAnalysisStore.getState().setComputing(true)
      useRollingAnalysisStore.getState().setError('Error occurred')
      expect(useRollingAnalysisStore.getState().isComputing).toBe(false)
    })

    it('can clear error by setting null', () => {
      useRollingAnalysisStore.getState().setError('Some error')
      useRollingAnalysisStore.getState().setError(null)
      expect(useRollingAnalysisStore.getState().error).toBeNull()
    })
  })

  describe('setChartData', () => {
    it('stores chart data', () => {
      const chartData: RollingChartDataPoint[] = [
        { time: 0, p10: 100, p25: 110, p50: 120, p75: 130, p90: 140 },
        { time: 1, p10: 105, p25: 115, p50: 125, p75: 135, p90: 145 },
      ]
      useRollingAnalysisStore.getState().setChartData(chartData)
      expect(useRollingAnalysisStore.getState().chartData).toEqual(chartData)
    })
  })

  describe('setAvailableHorizons', () => {
    it('updates available horizons', () => {
      useRollingAnalysisStore.getState().setAvailableHorizons([5, 10])
      expect(useRollingAnalysisStore.getState().availableHorizons).toEqual([5, 10])
    })

    it('can set to empty array', () => {
      useRollingAnalysisStore.getState().setAvailableHorizons([])
      expect(useRollingAnalysisStore.getState().availableHorizons).toEqual([])
    })
  })

  describe('clearResults', () => {
    it('resets result to null', () => {
      useRollingAnalysisStore.getState().setResult(createMockRollingResult())
      useRollingAnalysisStore.getState().clearResults()
      expect(useRollingAnalysisStore.getState().result).toBeNull()
    })

    it('resets chartData to empty', () => {
      const chartData: RollingChartDataPoint[] = [
        { time: 0, p10: 100, p25: 110, p50: 120, p75: 130, p90: 140 },
      ]
      useRollingAnalysisStore.getState().setChartData(chartData)
      useRollingAnalysisStore.getState().clearResults()
      expect(useRollingAnalysisStore.getState().chartData).toEqual([])
    })

    it('resets isComputing to false', () => {
      useRollingAnalysisStore.getState().setComputing(true)
      useRollingAnalysisStore.getState().clearResults()
      expect(useRollingAnalysisStore.getState().isComputing).toBe(false)
    })

    it('resets error to null', () => {
      useRollingAnalysisStore.getState().setError('Some error')
      useRollingAnalysisStore.getState().clearResults()
      expect(useRollingAnalysisStore.getState().error).toBeNull()
    })
  })

  describe('state transitions', () => {
    it('follows computing → result flow correctly', () => {
      // Start computation
      useRollingAnalysisStore.getState().setComputing(true)
      expect(useRollingAnalysisStore.getState().isComputing).toBe(true)
      expect(useRollingAnalysisStore.getState().error).toBeNull()

      // Complete with result
      useRollingAnalysisStore.getState().setResult(createMockRollingResult())
      expect(useRollingAnalysisStore.getState().isComputing).toBe(false)
      expect(useRollingAnalysisStore.getState().result).not.toBeNull()
      expect(useRollingAnalysisStore.getState().error).toBeNull()
    })

    it('follows computing → error flow correctly', () => {
      // Start computation
      useRollingAnalysisStore.getState().setComputing(true)
      expect(useRollingAnalysisStore.getState().isComputing).toBe(true)

      // Fail with error
      useRollingAnalysisStore.getState().setError('Computation failed')
      expect(useRollingAnalysisStore.getState().isComputing).toBe(false)
      expect(useRollingAnalysisStore.getState().error).toBe('Computation failed')
      expect(useRollingAnalysisStore.getState().result).toBeNull()
    })

    it('handles multiple horizon analyses', () => {
      // First analysis
      const result5 = createMockRollingResult(5)
      useRollingAnalysisStore.getState().setResult(result5)
      expect(useRollingAnalysisStore.getState().result?.stats.windowCount).toBe(5)

      // Switch to different horizon (new result replaces old)
      const result10 = createMockRollingResult(10)
      useRollingAnalysisStore.getState().setResult(result10)
      expect(useRollingAnalysisStore.getState().result?.stats.windowCount).toBe(10)
    })
  })

  describe('selectors', () => {
    describe('selectStats', () => {
      it('returns empty stats when result is null', () => {
        const stats = selectStats(useRollingAnalysisStore.getState())
        expect(stats.windowCount).toBe(0)
        expect(stats.medianReturn).toBe(0)
        expect(stats.successRate).toBe(0)
        expect(stats.bestWindow).toBeNull()
        expect(stats.worstWindow).toBeNull()
      })

      it('returns stats from result when available', () => {
        const mockResult = createMockRollingResult()
        useRollingAnalysisStore.getState().setResult(mockResult)

        const stats = selectStats(useRollingAnalysisStore.getState())
        expect(stats.windowCount).toBe(5)
        expect(stats.medianReturn).toBe(50)
        expect(stats.successRate).toBe(100)
        expect(stats.bestWindow).not.toBeNull()
      })
    })

    describe('selectWindows', () => {
      it('returns empty array when result is null', () => {
        const windows = selectWindows(useRollingAnalysisStore.getState())
        expect(windows).toEqual([])
      })

      it('returns windows from result when available', () => {
        const mockResult = createMockRollingResult(5)
        useRollingAnalysisStore.getState().setResult(mockResult)

        const windows = selectWindows(useRollingAnalysisStore.getState())
        expect(windows).toHaveLength(5)
        expect(windows[0].startDate).toBe('2010-01-01')
      })

      it('returns stable reference for empty state', () => {
        const windows1 = selectWindows(useRollingAnalysisStore.getState())
        const windows2 = selectWindows(useRollingAnalysisStore.getState())
        expect(windows1).toBe(windows2) // Same reference
      })
    })

    describe('selectDataRange', () => {
      it('returns null when result is null', () => {
        const dataRange = selectDataRange(useRollingAnalysisStore.getState())
        expect(dataRange).toBeNull()
      })

      it('returns data range from result when available', () => {
        const mockResult = createMockRollingResult()
        useRollingAnalysisStore.getState().setResult(mockResult)

        const dataRange = selectDataRange(useRollingAnalysisStore.getState())
        expect(dataRange?.firstDate).toBe('2010-01-01')
        expect(dataRange?.lastDate).toBe('2020-12-31')
        expect(dataRange?.yearsOfData).toBe(11)
      })
    })
  })
})
