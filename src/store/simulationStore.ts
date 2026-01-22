'use client'

import { create } from 'zustand'
import type { SimulationResult } from '@/lib/api/types'

interface TickerSimulation {
  ticker: string
  result: SimulationResult
  lumpSumResult: SimulationResult | null
  isLoading: boolean
  error: string | null
  dividendsUnavailable: boolean
  retryAt: number | null
}

interface SimulationState {
  // Primary ticker simulation
  primary: TickerSimulation | null

  // Comparison simulations
  comparisons: TickerSimulation[]

  // Benchmark simulations
  benchmarks: TickerSimulation[]

  // Actions
  setPrimaryResult: (
    ticker: string,
    result: SimulationResult,
    dividendsUnavailable?: boolean,
    lumpSumResult?: SimulationResult | null
  ) => void
  setPrimaryLoading: (ticker: string) => void
  setPrimaryError: (ticker: string, error: string, retryAt?: number | null) => void

  addComparisonResult: (
    ticker: string,
    result: SimulationResult,
    dividendsUnavailable?: boolean,
    lumpSumResult?: SimulationResult | null
  ) => void
  setComparisonLoading: (ticker: string) => void
  setComparisonError: (
    ticker: string,
    error: string,
    retryAt?: number | null
  ) => void
  removeComparison: (ticker: string) => void

  // Benchmark actions
  addBenchmarkResult: (
    ticker: string,
    result: SimulationResult,
    dividendsUnavailable?: boolean,
    lumpSumResult?: SimulationResult | null
  ) => void
  setBenchmarkLoading: (ticker: string) => void
  setBenchmarkError: (ticker: string, error: string, retryAt?: number | null) => void
  removeBenchmark: (ticker: string) => void

  clearAll: () => void
}

const createEmptySimulation = (ticker: string): TickerSimulation => ({
  ticker,
  result: {
    points: [],
    finalShares: 0,
    totalInvested: 0,
    totalDividends: 0,
    finalValue: 0,
    totalReturn: 0,
    cagr: 0,
  },
  lumpSumResult: null,
  isLoading: false,
  error: null,
  dividendsUnavailable: false,
  retryAt: null,
})

export const useSimulationStore = create<SimulationState>((set) => ({
  primary: null,
  comparisons: [],
  benchmarks: [],

  setPrimaryResult: (ticker, result, dividendsUnavailable = false, lumpSumResult = null) =>
    set({
      primary: {
        ticker,
        result,
        lumpSumResult,
        isLoading: false,
        error: null,
        dividendsUnavailable,
        retryAt: null,
      },
    }),

  setPrimaryLoading: (ticker) =>
    set((state) => ({
      primary: {
        ...(state.primary || createEmptySimulation(ticker)),
        ticker,
        lumpSumResult: null,
        isLoading: true,
        error: null,
        dividendsUnavailable: false,
        retryAt: null,
      },
    })),

  setPrimaryError: (ticker, error, retryAt = null) =>
    set((state) => ({
      primary: {
        ...(state.primary || createEmptySimulation(ticker)),
        ticker,
        lumpSumResult: null,
        isLoading: false,
        error,
        dividendsUnavailable: false,
        retryAt,
      },
    })),

  addComparisonResult: (ticker, result, dividendsUnavailable = false, lumpSumResult = null) =>
    set((state) => {
      const existing = state.comparisons.findIndex((c) => c.ticker === ticker)
      const newSim: TickerSimulation = {
        ticker,
        result,
        lumpSumResult,
        isLoading: false,
        error: null,
        dividendsUnavailable,
        retryAt: null,
      }

      if (existing >= 0) {
        const updated = [...state.comparisons]
        updated[existing] = newSim
        return { comparisons: updated }
      }

      return { comparisons: [...state.comparisons, newSim] }
    }),

  setComparisonLoading: (ticker) =>
    set((state) => {
      const existing = state.comparisons.findIndex((c) => c.ticker === ticker)

      if (existing >= 0) {
        const updated = [...state.comparisons]
        updated[existing] = {
          ...updated[existing],
          lumpSumResult: null,
          isLoading: true,
          error: null,
          dividendsUnavailable: false,
          retryAt: null,
        }
        return { comparisons: updated }
      }

      return {
        comparisons: [
          ...state.comparisons,
          { ...createEmptySimulation(ticker), isLoading: true },
        ],
      }
    }),

  setComparisonError: (ticker, error, retryAt = null) =>
    set((state) => {
      const existing = state.comparisons.findIndex((c) => c.ticker === ticker)

      if (existing >= 0) {
        const updated = [...state.comparisons]
        updated[existing] = {
          ...updated[existing],
          lumpSumResult: null,
          isLoading: false,
          error,
          dividendsUnavailable: false,
          retryAt,
        }
        return { comparisons: updated }
      }

      return state
    }),

  removeComparison: (ticker) =>
    set((state) => ({
      comparisons: state.comparisons.filter((c) => c.ticker !== ticker),
    })),

  // Benchmark actions (mirror comparison pattern)
  addBenchmarkResult: (ticker, result, dividendsUnavailable = false, lumpSumResult = null) =>
    set((state) => {
      const existing = state.benchmarks.findIndex((b) => b.ticker === ticker)
      const newSim: TickerSimulation = {
        ticker,
        result,
        lumpSumResult,
        isLoading: false,
        error: null,
        dividendsUnavailable,
        retryAt: null,
      }

      if (existing >= 0) {
        const updated = [...state.benchmarks]
        updated[existing] = newSim
        return { benchmarks: updated }
      }

      return { benchmarks: [...state.benchmarks, newSim] }
    }),

  setBenchmarkLoading: (ticker) =>
    set((state) => {
      const existing = state.benchmarks.findIndex((b) => b.ticker === ticker)

      if (existing >= 0) {
        const updated = [...state.benchmarks]
        updated[existing] = {
          ...updated[existing],
          lumpSumResult: null,
          isLoading: true,
          error: null,
          dividendsUnavailable: false,
          retryAt: null,
        }
        return { benchmarks: updated }
      }

      return {
        benchmarks: [
          ...state.benchmarks,
          { ...createEmptySimulation(ticker), isLoading: true },
        ],
      }
    }),

  setBenchmarkError: (ticker, error, retryAt = null) =>
    set((state) => {
      const existing = state.benchmarks.findIndex((b) => b.ticker === ticker)

      if (existing >= 0) {
        const updated = [...state.benchmarks]
        updated[existing] = {
          ...updated[existing],
          lumpSumResult: null,
          isLoading: false,
          error,
          dividendsUnavailable: false,
          retryAt,
        }
        return { benchmarks: updated }
      }

      return state
    }),

  removeBenchmark: (ticker) =>
    set((state) => ({
      benchmarks: state.benchmarks.filter((b) => b.ticker !== ticker),
    })),

  clearAll: () => set({ primary: null, comparisons: [], benchmarks: [] }),
}))
