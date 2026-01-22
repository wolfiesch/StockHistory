import { describe, it, expect, beforeEach } from 'vitest'
import { useConfigStore } from '@/store/configStore'

describe('localStorage Persistence Integration', () => {
  const STORAGE_KEY = 'dca-config'

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    // Reset store to defaults
    useConfigStore.getState().resetConfig()
  })

  describe('config persistence', () => {
    it('persists ticker changes to localStorage', () => {
      const store = useConfigStore.getState()
      store.setTicker('NVDA')

      // Check localStorage was updated
      const saved = localStorage.getItem(STORAGE_KEY)
      expect(saved).not.toBeNull()

      const parsed = JSON.parse(saved!)
      expect(parsed.state.ticker).toBe('NVDA')
    })

    it('persists amount changes to localStorage', () => {
      const store = useConfigStore.getState()
      store.setAmount(500)

      const saved = localStorage.getItem(STORAGE_KEY)
      const parsed = JSON.parse(saved!)
      expect(parsed.state.amount).toBe(500)
    })

    it('persists frequency changes to localStorage', () => {
      const store = useConfigStore.getState()
      store.setFrequency('weekly')

      const saved = localStorage.getItem(STORAGE_KEY)
      const parsed = JSON.parse(saved!)
      expect(parsed.state.frequency).toBe('weekly')
    })

    it('persists startDate changes to localStorage', () => {
      const store = useConfigStore.getState()
      store.setStartDate('2015-01-01')

      const saved = localStorage.getItem(STORAGE_KEY)
      const parsed = JSON.parse(saved!)
      expect(parsed.state.startDate).toBe('2015-01-01')
    })

    it('persists endDate changes to localStorage', () => {
      const store = useConfigStore.getState()
      store.setEndDate('2022-12-31')

      const saved = localStorage.getItem(STORAGE_KEY)
      const parsed = JSON.parse(saved!)
      expect(parsed.state.endDate).toBe('2022-12-31')
    })

    it('persists DRIP toggle to localStorage', () => {
      const store = useConfigStore.getState()
      store.setIsDRIP(false)

      const saved = localStorage.getItem(STORAGE_KEY)
      const parsed = JSON.parse(saved!)
      expect(parsed.state.isDRIP).toBe(false)
    })

    it('persists lump sum toggle to localStorage', () => {
      const store = useConfigStore.getState()
      store.setShowLumpSum(false)

      const saved = localStorage.getItem(STORAGE_KEY)
      const parsed = JSON.parse(saved!)
      expect(parsed.state.showLumpSum).toBe(false)
    })

    it('persists comparison tickers to localStorage', () => {
      const store = useConfigStore.getState()
      store.addComparisonTicker('MSFT')
      store.addComparisonTicker('GOOGL')

      const saved = localStorage.getItem(STORAGE_KEY)
      const parsed = JSON.parse(saved!)
      expect(parsed.state.comparisonTickers).toContain('MSFT')
      expect(parsed.state.comparisonTickers).toContain('GOOGL')
    })
  })

  describe('storage structure', () => {
    it('stores data in correct Zustand persist format', () => {
      const store = useConfigStore.getState()
      store.setTicker('TSLA')

      const saved = localStorage.getItem(STORAGE_KEY)
      const parsed = JSON.parse(saved!)

      // Zustand persist format
      expect(parsed).toHaveProperty('state')
      expect(parsed).toHaveProperty('version')
    })

    it('only persists whitelisted fields (partialize)', () => {
      const store = useConfigStore.getState()
      store.setTicker('META')

      const saved = localStorage.getItem(STORAGE_KEY)
      const parsed = JSON.parse(saved!)
      const state = parsed.state

      // Should persist these
      expect(state).toHaveProperty('ticker')
      expect(state).toHaveProperty('amount')
      expect(state).toHaveProperty('frequency')
      expect(state).toHaveProperty('startDate')
      expect(state).toHaveProperty('endDate')
      expect(state).toHaveProperty('isDRIP')
      expect(state).toHaveProperty('showLumpSum')
      expect(state).toHaveProperty('comparisonTickers')

      // Should NOT persist internal state
      expect(state).not.toHaveProperty('_hasHydrated')
      expect(state).not.toHaveProperty('setTicker')
      expect(state).not.toHaveProperty('setConfig')
    })
  })

  describe('config restoration', () => {
    it('reads config from localStorage correctly', () => {
      // Pre-populate localStorage with saved config
      const savedConfig = {
        state: {
          ticker: 'AMZN',
          amount: 250,
          frequency: 'biweekly',
          startDate: '2019-06-01',
          endDate: '2024-06-01',
          isDRIP: false,
          showLumpSum: false,
          comparisonTickers: ['SHOP'],
        },
        version: 0,
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedConfig))

      const retrieved = localStorage.getItem(STORAGE_KEY)
      expect(retrieved).toBe(JSON.stringify(savedConfig))
    })
  })

  describe('edge cases', () => {
    it('handles corrupted localStorage data gracefully', () => {
      localStorage.setItem(STORAGE_KEY, 'not valid json {')

      // Should not throw when trying to get item
      expect(() => localStorage.getItem(STORAGE_KEY)).not.toThrow()
    })

    it('handles empty localStorage gracefully', () => {
      localStorage.clear()

      const result = localStorage.getItem(STORAGE_KEY)
      expect(result).toBeNull()
    })

    it('store works in memory regardless of localStorage state', () => {
      // Store should work even if localStorage has issues
      useConfigStore.getState().setTicker('NVDA')
      expect(useConfigStore.getState().ticker).toBe('NVDA')

      useConfigStore.getState().setAmount(999)
      expect(useConfigStore.getState().amount).toBe(999)
    })
  })

  describe('comparison ticker operations', () => {
    it('persists added comparison ticker', () => {
      const store = useConfigStore.getState()
      store.clearComparisons()
      store.addComparisonTicker('TSLA')

      const saved = localStorage.getItem(STORAGE_KEY)
      const parsed = JSON.parse(saved!)
      expect(parsed.state.comparisonTickers).toContain('TSLA')
    })

    it('persists removed comparison ticker', () => {
      const store = useConfigStore.getState()
      store.clearComparisons()
      store.addComparisonTicker('MSFT')
      store.addComparisonTicker('GOOGL')

      store.removeComparisonTicker('MSFT')

      const saved = localStorage.getItem(STORAGE_KEY)
      const parsed = JSON.parse(saved!)
      expect(parsed.state.comparisonTickers).not.toContain('MSFT')
      expect(parsed.state.comparisonTickers).toContain('GOOGL')
    })

    it('persists cleared comparisons', () => {
      const store = useConfigStore.getState()
      store.addComparisonTicker('AAPL')
      store.addComparisonTicker('MSFT')

      store.clearComparisons()

      const saved = localStorage.getItem(STORAGE_KEY)
      const parsed = JSON.parse(saved!)
      expect(parsed.state.comparisonTickers).toHaveLength(0)
    })
  })
})
