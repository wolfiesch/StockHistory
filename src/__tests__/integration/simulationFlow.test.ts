import { describe, it, expect, beforeEach } from 'vitest'
import { useConfigStore } from '@/store/configStore'
import { useSimulationStore } from '@/store/simulationStore'
import { usePlaybackStore } from '@/store/playbackStore'
import { runDCASimulation } from '@/lib/calculation/dcaEngine'
import type { SimulationResult, PricePoint, DividendHistory } from '@/lib/api/types'

describe('Simulation Flow Integration', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    // Reset all stores
    useConfigStore.getState().resetConfig()
    useSimulationStore.getState().clearAll()
    usePlaybackStore.getState().reset()
  })

  describe('config to simulation flow', () => {
    it('simulation store updates when primary result is set', () => {
      const mockResult: SimulationResult = {
        points: [
          { date: '2023-01-03', principal: 100, marketValue: 105, totalValue: 105, shares: 0.8, dividends: 0 },
        ],
        finalShares: 0.8,
        totalInvested: 100,
        totalDividends: 0,
        finalValue: 105,
        totalReturn: 5,
        cagr: 5,
      }

      useSimulationStore.getState().setPrimaryResult('AAPL', mockResult)

      const state = useSimulationStore.getState()
      expect(state.primary).not.toBeNull()
      expect(state.primary?.ticker).toBe('AAPL')
      expect(state.primary?.result.finalValue).toBe(105)
      expect(state.primary?.isLoading).toBe(false)
      expect(state.primary?.error).toBeNull()
    })

    it('loading state transitions correctly', () => {
      // Start loading
      useSimulationStore.getState().setPrimaryLoading('AAPL')
      expect(useSimulationStore.getState().primary?.isLoading).toBe(true)
      expect(useSimulationStore.getState().primary?.error).toBeNull()

      // Complete with result
      const mockResult: SimulationResult = {
        points: [],
        finalShares: 0,
        totalInvested: 0,
        totalDividends: 0,
        finalValue: 0,
        totalReturn: 0,
        cagr: 0,
      }

      useSimulationStore.getState().setPrimaryResult('AAPL', mockResult)
      expect(useSimulationStore.getState().primary?.isLoading).toBe(false)
    })

    it('error state transitions correctly', () => {
      // Start loading
      useSimulationStore.getState().setPrimaryLoading('INVALID')

      // Fail with error
      useSimulationStore.getState().setPrimaryError('INVALID', 'Ticker not found')

      const state = useSimulationStore.getState()
      expect(state.primary?.isLoading).toBe(false)
      expect(state.primary?.error).toBe('Ticker not found')
    })
  })

  describe('comparison ticker flow', () => {
    it('adds comparison result correctly', () => {
      const mockResult: SimulationResult = {
        points: [{ date: '2023-01-03', principal: 100, marketValue: 110, totalValue: 110, shares: 1, dividends: 0 }],
        finalShares: 1,
        totalInvested: 100,
        totalDividends: 0,
        finalValue: 110,
        totalReturn: 10,
        cagr: 10,
      }

      useSimulationStore.getState().addComparisonResult('MSFT', mockResult)

      const state = useSimulationStore.getState()
      expect(state.comparisons).toHaveLength(1)
      expect(state.comparisons[0].ticker).toBe('MSFT')
      expect(state.comparisons[0].result.finalValue).toBe(110)
    })

    it('handles multiple comparison tickers', () => {
      const result1: SimulationResult = {
        points: [],
        finalShares: 1,
        totalInvested: 100,
        totalDividends: 0,
        finalValue: 110,
        totalReturn: 10,
        cagr: 10,
      }

      const result2: SimulationResult = {
        points: [],
        finalShares: 2,
        totalInvested: 100,
        totalDividends: 5,
        finalValue: 120,
        totalReturn: 20,
        cagr: 20,
      }

      useSimulationStore.getState().addComparisonResult('MSFT', result1)
      useSimulationStore.getState().addComparisonResult('GOOGL', result2)

      const state = useSimulationStore.getState()
      expect(state.comparisons).toHaveLength(2)
      expect(state.comparisons.map(c => c.ticker)).toContain('MSFT')
      expect(state.comparisons.map(c => c.ticker)).toContain('GOOGL')
    })

    it('updates existing comparison result', () => {
      const initialResult: SimulationResult = {
        points: [],
        finalShares: 1,
        totalInvested: 100,
        totalDividends: 0,
        finalValue: 110,
        totalReturn: 10,
        cagr: 10,
      }

      const updatedResult: SimulationResult = {
        points: [],
        finalShares: 2,
        totalInvested: 200,
        totalDividends: 5,
        finalValue: 250,
        totalReturn: 25,
        cagr: 25,
      }

      useSimulationStore.getState().addComparisonResult('MSFT', initialResult)
      useSimulationStore.getState().addComparisonResult('MSFT', updatedResult) // Same ticker, should update

      const state = useSimulationStore.getState()
      expect(state.comparisons).toHaveLength(1)
      expect(state.comparisons[0].result.finalValue).toBe(250)
    })

    it('removes comparison correctly', () => {
      const result: SimulationResult = {
        points: [],
        finalShares: 1,
        totalInvested: 100,
        totalDividends: 0,
        finalValue: 110,
        totalReturn: 10,
        cagr: 10,
      }

      useSimulationStore.getState().addComparisonResult('MSFT', result)
      useSimulationStore.getState().addComparisonResult('GOOGL', result)
      useSimulationStore.getState().removeComparison('MSFT')

      const state = useSimulationStore.getState()
      expect(state.comparisons).toHaveLength(1)
      expect(state.comparisons[0].ticker).toBe('GOOGL')
    })

    it('comparison loading state works correctly', () => {
      useSimulationStore.getState().setComparisonLoading('MSFT')

      const state = useSimulationStore.getState()
      expect(state.comparisons).toHaveLength(1)
      expect(state.comparisons[0].isLoading).toBe(true)
    })

    it('comparison error state works correctly', () => {
      useSimulationStore.getState().setComparisonLoading('INVALID')
      useSimulationStore.getState().setComparisonError('INVALID', 'API error')

      const state = useSimulationStore.getState()
      expect(state.comparisons[0].error).toBe('API error')
      expect(state.comparisons[0].isLoading).toBe(false)
    })
  })

  describe('playback integration', () => {
    it('playback index can be set and retrieved', () => {
      usePlaybackStore.getState().setCurrentIndex(50)

      expect(usePlaybackStore.getState().currentIndex).toBe(50)
    })

    it('playback reset works correctly', () => {
      usePlaybackStore.getState().setCurrentIndex(75)
      usePlaybackStore.getState().setIsPlaying(true)
      usePlaybackStore.getState().reset()

      const state = usePlaybackStore.getState()
      expect(state.currentIndex).toBe(0)
      expect(state.isPlaying).toBe(false)
    })

    it('playback speed can be changed', () => {
      usePlaybackStore.getState().setSpeed(2)
      expect(usePlaybackStore.getState().speed).toBe(2)

      usePlaybackStore.getState().setSpeed(4)
      expect(usePlaybackStore.getState().speed).toBe(4)
    })

    it('playback isPlaying state toggles correctly', () => {
      usePlaybackStore.getState().setIsPlaying(true)
      expect(usePlaybackStore.getState().isPlaying).toBe(true)

      usePlaybackStore.getState().setIsPlaying(false)
      expect(usePlaybackStore.getState().isPlaying).toBe(false)
    })
  })

  describe('DCA calculation integration', () => {
    const mockPrices: PricePoint[] = [
      { date: '2023-01-03', open: 125, high: 127, low: 124, close: 126, volume: 1000000 },
      { date: '2023-01-10', open: 126, high: 129, low: 125, close: 128, volume: 1100000 },
      { date: '2023-01-17', open: 128, high: 131, low: 127, close: 130, volume: 1200000 },
      { date: '2023-01-24', open: 130, high: 133, low: 129, close: 132, volume: 1150000 },
      { date: '2023-01-31', open: 132, high: 135, low: 131, close: 134, volume: 1250000 },
      { date: '2023-02-07', open: 134, high: 137, low: 133, close: 136, volume: 1300000 },
      { date: '2023-02-14', open: 136, high: 139, low: 135, close: 138, volume: 1350000 },
      { date: '2023-02-21', open: 138, high: 141, low: 137, close: 140, volume: 1400000 },
      { date: '2023-02-28', open: 140, high: 143, low: 139, close: 142, volume: 1450000 },
      { date: '2023-03-07', open: 142, high: 145, low: 141, close: 144, volume: 1500000 },
    ]

    const mockDividends: DividendHistory[] = [
      // Use 2023-02-07 which exists in mockPrices - DCA engine only processes dividends on trading days
      { exDate: '2023-02-07', paymentDate: '2023-02-14', amount: 0.23, yield: 0.5 },
    ]

    it('simulation produces correct output structure', () => {
      const result = runDCASimulation(mockPrices, mockDividends, {
        amount: 100,
        frequency: 'weekly',
        startDate: '2023-01-01',
        isDRIP: true,
      })

      expect(result).toHaveProperty('points')
      expect(result).toHaveProperty('finalShares')
      expect(result).toHaveProperty('totalInvested')
      expect(result).toHaveProperty('totalDividends')
      expect(result).toHaveProperty('finalValue')
      expect(result).toHaveProperty('totalReturn')
      expect(result).toHaveProperty('cagr')
    })

    it('simulation accumulates investments over time', () => {
      const result = runDCASimulation(mockPrices, mockDividends, {
        amount: 100,
        frequency: 'weekly',
        startDate: '2023-01-01',
        isDRIP: false,
      })

      // Principal should increase over time
      const principals = result.points.map(p => p.principal)
      for (let i = 1; i < principals.length; i++) {
        expect(principals[i]).toBeGreaterThanOrEqual(principals[i - 1])
      }
    })

    it('DRIP reinvests dividends into shares', () => {
      const resultWithDRIP = runDCASimulation(mockPrices, mockDividends, {
        amount: 100,
        frequency: 'weekly',
        startDate: '2023-01-01',
        isDRIP: true,
      })

      const resultWithoutDRIP = runDCASimulation(mockPrices, mockDividends, {
        amount: 100,
        frequency: 'weekly',
        startDate: '2023-01-01',
        isDRIP: false,
      })

      // With DRIP, should have more shares (dividends reinvested)
      expect(resultWithDRIP.finalShares).toBeGreaterThanOrEqual(resultWithoutDRIP.finalShares)

      // Without DRIP, dividends accumulate separately
      expect(resultWithoutDRIP.points.some(p => p.dividends > 0)).toBe(true)
    })

    it('monthly frequency invests less frequently than weekly', () => {
      const weeklyResult = runDCASimulation(mockPrices, mockDividends, {
        amount: 100,
        frequency: 'weekly',
        startDate: '2023-01-01',
        isDRIP: true,
      })

      const monthlyResult = runDCASimulation(mockPrices, mockDividends, {
        amount: 100,
        frequency: 'monthly',
        startDate: '2023-01-01',
        isDRIP: true,
      })

      // Weekly invests more total over same period
      expect(weeklyResult.totalInvested).toBeGreaterThan(monthlyResult.totalInvested)
    })

    it('start date affects first investment', () => {
      const earlyResult = runDCASimulation(mockPrices, mockDividends, {
        amount: 100,
        frequency: 'monthly',
        startDate: '2023-01-01',
        isDRIP: true,
      })

      const lateResult = runDCASimulation(mockPrices, mockDividends, {
        amount: 100,
        frequency: 'monthly',
        startDate: '2023-02-01',
        isDRIP: true,
      })

      // Starting earlier means more investment opportunities
      expect(earlyResult.totalInvested).toBeGreaterThanOrEqual(lateResult.totalInvested)
    })
  })

  describe('full flow: config -> simulation -> store', () => {
    it('complete flow from config to simulation result', () => {
      // 1. Set config
      useConfigStore.getState().setTicker('AAPL')
      useConfigStore.getState().setAmount(100)
      useConfigStore.getState().setFrequency('monthly')
      useConfigStore.getState().setStartDate('2023-01-01')
      useConfigStore.getState().setIsDRIP(true)

      const configState = useConfigStore.getState()
      expect(configState.ticker).toBe('AAPL')
      expect(configState.amount).toBe(100)

      // 2. Simulate calculation (mock prices)
      const mockPrices: PricePoint[] = [
        { date: '2023-01-03', open: 100, high: 105, low: 99, close: 102, volume: 1000000 },
        { date: '2023-02-01', open: 102, high: 107, low: 101, close: 105, volume: 1100000 },
        { date: '2023-03-01', open: 105, high: 110, low: 104, close: 108, volume: 1200000 },
      ]

      const result = runDCASimulation(mockPrices, [], {
        amount: configState.amount,
        frequency: configState.frequency,
        startDate: configState.startDate,
        isDRIP: configState.isDRIP,
      })

      // 3. Store result
      useSimulationStore.getState().setPrimaryResult(configState.ticker, result)

      // 4. Verify end-to-end
      const simState = useSimulationStore.getState()
      expect(simState.primary?.ticker).toBe('AAPL')
      expect(simState.primary?.result.points.length).toBeGreaterThan(0)
      expect(simState.primary?.result.totalInvested).toBeGreaterThan(0)
    })
  })

  describe('store synchronization', () => {
    it('clearAll resets simulation state', () => {
      // Add some data
      const mockResult: SimulationResult = {
        points: [{ date: '2023-01-03', principal: 100, marketValue: 100, totalValue: 100, shares: 1, dividends: 0 }],
        finalShares: 1,
        totalInvested: 100,
        totalDividends: 0,
        finalValue: 100,
        totalReturn: 0,
        cagr: 0,
      }

      useSimulationStore.getState().setPrimaryResult('AAPL', mockResult)
      useSimulationStore.getState().addComparisonResult('MSFT', mockResult)

      expect(useSimulationStore.getState().primary).not.toBeNull()
      expect(useSimulationStore.getState().comparisons.length).toBeGreaterThan(0)

      // Clear all
      useSimulationStore.getState().clearAll()

      const state = useSimulationStore.getState()
      expect(state.primary).toBeNull()
      expect(state.comparisons).toHaveLength(0)
    })

    it('resetConfig returns to defaults', () => {
      // Change everything
      useConfigStore.getState().setTicker('NVDA')
      useConfigStore.getState().setAmount(999)
      useConfigStore.getState().setFrequency('weekly')
      useConfigStore.getState().setIsDRIP(false)
      useConfigStore.getState().addComparisonTicker('MSFT')

      // Reset
      useConfigStore.getState().resetConfig()

      const state = useConfigStore.getState()
      expect(state.ticker).toBe('AAPL')
      expect(state.amount).toBe(100)
      expect(state.frequency).toBe('monthly')
      expect(state.isDRIP).toBe(true)
      expect(state.comparisonTickers).toHaveLength(0)
    })
  })
})
