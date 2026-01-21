import { describe, it, expect, beforeEach } from 'vitest'
import { useConfigStore } from '@/store/configStore'
import { getShareableURL } from '@/hooks/useURLSync'

describe('URL Sync Integration', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    // Reset store to defaults
    useConfigStore.getState().resetConfig()
  })

  describe('getShareableURL', () => {
    it('generates URL with all config parameters', () => {
      const store = useConfigStore.getState()
      store.setTicker('MSFT')
      store.setAmount(500)
      store.setFrequency('weekly')
      store.setStartDate('2020-01-15')
      store.setIsDRIP(false)
      store.addComparisonTicker('AAPL')
      store.addComparisonTicker('GOOGL')

      const url = getShareableURL()

      expect(url).toContain('t=MSFT')
      expect(url).toContain('a=500')
      expect(url).toContain('f=weekly')
      expect(url).toContain('s=2020-01-15')
      expect(url).toContain('d=0')
      expect(url).toContain('c=AAPL%2CGOOGL') // URL encoded comma
    })

    it('generates URL without comparison tickers when empty', () => {
      const store = useConfigStore.getState()
      store.setTicker('SPY')
      store.clearComparisons()

      const url = getShareableURL()

      expect(url).toContain('t=SPY')
      expect(url).not.toContain('c=')
    })

    it('includes DRIP=1 when enabled', () => {
      const store = useConfigStore.getState()
      store.setIsDRIP(true)

      const url = getShareableURL()

      expect(url).toContain('d=1')
    })

    it('handles all frequency options', () => {
      const store = useConfigStore.getState()

      store.setFrequency('weekly')
      expect(getShareableURL()).toContain('f=weekly')

      store.setFrequency('biweekly')
      expect(getShareableURL()).toContain('f=biweekly')

      store.setFrequency('monthly')
      expect(getShareableURL()).toContain('f=monthly')
    })
  })

  describe('URL parameter parsing', () => {
    it('parses valid ticker from URL', () => {
      // This tests the setConfig method which is used by useURLSync
      useConfigStore.getState().setConfig({ ticker: 'nvda' }) // lowercase should be uppercased

      expect(useConfigStore.getState().ticker).toBe('NVDA')
    })

    it('parses valid amount within bounds', () => {
      useConfigStore.getState().setConfig({ amount: 5000 })
      expect(useConfigStore.getState().amount).toBe(5000)

      useConfigStore.getState().setConfig({ amount: 1 })
      expect(useConfigStore.getState().amount).toBe(1)

      useConfigStore.getState().setConfig({ amount: 10000 })
      expect(useConfigStore.getState().amount).toBe(10000)
    })

    it('clamps amount to valid range', () => {
      useConfigStore.getState().setConfig({ amount: 0 })
      expect(useConfigStore.getState().amount).toBe(1) // Minimum

      useConfigStore.getState().setConfig({ amount: 99999 })
      expect(useConfigStore.getState().amount).toBe(10000) // Maximum
    })

    it('parses frequency options correctly', () => {
      useConfigStore.getState().setConfig({ frequency: 'weekly' })
      expect(useConfigStore.getState().frequency).toBe('weekly')

      useConfigStore.getState().setConfig({ frequency: 'biweekly' })
      expect(useConfigStore.getState().frequency).toBe('biweekly')

      useConfigStore.getState().setConfig({ frequency: 'monthly' })
      expect(useConfigStore.getState().frequency).toBe('monthly')
    })

    it('parses start date correctly', () => {
      useConfigStore.getState().setConfig({ startDate: '2015-06-15' })
      expect(useConfigStore.getState().startDate).toBe('2015-06-15')
    })

    it('parses DRIP boolean correctly', () => {
      useConfigStore.getState().setConfig({ isDRIP: true })
      expect(useConfigStore.getState().isDRIP).toBe(true)

      useConfigStore.getState().setConfig({ isDRIP: false })
      expect(useConfigStore.getState().isDRIP).toBe(false)
    })

    it('parses comparison tickers correctly', () => {
      useConfigStore.getState().clearComparisons()
      useConfigStore.getState().setConfig({ comparisonTickers: ['MSFT', 'GOOGL'] })

      expect(useConfigStore.getState().comparisonTickers).toEqual(['MSFT', 'GOOGL'])
    })

    it('limits comparison tickers to 2', () => {
      useConfigStore.getState().clearComparisons()

      // addComparisonTicker enforces the limit
      useConfigStore.getState().addComparisonTicker('MSFT')
      useConfigStore.getState().addComparisonTicker('GOOGL')
      useConfigStore.getState().addComparisonTicker('AMZN') // Should be ignored

      const tickers = useConfigStore.getState().comparisonTickers
      expect(tickers).toHaveLength(2)
      expect(tickers).toContain('MSFT')
      expect(tickers).toContain('GOOGL')
      expect(tickers).not.toContain('AMZN')
    })
  })

  describe('bulk config update', () => {
    it('updates multiple config values atomically', () => {
      useConfigStore.getState().setConfig({
        ticker: 'TSLA',
        amount: 250,
        frequency: 'biweekly',
        startDate: '2019-03-01',
        isDRIP: false,
        comparisonTickers: ['RIVN'],
      })

      const state = useConfigStore.getState()
      expect(state.ticker).toBe('TSLA')
      expect(state.amount).toBe(250)
      expect(state.frequency).toBe('biweekly')
      expect(state.startDate).toBe('2019-03-01')
      expect(state.isDRIP).toBe(false)
      expect(state.comparisonTickers).toEqual(['RIVN'])
    })

    it('preserves unchanged values during partial update', () => {
      // Set initial state
      useConfigStore.getState().setConfig({
        ticker: 'AAPL',
        amount: 100,
        frequency: 'monthly',
        startDate: '2020-01-01',
        isDRIP: true,
      })

      // Partial update
      useConfigStore.getState().setConfig({ ticker: 'MSFT' })

      const state = useConfigStore.getState()
      expect(state.ticker).toBe('MSFT')
      expect(state.amount).toBe(100) // Preserved
      expect(state.frequency).toBe('monthly') // Preserved
      expect(state.startDate).toBe('2020-01-01') // Preserved
      expect(state.isDRIP).toBe(true) // Preserved
    })
  })

  describe('URL round-trip', () => {
    it('config -> URL -> config preserves all values', () => {
      const store = useConfigStore.getState()

      // Set config
      const originalConfig = {
        ticker: 'META',
        amount: 750,
        frequency: 'weekly' as const,
        startDate: '2018-07-20',
        isDRIP: false,
        comparisonTickers: ['SNAP', 'PINS'],
      }
      store.setConfig(originalConfig)

      // Generate URL
      const url = getShareableURL()
      const params = new URLSearchParams(new URL(url).search)

      // Parse URL back (simulating what useURLSync does)
      const parsedConfig = {
        ticker: params.get('t')?.toUpperCase(),
        amount: parseInt(params.get('a') || '0', 10),
        frequency: params.get('f') as 'weekly' | 'biweekly' | 'monthly',
        startDate: params.get('s'),
        isDRIP: params.get('d') === '1',
        comparisonTickers: params.get('c')?.split(','),
      }

      expect(parsedConfig.ticker).toBe(originalConfig.ticker)
      expect(parsedConfig.amount).toBe(originalConfig.amount)
      expect(parsedConfig.frequency).toBe(originalConfig.frequency)
      expect(parsedConfig.startDate).toBe(originalConfig.startDate)
      expect(parsedConfig.isDRIP).toBe(originalConfig.isDRIP)
      expect(parsedConfig.comparisonTickers).toEqual(originalConfig.comparisonTickers)
    })
  })
})
