'use client'

import { useSimulationStore } from '@/store/simulationStore'
import { usePlaybackStore } from '@/store/playbackStore'
import { formatCurrency, formatPercent, formatShares } from '@/lib/calculation/dcaEngine'
import { MetricsSkeleton } from '@/components/ui/Skeleton'

interface MetricCardProps {
  label: string
  value: string
  subValue?: string
  colorClass?: string
}

function MetricCard({ label, value, subValue, colorClass = 'text-white' }: MetricCardProps) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-4">
      <p className="text-sm text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
      {subValue && <p className="text-sm text-gray-500 mt-1">{subValue}</p>}
    </div>
  )
}

export function MetricsSummary() {
  const { primary } = useSimulationStore()
  const { currentIndex } = usePlaybackStore()

  if (!primary || primary.result.points.length === 0) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {['Total Invested', 'Current Value', 'Total Return', 'Shares Owned'].map(
          (label) => (
            <MetricCard key={label} label={label} value="---" />
          )
        )}
      </div>
    )
  }

  if (primary.isLoading) {
    return <MetricsSkeleton />
  }

  const { result } = primary
  const currentPoint = result.points[currentIndex] || result.points[result.points.length - 1]

  // Calculate metrics at current point in time
  const invested = currentPoint.principal
  const currentValue = currentPoint.totalValue
  const returnValue = invested > 0 ? ((currentValue - invested) / invested) * 100 : 0
  const shares = currentPoint.shares

  // For CAGR, calculate based on time from start to current point
  const startDate = new Date(result.points[0].date)
  const currentDate = new Date(currentPoint.date)
  const years = (currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
  const cagr = years > 0 && invested > 0
    ? (Math.pow(currentValue / invested, 1 / years) - 1) * 100
    : 0

  const returnColorClass = returnValue >= 0 ? 'text-green-400' : 'text-red-400'

  // Calculate actual data range
  const firstDate = new Date(result.points[0].date)
  const lastDate = new Date(result.points[result.points.length - 1].date)
  const actualYears = Math.round((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25) * 10) / 10

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{primary.ticker}</h2>
          <p className="text-xs text-gray-500">
            Data from {firstDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - {lastDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} ({actualYears} years)
          </p>
        </div>
        <span className="text-sm text-gray-400">
          {new Date(currentPoint.date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Total Invested"
          value={formatCurrency(invested)}
          colorClass="text-green-400"
        />
        <MetricCard
          label="Current Value"
          value={formatCurrency(currentValue)}
          subValue={currentPoint.dividends > 0 ? `+ ${formatCurrency(currentPoint.dividends)} dividends` : undefined}
        />
        <MetricCard
          label="Total Return"
          value={formatPercent(returnValue)}
          subValue={`CAGR: ${formatPercent(cagr)}`}
          colorClass={returnColorClass}
        />
        <MetricCard
          label="Shares Owned"
          value={formatShares(shares)}
        />
      </div>

      {/* Final metrics at end of simulation */}
      {currentIndex === result.points.length - 1 && (
        <div className="mt-4 pt-4 border-t border-gray-800">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Final CAGR: </span>
              <span className={result.cagr >= 0 ? 'text-green-400' : 'text-red-400'}>
                {formatPercent(result.cagr)}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Total Dividends: </span>
              <span className="text-yellow-400">
                {formatCurrency(result.totalDividends)}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Final Shares: </span>
              <span className="text-white">{formatShares(result.finalShares)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
