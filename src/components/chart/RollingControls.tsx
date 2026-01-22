'use client'

import { useConfigStore } from '@/store/configStore'
import { useRollingAnalysisStore } from '@/store/rollingAnalysisStore'
import type { HorizonYears, RollingXAxisMode } from '@/lib/api/types'

const HORIZON_OPTIONS: { value: HorizonYears; label: string }[] = [
  { value: 5, label: '5Y' },
  { value: 10, label: '10Y' },
  { value: 15, label: '15Y' },
  { value: 20, label: '20Y' },
]

const X_AXIS_OPTIONS: { value: RollingXAxisMode; label: string }[] = [
  { value: 'normalized', label: 'Months from Start' },
  { value: 'calendar', label: 'Calendar End Date' },
]

export function RollingControls() {
  const {
    rollingHorizon,
    rollingXAxisMode,
    setRollingHorizon,
    setRollingXAxisMode,
  } = useConfigStore()
  const { availableHorizons, isComputing } = useRollingAnalysisStore()

  return (
    <div className="bg-gray-800/50 rounded-xl p-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Horizon Selector */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400 font-medium">
            Investment Horizon:
          </span>
          <div className="flex items-center gap-1">
            {HORIZON_OPTIONS.map((option) => {
              const isAvailable = availableHorizons.includes(option.value)
              const isSelected = rollingHorizon === option.value

              return (
                <button
                  key={option.value}
                  onClick={() => setRollingHorizon(option.value)}
                  disabled={!isAvailable || isComputing}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200
                    ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-sm'
                        : isAvailable
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                        : 'bg-gray-800/50 text-gray-600 cursor-not-allowed'
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed`}
                  title={
                    !isAvailable
                      ? `Insufficient data for ${option.value}-year horizon`
                      : `Analyze ${option.value}-year rolling windows`
                  }
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* X-Axis Mode Toggle */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400 font-medium">X-Axis:</span>
          <div className="inline-flex items-center bg-gray-700/50 rounded-lg p-0.5">
            {X_AXIS_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setRollingXAxisMode(option.value)}
                disabled={isComputing}
                className={`px-3 py-1.5 text-sm rounded-md transition-all duration-200
                  ${
                    rollingXAxisMode === option.value
                      ? 'bg-gray-600 text-white'
                      : 'text-gray-400 hover:text-gray-200'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Horizon Warning */}
      {availableHorizons.length > 0 &&
        !availableHorizons.includes(rollingHorizon) && (
          <div className="mt-3 text-sm text-yellow-400">
            Selected horizon ({rollingHorizon}Y) unavailable. Maximum available:{' '}
            {Math.max(...availableHorizons)}Y
          </div>
        )}

      {/* No horizons available */}
      {availableHorizons.length === 0 && !isComputing && (
        <div className="mt-3 text-sm text-yellow-400">
          Insufficient historical data for rolling window analysis. Need at
          least 6 years of data.
        </div>
      )}
    </div>
  )
}
