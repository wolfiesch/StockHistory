'use client'

import { useConfigStore } from '@/store/configStore'
import { TickerInput } from './TickerInput'
import { DRIPToggle } from './DRIPToggle'
import type { InvestmentFrequency } from '@/lib/api/types'

const FREQUENCY_OPTIONS: { value: InvestmentFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
]

function XIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

export function ConfigPanel() {
  const {
    ticker,
    amount,
    frequency,
    startDate,
    comparisonTickers,
    setAmount,
    setFrequency,
    setStartDate,
    removeComparisonTicker,
  } = useConfigStore()

  // Calculate min date (30 years ago)
  const minDate = new Date()
  minDate.setFullYear(minDate.getFullYear() - 30)
  const minDateStr = minDate.toISOString().split('T')[0]

  // Max date is today
  const maxDateStr = new Date().toISOString().split('T')[0]

  return (
    <div className="bg-gray-900/50 rounded-xl p-6 space-y-6">
      <h2 className="text-lg font-semibold text-white">Configuration</h2>

      {/* Ticker Input */}
      <TickerInput />

      {/* Comparison Tickers */}
      {comparisonTickers.length > 0 && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-400">
            Comparing with
          </label>
          <div className="flex flex-wrap gap-2">
            {comparisonTickers.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 px-3 py-1 bg-gray-800
                  text-white rounded-full text-sm"
              >
                {t}
                <button
                  onClick={() => removeComparisonTicker(t)}
                  className="ml-1 text-gray-400 hover:text-white transition-colors"
                >
                  <XIcon />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Investment Amount */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-400">
          Investment Amount
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
            $
          </span>
          <input
            type="number"
            min={1}
            max={10000}
            value={amount}
            onChange={(e) => setAmount(parseInt(e.target.value, 10) || 100)}
            className="w-full pl-8 pr-4 py-2 bg-gray-800 border border-gray-700
              rounded-lg text-white focus:outline-none focus:ring-2
              focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-2">
          {[50, 100, 200, 500].map((preset) => (
            <button
              key={preset}
              onClick={() => setAmount(preset)}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                amount === preset
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              ${preset}
            </button>
          ))}
        </div>
      </div>

      {/* Frequency */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-400">
          Investment Frequency
        </label>
        <div className="grid grid-cols-3 gap-2">
          {FREQUENCY_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setFrequency(option.value)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                frequency === option.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Start Date */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-400">
          Start Date
        </label>
        <input
          type="date"
          value={startDate}
          min={minDateStr}
          max={maxDateStr}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg
            text-white focus:outline-none focus:ring-2 focus:ring-blue-500
            focus:border-transparent"
        />
        <div className="flex gap-2">
          {[5, 10, 20].map((years) => {
            const date = new Date()
            date.setFullYear(date.getFullYear() - years)
            const dateStr = date.toISOString().split('T')[0]
            return (
              <button
                key={years}
                onClick={() => setStartDate(dateStr)}
                className="px-3 py-1 text-sm rounded-lg bg-gray-800 text-gray-400
                  hover:bg-gray-700 transition-colors"
              >
                {years}Y ago
              </button>
            )
          })}
        </div>
      </div>

      {/* DRIP Toggle */}
      <DRIPToggle />

      {/* Current settings summary */}
      <div className="pt-4 border-t border-gray-800 text-sm text-gray-500">
        <p>
          Investing <span className="text-white">${amount}</span>{' '}
          <span className="text-white">{frequency}</span> in{' '}
          <span className="text-white">{ticker}</span>
          {comparisonTickers.length > 0 && (
            <>
              {' '}
              (comparing with{' '}
              <span className="text-white">{comparisonTickers.join(', ')}</span>)
            </>
          )}{' '}
          since{' '}
          <span className="text-white">
            {new Date(startDate).toLocaleDateString('en-US', {
              month: 'short',
              year: 'numeric',
            })}
          </span>
        </p>
      </div>
    </div>
  )
}
