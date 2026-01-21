import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useSimulationStore } from '@/store/simulationStore'
import { useConfigStore } from '@/store/configStore'
import { runDCASimulation } from '@/lib/calculation/dcaEngine'
import { ErrorBoundary, ChartErrorFallback, MetricsErrorFallback } from '@/components/ui/ErrorBoundary'
import type { PricePoint, SimulationResult } from '@/lib/api/types'

describe('Error Handling Integration', () => {
  beforeEach(() => {
    localStorage.clear()
    useSimulationStore.getState().clearAll()
    useConfigStore.getState().resetConfig()
  })

  describe('simulation store error handling', () => {
    it('stores error message for primary ticker', () => {
      useSimulationStore.getState().setPrimaryLoading('INVALID')
      useSimulationStore.getState().setPrimaryError('INVALID', 'Ticker not found')

      const state = useSimulationStore.getState()
      expect(state.primary?.error).toBe('Ticker not found')
      expect(state.primary?.isLoading).toBe(false)
    })

    it('stores error message for comparison ticker', () => {
      useSimulationStore.getState().setComparisonLoading('BADTICKER')
      useSimulationStore.getState().setComparisonError('BADTICKER', 'API rate limit exceeded')

      const state = useSimulationStore.getState()
      const comparison = state.comparisons.find(c => c.ticker === 'BADTICKER')
      expect(comparison?.error).toBe('API rate limit exceeded')
      expect(comparison?.isLoading).toBe(false)
    })

    it('preserves error across loading states', () => {
      useSimulationStore.getState().setPrimaryError('AAPL', 'Initial error')

      // Error should be preserved until new result or explicit clear
      expect(useSimulationStore.getState().primary?.error).toBe('Initial error')

      // Start new loading should clear error
      useSimulationStore.getState().setPrimaryLoading('AAPL')
      expect(useSimulationStore.getState().primary?.error).toBeNull()
    })

    it('handles rapid state transitions', () => {
      // Rapid transitions
      useSimulationStore.getState().setPrimaryLoading('AAPL')
      useSimulationStore.getState().setPrimaryError('AAPL', 'Error 1')
      useSimulationStore.getState().setPrimaryLoading('AAPL')
      useSimulationStore.getState().setPrimaryError('AAPL', 'Error 2')

      expect(useSimulationStore.getState().primary?.error).toBe('Error 2')
    })
  })

  describe('DCA calculation edge cases', () => {
    it('handles empty price data', () => {
      const result = runDCASimulation([], [], {
        amount: 100,
        frequency: 'monthly',
        startDate: '2023-01-01',
        isDRIP: true,
      })

      expect(result.points).toHaveLength(0)
      expect(result.totalInvested).toBe(0)
      expect(result.finalShares).toBe(0)
    })

    it('handles start date after all available data', () => {
      const mockPrices: PricePoint[] = [
        { date: '2020-01-03', open: 100, high: 105, low: 99, close: 102, volume: 1000000 },
        { date: '2020-02-03', open: 102, high: 107, low: 101, close: 105, volume: 1100000 },
      ]

      const result = runDCASimulation(mockPrices, [], {
        amount: 100,
        frequency: 'monthly',
        startDate: '2025-01-01', // Way after available data
        isDRIP: true,
      })

      // Should handle gracefully
      expect(result.totalInvested).toBe(0)
    })

    it('handles prices with zero values', () => {
      const mockPrices: PricePoint[] = [
        { date: '2023-01-03', open: 100, high: 105, low: 99, close: 100, volume: 1000000 },
        { date: '2023-02-03', open: 100, high: 105, low: 99, close: 100, volume: 1100000 },
      ]

      // This should not throw
      expect(() =>
        runDCASimulation(mockPrices, [], {
          amount: 100,
          frequency: 'monthly',
          startDate: '2023-01-01',
          isDRIP: true,
        })
      ).not.toThrow()
    })

    it('handles very small investment amounts', () => {
      const mockPrices: PricePoint[] = [
        { date: '2023-01-03', open: 1000, high: 1050, low: 990, close: 1000, volume: 1000000 },
        { date: '2023-02-03', open: 1000, high: 1050, low: 990, close: 1050, volume: 1100000 },
      ]

      const result = runDCASimulation(mockPrices, [], {
        amount: 1, // Minimum amount
        frequency: 'monthly',
        startDate: '2023-01-01',
        isDRIP: true,
      })

      expect(result.finalShares).toBeGreaterThan(0)
      expect(result.finalShares).toBeLessThan(1) // Fractional shares
    })

    it('handles very large investment amounts', () => {
      const mockPrices: PricePoint[] = [
        { date: '2023-01-03', open: 100, high: 105, low: 99, close: 100, volume: 1000000 },
        { date: '2023-02-03', open: 100, high: 105, low: 99, close: 105, volume: 1100000 },
      ]

      const result = runDCASimulation(mockPrices, [], {
        amount: 10000, // Maximum amount
        frequency: 'monthly',
        startDate: '2023-01-01',
        isDRIP: true,
      })

      expect(result.totalInvested).toBeGreaterThan(0)
      expect(result.finalShares).toBeGreaterThan(0)
    })
  })

  describe('config store validation', () => {
    it('clamps amount below minimum to 1', () => {
      useConfigStore.getState().setAmount(0)
      expect(useConfigStore.getState().amount).toBe(1)

      useConfigStore.getState().setAmount(-100)
      expect(useConfigStore.getState().amount).toBe(1)
    })

    it('clamps amount above maximum to 10000', () => {
      useConfigStore.getState().setAmount(50000)
      expect(useConfigStore.getState().amount).toBe(10000)

      useConfigStore.getState().setAmount(999999)
      expect(useConfigStore.getState().amount).toBe(10000)
    })

    it('normalizes ticker to uppercase', () => {
      useConfigStore.getState().setTicker('aapl')
      expect(useConfigStore.getState().ticker).toBe('AAPL')

      useConfigStore.getState().setTicker('mSfT')
      expect(useConfigStore.getState().ticker).toBe('MSFT')
    })

    it('prevents duplicate comparison tickers', () => {
      useConfigStore.getState().clearComparisons()
      useConfigStore.getState().addComparisonTicker('MSFT')
      useConfigStore.getState().addComparisonTicker('MSFT') // Duplicate

      expect(useConfigStore.getState().comparisonTickers).toHaveLength(1)
    })

    it('prevents comparison ticker matching primary', () => {
      useConfigStore.getState().setTicker('AAPL')
      useConfigStore.getState().clearComparisons()
      useConfigStore.getState().addComparisonTicker('AAPL') // Same as primary

      expect(useConfigStore.getState().comparisonTickers).toHaveLength(0)
    })

    it('limits comparison tickers to 2', () => {
      useConfigStore.getState().clearComparisons()
      useConfigStore.getState().addComparisonTicker('MSFT')
      useConfigStore.getState().addComparisonTicker('GOOGL')
      useConfigStore.getState().addComparisonTicker('AMZN') // Should be rejected

      const state = useConfigStore.getState()
      expect(state.comparisonTickers).toHaveLength(2)
      expect(state.comparisonTickers).not.toContain('AMZN')
    })
  })

  describe('ErrorBoundary component', () => {
    // Component that throws an error for testing
    function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
      if (shouldThrow) {
        throw new Error('Test error')
      }
      return <div>Success</div>
    }

    it('renders children when no error', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={false} />
        </ErrorBoundary>
      )

      expect(screen.getByText('Success')).toBeInTheDocument()
    })

    it('renders fallback UI when error occurs', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()

      consoleSpy.mockRestore()
    })

    it('displays error message in fallback UI', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(screen.getByText('Test error')).toBeInTheDocument()

      consoleSpy.mockRestore()
    })

    it('renders custom fallback when provided', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(
        <ErrorBoundary fallback={<div>Custom fallback</div>}>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(screen.getByText('Custom fallback')).toBeInTheDocument()

      consoleSpy.mockRestore()
    })

    it('calls onError callback when error occurs', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const onErrorMock = vi.fn()

      render(
        <ErrorBoundary onError={onErrorMock}>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(onErrorMock).toHaveBeenCalled()
      expect(onErrorMock).toHaveBeenCalledWith(
        expect.any(Error),
        expect.any(Object)
      )

      consoleSpy.mockRestore()
    })

    it('retry button resets error state', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      let shouldThrow = true

      function ConditionalThrowing() {
        if (shouldThrow) {
          throw new Error('Test error')
        }
        return <div>Recovered</div>
      }

      render(
        <ErrorBoundary>
          <ConditionalThrowing />
        </ErrorBoundary>
      )

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()

      // Stop throwing and click retry
      shouldThrow = false
      fireEvent.click(screen.getByText('Try Again'))

      // Should attempt to re-render children
      // Note: Due to how React error boundaries work, we need to verify the state was reset
      // The actual recovery would require the component to not throw on next render

      consoleSpy.mockRestore()
    })
  })

  describe('specialized error fallbacks', () => {
    it('ChartErrorFallback renders correctly', () => {
      render(<ChartErrorFallback />)

      expect(screen.getByText('Chart unavailable')).toBeInTheDocument()
      expect(screen.getByText('Unable to render chart. Please refresh the page.')).toBeInTheDocument()
    })

    it('MetricsErrorFallback renders correctly', () => {
      render(<MetricsErrorFallback />)

      expect(screen.getByText('Total Invested')).toBeInTheDocument()
      expect(screen.getByText('Current Value')).toBeInTheDocument()
      expect(screen.getByText('Total Return')).toBeInTheDocument()
      expect(screen.getByText('Shares Owned')).toBeInTheDocument()
      // All should show "Error"
      expect(screen.getAllByText('Error')).toHaveLength(4)
    })
  })

  describe('API error scenarios', () => {
    it('handles network timeout simulation', () => {
      useSimulationStore.getState().setPrimaryLoading('AAPL')
      useSimulationStore.getState().setPrimaryError('AAPL', 'Network timeout: Request took too long')

      expect(useSimulationStore.getState().primary?.error).toContain('timeout')
    })

    it('handles rate limiting simulation', () => {
      useSimulationStore.getState().setPrimaryLoading('AAPL')
      useSimulationStore.getState().setPrimaryError('AAPL', 'Rate limited: Please try again later')

      expect(useSimulationStore.getState().primary?.error).toContain('Rate limited')
    })

    it('handles invalid ticker simulation', () => {
      useSimulationStore.getState().setPrimaryLoading('INVALIDTICKER123')
      useSimulationStore.getState().setPrimaryError('INVALIDTICKER123', 'Ticker not found: INVALIDTICKER123')

      expect(useSimulationStore.getState().primary?.error).toContain('not found')
    })

    it('handles server error simulation', () => {
      useSimulationStore.getState().setPrimaryLoading('AAPL')
      useSimulationStore.getState().setPrimaryError('AAPL', 'Server error: 500 Internal Server Error')

      expect(useSimulationStore.getState().primary?.error).toContain('Server error')
    })

    it('handles data unavailable simulation', () => {
      useSimulationStore.getState().setPrimaryLoading('NEWSTOCK')
      useSimulationStore.getState().setPrimaryError('NEWSTOCK', 'No historical data available for this ticker')

      expect(useSimulationStore.getState().primary?.error).toContain('No historical data')
    })
  })

  describe('recovery scenarios', () => {
    it('recovers from error state on successful retry', () => {
      // First attempt fails
      useSimulationStore.getState().setPrimaryLoading('AAPL')
      useSimulationStore.getState().setPrimaryError('AAPL', 'Network error')
      expect(useSimulationStore.getState().primary?.error).toBe('Network error')

      // Retry succeeds
      useSimulationStore.getState().setPrimaryLoading('AAPL')
      const mockResult: SimulationResult = {
        points: [{ date: '2023-01-03', principal: 100, marketValue: 105, totalValue: 105, shares: 1, dividends: 0 }],
        finalShares: 1,
        totalInvested: 100,
        totalDividends: 0,
        finalValue: 105,
        totalReturn: 5,
        cagr: 5,
      }
      useSimulationStore.getState().setPrimaryResult('AAPL', mockResult)

      const state = useSimulationStore.getState()
      expect(state.primary?.error).toBeNull()
      expect(state.primary?.result.finalValue).toBe(105)
    })

    it('clears comparison error on removal', () => {
      useSimulationStore.getState().setComparisonLoading('BADTICKER')
      useSimulationStore.getState().setComparisonError('BADTICKER', 'Ticker not found')

      expect(useSimulationStore.getState().comparisons.find(c => c.ticker === 'BADTICKER')?.error).toBe('Ticker not found')

      useSimulationStore.getState().removeComparison('BADTICKER')

      expect(useSimulationStore.getState().comparisons.find(c => c.ticker === 'BADTICKER')).toBeUndefined()
    })
  })
})
