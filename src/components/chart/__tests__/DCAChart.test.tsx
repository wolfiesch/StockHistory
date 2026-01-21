import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock lightweight-charts (requires browser APIs not available in jsdom)
vi.mock('lightweight-charts', () => ({
  createChart: vi.fn(() => ({
    addSeries: vi.fn(() => ({
      setData: vi.fn(),
    })),
    subscribeCrosshairMove: vi.fn(),
    unsubscribeCrosshairMove: vi.fn(),
    timeScale: vi.fn(() => ({
      fitContent: vi.fn(),
      setVisibleRange: vi.fn(),
    })),
    applyOptions: vi.fn(),
    remove: vi.fn(),
  })),
  ColorType: { Solid: 'solid' },
  CrosshairMode: { Normal: 0 },
  AreaSeries: {},
}))

import { DCAChart } from '../DCAChart'

// Mock the stores
const mockPrimary = {
  isLoading: false,
  error: null,
  result: {
    points: [
      { date: '2023-01-01', principal: 100, marketValue: 110, dividends: 0, shares: 10 },
      { date: '2023-02-01', principal: 200, marketValue: 230, dividends: 5, shares: 20 },
      { date: '2023-03-01', principal: 300, marketValue: 280, dividends: 10, shares: 30 }, // Loss scenario
    ],
    totalInvested: 300,
    finalShares: 30,
    finalValue: 280,
    totalDividends: 10,
    totalReturn: -6.67,
    cagr: -2.5,
  },
}

vi.mock('@/store/simulationStore', () => ({
  useSimulationStore: vi.fn(() => ({ primary: null })),
}))

vi.mock('@/store/playbackStore', () => ({
  usePlaybackStore: vi.fn(() => ({ currentIndex: 2 })),
}))

// Import mocked stores to control them
import { useSimulationStore } from '@/store/simulationStore'
import { usePlaybackStore } from '@/store/playbackStore'

const mockUseSimulationStore = vi.mocked(useSimulationStore)
const mockUsePlaybackStore = vi.mocked(usePlaybackStore)

describe('DCAChart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('hooks rules compliance', () => {
    it('renders without hook violations when primary is null', () => {
      mockUseSimulationStore.mockReturnValue({ primary: null })
      mockUsePlaybackStore.mockReturnValue({ currentIndex: 0 })

      // This would throw "Rendered more hooks than during the previous render"
      // if hooks are placed after early returns
      expect(() => render(<DCAChart />)).not.toThrow()
      expect(screen.getByText('Enter a ticker to start')).toBeInTheDocument()
    })

    it('renders without hook violations when loading', () => {
      mockUseSimulationStore.mockReturnValue({
        primary: { isLoading: true, error: null, result: null },
      })
      mockUsePlaybackStore.mockReturnValue({ currentIndex: 0 })

      expect(() => render(<DCAChart />)).not.toThrow()
    })

    it('renders without hook violations when error', () => {
      mockUseSimulationStore.mockReturnValue({
        primary: { isLoading: false, error: 'Test error', result: null },
      })
      mockUsePlaybackStore.mockReturnValue({ currentIndex: 0 })

      expect(() => render(<DCAChart />)).not.toThrow()
      expect(screen.getByText('Test error')).toBeInTheDocument()
    })

    it('renders without hook violations with data', () => {
      mockUseSimulationStore.mockReturnValue({ primary: mockPrimary })
      mockUsePlaybackStore.mockReturnValue({ currentIndex: 2 })

      expect(() => render(<DCAChart />)).not.toThrow()
    })

    it('handles state transitions without hook violations', () => {
      // Start with null
      mockUseSimulationStore.mockReturnValue({ primary: null })
      mockUsePlaybackStore.mockReturnValue({ currentIndex: 0 })

      const { rerender } = render(<DCAChart />)
      expect(screen.getByText('Enter a ticker to start')).toBeInTheDocument()

      // Transition to loading
      mockUseSimulationStore.mockReturnValue({
        primary: { isLoading: true, error: null, result: null },
      })
      expect(() => rerender(<DCAChart />)).not.toThrow()

      // Transition to data
      mockUseSimulationStore.mockReturnValue({ primary: mockPrimary })
      mockUsePlaybackStore.mockReturnValue({ currentIndex: 2 })
      expect(() => rerender(<DCAChart />)).not.toThrow()

      // Transition back to error
      mockUseSimulationStore.mockReturnValue({
        primary: { isLoading: false, error: 'Connection failed', result: null },
      })
      expect(() => rerender(<DCAChart />)).not.toThrow()
      expect(screen.getByText('Connection failed')).toBeInTheDocument()
    })
  })

  describe('empty data handling', () => {
    it('shows message when visible data is empty', () => {
      mockUseSimulationStore.mockReturnValue({
        primary: {
          isLoading: false,
          error: null,
          result: { points: [] },
        },
      })
      mockUsePlaybackStore.mockReturnValue({ currentIndex: 0 })

      render(<DCAChart />)
      expect(screen.getByText('No data available for this period')).toBeInTheDocument()
    })
  })
})
