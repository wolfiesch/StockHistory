'use client'

import { useState } from 'react'
import { useRollingAnalysisStore, selectStats, selectWindows } from '@/store/rollingAnalysisStore'
import { WindowDetailModal } from './WindowDetailModal'
import type { WindowResult } from '@/lib/api/types'

function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
  })
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

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

interface WindowCardProps {
  window: WindowResult
  label: string
  variant: 'best' | 'worst' | 'neutral'
  onClick: () => void
}

function WindowCard({ window, label, variant, onClick }: WindowCardProps) {
  const colors = {
    best: {
      bg: 'bg-green-500/10 hover:bg-green-500/20',
      border: 'border-green-500/30',
      text: 'text-green-400',
      icon: <TrendUpIcon />,
    },
    worst: {
      bg: 'bg-red-500/10 hover:bg-red-500/20',
      border: 'border-red-500/30',
      text: 'text-red-400',
      icon: <TrendDownIcon />,
    },
    neutral: {
      bg: 'bg-gray-700/50 hover:bg-gray-700',
      border: 'border-gray-600',
      text: 'text-gray-300',
      icon: null,
    },
  }

  const style = colors[variant]

  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-[140px] p-3 rounded-lg border ${style.bg} ${style.border}
        transition-colors cursor-pointer text-left`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        {style.icon}
        <span className="text-xs font-medium text-gray-400">{label}</span>
      </div>
      <p className={`text-lg font-bold ${style.text}`}>
        {formatPercent(window.totalReturn)}
      </p>
      <p className="text-xs text-gray-500">
        {formatDate(window.startDate)} - {formatDate(window.endDate)}
      </p>
    </button>
  )
}

/**
 * Component for exploring individual rolling windows.
 * Shows best/worst windows with click-to-view details.
 */
export function WindowExplorer() {
  const [selectedWindow, setSelectedWindow] = useState<WindowResult | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const stats = useRollingAnalysisStore(selectStats)
  const windows = useRollingAnalysisStore(selectWindows)

  if (!stats.windowCount || !stats.bestWindow || !stats.worstWindow) {
    return null
  }

  // Get a sample of windows for the expanded view
  const sortedByReturn = [...windows].sort((a, b) => b.totalReturn - a.totalReturn)
  const topWindows = sortedByReturn.slice(0, 5)
  const bottomWindows = sortedByReturn.slice(-5).reverse()

  return (
    <>
      <div className="bg-gray-800/50 rounded-xl p-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-400">
            Explore Individual Windows
          </h3>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            {isExpanded ? 'Less' : 'More'}
            <ChevronDownIcon
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        {/* Best and Worst Windows */}
        <div className="flex flex-wrap gap-3">
          <WindowCard
            window={stats.bestWindow}
            label="Best Window"
            variant="best"
            onClick={() => setSelectedWindow(stats.bestWindow)}
          />
          <WindowCard
            window={stats.worstWindow}
            label="Worst Window"
            variant="worst"
            onClick={() => setSelectedWindow(stats.worstWindow)}
          />
        </div>

        {/* Expanded View - Top and Bottom 5 */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Top 5 */}
              <div>
                <h4 className="text-xs font-medium text-green-400 mb-2">
                  Top 5 Performing Windows
                </h4>
                <div className="space-y-1.5">
                  {topWindows.map((w, i) => (
                    <button
                      key={w.startDate}
                      onClick={() => setSelectedWindow(w)}
                      className="w-full flex items-center justify-between p-2 rounded-lg
                        bg-gray-700/30 hover:bg-gray-700/60 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-4">{i + 1}.</span>
                        <span className="text-sm text-gray-300">
                          {formatDate(w.startDate)} - {formatDate(w.endDate)}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-green-400">
                        {formatPercent(w.totalReturn)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bottom 5 */}
              <div>
                <h4 className="text-xs font-medium text-red-400 mb-2">
                  Bottom 5 Performing Windows
                </h4>
                <div className="space-y-1.5">
                  {bottomWindows.map((w, i) => (
                    <button
                      key={w.startDate}
                      onClick={() => setSelectedWindow(w)}
                      className="w-full flex items-center justify-between p-2 rounded-lg
                        bg-gray-700/30 hover:bg-gray-700/60 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-4">
                          {windows.length - 4 + i}.
                        </span>
                        <span className="text-sm text-gray-300">
                          {formatDate(w.startDate)} - {formatDate(w.endDate)}
                        </span>
                      </div>
                      <span
                        className={`text-sm font-medium ${
                          w.totalReturn >= 0 ? 'text-gray-300' : 'text-red-400'
                        }`}
                      >
                        {formatPercent(w.totalReturn)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-500 mt-3 text-center">
              Click any window to see detailed information
            </p>
          </div>
        )}
      </div>

      {/* Window Detail Modal */}
      {selectedWindow && (
        <WindowDetailModal
          window={selectedWindow}
          stats={stats}
          onClose={() => setSelectedWindow(null)}
        />
      )}
    </>
  )
}
