'use client'

import { create } from 'zustand'

type PlaybackSpeed = 0.5 | 1 | 2 | 4

interface PlaybackState {
  isPlaying: boolean
  currentIndex: number
  speed: PlaybackSpeed
  adaptiveXAxis: boolean // true = adapt to visible data, false = fixed full range
  adaptiveYAxis: boolean

  // Actions
  setIsPlaying: (isPlaying: boolean) => void
  setCurrentIndex: (index: number) => void
  setSpeed: (speed: PlaybackSpeed) => void
  setAdaptiveXAxis: (adaptive: boolean) => void
  setAdaptiveYAxis: (adaptive: boolean) => void
  reset: () => void
}

export const usePlaybackStore = create<PlaybackState>((set) => ({
  isPlaying: false,
  currentIndex: 0,
  speed: 1,
  adaptiveXAxis: false, // Default: fixed range (stable labels)
  adaptiveYAxis: false, // Default: fixed range (stable scale)

  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentIndex: (currentIndex) => set({ currentIndex }),
  setSpeed: (speed) => set({ speed }),
  setAdaptiveXAxis: (adaptive) => set({ adaptiveXAxis: adaptive }),
  setAdaptiveYAxis: (adaptive) => set({ adaptiveYAxis: adaptive }),
  reset: () => set({ isPlaying: false, currentIndex: 0 }),
}))

// Speed options for UI
export const SPEED_OPTIONS: { value: PlaybackSpeed; label: string }[] = [
  { value: 0.5, label: '0.5x' },
  { value: 1, label: '1x' },
  { value: 2, label: '2x' },
  { value: 4, label: '4x' },
]
