'use client'

import { useState } from 'react'
import { DCAChart } from '@/components/chart/DCAChart'
import { PlaybackControls } from '@/components/chart/PlaybackControls'
import { ComparisonGrid } from '@/components/chart/ComparisonGrid'
import { ConfigPanel } from '@/components/config/ConfigPanel'
import { MetricsSummary } from '@/components/summary/MetricsSummary'
import { Drawer } from '@/components/ui/Drawer'
import { useDCASimulation } from '@/hooks/useDCASimulation'
import { useURLSync } from '@/hooks/useURLSync'
import {
  ErrorBoundary,
  ChartErrorFallback,
  MetricsErrorFallback,
} from '@/components/ui/ErrorBoundary'

function TrendUpIcon() {
  return (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
      />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  )
}

export default function Home() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Initialize simulation hook (manages data fetching based on config changes)
  useDCASimulation()
  // Sync config with URL for shareable links
  useURLSync()

  return (
    <main className="min-h-screen p-4 md:p-8 lg:px-12">
      <div className="max-w-[1800px] mx-auto space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600/20 rounded-xl text-blue-400">
              <TrendUpIcon />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">
                DCA Investment Visualizer
              </h1>
              <p className="text-gray-400">
                See how recurring investments would have grown over time
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition-colors"
            aria-label="Open settings"
          >
            <SettingsIcon />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </header>

        {/* Main Content - Full Width */}
        <div className="space-y-6">
          {/* Metrics Summary */}
          <ErrorBoundary fallback={<MetricsErrorFallback />}>
            <MetricsSummary onSettingsClick={() => setIsDrawerOpen(true)} />
          </ErrorBoundary>

          {/* Main Chart */}
          <ErrorBoundary fallback={<ChartErrorFallback />}>
            <DCAChart />
          </ErrorBoundary>

          {/* Playback Controls */}
          <ErrorBoundary>
            <PlaybackControls />
          </ErrorBoundary>

          {/* Comparison Grid (if comparisons exist) */}
          <ErrorBoundary>
            <ComparisonGrid />
          </ErrorBoundary>
        </div>

        {/* Footer */}
        <footer className="text-center text-sm text-gray-500 pt-8 border-t border-gray-800">
          <p>
            Data provided by EODHD. Past performance does not guarantee future
            results.
          </p>
        </footer>
      </div>

      {/* Settings Drawer */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="Settings"
      >
        <ErrorBoundary>
          <ConfigPanel />
        </ErrorBoundary>
      </Drawer>
    </main>
  )
}
