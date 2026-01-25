'use client'

import { useEffect, useCallback } from 'react'
import type { WindowResult, RollingWindowStats } from '@/lib/api/types'

interface WindowDetailModalProps {
  window: WindowResult
  stats: RollingWindowStats
  onClose: () => void
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  })
}

function CloseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function TrendUpIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  )
}

function TrendDownIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
    </svg>
  )
}

/**
 * Modal showing detailed information about a specific rolling window.
 * Displays performance metrics and comparison to the overall distribution.
 */
export function WindowDetailModal({ window, stats, onClose }: WindowDetailModalProps) {
  const isPositive = window.totalReturn >= 0
  const isBestWindow = stats.bestWindow?.startDate === window.startDate
  const isWorstWindow = stats.worstWindow?.startDate === window.startDate

  // Calculate percentile rank
  const getPercentileRank = (): string => {
    if (!stats.windowCount) return 'N/A'

    // Simple approximation - would need all windows for exact calculation
    if (window.totalReturn > stats.medianReturn) {
      if (isBestWindow) return 'Top 1%'
      return 'Above Median'
    } else if (window.totalReturn < stats.medianReturn) {
      if (isWorstWindow) return 'Bottom 1%'
      return 'Below Median'
    }
    return 'At Median'
  }

  // Handle escape key
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    },
    [onClose]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div>
            <h3 className="text-lg font-semibold text-white">
              Window Details
            </h3>
            <p className="text-sm text-gray-400">
              {formatDate(window.startDate)} → {formatDate(window.endDate)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Performance Badge */}
          {(isBestWindow || isWorstWindow) && (
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                isBestWindow
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}
            >
              {isBestWindow ? <TrendUpIcon /> : <TrendDownIcon />}
              {isBestWindow ? 'Best Performing Window' : 'Worst Performing Window'}
            </div>
          )}

          {/* Main Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                Total Return
              </p>
              <p
                className={`text-xl font-bold ${
                  isPositive ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {formatPercent(window.totalReturn)}
              </p>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                CAGR
              </p>
              <p
                className={`text-xl font-bold ${
                  window.cagr >= 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {formatPercent(window.cagr)}
              </p>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                Final Value
              </p>
              <p className="text-xl font-bold text-white">
                {formatCurrency(window.finalValue)}
              </p>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                Total Invested
              </p>
              <p className="text-xl font-bold text-gray-300">
                {formatCurrency(window.totalInvested)}
              </p>
            </div>
          </div>

          {/* Profit/Loss */}
          <div className="bg-gray-800/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
              {isPositive ? 'Net Gain' : 'Net Loss'}
            </p>
            <p
              className={`text-xl font-bold ${
                isPositive ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {formatCurrency(window.finalValue - window.totalInvested)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              on {formatCurrency(window.totalInvested)} invested
            </p>
          </div>

          {/* Comparison to Distribution */}
          <div className="border-t border-gray-700 pt-4">
            <p className="text-sm font-medium text-gray-400 mb-3">
              Compared to All {stats.windowCount} Windows
            </p>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Percentile Rank</span>
                <span className="text-sm text-white font-medium">
                  {getPercentileRank()}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Median Return</span>
                <span className="text-sm text-gray-300">
                  {formatPercent(stats.medianReturn)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">This Window vs Median</span>
                <span
                  className={`text-sm font-medium ${
                    window.totalReturn > stats.medianReturn
                      ? 'text-green-400'
                      : window.totalReturn < stats.medianReturn
                      ? 'text-red-400'
                      : 'text-gray-300'
                  }`}
                >
                  {window.totalReturn > stats.medianReturn
                    ? `+${(window.totalReturn - stats.medianReturn).toFixed(1)}pp`
                    : window.totalReturn < stats.medianReturn
                    ? `${(window.totalReturn - stats.medianReturn).toFixed(1)}pp`
                    : 'Equal'}
                </span>
              </div>

              {/* Visual comparison bar */}
              <div className="mt-3">
                <div className="relative h-2 bg-gray-700 rounded-full overflow-hidden">
                  {/* Range background */}
                  <div className="absolute inset-0 bg-gradient-to-r from-red-500/30 via-yellow-500/30 to-green-500/30" />

                  {/* Median marker */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white/50"
                    style={{ left: '50%' }}
                  />

                  {/* This window marker */}
                  <div
                    className={`absolute top-0 bottom-0 w-1.5 rounded-full ${
                      isPositive ? 'bg-green-400' : 'bg-red-400'
                    }`}
                    style={{
                      left: `${Math.min(Math.max(
                        // Normalize to 0-100 scale (assuming -50% to +150% range)
                        ((window.totalReturn + 50) / 200) * 100,
                        5
                      ), 95)}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Worst</span>
                  <span>Median</span>
                  <span>Best</span>
                </div>
              </div>
            </div>
          </div>

          {/* Historical Context */}
          <div className="border-t border-gray-700 pt-4">
            <p className="text-sm font-medium text-gray-400 mb-2">
              Historical Context
            </p>
            <p className="text-sm text-gray-500">
              This window covers the period from{' '}
              <span className="text-gray-300">{formatDate(window.startDate)}</span>{' '}
              to{' '}
              <span className="text-gray-300">{formatDate(window.endDate)}</span>
              . During this time, an investor making regular contributions would have{' '}
              {isPositive ? 'grown' : 'lost'} their portfolio by{' '}
              <span className={isPositive ? 'text-green-400' : 'text-red-400'}>
                {formatPercent(window.totalReturn)}
              </span>.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
