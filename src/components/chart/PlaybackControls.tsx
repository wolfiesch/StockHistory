'use client'

import { usePlayback } from '@/lib/animation/usePlayback'
import { usePlaybackStore, SPEED_OPTIONS } from '@/store/playbackStore'
import { useSimulationStore } from '@/store/simulationStore'

function PlayIcon() {
  return (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
      <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
      <path d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75A.75.75 0 007.25 3h-1.5zM12.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-1.5z" />
    </svg>
  )
}

function ResetIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  )
}

export function PlaybackControls() {
  const { primary } = useSimulationStore()
  const {
    setSpeed,
    adaptiveXAxis,
    adaptiveYAxis,
    setAdaptiveXAxis,
    setAdaptiveYAxis,
  } = usePlaybackStore()

  const totalPoints = primary?.result.points.length ?? 0
  const { isPlaying, currentIndex, speed, progress, toggle, seek, reset } =
    usePlayback(totalPoints)

  const currentDate = primary?.result.points[currentIndex]?.date ?? ''

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10)
    seek(value)
  }

  const isDisabled = totalPoints === 0

  return (
    <div className="bg-gray-800/50 rounded-xl p-4 space-y-4">
      {/* Current date display */}
      <div className="text-center">
        <span className="text-2xl font-mono text-white">
          {currentDate
            ? new Date(currentDate).toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              })
            : '---'}
        </span>
      </div>

      {/* Scrubber */}
      <div className="space-y-2">
        <input
          type="range"
          min={0}
          max={Math.max(0, totalPoints - 1)}
          value={currentIndex}
          onChange={handleScrub}
          disabled={isDisabled}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer
            disabled:opacity-50 disabled:cursor-not-allowed
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-blue-500
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:hover:bg-blue-400"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>
            {primary?.result.points[0]?.date
              ? new Date(primary.result.points[0].date).getFullYear()
              : '---'}
          </span>
          <span>{Math.round(progress)}%</span>
          <span>
            {primary?.result.points[totalPoints - 1]?.date
              ? new Date(
                  primary.result.points[totalPoints - 1].date
                ).getFullYear()
              : '---'}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        {/* Reset button */}
        <button
          onClick={reset}
          disabled={isDisabled}
          className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-50
            disabled:cursor-not-allowed transition-colors text-gray-300"
          title="Reset"
        >
          <ResetIcon />
        </button>

        {/* Play/Pause button */}
        <button
          onClick={toggle}
          disabled={isDisabled}
          className="p-4 rounded-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50
            disabled:cursor-not-allowed transition-colors text-white"
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>

        {/* Speed selector */}
        <div className="flex items-center gap-1">
          {SPEED_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setSpeed(option.value)}
              disabled={isDisabled}
              className={`px-2 py-1 text-sm rounded transition-colors
                ${
                  speed === option.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }
                disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Axis toggles */}
        <div className="flex items-center gap-2 ml-4 border-l border-gray-700 pl-4">
          <span className="text-xs text-gray-500">Axes:</span>
          <button
            onClick={() => setAdaptiveXAxis(!adaptiveXAxis)}
            disabled={isDisabled}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              adaptiveXAxis
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={
              adaptiveXAxis
                ? 'X-Axis: Adaptive (rescales)'
                : 'X-Axis: Fixed (stable)'
            }
          >
            X: {adaptiveXAxis ? 'Adapt' : 'Fixed'}
          </button>
          <button
            onClick={() => setAdaptiveYAxis(!adaptiveYAxis)}
            disabled={isDisabled}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              adaptiveYAxis
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={
              adaptiveYAxis
                ? 'Y-Axis: Adaptive (rescales)'
                : 'Y-Axis: Fixed (stable)'
            }
          >
            Y: {adaptiveYAxis ? 'Adapt' : 'Fixed'}
          </button>
        </div>
      </div>
    </div>
  )
}
