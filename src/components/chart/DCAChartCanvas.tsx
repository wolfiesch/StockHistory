'use client'

import { useEffect, useLayoutEffect, useRef, useState, useMemo, useCallback } from 'react'
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  type MouseEventParams,
  ColorType,
  CrosshairMode,
  AreaSeries,
} from 'lightweight-charts'
import { useSimulationStore } from '@/store/simulationStore'
import { usePlaybackStore } from '@/store/playbackStore'
import { formatCurrency } from '@/lib/calculation/dcaEngine'
import { ChartSkeleton } from '@/components/ui/Skeleton'
import type { SimulationPoint } from '@/lib/api/types'

interface TooltipData {
  visible: boolean
  x: number
  y: number
  date: string
  principal: number
  marketValue: number
  dividends: number
}

interface ChartSeriesData {
  time: UTCTimestamp
  value: number
}

/**
 * Transform simulation points to Lightweight Charts format
 */
function transformToLightweightData(points: SimulationPoint[]): {
  principal: ChartSeriesData[]
  marketValue: ChartSeriesData[]
} {
  const principal: ChartSeriesData[] = []
  const marketValue: ChartSeriesData[] = []

  for (const point of points) {
    const time = (new Date(point.date).getTime() / 1000) as UTCTimestamp
    principal.push({ time, value: point.principal })
    marketValue.push({ time, value: point.marketValue })
  }

  return { principal, marketValue }
}

/**
 * Build a lookup map from timestamp to original data point
 */
function buildDataLookup(points: SimulationPoint[]): Map<number, SimulationPoint> {
  const lookup = new Map<number, SimulationPoint>()
  for (const point of points) {
    const time = new Date(point.date).getTime() / 1000
    lookup.set(time, point)
  }
  return lookup
}

export function DCAChartCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const chartCreatedRef = useRef(false) // Track if chart was created (for Strict Mode)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const principalSeriesRef = useRef<ISeriesApi<any> | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const marketValueSeriesRef = useRef<ISeriesApi<any> | null>(null)
  const dataLookupRef = useRef<Map<number, SimulationPoint>>(new Map())

  const [tooltip, setTooltip] = useState<TooltipData>({
    visible: false,
    x: 0,
    y: 0,
    date: '',
    principal: 0,
    marketValue: 0,
    dividends: 0,
  })

  const { primary } = useSimulationStore()
  const { currentIndex } = usePlaybackStore()

  // Transform ALL data for Lightweight Charts (memoized)
  const allChartData = useMemo(() => {
    if (!primary?.result?.points) return null
    return transformToLightweightData(primary.result.points)
  }, [primary?.result?.points])

  // Slice data up to current playback index for progressive reveal
  const chartData = useMemo(() => {
    if (!allChartData) return null
    const visibleIndex = Math.min(currentIndex + 1, allChartData.principal.length)
    return {
      principal: allChartData.principal.slice(0, visibleIndex),
      marketValue: allChartData.marketValue.slice(0, visibleIndex),
    }
  }, [allChartData, currentIndex])

  // Build lookup map for tooltip data
  const dataLookup = useMemo(() => {
    if (!primary?.result?.points) return new Map<number, SimulationPoint>()
    return buildDataLookup(primary.result.points)
  }, [primary?.result?.points])

  // Store lookup in ref for crosshair callback
  useEffect(() => {
    dataLookupRef.current = dataLookup
  }, [dataLookup])

  // Handle crosshair move for tooltip
  const handleCrosshairMove = useCallback((param: MouseEventParams) => {
    if (!param.point || !param.time) {
      setTooltip(prev => ({ ...prev, visible: false }))
      return
    }

    const timestamp = param.time as number
    const point = dataLookupRef.current.get(timestamp)

    if (point) {
      setTooltip({
        visible: true,
        x: param.point.x,
        y: param.point.y,
        date: point.date,
        principal: point.principal,
        marketValue: point.marketValue,
        dividends: point.dividends,
      })
    }
  }, [])

  // Initialize chart on mount - use useLayoutEffect for synchronous DOM operations
  // This prevents flash of empty content and handles React Strict Mode properly
  useLayoutEffect(() => {
    if (!containerRef.current) return

    // Strict Mode guard: skip if chart was already created in this mount cycle
    if (chartCreatedRef.current && chartRef.current) {
      return
    }

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#1f2937' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: '#374151' },
        horzLines: { color: '#374151' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#6b7280',
          width: 1,
          style: 2,
        },
        horzLine: {
          color: '#6b7280',
          width: 1,
          style: 2,
        },
      },
      rightPriceScale: {
        borderColor: '#374151',
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      timeScale: {
        borderColor: '#374151',
        timeVisible: false,
        secondsVisible: false,
      },
      handleScroll: false,
      handleScale: false,
    })

    // Create principal series (green area)
    const principalSeries = chart.addSeries(AreaSeries, {
      lineColor: '#22c55e',
      topColor: 'rgba(34, 197, 94, 0.4)',
      bottomColor: 'rgba(34, 197, 94, 0.0)',
      lineWidth: 2,
    })

    // Create market value series (blue area)
    const marketValueSeries = chart.addSeries(AreaSeries, {
      lineColor: '#3b82f6',
      topColor: 'rgba(59, 130, 246, 0.4)',
      bottomColor: 'rgba(59, 130, 246, 0.0)',
      lineWidth: 2,
    })

    chart.subscribeCrosshairMove(handleCrosshairMove)

    chartRef.current = chart
    principalSeriesRef.current = principalSeries
    marketValueSeriesRef.current = marketValueSeries
    chartCreatedRef.current = true

    // Handle resize
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries[0] && chartRef.current) {
        const { width, height } = entries[0].contentRect
        chartRef.current.applyOptions({ width, height })
      }
    })

    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      chart.unsubscribeCrosshairMove(handleCrosshairMove)
      chart.remove()
      chartRef.current = null
      principalSeriesRef.current = null
      marketValueSeriesRef.current = null
      chartCreatedRef.current = false
    }
  }, [handleCrosshairMove])

  // Update series data when visible data changes (progressive reveal)
  useEffect(() => {
    if (!chartData || !principalSeriesRef.current || !marketValueSeriesRef.current) return

    principalSeriesRef.current.setData(chartData.principal)
    marketValueSeriesRef.current.setData(chartData.marketValue)

    // Fit content to show all visible data
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent()
    }
  }, [chartData])

  // Determine display state
  const showLoading = primary?.isLoading
  const showError = primary?.error
  const showEmpty = !primary
  const showNoData = allChartData && allChartData.principal.length === 0
  const showChart = !showLoading && !showError && !showEmpty && !showNoData

  // Calculate tooltip values when visible
  const gainLoss = tooltip.marketValue - tooltip.principal
  const gainLossPercent = tooltip.principal > 0 ? (gainLoss / tooltip.principal) * 100 : 0
  const isProfit = gainLoss >= 0

  // Always render the chart container to keep the ref attached
  // Show overlays for different states
  return (
    <div className="h-[400px] bg-gray-900/50 rounded-xl relative overflow-hidden">
      {/* Chart container - always rendered to keep ref attached */}
      <div
        ref={containerRef}
        style={{ width: '100%', height: '368px' }}
        className={showChart ? '' : 'invisible'}
      />

      {/* State overlays - positioned absolutely over the chart area */}
      {showEmpty && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-gray-400">Enter a ticker to start</div>
        </div>
      )}

      {showLoading && (
        <div className="absolute inset-0">
          <ChartSkeleton />
        </div>
      )}

      {showError && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-red-400">{primary?.error}</div>
        </div>
      )}

      {showNoData && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-gray-400">No data available for this period</div>
        </div>
      )}

      {/* Legend - only show when chart is visible */}
      {showChart && (
        <div className="absolute top-6 left-6 flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-gray-400">Principal</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-gray-400">Market Value</span>
          </div>
        </div>
      )}

      {/* Custom Tooltip */}
      {showChart && tooltip.visible && (
        <div
          className="absolute pointer-events-none z-10 bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl"
          style={{
            left: Math.min(tooltip.x + 10, (containerRef.current?.clientWidth ?? 400) - 200),
            top: Math.max(tooltip.y - 100, 10),
          }}
        >
          <p className="text-gray-400 text-sm mb-2">
            {new Date(tooltip.date).toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric',
            })}
          </p>
          <div className="flex justify-between gap-4 text-sm">
            <span className="text-green-500">Principal</span>
            <span className="text-white font-medium">
              {formatCurrency(tooltip.principal)}
            </span>
          </div>
          <div className="flex justify-between gap-4 text-sm">
            <span className="text-blue-500">Market Value</span>
            <span className="text-white font-medium">
              {formatCurrency(tooltip.marketValue)}
            </span>
          </div>
          {tooltip.dividends > 0 && (
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-yellow-500">Dividends</span>
              <span className="text-white font-medium">
                {formatCurrency(tooltip.dividends)}
              </span>
            </div>
          )}
          <div className="border-t border-gray-700 mt-2 pt-2 flex justify-between gap-4">
            <span className="text-gray-400">Gain/Loss</span>
            <span className={`font-bold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
              {isProfit ? '+' : ''}{formatCurrency(gainLoss)} ({isProfit ? '+' : ''}{gainLossPercent.toFixed(1)}%)
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
