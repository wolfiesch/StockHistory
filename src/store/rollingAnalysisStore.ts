'use client'

import { create } from 'zustand'
import type {
  RollingWindowResult,
  RollingChartDataPoint,
  WindowResult,
  RollingWindowStats,
  HorizonYears,
} from '@/lib/api/types'

interface RollingAnalysisState {
  // The complete rolling window analysis result
  result: RollingWindowResult | null

  // Chart-ready data (computed from result based on X-axis mode)
  chartData: RollingChartDataPoint[]

  // Loading and error states
  isComputing: boolean
  error: string | null

  // Available horizons (based on data length)
  availableHorizons: HorizonYears[]

  // Actions
  setResult: (result: RollingWindowResult) => void
  setChartData: (data: RollingChartDataPoint[]) => void
  setComputing: (isComputing: boolean) => void
  setError: (error: string | null) => void
  setAvailableHorizons: (horizons: HorizonYears[]) => void
  clearResults: () => void
}

// Helper to get empty stats
const emptyStats: RollingWindowStats = {
  windowCount: 0,
  medianReturn: 0,
  medianCAGR: 0,
  successRate: 0,
  bestWindow: null,
  worstWindow: null,
  returnDistribution: {
    negative: 0,
    low: 0,
    medium: 0,
    high: 0,
  },
}

export const useRollingAnalysisStore = create<RollingAnalysisState>((set) => ({
  result: null,
  chartData: [],
  isComputing: false,
  error: null,
  availableHorizons: [5, 10, 15, 20],

  setResult: (result) =>
    set({
      result,
      isComputing: false,
      error: null,
    }),

  setChartData: (chartData) => set({ chartData }),

  setComputing: (isComputing) =>
    set({
      isComputing,
      error: isComputing ? null : undefined,
    }),

  setError: (error) =>
    set({
      error,
      isComputing: false,
    }),

  setAvailableHorizons: (availableHorizons) => set({ availableHorizons }),

  clearResults: () =>
    set({
      result: null,
      chartData: [],
      isComputing: false,
      error: null,
    }),
}))

// Stable empty arrays for selectors (avoids new reference each call)
const emptyWindows: WindowResult[] = []

// Selectors for common derived data
export const selectStats = (state: RollingAnalysisState): RollingWindowStats =>
  state.result?.stats ?? emptyStats

export const selectWindows = (state: RollingAnalysisState): WindowResult[] =>
  state.result?.windows ?? emptyWindows

export const selectDataRange = (state: RollingAnalysisState) =>
  state.result?.dataRange ?? null
