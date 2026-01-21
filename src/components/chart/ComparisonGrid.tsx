'use client'

import { useSimulationStore } from '@/store/simulationStore'
import { usePlaybackStore } from '@/store/playbackStore'
import { MiniChartCanvas } from './MiniChartCanvas'
import type { SimulationPoint } from '@/lib/api/types'

export function ComparisonGrid() {
  const { primary, comparisons } = useSimulationStore()
  const { currentIndex } = usePlaybackStore()

  // Only show if there are comparisons
  if (comparisons.length === 0) return null

  const allSimulations = [
    primary && {
      ticker: primary.ticker,
      points: primary.result.points,
      totalReturn: primary.result.totalReturn,
      isLoading: primary.isLoading,
      error: primary.error,
    },
    ...comparisons.map((c) => ({
      ticker: c.ticker,
      points: c.result.points,
      totalReturn: c.result.totalReturn,
      isLoading: c.isLoading,
      error: c.error,
    })),
  ].filter(Boolean) as Array<{
    ticker: string
    points: SimulationPoint[]
    totalReturn: number
    isLoading: boolean
    error: string | null
  }>

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white">Comparison</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {allSimulations.map((sim) => (
          <MiniChartCanvas
            key={sim.ticker}
            ticker={sim.ticker}
            points={sim.points}
            currentIndex={Math.min(currentIndex, sim.points.length - 1)}
            totalReturn={sim.totalReturn}
            isLoading={sim.isLoading}
            error={sim.error}
          />
        ))}
      </div>
    </div>
  )
}
