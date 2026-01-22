'use client'

import { useRollingAnalysisStore, selectStats, selectDataRange } from '@/store/rollingAnalysisStore'
import { useConfigStore } from '@/store/configStore'
import { formatCurrency, formatPercent } from '@/lib/calculation/dcaEngine'
import { MetricsSkeleton } from '@/components/ui/Skeleton'

interface MetricCardProps {
  label: string
  value: string
  subValue?: string
  colorClass?: string
}

function MetricCard({
  label,
  value,
  subValue,
  colorClass = 'text-white',
}: MetricCardProps) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-4">
      <p className="text-sm text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
      {subValue && <p className="text-sm text-gray-500 mt-1">{subValue}</p>}
    </div>
  )
}

function DistributionBar({
  negative,
  low,
  medium,
  high,
}: {
  negative: number
  low: number
  medium: number
  high: number
}) {
  return (
    <div className="space-y-2">
      <div className="flex h-3 rounded-full overflow-hidden bg-gray-700">
        <div
          className="bg-red-500"
          style={{ width: `${negative}%` }}
          title={`Negative: ${negative.toFixed(1)}%`}
        />
        <div
          className="bg-yellow-500"
          style={{ width: `${low}%` }}
          title={`0-50%: ${low.toFixed(1)}%`}
        />
        <div
          className="bg-green-500"
          style={{ width: `${medium}%` }}
          title={`50-100%: ${medium.toFixed(1)}%`}
        />
        <div
          className="bg-emerald-400"
          style={{ width: `${high}%` }}
          title={`100%+: ${high.toFixed(1)}%`}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span className="text-red-400">Loss: {negative.toFixed(0)}%</span>
        <span className="text-yellow-400">0-50%: {low.toFixed(0)}%</span>
        <span className="text-green-400">50-100%: {medium.toFixed(0)}%</span>
        <span className="text-emerald-400">100%+: {high.toFixed(0)}%</span>
      </div>
    </div>
  )
}

interface RollingMetricsSummaryProps {
  onSettingsClick?: () => void
}

export function RollingMetricsSummary({
  onSettingsClick,
}: RollingMetricsSummaryProps) {
  const { isComputing, error, result } = useRollingAnalysisStore()
  const stats = useRollingAnalysisStore(selectStats)
  const dataRange = useRollingAnalysisStore(selectDataRange)
  const { ticker, rollingHorizon, amount, frequency } = useConfigStore()

  // Loading state
  if (isComputing) {
    return <MetricsSkeleton />
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-900/50 rounded-lg p-4 text-red-300">
        {error}
      </div>
    )
  }

  // Empty state
  if (!result || stats.windowCount === 0) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {['Windows Analyzed', 'Median Return', 'Success Rate', 'Best Window'].map(
          (label) => (
            <MetricCard key={label} label={label} value="---" />
          )
        )}
      </div>
    )
  }

  const { bestWindow, worstWindow, returnDistribution } = stats
  const medianColorClass = stats.medianReturn >= 0 ? 'text-green-400' : 'text-red-400'
  const successColorClass = stats.successRate >= 80 ? 'text-green-400' : stats.successRate >= 50 ? 'text-yellow-400' : 'text-red-400'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">
            {ticker} - {rollingHorizon}-Year Rolling Analysis
          </h2>
          <p className="text-xs text-gray-500">
            ${amount} {frequency} investments • {stats.windowCount} historical
            windows analyzed
            {dataRange && (
              <>
                {' '}
                • Data from{' '}
                {new Date(dataRange.firstDate).toLocaleDateString('en-US', {
                  month: 'short',
                  year: 'numeric',
                })}{' '}
                -{' '}
                {new Date(dataRange.lastDate).toLocaleDateString('en-US', {
                  month: 'short',
                  year: 'numeric',
                })}
              </>
            )}
          </p>
        </div>
        {onSettingsClick && (
          <button
            onClick={onSettingsClick}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            Settings
          </button>
        )}
      </div>

      {/* Primary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Median Total Return"
          value={formatPercent(stats.medianReturn)}
          subValue={`CAGR: ${formatPercent(stats.medianCAGR)}`}
          colorClass={medianColorClass}
        />
        <MetricCard
          label="Success Rate"
          value={`${stats.successRate.toFixed(1)}%`}
          subValue="Windows with positive returns"
          colorClass={successColorClass}
        />
        <MetricCard
          label="Best Window"
          value={formatPercent(bestWindow?.totalReturn ?? 0)}
          subValue={
            bestWindow
              ? `${new Date(bestWindow.startDate).toLocaleDateString('en-US', {
                  month: 'short',
                  year: 'numeric',
                })} start`
              : undefined
          }
          colorClass="text-green-400"
        />
        <MetricCard
          label="Worst Window"
          value={formatPercent(worstWindow?.totalReturn ?? 0)}
          subValue={
            worstWindow
              ? `${new Date(worstWindow.startDate).toLocaleDateString('en-US', {
                  month: 'short',
                  year: 'numeric',
                })} start`
              : undefined
          }
          colorClass="text-red-400"
        />
      </div>

      {/* Return Distribution */}
      <div className="bg-gray-800/30 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-300 mb-3">
          Return Distribution
        </h3>
        <DistributionBar
          negative={returnDistribution.negative}
          low={returnDistribution.low}
          medium={returnDistribution.medium}
          high={returnDistribution.high}
        />
      </div>

      {/* Best/Worst Window Details */}
      {(bestWindow || worstWindow) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {bestWindow && (
            <div className="bg-green-900/20 border border-green-900/50 rounded-lg p-3">
              <p className="text-green-400 font-medium mb-1">
                Best Window Details
              </p>
              <p className="text-gray-300">
                Started:{' '}
                {new Date(bestWindow.startDate).toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
              <p className="text-gray-300">
                Final Value: {formatCurrency(bestWindow.finalValue)}
              </p>
              <p className="text-gray-300">
                Total Invested: {formatCurrency(bestWindow.totalInvested)}
              </p>
            </div>
          )}
          {worstWindow && (
            <div className="bg-red-900/20 border border-red-900/50 rounded-lg p-3">
              <p className="text-red-400 font-medium mb-1">
                Worst Window Details
              </p>
              <p className="text-gray-300">
                Started:{' '}
                {new Date(worstWindow.startDate).toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
              <p className="text-gray-300">
                Final Value: {formatCurrency(worstWindow.finalValue)}
              </p>
              <p className="text-gray-300">
                Total Invested: {formatCurrency(worstWindow.totalInvested)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
