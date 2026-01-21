'use client'

import { create } from 'zustand'
import type { SimulationResult } from '@/lib/api/types'

interface TickerSimulation {
  ticker: string
  result: SimulationResult
  isLoading: boolean
  error: string | null
}

interface SimulationState {
  // Primary ticker simulation
  primary: TickerSimulation | null

  // Comparison simulations
  comparisons: TickerSimulation[]

  // Actions
  setPrimaryResult: (ticker: string, result: SimulationResult) => void
  setPrimaryLoading: (ticker: string) => void
  setPrimaryError: (ticker: string, error: string) => void

  addComparisonResult: (ticker: string, result: SimulationResult) => void
  setComparisonLoading: (ticker: string) => void
  setComparisonError: (ticker: string, error: string) => void
  removeComparison: (ticker: string) => void

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
  isLoading: false,
  error: null,
})

export const useSimulationStore = create<SimulationState>((set) => ({
  primary: null,
  comparisons: [],

  setPrimaryResult: (ticker, result) =>
    set({
      primary: {
        ticker,
        result,
        isLoading: false,
        error: null,
      },
    }),

  setPrimaryLoading: (ticker) =>
    set((state) => ({
      primary: {
        ...(state.primary || createEmptySimulation(ticker)),
        ticker,
        isLoading: true,
        error: null,
      },
    })),

  setPrimaryError: (ticker, error) =>
    set((state) => ({
      primary: {
        ...(state.primary || createEmptySimulation(ticker)),
        ticker,
        isLoading: false,
        error,
      },
    })),

  addComparisonResult: (ticker, result) =>
    set((state) => {
      const existing = state.comparisons.findIndex((c) => c.ticker === ticker)
      const newSim: TickerSimulation = {
        ticker,
        result,
        isLoading: false,
        error: null,
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
        updated[existing] = { ...updated[existing], isLoading: true, error: null }
        return { comparisons: updated }
      }

      return {
        comparisons: [
          ...state.comparisons,
          { ...createEmptySimulation(ticker), isLoading: true },
        ],
      }
    }),

  setComparisonError: (ticker, error) =>
    set((state) => {
      const existing = state.comparisons.findIndex((c) => c.ticker === ticker)

      if (existing >= 0) {
        const updated = [...state.comparisons]
        updated[existing] = { ...updated[existing], isLoading: false, error }
        return { comparisons: updated }
      }

      return state
    }),

  removeComparison: (ticker) =>
    set((state) => ({
      comparisons: state.comparisons.filter((c) => c.ticker !== ticker),
    })),

  clearAll: () => set({ primary: null, comparisons: [] }),
}))
