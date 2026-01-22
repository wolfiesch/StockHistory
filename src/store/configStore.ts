'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { InvestmentFrequency, ViewMode, HorizonYears, RollingXAxisMode } from '@/lib/api/types'

// Preset benchmark ETFs
export const BENCHMARK_PRESETS = ['SPY', 'QQQ', 'DIA'] as const
export type BenchmarkPreset = typeof BENCHMARK_PRESETS[number]

interface ConfigState {
  ticker: string
  amount: number
  frequency: InvestmentFrequency
  startDate: string
  endDate: string
  isDRIP: boolean
  showLumpSum: boolean

  // Comparison tickers (up to 2 additional)
  comparisonTickers: string[]

  // Benchmark tickers (presets + 1 custom)
  benchmarkTickers: string[]

  // Rolling analysis settings
  viewMode: ViewMode
  rollingHorizon: HorizonYears
  rollingXAxisMode: RollingXAxisMode

  // Hydration state
  _hasHydrated: boolean
  setHasHydrated: (state: boolean) => void

  // Actions
  setTicker: (ticker: string) => void
  setAmount: (amount: number) => void
  setFrequency: (frequency: InvestmentFrequency) => void
  setStartDate: (startDate: string) => void
  setEndDate: (endDate: string) => void
  setIsDRIP: (isDRIP: boolean) => void
  setShowLumpSum: (showLumpSum: boolean) => void
  addComparisonTicker: (ticker: string) => void
  removeComparisonTicker: (ticker: string) => void
  clearComparisons: () => void
  resetConfig: () => void

  // Benchmark actions
  toggleBenchmark: (ticker: string) => void
  addCustomBenchmark: (ticker: string) => void
  removeBenchmark: (ticker: string) => void
  clearBenchmarks: () => void

  // Rolling analysis actions
  setViewMode: (mode: ViewMode) => void
  setRollingHorizon: (years: HorizonYears) => void
  setRollingXAxisMode: (mode: RollingXAxisMode) => void

  // Bulk update for URL sync
  setConfig: (config: Partial<Pick<ConfigState, 'ticker' | 'amount' | 'frequency' | 'startDate' | 'endDate' | 'isDRIP' | 'showLumpSum' | 'comparisonTickers' | 'benchmarkTickers' | 'viewMode' | 'rollingHorizon' | 'rollingXAxisMode'>>) => void
}

// Default to 10 years ago
const getDefaultStartDate = () => {
  const date = new Date()
  date.setFullYear(date.getFullYear() - 10)
  return date.toISOString().split('T')[0]
}

const getDefaultEndDate = () => new Date().toISOString().split('T')[0]

const defaultConfig = {
  ticker: 'AAPL',
  amount: 100,
  frequency: 'monthly' as InvestmentFrequency,
  startDate: getDefaultStartDate(),
  endDate: getDefaultEndDate(),
  isDRIP: true,
  showLumpSum: false,
  comparisonTickers: [],
  benchmarkTickers: [],
  // Rolling analysis defaults
  viewMode: 'single' as ViewMode,
  rollingHorizon: 10 as HorizonYears,
  rollingXAxisMode: 'normalized' as RollingXAxisMode,
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      ...defaultConfig,
      _hasHydrated: false,

      setHasHydrated: (state) => set({ _hasHydrated: state }),

      setTicker: (ticker) => set({ ticker: ticker.toUpperCase() }),
      setAmount: (amount) => set({ amount: Math.max(1, Math.min(10000, amount)) }),
      setFrequency: (frequency) => set({ frequency }),
      setStartDate: (startDate) =>
        set((state) => ({
          startDate,
          endDate: state.endDate < startDate ? startDate : state.endDate,
        })),
      setEndDate: (endDate) =>
        set((state) => ({
          endDate,
          startDate: endDate < state.startDate ? endDate : state.startDate,
        })),
      setIsDRIP: (isDRIP) => set({ isDRIP }),
      setShowLumpSum: (showLumpSum) => set({ showLumpSum }),

      addComparisonTicker: (ticker) =>
        set((state) => {
          const normalized = ticker.toUpperCase()
          if (
            state.comparisonTickers.length >= 2 ||
            state.comparisonTickers.includes(normalized) ||
            normalized === state.ticker
          ) {
            return state
          }
          return { comparisonTickers: [...state.comparisonTickers, normalized] }
        }),

      removeComparisonTicker: (ticker) =>
        set((state) => ({
          comparisonTickers: state.comparisonTickers.filter(
            (t) => t !== ticker.toUpperCase()
          ),
        })),

      clearComparisons: () => set({ comparisonTickers: [] }),

      // Benchmark actions
      toggleBenchmark: (ticker) =>
        set((state) => {
          const normalized = ticker.toUpperCase()
          // Prevent adding primary ticker as benchmark
          if (normalized === state.ticker) return state

          if (state.benchmarkTickers.includes(normalized)) {
            // Remove if already present
            return { benchmarkTickers: state.benchmarkTickers.filter((t) => t !== normalized) }
          }

          // Max 4 benchmarks (3 presets + 1 custom)
          if (state.benchmarkTickers.length >= 4) return state

          return { benchmarkTickers: [...state.benchmarkTickers, normalized] }
        }),

      addCustomBenchmark: (ticker) =>
        set((state) => {
          const normalized = ticker.toUpperCase()
          // Prevent duplicates, primary ticker, or exceeding limit
          if (
            state.benchmarkTickers.includes(normalized) ||
            normalized === state.ticker ||
            state.benchmarkTickers.length >= 4
          ) {
            return state
          }
          return { benchmarkTickers: [...state.benchmarkTickers, normalized] }
        }),

      removeBenchmark: (ticker) =>
        set((state) => ({
          benchmarkTickers: state.benchmarkTickers.filter((t) => t !== ticker.toUpperCase()),
        })),

      clearBenchmarks: () => set({ benchmarkTickers: [] }),

      // Rolling analysis actions
      setViewMode: (mode) => set({ viewMode: mode }),
      setRollingHorizon: (years) => set({ rollingHorizon: years }),
      setRollingXAxisMode: (mode) => set({ rollingXAxisMode: mode }),

      resetConfig: () => set(defaultConfig),

      setConfig: (config) =>
        set((state) => {
          const nextStart = config.startDate ?? state.startDate
          const nextEnd = config.endDate ?? state.endDate
          let normalizedStart = nextStart
          let normalizedEnd = nextEnd

          if (normalizedEnd < normalizedStart) {
            if (config.startDate && !config.endDate) {
              normalizedEnd = normalizedStart
            } else if (config.endDate && !config.startDate) {
              normalizedStart = normalizedEnd
            } else {
              normalizedEnd = normalizedStart
            }
          }

          return {
            ...state,
            ...config,
            ticker: config.ticker?.toUpperCase() ?? state.ticker,
            amount: config.amount !== undefined
              ? Math.max(1, Math.min(10000, config.amount))
              : state.amount,
            startDate: normalizedStart,
            endDate: normalizedEnd,
          }
        }),
    }),
    {
      name: 'dca-config',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        ticker: state.ticker,
        amount: state.amount,
        frequency: state.frequency,
        startDate: state.startDate,
        endDate: state.endDate,
        isDRIP: state.isDRIP,
        showLumpSum: state.showLumpSum,
        comparisonTickers: state.comparisonTickers,
        benchmarkTickers: state.benchmarkTickers,
        viewMode: state.viewMode,
        rollingHorizon: state.rollingHorizon,
        rollingXAxisMode: state.rollingXAxisMode,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
