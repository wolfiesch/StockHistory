'use client'

import { useState } from 'react'
import { useSimulationStore } from '@/store/simulationStore'
import { usePlaybackStore } from '@/store/playbackStore'
import { useConfigStore } from '@/store/configStore'
import { formatCurrency, formatPercent, formatShares } from '@/lib/calculation/dcaEngine'
import { MetricsSkeleton } from '@/components/ui/Skeleton'
import { exportSimulationToCSV } from '@/lib/export/csvExport'
import { getShareableURL } from '@/hooks/useURLSync'

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

function ShareIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

interface MetricsSummaryProps {
  onSettingsClick?: () => void
}

export function MetricsSummary({ onSettingsClick }: MetricsSummaryProps) {
  const { primary, benchmarks } = useSimulationStore()
  const { currentIndex } = usePlaybackStore()
  const config = useConfigStore()
  const showLumpSum = config.showLumpSum
  const benchmarkTickers = config.benchmarkTickers
  const [copied, setCopied] = useState(false)

  const handleExportCSV = () => {
    if (!primary || primary.result.points.length === 0) return
    exportSimulationToCSV(primary.result, {
      ticker: config.ticker,
      amount: config.amount,
      frequency: config.frequency,
      startDate: config.startDate,
      endDate: config.endDate,
      isDRIP: config.isDRIP,
    })
  }

  const handleShare = async () => {
    const url = getShareableURL()
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = url
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

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
  const lumpSumResult = primary.lumpSumResult
  const lumpSumPoint = lumpSumResult?.points[currentIndex]
    || lumpSumResult?.points[lumpSumResult.points.length - 1]

  // Calculate metrics at current point in time
  const invested = currentPoint.principal
  const currentValue = currentPoint.totalValue
  const returnValue = invested > 0 ? ((currentValue - invested) / invested) * 100 : 0
  const shares = currentPoint.shares
  const lumpSumValue = lumpSumPoint?.totalValue ?? 0
  const dcaVsLumpSum = currentValue - lumpSumValue
  const dcaVsLumpSumPercent = lumpSumValue > 0
    ? (dcaVsLumpSum / lumpSumValue) * 100
    : 0

  // For CAGR, calculate based on time from start to current point
  const startDate = new Date(result.points[0].date)
  const currentDate = new Date(currentPoint.date)
  const years = (currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
  const cagr = years > 0 && invested > 0
    ? (Math.pow(currentValue / invested, 1 / years) - 1) * 100
    : 0

  const returnColorClass = returnValue >= 0 ? 'text-green-400' : 'text-red-400'
  const deltaColorClass = dcaVsLumpSum >= 0 ? 'text-green-400' : 'text-red-400'

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
        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors"
            title="Copy shareable link"
          >
            {copied ? <CheckIcon /> : <ShareIcon />}
            <span className="hidden sm:inline">{copied ? 'Copied!' : 'Share'}</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors"
            title="Download CSV"
          >
            <DownloadIcon />
            <span className="hidden sm:inline">Export</span>
          </button>
          {onSettingsClick && (
            <button
              onClick={onSettingsClick}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
              title="Open settings"
            >
              <SettingsIcon />
              <span className="hidden sm:inline">Settings</span>
            </button>
          )}
          <span className="text-sm text-gray-400 ml-2">
            {new Date(currentPoint.date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        </div>
      </div>

      {primary.dividendsUnavailable && (
        <div className="rounded-lg border border-yellow-900/50 bg-yellow-900/20 px-3 py-2 text-sm text-yellow-200">
          Dividend data unavailable. {config.isDRIP ? 'DRIP results may be understated.' : 'Returns exclude dividends.'}
        </div>
      )}

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

      {showLumpSum && lumpSumPoint && lumpSumResult && lumpSumResult.totalInvested > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MetricCard
            label="Lump Sum Value"
            value={formatCurrency(lumpSumValue)}
            subValue={`Invested: ${formatCurrency(lumpSumResult.totalInvested)}`}
          />
          <MetricCard
            label="DCA vs Lump Sum"
            value={`${dcaVsLumpSum >= 0 ? '+' : ''}${formatCurrency(dcaVsLumpSum)}`}
            subValue={`Delta: ${formatPercent(dcaVsLumpSumPercent)}`}
            colorClass={deltaColorClass}
          />
        </div>
      )}

      {/* Benchmark Comparisons */}
      {benchmarkTickers.length > 0 && benchmarks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {benchmarks.map((bench) => {
            if (!bench.result?.points || bench.result.points.length === 0) {
              return null
            }
            const benchPoint = bench.result.points[currentIndex] || bench.result.points[bench.result.points.length - 1]
            const benchValue = benchPoint.marketValue
            const deltaVsBench = currentValue - benchValue
            const deltaVsBenchPercent = benchValue > 0
              ? (deltaVsBench / benchValue) * 100
              : 0
            const benchColorClass = deltaVsBench >= 0 ? 'text-green-400' : 'text-red-400'

            return (
              <MetricCard
                key={bench.ticker}
                label={`vs ${bench.ticker}`}
                value={`${deltaVsBench >= 0 ? '+' : ''}${formatCurrency(deltaVsBench)}`}
                subValue={`${deltaVsBench >= 0 ? '+' : ''}${formatPercent(deltaVsBenchPercent)} (${bench.ticker}: ${formatCurrency(benchValue)})`}
                colorClass={benchColorClass}
              />
            )
          })}
        </div>
      )}

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
