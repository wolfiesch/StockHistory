'use client'

import { create } from 'zustand'

type PlaybackSpeed = 0.5 | 1 | 2 | 4

interface PlaybackState {
  isPlaying: boolean
  currentIndex: number
  speed: PlaybackSpeed

  // Actions
  setIsPlaying: (isPlaying: boolean) => void
  setCurrentIndex: (index: number) => void
  setSpeed: (speed: PlaybackSpeed) => void
  reset: () => void
}

export const usePlaybackStore = create<PlaybackState>((set) => ({
  isPlaying: false,
  currentIndex: 0,
  speed: 1,

  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentIndex: (currentIndex) => set({ currentIndex }),
  setSpeed: (speed) => set({ speed }),
  reset: () => set({ isPlaying: false, currentIndex: 0 }),
}))

// Speed options for UI
export const SPEED_OPTIONS: { value: PlaybackSpeed; label: string }[] = [
  { value: 0.5, label: '0.5x' },
  { value: 1, label: '1x' },
  { value: 2, label: '2x' },
  { value: 4, label: '4x' },
]
