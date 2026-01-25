'use client'

import { useState, useCallback } from 'react'
import { useConfigStore, BENCHMARK_PRESETS } from '@/store/configStore'

const BENCHMARK_LABELS: Record<string, string> = {
  SPY: 'S&P 500',
  QQQ: 'NASDAQ',
  DIA: 'Dow Jones',
}

type ValidationState = 'idle' | 'validating' | 'valid' | 'invalid'

function isValidTickerFormat(value: string): boolean {
  return /^[A-Z0-9]{1,10}(?:[.-][A-Z0-9]{1,6})?$/.test(value)
}

function XIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

export function BenchmarkToggles() {
  const {
    ticker,
    benchmarkTickers,
    toggleBenchmark,
    addCustomBenchmark,
    removeBenchmark,
  } = useConfigStore()

  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customInput, setCustomInput] = useState('')
  const [validationState, setValidationState] = useState<ValidationState>('idle')
  const [validationError, setValidationError] = useState<string | null>(null)

  // Get custom benchmarks (non-preset)
  const customBenchmarks = benchmarkTickers.filter(
    (t) => !BENCHMARK_PRESETS.includes(t as typeof BENCHMARK_PRESETS[number])
  )

  const validateTicker = useCallback(async (symbol: string): Promise<boolean> => {
    if (!symbol || !isValidTickerFormat(symbol)) {
      setValidationState('invalid')
      setValidationError('Invalid ticker format')
      return false
    }

    // Check if same as primary ticker
    if (symbol === ticker) {
      setValidationState('invalid')
      setValidationError('Cannot benchmark against primary ticker')
      return false
    }

    // Check if already added
    if (benchmarkTickers.includes(symbol)) {
      setValidationState('invalid')
      setValidationError('Benchmark already added')
      return false
    }

    setValidationState('validating')
    setValidationError(null)

    try {
      const response = await fetch(`/api/stock/validate?symbol=${symbol}`)
      const data = await response.json()

      if (data.valid) {
        setValidationState('valid')
        return true
      } else {
        setValidationState('invalid')
        setValidationError(data.error || 'Ticker not found')
        return false
      }
    } catch {
      setValidationState('invalid')
      setValidationError('Validation failed')
      return false
    }
  }, [ticker, benchmarkTickers])

  const handleAddCustom = useCallback(async () => {
    const normalized = customInput.toUpperCase().trim()
    if (!normalized) return

    const isValid = await validateTicker(normalized)
    if (isValid) {
      addCustomBenchmark(normalized)
      setCustomInput('')
      setShowCustomInput(false)
      setValidationState('idle')
      setValidationError(null)
    }
  }, [customInput, validateTicker, addCustomBenchmark])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAddCustom()
    } else if (e.key === 'Escape') {
      setShowCustomInput(false)
      setCustomInput('')
      setValidationState('idle')
      setValidationError(null)
    }
  }

  // Max benchmarks reached (3 presets + 1 custom)
  const maxReached = benchmarkTickers.length >= 4

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-400">
        Benchmark Comparison
      </label>
      <p className="text-xs text-gray-500">
        Compare your investment against market indices
      </p>

      {/* Preset toggles */}
      <div className="flex flex-wrap gap-2">
        {BENCHMARK_PRESETS.map((preset) => {
          const isActive = benchmarkTickers.includes(preset)
          const isDisabled = preset === ticker || (!isActive && maxReached)

          return (
            <button
              key={preset}
              onClick={() => !isDisabled && toggleBenchmark(preset)}
              disabled={isDisabled}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                isActive
                  ? 'bg-gray-600 text-white border border-gray-500'
                  : isDisabled
                    ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
              title={
                preset === ticker
                  ? 'Cannot benchmark against primary ticker'
                  : BENCHMARK_LABELS[preset]
              }
            >
              <span className="font-medium">{preset}</span>
              <span className="ml-1 text-xs text-gray-500">
                {BENCHMARK_LABELS[preset]}
              </span>
            </button>
          )
        })}

        {/* Custom benchmark button */}
        {!showCustomInput && customBenchmarks.length === 0 && !maxReached && (
          <button
            onClick={() => setShowCustomInput(true)}
            className="px-3 py-1.5 text-sm rounded-lg bg-gray-800 text-gray-400
              hover:bg-gray-700 transition-colors border border-dashed border-gray-600"
          >
            + Custom
          </button>
        )}
      </div>

      {/* Custom benchmark tags */}
      {customBenchmarks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {customBenchmarks.map((custom) => (
            <span
              key={custom}
              className="inline-flex items-center gap-1 px-2 py-1 bg-gray-700
                text-white rounded-full text-sm"
            >
              {custom}
              <button
                onClick={() => removeBenchmark(custom)}
                className="ml-1 text-gray-400 hover:text-white transition-colors"
              >
                <XIcon />
              </button>
            </span>
          ))}
          {customBenchmarks.length < 1 && !maxReached && (
            <button
              onClick={() => setShowCustomInput(true)}
              className="px-2 py-1 text-xs rounded-lg bg-gray-800 text-gray-400
                hover:bg-gray-700 transition-colors border border-dashed border-gray-600"
            >
              + Add
            </button>
          )}
        </div>
      )}

      {/* Custom input field */}
      {showCustomInput && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={customInput}
                onChange={(e) => {
                  setCustomInput(e.target.value.toUpperCase())
                  if (validationState !== 'idle') {
                    setValidationState('idle')
                    setValidationError(null)
                  }
                }}
                onKeyDown={handleKeyDown}
                placeholder="Enter ticker (e.g., VTI)"
                autoFocus
                className={`w-full px-3 py-1.5 text-sm bg-gray-800 border rounded-lg
                  text-white placeholder-gray-500 focus:outline-none focus:ring-2
                  focus:border-transparent transition-colors
                  ${validationState === 'valid' ? 'border-green-500 focus:ring-green-500' : ''}
                  ${validationState === 'invalid' ? 'border-red-500 focus:ring-red-500' : ''}
                  ${validationState === 'validating' ? 'border-yellow-500 focus:ring-yellow-500' : ''}
                  ${validationState === 'idle' ? 'border-gray-700 focus:ring-blue-500' : ''}`}
              />
              {validationState === 'validating' && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <svg className="animate-spin h-4 w-4 text-yellow-500" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              )}
            </div>
            <button
              onClick={handleAddCustom}
              disabled={validationState === 'validating'}
              className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white
                hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add
            </button>
            <button
              onClick={() => {
                setShowCustomInput(false)
                setCustomInput('')
                setValidationState('idle')
                setValidationError(null)
              }}
              className="px-3 py-1.5 text-sm rounded-lg bg-gray-700 text-gray-300
                hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
          {validationError && (
            <p className="text-xs text-red-400">{validationError}</p>
          )}
        </div>
      )}

      {/* Active benchmarks summary */}
      {benchmarkTickers.length > 0 && (
        <p className="text-xs text-gray-500">
          Comparing against: {benchmarkTickers.join(', ')}
        </p>
      )}
    </div>
  )
}
