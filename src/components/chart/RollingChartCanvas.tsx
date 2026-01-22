'use client'

import { useEffect, useLayoutEffect, useRef, useState, useMemo, useCallback } from 'react'
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  ColorType,
  CrosshairMode,
  LineSeries,
} from 'lightweight-charts'
import { useRollingAnalysisStore, selectStats } from '@/store/rollingAnalysisStore'
import { useConfigStore } from '@/store/configStore'
import {
  renderPercentileBands,
  createRendererConfig,
  formatBandValue,
} from '@/lib/chart/PercentileBandPlugin'
import { ChartSkeleton } from '@/components/ui/Skeleton'
import type { RollingChartDataPoint } from '@/lib/api/types'

interface TooltipData {
  visible: boolean
  x: number
  y: number
  month: number
  p10: number
  p25: number
  p50: number
  p75: number
  p90: number
}

/**
 * Transform chart data to line series format (for median line)
 */
function transformToLineData(
  data: RollingChartDataPoint[]
): Array<{ time: number; value: number }> {
  return data.map((d) => ({
    time: d.time,
    value: d.p50,
  }))
}

/**
 * Build a lookup map from time to data point
 */
function buildDataLookup(
  data: RollingChartDataPoint[]
): Map<number, RollingChartDataPoint> {
  const lookup = new Map<number, RollingChartDataPoint>()
  for (const point of data) {
    lookup.set(point.time, point)
  }
  return lookup
}

export function RollingChartCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const bandCanvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const chartCreatedRef = useRef(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const medianSeriesRef = useRef<ISeriesApi<any> | null>(null)
  const dataLookupRef = useRef<Map<number, RollingChartDataPoint>>(new Map())

  const [tooltip, setTooltip] = useState<TooltipData>({
    visible: false,
    x: 0,
    y: 0,
    month: 0,
    p10: 0,
    p25: 0,
    p50: 0,
    p75: 0,
    p90: 0,
  })

  const { chartData, isComputing, error, result } = useRollingAnalysisStore()
  const { rollingHorizon, rollingXAxisMode } = useConfigStore()
  const stats = useRollingAnalysisStore(selectStats)

  // Transform data for the median line series
  const lineData = useMemo(() => transformToLineData(chartData), [chartData])

  // Build lookup map for tooltip
  const dataLookup = useMemo(() => buildDataLookup(chartData), [chartData])

  // Store lookup in ref for crosshair callback
  useEffect(() => {
    dataLookupRef.current = dataLookup
  }, [dataLookup])

  // Handle crosshair move for tooltip
  const handleCrosshairMove = useCallback((param: MouseEventParams) => {
    if (!param.point || !param.time) {
      setTooltip((prev) => ({ ...prev, visible: false }))
      return
    }

    const time = param.time as number
    const point = dataLookupRef.current.get(time)

    if (point) {
      setTooltip({
        visible: true,
        x: param.point.x,
        y: param.point.y,
        month: point.time,
        p10: point.p10,
        p25: point.p25,
        p50: point.p50,
        p75: point.p75,
        p90: point.p90,
      })
    }
  }, [])

  // Draw percentile bands on canvas overlay
  const drawBands = useCallback(() => {
    const canvas = bandCanvasRef.current
    const chart = chartRef.current
    if (!canvas || !chart || chartData.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Get chart dimensions
    const chartElement = containerRef.current
    if (!chartElement) return

    // Sync canvas size with chart
    const rect = chartElement.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = (rect.height - 32) * dpr // Account for legend area
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height - 32}px`
    ctx.scale(dpr, dpr)

    // Clear previous drawing
    ctx.clearRect(0, 0, rect.width, rect.height)

    // Get coordinate converters from chart
    const timeScale = chart.timeScale()
    const medianSeries = medianSeriesRef.current

    if (!medianSeries) return

    // Converter functions
    const timeToX = (time: number): number => {
      const coord = timeScale.timeToCoordinate(time as never)
      return coord ?? 0
    }

    const priceToY = (price: number): number => {
      // Use series to convert price to coordinate
      const coord = medianSeries.priceToCoordinate(price)
      return coord ?? 0
    }

    // Render the bands
    const config = createRendererConfig(chartData)
    renderPercentileBands(ctx, config, timeToX, priceToY)
  }, [chartData])

  // Initialize chart on mount
  useLayoutEffect(() => {
    if (!containerRef.current) return

    // Strict Mode guard
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
        timeVisible: rollingXAxisMode === 'calendar',
        secondsVisible: false,
        tickMarkFormatter: (time: number) => {
          if (rollingXAxisMode === 'normalized') {
            return `Month ${time}`
          }
          // For calendar mode, time is a Unix timestamp (seconds)
          const date = new Date(time * 1000)
          return date.toLocaleDateString('en-US', {
            month: 'short',
            year: '2-digit',
          })
        },
      },
      handleScroll: true,
      handleScale: true,
    })

    // Create median line series (transparent - bands are drawn underneath)
    // We use lineWidth: 1 since 0 is not valid, but transparent color hides it
    const medianSeries = chart.addSeries(LineSeries, {
      color: 'transparent', // Hidden - we draw bands ourselves
      lineWidth: 1,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    })

    chart.subscribeCrosshairMove(handleCrosshairMove)

    chartRef.current = chart
    medianSeriesRef.current = medianSeries
    chartCreatedRef.current = true

    // Handle resize
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries[0] && chartRef.current) {
        const { width, height } = entries[0].contentRect
        chartRef.current.applyOptions({ width, height })
        // Redraw bands after resize
        requestAnimationFrame(drawBands)
      }
    })

    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      chart.unsubscribeCrosshairMove(handleCrosshairMove)
      chart.remove()
      chartRef.current = null
      medianSeriesRef.current = null
      chartCreatedRef.current = false
    }
  }, [handleCrosshairMove, drawBands, rollingXAxisMode])

  // Update time scale formatter when X-axis mode changes
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.applyOptions({
        timeScale: {
          timeVisible: rollingXAxisMode === 'calendar',
          tickMarkFormatter: (time: number) => {
            if (rollingXAxisMode === 'normalized') {
              return `Month ${time}`
            }
            // For calendar mode, time is a Unix timestamp (seconds)
            const date = new Date(time * 1000)
            return date.toLocaleDateString('en-US', {
              month: 'short',
              year: '2-digit',
            })
          },
        },
      })
    }
  }, [rollingXAxisMode])

  // Update series data when chart data changes
  useEffect(() => {
    if (!medianSeriesRef.current || lineData.length === 0) return

    medianSeriesRef.current.setData(lineData as never)

    // Set price scale range based on data
    if (chartRef.current && chartData.length > 0) {
      chartRef.current.priceScale('right').applyOptions({
        autoScale: true,
      })
      chartRef.current.timeScale().fitContent()
    }

    // Draw bands after data update
    requestAnimationFrame(drawBands)
  }, [lineData, chartData, drawBands])

  // Redraw bands when chart moves/scales
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    const handleTimeRangeChange = () => {
      requestAnimationFrame(drawBands)
    }

    chart.timeScale().subscribeVisibleTimeRangeChange(handleTimeRangeChange)

    return () => {
      chart.timeScale().unsubscribeVisibleTimeRangeChange(handleTimeRangeChange)
    }
  }, [drawBands])

  // Determine display state
  const showLoading = isComputing
  const showError = !!error
  const showEmpty = chartData.length === 0 && !isComputing && !error
  const showChart = !showLoading && !showError && !showEmpty

  return (
    <div className="h-[50vh] min-h-[400px] max-h-[700px] bg-gray-900/50 rounded-xl relative overflow-hidden">
      {/* Chart container */}
      <div
        ref={containerRef}
        className={`w-full h-[calc(100%-32px)] ${showChart ? '' : 'invisible'}`}
      />

      {/* Canvas overlay for band rendering */}
      <canvas
        ref={bandCanvasRef}
        className={`absolute top-0 left-0 pointer-events-none ${
          showChart ? '' : 'invisible'
        }`}
        style={{ zIndex: 1 }}
      />

      {/* State overlays */}
      {showEmpty && !result && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-gray-400">
            Switch to Rolling Analysis mode and select a ticker
          </div>
        </div>
      )}

      {showEmpty && result && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-gray-400">
            No data available for {rollingHorizon}-year rolling windows
          </div>
        </div>
      )}

      {showLoading && (
        <div className="absolute inset-0">
          <ChartSkeleton />
        </div>
      )}

      {showError && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-red-400">{error}</div>
          </div>
        </div>
      )}

      {/* Legend */}
      {showChart && (
        <div className="absolute top-6 left-6 flex flex-wrap gap-4 text-sm z-10">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)' }}
            />
            <span className="text-gray-400">10th-90th Percentile</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: 'rgba(59, 130, 246, 0.3)' }}
            />
            <span className="text-gray-400">25th-75th Percentile</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-blue-500 rounded" />
            <span className="text-gray-400">Median (50th)</span>
          </div>
        </div>
      )}

      {/* Info badge */}
      {showChart && stats.windowCount > 0 && (
        <div className="absolute top-6 right-6 bg-gray-800/80 rounded-lg px-3 py-1.5 text-sm text-gray-300 z-10">
          {stats.windowCount} rolling windows analyzed
        </div>
      )}

      {/* Custom Tooltip */}
      {showChart && tooltip.visible && (
        <div
          className="absolute pointer-events-none z-20 bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl"
          style={{
            left: Math.min(
              tooltip.x + 10,
              (containerRef.current?.clientWidth ?? 400) - 220
            ),
            top: Math.max(tooltip.y - 140, 10),
          }}
        >
          <p className="text-gray-400 text-sm mb-2 font-medium">
            {rollingXAxisMode === 'normalized'
              ? `Month ${tooltip.month}`
              : new Date(tooltip.month * 1000).toLocaleDateString('en-US', {
                  month: 'short',
                  year: 'numeric',
                })}
            {/* Show horizon mark - for calendar mode, calculate if this is the horizon point */}
            {rollingXAxisMode === 'normalized' &&
              tooltip.month === rollingHorizon * 12 && (
                <span className="text-blue-400 ml-2">
                  ({rollingHorizon}Y mark)
                </span>
              )}
          </p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-blue-300">90th Percentile</span>
              <span className="text-white font-medium">
                {formatBandValue(tooltip.p90)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-blue-400">75th Percentile</span>
              <span className="text-white font-medium">
                {formatBandValue(tooltip.p75)}
              </span>
            </div>
            <div className="flex justify-between gap-4 bg-blue-500/20 -mx-2 px-2 py-0.5 rounded">
              <span className="text-blue-400 font-medium">Median (50th)</span>
              <span className="text-white font-bold">
                {formatBandValue(tooltip.p50)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-blue-400">25th Percentile</span>
              <span className="text-white font-medium">
                {formatBandValue(tooltip.p25)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-blue-300">10th Percentile</span>
              <span className="text-white font-medium">
                {formatBandValue(tooltip.p10)}
              </span>
            </div>
          </div>
          <div className="border-t border-gray-700 mt-2 pt-2 text-xs text-gray-500">
            Based on {stats.windowCount} historical windows
          </div>
        </div>
      )}
    </div>
  )
}
