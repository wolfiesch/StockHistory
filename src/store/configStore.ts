'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { InvestmentFrequency } from '@/lib/api/types'

interface ConfigState {
  ticker: string
  amount: number
  frequency: InvestmentFrequency
  startDate: string
  isDRIP: boolean

  // Comparison tickers (up to 2 additional)
  comparisonTickers: string[]

  // Hydration state
  _hasHydrated: boolean
  setHasHydrated: (state: boolean) => void

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

  // Bulk update for URL sync
  setConfig: (config: Partial<Pick<ConfigState, 'ticker' | 'amount' | 'frequency' | 'startDate' | 'isDRIP' | 'comparisonTickers'>>) => void
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

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      ...defaultConfig,
      _hasHydrated: false,

      setHasHydrated: (state) => set({ _hasHydrated: state }),

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

      setConfig: (config) =>
        set((state) => ({
          ...state,
          ...config,
          ticker: config.ticker?.toUpperCase() ?? state.ticker,
          amount: config.amount !== undefined
            ? Math.max(1, Math.min(10000, config.amount))
            : state.amount,
        })),
    }),
    {
      name: 'dca-config',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        ticker: state.ticker,
        amount: state.amount,
        frequency: state.frequency,
        startDate: state.startDate,
        isDRIP: state.isDRIP,
        comparisonTickers: state.comparisonTickers,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
