'use client'

import { useCallback, useEffect, useRef } from 'react'
import { usePlaybackStore } from '@/store/playbackStore'

// Target 30 points per second at 1x speed
const BASE_POINTS_PER_SECOND = 30

/**
 * Hook for controlling animation playback
 * Uses requestAnimationFrame for smooth animation
 */
export function usePlayback(totalPoints: number) {
  const {
    isPlaying,
    currentIndex,
    speed,
    setCurrentIndex,
    setIsPlaying,
  } = usePlaybackStore()

  const lastTimeRef = useRef<number>(0)
  const accumulatorRef = useRef<number>(0)
  const animationFrameRef = useRef<number | null>(null)

  // Use refs for values accessed inside the animation loop to avoid
  // re-running the effect when they change (which would break the animation)
  const currentIndexRef = useRef(currentIndex)
  const speedRef = useRef(speed)
  const totalPointsRef = useRef(totalPoints)

  // Keep refs in sync with state
  useEffect(() => {
    currentIndexRef.current = currentIndex
  }, [currentIndex])

  useEffect(() => {
    speedRef.current = speed
  }, [speed])

  useEffect(() => {
    totalPointsRef.current = totalPoints
  }, [totalPoints])

  const play = useCallback(() => {
    setIsPlaying(true)
  }, [setIsPlaying])

  const pause = useCallback(() => {
    setIsPlaying(false)
  }, [setIsPlaying])

  const toggle = useCallback(() => {
    if (isPlaying) {
      pause()
    } else {
      // If at the end, restart from beginning
      if (currentIndex >= totalPoints - 1) {
        setCurrentIndex(0)
      }
      play()
    }
  }, [isPlaying, currentIndex, totalPoints, play, pause, setCurrentIndex])

  const seek = useCallback((index: number) => {
    const clampedIndex = Math.max(0, Math.min(index, totalPoints - 1))
    setCurrentIndex(clampedIndex)
  }, [totalPoints, setCurrentIndex])

  const seekPercent = useCallback((percent: number) => {
    const index = Math.floor((percent / 100) * (totalPoints - 1))
    seek(index)
  }, [totalPoints, seek])

  const reset = useCallback(() => {
    setCurrentIndex(0)
    setIsPlaying(false)
  }, [setCurrentIndex, setIsPlaying])

  // Animation loop - only depends on isPlaying to start/stop
  // All other values are read from refs to avoid restarting the loop
  useEffect(() => {
    if (!isPlaying || totalPointsRef.current === 0) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      return
    }

    const animate = (timestamp: number) => {
      if (!lastTimeRef.current) {
        lastTimeRef.current = timestamp
      }

      const deltaTime = timestamp - lastTimeRef.current
      lastTimeRef.current = timestamp

      // Calculate how many points to advance (read from refs)
      const pointsPerMs = (BASE_POINTS_PER_SECOND * speedRef.current) / 1000
      accumulatorRef.current += deltaTime * pointsPerMs

      // Advance index by accumulated points
      const pointsToAdvance = Math.floor(accumulatorRef.current)
      if (pointsToAdvance > 0) {
        accumulatorRef.current -= pointsToAdvance

        const newIndex = Math.min(
          currentIndexRef.current + pointsToAdvance,
          totalPointsRef.current - 1
        )
        setCurrentIndex(newIndex)
        currentIndexRef.current = newIndex // Keep ref in sync immediately

        // Stop at the end
        if (newIndex >= totalPointsRef.current - 1) {
          setIsPlaying(false)
          return
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate)
    }

    // Reset timing when starting
    lastTimeRef.current = 0
    accumulatorRef.current = 0
    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isPlaying, setCurrentIndex, setIsPlaying])

  // Calculate progress percentage
  const progress = totalPoints > 0 ? (currentIndex / (totalPoints - 1)) * 100 : 0

  return {
    isPlaying,
    currentIndex,
    speed,
    progress,
    play,
    pause,
    toggle,
    seek,
    seekPercent,
    reset,
  }
}
