'use client'

import { useEffect, useLayoutEffect, useRef, useMemo, useCallback, useState } from 'react'
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
import { formatCurrency, formatPercent } from '@/lib/calculation/dcaEngine'
import type { SimulationPoint } from '@/lib/api/types'

interface ChartSeriesData {
  time: UTCTimestamp
  value: number
}

interface TooltipData {
  visible: boolean
  x: number
  y: number
  date: string
  principal: number
  dividends: number
  gain: number
}

interface MiniChartCanvasProps {
  ticker: string
  points: SimulationPoint[]
  currentIndex: number
  totalReturn: number
  isLoading?: boolean
  error?: string | null
  retryAt?: number | null
}

/**
 * Transform simulation points to stacked area format for Lightweight Charts
 */
function transformToStackedData(points: SimulationPoint[]): {
  principal: ChartSeriesData[]
  dividends: ChartSeriesData[]
  gain: ChartSeriesData[]
} {
  const principal: ChartSeriesData[] = []
  const dividends: ChartSeriesData[] = []
  const gain: ChartSeriesData[] = []

  for (const point of points) {
    const time = (new Date(point.date).getTime() / 1000) as UTCTimestamp
    const gainValue = Math.max(0, point.marketValue - point.principal)

    principal.push({ time, value: point.principal })
    dividends.push({ time, value: point.dividends })
    gain.push({ time, value: gainValue })
  }

  return { principal, dividends, gain }
}

/**
 * Build a lookup map from timestamp to original data
 */
function buildDataLookup(points: SimulationPoint[]): Map<number, { principal: number; dividends: number; gain: number; date: string }> {
  const lookup = new Map()
  for (const point of points) {
    const time = new Date(point.date).getTime() / 1000
    lookup.set(time, {
      principal: point.principal,
      dividends: point.dividends,
      gain: Math.max(0, point.marketValue - point.principal),
      date: point.date,
    })
  }
  return lookup
}

export function MiniChartCanvas({
  ticker,
  points,
  currentIndex,
  totalReturn,
  isLoading,
  error,
  retryAt,
}: MiniChartCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const chartCreatedRef = useRef(false) // Track if chart was created (for Strict Mode)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const principalSeriesRef = useRef<ISeriesApi<any> | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dividendSeriesRef = useRef<ISeriesApi<any> | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gainSeriesRef = useRef<ISeriesApi<any> | null>(null)
  const dataLookupRef = useRef<Map<number, { principal: number; dividends: number; gain: number; date: string }>>(new Map())

  const [tooltip, setTooltip] = useState<TooltipData>({
    visible: false,
    x: 0,
    y: 0,
    date: '',
    principal: 0,
    dividends: 0,
    gain: 0,
  })

  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    if (!retryAt) return
    setNowMs(Date.now())
    const interval = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [retryAt])

  const retryInSeconds = retryAt ? Math.max(0, Math.ceil((retryAt - nowMs) / 1000)) : null

  // Transform ALL data for Lightweight Charts
  const allChartData = useMemo(() => {
    if (!points || points.length === 0) return null
    return transformToStackedData(points)
  }, [points])

  // Slice data up to current playback index for progressive reveal
  const chartData = useMemo(() => {
    if (!allChartData) return null
    const visibleIndex = Math.min(currentIndex + 1, allChartData.principal.length)
    return {
      principal: allChartData.principal.slice(0, visibleIndex),
      dividends: allChartData.dividends.slice(0, visibleIndex),
      gain: allChartData.gain.slice(0, visibleIndex),
    }
  }, [allChartData, currentIndex])

  // Build lookup map for tooltip
  const dataLookup = useMemo(() => {
    if (!points || points.length === 0) return new Map()
    return buildDataLookup(points)
  }, [points])

  useEffect(() => {
    dataLookupRef.current = dataLookup
  }, [dataLookup])

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
        dividends: point.dividends,
        gain: point.gain,
      })
    }
  }, [])

  // Initialize chart on mount - use useLayoutEffect for synchronous DOM operations
  // This prevents flash of empty content and handles React Strict Mode properly
  useLayoutEffect(() => {
    if (!containerRef.current || isLoading || error) return

    // Strict Mode guard: skip if chart was already created in this mount cycle
    if (chartCreatedRef.current && chartRef.current) {
      return
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#6b7280',
      },
      grid: {
        vertLines: { color: '#374151' },
        horzLines: { color: '#374151' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#6b7280', width: 1, style: 2 },
        horzLine: { color: '#6b7280', width: 1, style: 2 },
      },
      rightPriceScale: {
        borderColor: '#374151',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: '#374151',
        timeVisible: false,
        secondsVisible: false,
      },
      handleScroll: false,
      handleScale: false,
    })

    // Create stacked area series (order matters for layering)
    const gainSeries = chart.addSeries(AreaSeries, {
      lineColor: '#3b82f6',
      topColor: 'rgba(59, 130, 246, 0.6)',
      bottomColor: 'rgba(59, 130, 246, 0.1)',
      lineWidth: 1,
      priceFormat: { type: 'custom', formatter: (price: number) => `$${(price / 1000).toFixed(0)}k` },
    })

    const dividendSeries = chart.addSeries(AreaSeries, {
      lineColor: '#eab308',
      topColor: 'rgba(234, 179, 8, 0.6)',
      bottomColor: 'rgba(234, 179, 8, 0.1)',
      lineWidth: 1,
      priceFormat: { type: 'custom', formatter: (price: number) => `$${(price / 1000).toFixed(0)}k` },
    })

    const principalSeries = chart.addSeries(AreaSeries, {
      lineColor: '#22c55e',
      topColor: 'rgba(34, 197, 94, 0.6)',
      bottomColor: 'rgba(34, 197, 94, 0.1)',
      lineWidth: 1,
      priceFormat: { type: 'custom', formatter: (price: number) => `$${(price / 1000).toFixed(0)}k` },
    })

    chart.subscribeCrosshairMove(handleCrosshairMove)

    chartRef.current = chart
    principalSeriesRef.current = principalSeries
    dividendSeriesRef.current = dividendSeries
    gainSeriesRef.current = gainSeries
    chartCreatedRef.current = true

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
      dividendSeriesRef.current = null
      gainSeriesRef.current = null
      chartCreatedRef.current = false
    }
  }, [handleCrosshairMove, isLoading, error])

  // Update series data when visible data changes (progressive reveal)
  useEffect(() => {
    if (!chartData || !principalSeriesRef.current || !dividendSeriesRef.current || !gainSeriesRef.current) return

    principalSeriesRef.current.setData(chartData.principal)
    dividendSeriesRef.current.setData(chartData.dividends)
    gainSeriesRef.current.setData(chartData.gain)

    if (chartRef.current) {
      chartRef.current.timeScale().fitContent()
    }
  }, [chartData])

  if (isLoading) {
    return (
      <div className="bg-gray-900/50 rounded-xl p-4 h-48 flex items-center justify-center">
        <span className="text-gray-400">Loading {ticker}...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-gray-900/50 rounded-xl p-4 h-48 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400">{error}</div>
          {retryInSeconds !== null && retryInSeconds > 0 && (
            <div className="text-xs text-gray-400 mt-2">
              Retrying in {retryInSeconds}s...
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-900/50 rounded-xl p-4 relative">
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-white">{ticker}</span>
        <span className={totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}>
          {formatPercent(totalReturn)}
        </span>
      </div>
      <div className="h-40" ref={containerRef} />

      {/* Mini tooltip */}
      {tooltip.visible && (
        <div
          className="absolute pointer-events-none z-10 bg-gray-900 border border-gray-700 rounded-lg p-2 shadow-xl text-xs"
          style={{
            left: Math.min(tooltip.x + 10, (containerRef.current?.clientWidth ?? 200) - 120),
            top: Math.max(tooltip.y - 60, 40),
          }}
        >
          <p className="text-gray-400 mb-1">
            {new Date(tooltip.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </p>
          <div className="flex justify-between gap-2">
            <span className="text-green-500">Principal</span>
            <span className="text-white">{formatCurrency(tooltip.principal)}</span>
          </div>
          {tooltip.dividends > 0 && (
            <div className="flex justify-between gap-2">
              <span className="text-yellow-500">Dividends</span>
              <span className="text-white">{formatCurrency(tooltip.dividends)}</span>
            </div>
          )}
          {tooltip.gain > 0 && (
            <div className="flex justify-between gap-2">
              <span className="text-blue-500">Gain</span>
              <span className="text-white">{formatCurrency(tooltip.gain)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
