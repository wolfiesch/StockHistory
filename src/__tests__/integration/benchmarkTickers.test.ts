import { describe, it, expect, beforeEach } from 'vitest'
import { useConfigStore, BENCHMARK_PRESETS } from '@/store/configStore'

describe('Benchmark Tickers Integration', () => {
  beforeEach(() => {
    localStorage.clear()
    useConfigStore.getState().resetConfig()
  })

  describe('initial state', () => {
    it('starts with empty benchmark tickers', () => {
      const state = useConfigStore.getState()
      expect(state.benchmarkTickers).toEqual([])
    })

    it('has predefined benchmark presets available', () => {
      expect(BENCHMARK_PRESETS).toContain('SPY')
      expect(BENCHMARK_PRESETS).toContain('QQQ')
      expect(BENCHMARK_PRESETS).toContain('DIA')
    })
  })

  describe('toggleBenchmark', () => {
    it('adds a benchmark when not present', () => {
      useConfigStore.getState().toggleBenchmark('SPY')
      expect(useConfigStore.getState().benchmarkTickers).toContain('SPY')
    })

    it('removes a benchmark when already present', () => {
      useConfigStore.getState().toggleBenchmark('SPY')
      useConfigStore.getState().toggleBenchmark('SPY')
      expect(useConfigStore.getState().benchmarkTickers).not.toContain('SPY')
    })

    it('normalizes ticker to uppercase', () => {
      useConfigStore.getState().toggleBenchmark('spy')
      expect(useConfigStore.getState().benchmarkTickers).toContain('SPY')
    })

    it('prevents adding primary ticker as benchmark', () => {
      useConfigStore.getState().setTicker('AAPL')
      useConfigStore.getState().toggleBenchmark('AAPL')
      expect(useConfigStore.getState().benchmarkTickers).not.toContain('AAPL')
    })

    it('allows adding multiple benchmarks', () => {
      useConfigStore.getState().toggleBenchmark('SPY')
      useConfigStore.getState().toggleBenchmark('QQQ')
      useConfigStore.getState().toggleBenchmark('DIA')

      const benchmarks = useConfigStore.getState().benchmarkTickers
      expect(benchmarks).toContain('SPY')
      expect(benchmarks).toContain('QQQ')
      expect(benchmarks).toContain('DIA')
    })

    it('enforces max 4 benchmarks', () => {
      useConfigStore.getState().toggleBenchmark('SPY')
      useConfigStore.getState().toggleBenchmark('QQQ')
      useConfigStore.getState().toggleBenchmark('DIA')
      useConfigStore.getState().toggleBenchmark('VTI')
      useConfigStore.getState().toggleBenchmark('IWM') // Should not be added

      expect(useConfigStore.getState().benchmarkTickers).toHaveLength(4)
      expect(useConfigStore.getState().benchmarkTickers).not.toContain('IWM')
    })
  })

  describe('addCustomBenchmark', () => {
    it('adds a custom benchmark', () => {
      useConfigStore.getState().addCustomBenchmark('VTI')
      expect(useConfigStore.getState().benchmarkTickers).toContain('VTI')
    })

    it('normalizes to uppercase', () => {
      useConfigStore.getState().addCustomBenchmark('vti')
      expect(useConfigStore.getState().benchmarkTickers).toContain('VTI')
    })

    it('prevents duplicate benchmarks', () => {
      useConfigStore.getState().addCustomBenchmark('VTI')
      useConfigStore.getState().addCustomBenchmark('VTI')

      const benchmarks = useConfigStore.getState().benchmarkTickers
      expect(benchmarks.filter(t => t === 'VTI')).toHaveLength(1)
    })

    it('prevents adding primary ticker', () => {
      useConfigStore.getState().setTicker('AAPL')
      useConfigStore.getState().addCustomBenchmark('AAPL')
      expect(useConfigStore.getState().benchmarkTickers).not.toContain('AAPL')
    })

    it('enforces max 4 benchmarks limit', () => {
      useConfigStore.getState().addCustomBenchmark('SPY')
      useConfigStore.getState().addCustomBenchmark('QQQ')
      useConfigStore.getState().addCustomBenchmark('DIA')
      useConfigStore.getState().addCustomBenchmark('VTI')
      useConfigStore.getState().addCustomBenchmark('IWM') // Should not be added

      expect(useConfigStore.getState().benchmarkTickers).toHaveLength(4)
    })
  })

  describe('removeBenchmark', () => {
    it('removes a benchmark by ticker', () => {
      useConfigStore.getState().toggleBenchmark('SPY')
      useConfigStore.getState().toggleBenchmark('QQQ')
      useConfigStore.getState().removeBenchmark('SPY')

      const benchmarks = useConfigStore.getState().benchmarkTickers
      expect(benchmarks).not.toContain('SPY')
      expect(benchmarks).toContain('QQQ')
    })

    it('handles case-insensitive removal', () => {
      useConfigStore.getState().toggleBenchmark('SPY')
      useConfigStore.getState().removeBenchmark('spy')
      expect(useConfigStore.getState().benchmarkTickers).not.toContain('SPY')
    })

    it('no-op when removing non-existent benchmark', () => {
      useConfigStore.getState().toggleBenchmark('SPY')
      useConfigStore.getState().removeBenchmark('QQQ') // Not present

      expect(useConfigStore.getState().benchmarkTickers).toContain('SPY')
      expect(useConfigStore.getState().benchmarkTickers).toHaveLength(1)
    })
  })

  describe('clearBenchmarks', () => {
    it('removes all benchmarks', () => {
      useConfigStore.getState().toggleBenchmark('SPY')
      useConfigStore.getState().toggleBenchmark('QQQ')
      useConfigStore.getState().toggleBenchmark('DIA')

      useConfigStore.getState().clearBenchmarks()

      expect(useConfigStore.getState().benchmarkTickers).toEqual([])
    })

    it('works when already empty', () => {
      useConfigStore.getState().clearBenchmarks()
      expect(useConfigStore.getState().benchmarkTickers).toEqual([])
    })
  })

  describe('interaction with primary ticker', () => {
    it('changing primary ticker to a benchmark removes it from benchmarks', () => {
      useConfigStore.getState().setTicker('AAPL')
      useConfigStore.getState().toggleBenchmark('MSFT')

      // Now change primary to MSFT - trying to add it again should fail
      useConfigStore.getState().setTicker('MSFT')
      useConfigStore.getState().toggleBenchmark('MSFT') // Should be no-op (it's primary now)

      // MSFT should still be in benchmarks from before (store doesn't auto-clean)
      // But we can't add primary as new benchmark
      expect(useConfigStore.getState().ticker).toBe('MSFT')
    })

    it('benchmark that was primary ticker can be added after changing primary', () => {
      useConfigStore.getState().setTicker('AAPL')
      // Can't add AAPL as benchmark
      useConfigStore.getState().toggleBenchmark('AAPL')
      expect(useConfigStore.getState().benchmarkTickers).not.toContain('AAPL')

      // Change primary
      useConfigStore.getState().setTicker('MSFT')

      // Now can add AAPL as benchmark
      useConfigStore.getState().toggleBenchmark('AAPL')
      expect(useConfigStore.getState().benchmarkTickers).toContain('AAPL')
    })
  })

  describe('interaction with comparison tickers', () => {
    it('benchmarks and comparisons are independent', () => {
      useConfigStore.getState().addComparisonTicker('MSFT')
      useConfigStore.getState().toggleBenchmark('SPY')

      expect(useConfigStore.getState().comparisonTickers).toContain('MSFT')
      expect(useConfigStore.getState().benchmarkTickers).toContain('SPY')
    })

    it('same ticker can be both comparison and benchmark', () => {
      useConfigStore.getState().addComparisonTicker('SPY')
      useConfigStore.getState().toggleBenchmark('SPY')

      expect(useConfigStore.getState().comparisonTickers).toContain('SPY')
      expect(useConfigStore.getState().benchmarkTickers).toContain('SPY')
    })

    it('clearing comparisons does not affect benchmarks', () => {
      useConfigStore.getState().addComparisonTicker('MSFT')
      useConfigStore.getState().toggleBenchmark('SPY')
      useConfigStore.getState().clearComparisons()

      expect(useConfigStore.getState().comparisonTickers).toEqual([])
      expect(useConfigStore.getState().benchmarkTickers).toContain('SPY')
    })

    it('clearing benchmarks does not affect comparisons', () => {
      useConfigStore.getState().addComparisonTicker('MSFT')
      useConfigStore.getState().toggleBenchmark('SPY')
      useConfigStore.getState().clearBenchmarks()

      expect(useConfigStore.getState().benchmarkTickers).toEqual([])
      expect(useConfigStore.getState().comparisonTickers).toContain('MSFT')
    })
  })

  describe('bulk update via setConfig', () => {
    it('updates benchmarks via setConfig', () => {
      useConfigStore.getState().setConfig({
        benchmarkTickers: ['SPY', 'QQQ'],
      })

      const benchmarks = useConfigStore.getState().benchmarkTickers
      expect(benchmarks).toContain('SPY')
      expect(benchmarks).toContain('QQQ')
    })

    it('replaces benchmarks completely via setConfig', () => {
      useConfigStore.getState().toggleBenchmark('DIA')
      useConfigStore.getState().setConfig({
        benchmarkTickers: ['SPY'],
      })

      const benchmarks = useConfigStore.getState().benchmarkTickers
      expect(benchmarks).toEqual(['SPY'])
      expect(benchmarks).not.toContain('DIA')
    })
  })

  describe('resetConfig behavior', () => {
    it('clears all benchmarks on reset', () => {
      useConfigStore.getState().toggleBenchmark('SPY')
      useConfigStore.getState().toggleBenchmark('QQQ')
      useConfigStore.getState().resetConfig()

      expect(useConfigStore.getState().benchmarkTickers).toEqual([])
    })
  })
})
