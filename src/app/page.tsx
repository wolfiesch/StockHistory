'use client'

import { DCAChart } from '@/components/chart/DCAChart'
import { PlaybackControls } from '@/components/chart/PlaybackControls'
import { ComparisonGrid } from '@/components/chart/ComparisonGrid'
import { ConfigPanel } from '@/components/config/ConfigPanel'
import { MetricsSummary } from '@/components/summary/MetricsSummary'
import { useDCASimulation } from '@/hooks/useDCASimulation'

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

export default function Home() {
  // Initialize simulation hook (manages data fetching based on config changes)
  useDCASimulation()

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex items-center gap-4 mb-8">
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
        </header>

        {/* Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* Main Content */}
          <div className="space-y-6">
            {/* Metrics Summary */}
            <MetricsSummary />

            {/* Main Chart */}
            <DCAChart />

            {/* Playback Controls */}
            <PlaybackControls />

            {/* Comparison Grid (if comparisons exist) */}
            <ComparisonGrid />
          </div>

          {/* Sidebar */}
          <aside>
            <div className="sticky top-4">
              <ConfigPanel />
            </div>
          </aside>
        </div>

        {/* Footer */}
        <footer className="text-center text-sm text-gray-500 pt-8 border-t border-gray-800">
          <p>
            Data provided by EODHD. Past performance does not guarantee future
            results.
          </p>
        </footer>
      </div>
    </main>
  )
}
