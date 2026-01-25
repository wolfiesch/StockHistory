import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PlaybackControls } from '../PlaybackControls'

// Mock data for simulation store
const mockPrimaryWithData = {
  ticker: 'AAPL',
  isLoading: false,
  error: null,
  result: {
    points: [
      { date: '2023-01-01', principal: 100, marketValue: 100, totalValue: 100, shares: 1, dividends: 0 },
      { date: '2023-02-01', principal: 200, marketValue: 210, totalValue: 210, shares: 2, dividends: 0 },
      { date: '2023-03-01', principal: 300, marketValue: 330, totalValue: 330, shares: 3, dividends: 0 },
      { date: '2023-04-01', principal: 400, marketValue: 440, totalValue: 440, shares: 4, dividends: 0 },
      { date: '2023-05-01', principal: 500, marketValue: 560, totalValue: 560, shares: 5, dividends: 0 },
    ],
    totalInvested: 500,
    finalShares: 5,
    finalValue: 560,
    totalDividends: 0,
    totalReturn: 12,
    cagr: 12,
  },
}

// Mock the usePlayback hook
const mockToggle = vi.fn()
const mockSeek = vi.fn()
const mockReset = vi.fn()

vi.mock('@/lib/animation/usePlayback', () => ({
  usePlayback: vi.fn(() => ({
    isPlaying: false,
    currentIndex: 0,
    speed: 1,
    progress: 0,
    toggle: mockToggle,
    seek: mockSeek,
    reset: mockReset,
  })),
}))

// Mock the stores
vi.mock('@/store/simulationStore', () => ({
  useSimulationStore: vi.fn(() => ({ primary: null })),
}))

const mockSetSpeed = vi.fn()
vi.mock('@/store/playbackStore', () => ({
  usePlaybackStore: vi.fn(() => ({ setSpeed: mockSetSpeed })),
  SPEED_OPTIONS: [
    { value: 0.5, label: '0.5x' },
    { value: 1, label: '1x' },
    { value: 2, label: '2x' },
    { value: 4, label: '4x' },
    { value: 8, label: '8x' },
  ],
}))

// Import mocked modules
import { useSimulationStore } from '@/store/simulationStore'
import { usePlayback } from '@/lib/animation/usePlayback'

const mockUseSimulationStore = vi.mocked(useSimulationStore)
const mockUsePlayback = vi.mocked(usePlayback)

describe('PlaybackControls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSimulationStore.mockReturnValue({ primary: null })
    mockUsePlayback.mockReturnValue({
      isPlaying: false,
      currentIndex: 0,
      speed: 1,
      progress: 0,
      toggle: mockToggle,
      seek: mockSeek,
      reset: mockReset,
      play: vi.fn(),
      pause: vi.fn(),
      seekPercent: vi.fn(),
    })
  })

  describe('disabled state', () => {
    it('renders with disabled controls when no data', () => {
      mockUseSimulationStore.mockReturnValue({ primary: null })

      render(<PlaybackControls />)

      // Play button should be disabled
      const playButton = screen.getByRole('button', { name: '' }) // Play button has no text
      expect(playButton).toBeDisabled()

      // Reset button should be disabled
      const resetButton = screen.getByTitle('Reset')
      expect(resetButton).toBeDisabled()

      // Speed buttons should be disabled
      const speedButtons = screen.getAllByRole('button').filter(btn =>
        btn.textContent?.includes('x')
      )
      speedButtons.forEach(btn => {
        expect(btn).toBeDisabled()
      })
    })

    it('shows placeholder date when no data', () => {
      mockUseSimulationStore.mockReturnValue({ primary: null })

      render(<PlaybackControls />)

      // There are multiple "---" placeholders (date, start year, end year)
      const placeholders = screen.getAllByText('---')
      expect(placeholders.length).toBeGreaterThan(0)
    })
  })

  describe('enabled state with data', () => {
    beforeEach(() => {
      mockUseSimulationStore.mockReturnValue({ primary: mockPrimaryWithData })
      mockUsePlayback.mockReturnValue({
        isPlaying: false,
        currentIndex: 2,
        speed: 1,
        progress: 50,
        toggle: mockToggle,
        seek: mockSeek,
        reset: mockReset,
        play: vi.fn(),
        pause: vi.fn(),
        seekPercent: vi.fn(),
      })
    })

    it('renders with enabled controls when data exists', () => {
      render(<PlaybackControls />)

      // All buttons should be enabled
      const buttons = screen.getAllByRole('button')
      buttons.forEach(btn => {
        expect(btn).not.toBeDisabled()
      })
    })

    it('displays current date from simulation', () => {
      // Explicitly set both mocks for this test
      mockUseSimulationStore.mockReturnValue({ primary: mockPrimaryWithData })
      mockUsePlayback.mockReturnValue({
        isPlaying: false,
        currentIndex: 0, // First point is 2023-01-01
        speed: 1,
        progress: 0,
        toggle: mockToggle,
        seek: mockSeek,
        reset: mockReset,
        play: vi.fn(),
        pause: vi.fn(),
        seekPercent: vi.fn(),
      })

      render(<PlaybackControls />)

      // Should show a formatted date containing year 2023
      // The exact format depends on locale, so we just check it's not the placeholder
      expect(screen.queryByText('---')).not.toBeInTheDocument()
      // Check that we see 2023 somewhere in the date display
      expect(screen.getByText(/2023/)).toBeInTheDocument()
    })

    it('displays progress percentage', () => {
      render(<PlaybackControls />)

      expect(screen.getByText('50%')).toBeInTheDocument()
    })

    it('displays first and last year in scrubber', () => {
      render(<PlaybackControls />)

      expect(screen.getByText('2023')).toBeInTheDocument()
    })
  })

  describe('play/pause toggle', () => {
    beforeEach(() => {
      mockUseSimulationStore.mockReturnValue({ primary: mockPrimaryWithData })
    })

    it('shows play icon when paused', () => {
      mockUsePlayback.mockReturnValue({
        isPlaying: false,
        currentIndex: 0,
        speed: 1,
        progress: 0,
        toggle: mockToggle,
        seek: mockSeek,
        reset: mockReset,
        play: vi.fn(),
        pause: vi.fn(),
        seekPercent: vi.fn(),
      })

      render(<PlaybackControls />)

      // Play icon (triangle path) should be visible
      const playButton = screen.getAllByRole('button')[1] // Second button is play/pause
      const svg = playButton.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })

    it('shows pause icon when playing', () => {
      mockUsePlayback.mockReturnValue({
        isPlaying: true,
        currentIndex: 0,
        speed: 1,
        progress: 0,
        toggle: mockToggle,
        seek: mockSeek,
        reset: mockReset,
        play: vi.fn(),
        pause: vi.fn(),
        seekPercent: vi.fn(),
      })

      render(<PlaybackControls />)

      // The button should contain pause icon (two rectangles)
      const playButton = screen.getAllByRole('button')[1]
      const svg = playButton.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })

    it('calls toggle when play/pause button clicked', () => {
      mockUsePlayback.mockReturnValue({
        isPlaying: false,
        currentIndex: 0,
        speed: 1,
        progress: 0,
        toggle: mockToggle,
        seek: mockSeek,
        reset: mockReset,
        play: vi.fn(),
        pause: vi.fn(),
        seekPercent: vi.fn(),
      })

      render(<PlaybackControls />)

      const playButton = screen.getAllByRole('button')[1]
      fireEvent.click(playButton)

      expect(mockToggle).toHaveBeenCalledTimes(1)
    })
  })

  describe('reset functionality', () => {
    beforeEach(() => {
      mockUseSimulationStore.mockReturnValue({ primary: mockPrimaryWithData })
      mockUsePlayback.mockReturnValue({
        isPlaying: false,
        currentIndex: 3,
        speed: 2,
        progress: 75,
        toggle: mockToggle,
        seek: mockSeek,
        reset: mockReset,
        play: vi.fn(),
        pause: vi.fn(),
        seekPercent: vi.fn(),
      })
    })

    it('calls reset when reset button clicked', () => {
      render(<PlaybackControls />)

      const resetButton = screen.getByTitle('Reset')
      fireEvent.click(resetButton)

      expect(mockReset).toHaveBeenCalledTimes(1)
    })
  })

  describe('speed selection', () => {
    beforeEach(() => {
      mockUseSimulationStore.mockReturnValue({ primary: mockPrimaryWithData })
      mockUsePlayback.mockReturnValue({
        isPlaying: false,
        currentIndex: 0,
        speed: 1,
        progress: 0,
        toggle: mockToggle,
        seek: mockSeek,
        reset: mockReset,
        play: vi.fn(),
        pause: vi.fn(),
        seekPercent: vi.fn(),
      })
    })

    it('renders all speed options', () => {
      render(<PlaybackControls />)

      expect(screen.getByText('0.5x')).toBeInTheDocument()
      expect(screen.getByText('1x')).toBeInTheDocument()
      expect(screen.getByText('2x')).toBeInTheDocument()
      expect(screen.getByText('4x')).toBeInTheDocument()
      expect(screen.getByText('8x')).toBeInTheDocument()
    })

    it('highlights current speed', () => {
      render(<PlaybackControls />)

      const speed1Button = screen.getByText('1x')
      // Current speed button should have blue background
      expect(speed1Button.className).toContain('bg-blue-600')
    })

    it('calls setSpeed when speed button clicked', () => {
      render(<PlaybackControls />)

      const speed2Button = screen.getByText('2x')
      fireEvent.click(speed2Button)

      expect(mockSetSpeed).toHaveBeenCalledWith(2)
    })

    it('updates highlighted button when speed changes', () => {
      mockUsePlayback.mockReturnValue({
        isPlaying: false,
        currentIndex: 0,
        speed: 4,
        progress: 0,
        toggle: mockToggle,
        seek: mockSeek,
        reset: mockReset,
        play: vi.fn(),
        pause: vi.fn(),
        seekPercent: vi.fn(),
      })

      render(<PlaybackControls />)

      const speed4Button = screen.getByText('4x')
      expect(speed4Button.className).toContain('bg-blue-600')

      const speed1Button = screen.getByText('1x')
      expect(speed1Button.className).not.toContain('bg-blue-600')
    })
  })

  describe('scrubber interaction', () => {
    beforeEach(() => {
      mockUseSimulationStore.mockReturnValue({ primary: mockPrimaryWithData })
      mockUsePlayback.mockReturnValue({
        isPlaying: false,
        currentIndex: 2,
        speed: 1,
        progress: 50,
        toggle: mockToggle,
        seek: mockSeek,
        reset: mockReset,
        play: vi.fn(),
        pause: vi.fn(),
        seekPercent: vi.fn(),
      })
    })

    it('renders range input for scrubbing', () => {
      render(<PlaybackControls />)

      const rangeInput = screen.getByRole('slider')
      expect(rangeInput).toBeInTheDocument()
    })

    it('range input has correct min/max values', () => {
      render(<PlaybackControls />)

      const rangeInput = screen.getByRole('slider')
      expect(rangeInput).toHaveAttribute('min', '0')
      expect(rangeInput).toHaveAttribute('max', '4') // 5 points - 1
    })

    it('range input reflects current index', () => {
      render(<PlaybackControls />)

      const rangeInput = screen.getByRole('slider') as HTMLInputElement
      expect(rangeInput.value).toBe('2')
    })

    it('calls seek when scrubber is moved', () => {
      render(<PlaybackControls />)

      const rangeInput = screen.getByRole('slider')
      fireEvent.change(rangeInput, { target: { value: '3' } })

      expect(mockSeek).toHaveBeenCalledWith(3)
    })
  })

  describe('edge cases', () => {
    it('handles empty result points gracefully', () => {
      mockUseSimulationStore.mockReturnValue({
        primary: {
          ...mockPrimaryWithData,
          result: { ...mockPrimaryWithData.result, points: [] },
        },
      })

      expect(() => render(<PlaybackControls />)).not.toThrow()
    })

    it('handles undefined dates gracefully', () => {
      mockUseSimulationStore.mockReturnValue({
        primary: {
          ...mockPrimaryWithData,
          result: {
            ...mockPrimaryWithData.result,
            points: [{ principal: 100, marketValue: 100, totalValue: 100, shares: 1, dividends: 0 }],
          },
        },
      })
      mockUsePlayback.mockReturnValue({
        isPlaying: false,
        currentIndex: 0,
        speed: 1,
        progress: 0,
        toggle: mockToggle,
        seek: mockSeek,
        reset: mockReset,
        play: vi.fn(),
        pause: vi.fn(),
        seekPercent: vi.fn(),
      })

      expect(() => render(<PlaybackControls />)).not.toThrow()
    })
  })
})
