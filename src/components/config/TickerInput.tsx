'use client'

import { useState, useCallback } from 'react'
import { useConfigStore } from '@/store/configStore'

// Common US stocks for quick selection
const POPULAR_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'SPY', 'QQQ', 'VOO']

type ValidationState = 'idle' | 'validating' | 'valid' | 'invalid'

function isValidTickerFormat(value: string): boolean {
  return /^[A-Z]{1,5}$/.test(value)
}

export function TickerInput() {
  const { ticker, setTicker, comparisonTickers, addComparisonTicker } = useConfigStore()
  const [inputValue, setInputValue] = useState(ticker)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [validationState, setValidationState] = useState<ValidationState>('idle')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState<string | null>(null)

  const validateTicker = useCallback(async (symbol: string) => {
    if (!symbol || !isValidTickerFormat(symbol)) {
      setValidationState('invalid')
      setValidationError('Invalid ticker format (1-5 letters)')
      setCompanyName(null)
      return false
    }

    setValidationState('validating')
    setValidationError(null)
    setCompanyName(null)

    try {
      const response = await fetch(`/api/stock/validate?symbol=${symbol}`)
      const data = await response.json()

      if (data.valid) {
        setValidationState('valid')
        setCompanyName(data.name || null)
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
  }, [])

  const handleSubmit = useCallback(
    async (value: string) => {
      const normalized = value.toUpperCase().trim()
      if (normalized) {
        // Skip validation for popular tickers (known good)
        const isPopular = POPULAR_TICKERS.includes(normalized)
        if (isPopular) {
          setValidationState('valid')
          setValidationError(null)
          setTicker(normalized)
          setInputValue(normalized)
        } else {
          const isValid = await validateTicker(normalized)
          if (isValid) {
            setTicker(normalized)
            setInputValue(normalized)
          }
        }
      }
      setShowSuggestions(false)
    },
    [setTicker, validateTicker]
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit(inputValue)
    }
  }

  const handleBlur = () => {
    // Delay to allow click on suggestion
    setTimeout(() => setShowSuggestions(false), 150)
    if (inputValue !== ticker) {
      handleSubmit(inputValue)
    }
  }

  const filteredSuggestions = POPULAR_TICKERS.filter(
    (t) =>
      t.includes(inputValue.toUpperCase()) &&
      t !== ticker &&
      !comparisonTickers.includes(t)
  )

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-400">
        Stock Ticker
      </label>
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value.toUpperCase())
            setShowSuggestions(true)
            // Reset validation when typing
            if (validationState !== 'idle') {
              setValidationState('idle')
              setValidationError(null)
              setCompanyName(null)
            }
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="Enter ticker (e.g., AAPL)"
          className={`w-full px-4 py-2 pr-10 bg-gray-800 border rounded-lg
            text-white placeholder-gray-500 focus:outline-none focus:ring-2
            focus:border-transparent transition-colors
            ${validationState === 'valid' ? 'border-green-500 focus:ring-green-500' : ''}
            ${validationState === 'invalid' ? 'border-red-500 focus:ring-red-500' : ''}
            ${validationState === 'validating' ? 'border-yellow-500 focus:ring-yellow-500' : ''}
            ${validationState === 'idle' ? 'border-gray-700 focus:ring-blue-500' : ''}`}
        />

        {/* Validation indicator */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {validationState === 'validating' && (
            <svg className="animate-spin h-5 w-5 text-yellow-500" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
          {validationState === 'valid' && (
            <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {validationState === 'invalid' && (
            <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700
            rounded-lg shadow-lg max-h-48 overflow-auto">
            {filteredSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => handleSubmit(suggestion)}
                className="w-full px-4 py-2 text-left text-white hover:bg-gray-700
                  transition-colors first:rounded-t-lg last:rounded-b-lg"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Validation feedback */}
      {validationError && (
        <p className="text-sm text-red-400 mt-1">{validationError}</p>
      )}
      {companyName && validationState === 'valid' && (
        <p className="text-sm text-green-400 mt-1">{companyName}</p>
      )}

      {/* Quick add for comparison */}
      {comparisonTickers.length < 2 && (
        <div className="flex flex-wrap gap-2 mt-2">
          <span className="text-xs text-gray-500">Quick add:</span>
          {POPULAR_TICKERS.filter(
            (t) => t !== ticker && !comparisonTickers.includes(t)
          )
            .slice(0, 4)
            .map((t) => (
              <button
                key={t}
                onClick={() => addComparisonTicker(t)}
                className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 rounded
                  hover:bg-gray-600 transition-colors"
              >
                + {t}
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
