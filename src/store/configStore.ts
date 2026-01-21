'use client'

import { create } from 'zustand'
import type { InvestmentFrequency } from '@/lib/api/types'

interface ConfigState {
  ticker: string
  amount: number
  frequency: InvestmentFrequency
  startDate: string
  isDRIP: boolean

  // Comparison tickers (up to 2 additional)
  comparisonTickers: string[]

  // Actions
  setTicker: (ticker: string) => void
  setAmount: (amount: number) => void
  setFrequency: (frequency: InvestmentFrequency) => void
  setStartDate: (startDate: string) => void
  setIsDRIP: (isDRIP: boolean) => void
  addComparisonTicker: (ticker: string) => void
  removeComparisonTicker: (ticker: string) => void
  clearComparisons: () => void
  resetConfig: () => void
}

// Default to 10 years ago
const getDefaultStartDate = () => {
  const date = new Date()
  date.setFullYear(date.getFullYear() - 10)
  return date.toISOString().split('T')[0]
}

const defaultConfig = {
  ticker: 'AAPL',
  amount: 100,
  frequency: 'monthly' as InvestmentFrequency,
  startDate: getDefaultStartDate(),
  isDRIP: true,
  comparisonTickers: [],
}

export const useConfigStore = create<ConfigState>((set) => ({
  ...defaultConfig,

  setTicker: (ticker) => set({ ticker: ticker.toUpperCase() }),
  setAmount: (amount) => set({ amount: Math.max(1, Math.min(10000, amount)) }),
  setFrequency: (frequency) => set({ frequency }),
  setStartDate: (startDate) => set({ startDate }),
  setIsDRIP: (isDRIP) => set({ isDRIP }),

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

  resetConfig: () => set(defaultConfig),
}))
