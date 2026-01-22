'use client'

import { useMemo, useState, useEffect } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { useSimulationStore } from '@/store/simulationStore'
import { usePlaybackStore } from '@/store/playbackStore'
import { useConfigStore } from '@/store/configStore'
import { formatCurrency } from '@/lib/calculation/dcaEngine'
import { ChartSkeleton } from '@/components/ui/Skeleton'

// Benchmark series colors (matching the other chart implementations)
const BENCHMARK_COLORS = ['#9ca3af', '#6b7280', '#d1d5db', '#4b5563']

/**
 * Format currency for Y-axis (compact for axis labels)
 */
function formatAxisCurrency(value: number): string {
  if (value >= 1000000) {
    return '$' + (value / 1000000).toFixed(1) + 'M'
  }
  if (value >= 1000) {
    return '$' + (value / 1000).toFixed(0) + 'K'
  }
  return '$' + value.toFixed(0)
}

export function DCAChartECharts() {
  const { primary, benchmarks } = useSimulationStore()
  const { currentIndex } = usePlaybackStore()
  const { showLumpSum } = useConfigStore()

  // Retry countdown state
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    if (!primary?.retryAt) return
    setNowMs(Date.now())
    const interval = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [primary?.retryAt])

  const retryInSeconds = primary?.retryAt
    ? Math.max(0, Math.ceil((primary.retryAt - nowMs) / 1000))
    : null

  // Build ECharts option
  const option: EChartsOption = useMemo(() => {
    if (!primary?.result?.points || primary.result.points.length === 0) {
      return {}
    }

    const visibleIndex = Math.min(currentIndex + 1, primary.result.points.length)
    const visiblePoints = primary.result.points.slice(0, visibleIndex)

    // X-axis dates
    const xData = visiblePoints.map((p) => p.date)

    // Build series array
    const series: EChartsOption['series'] = [
      // Principal (green area)
      {
        name: 'Principal',
        type: 'line',
        data: visiblePoints.map((p) => p.principal),
        smooth: true,
        symbol: 'none',
        lineStyle: {
          width: 2,
          color: '#22c55e',
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(34, 197, 94, 0.3)' },
              { offset: 1, color: 'rgba(34, 197, 94, 0.05)' },
            ],
          },
        },
        emphasis: {
          focus: 'series',
        },
        animationDuration: 300,
      },
      // Market Value (blue area)
      {
        name: 'Market Value',
        type: 'line',
        data: visiblePoints.map((p) => p.marketValue),
        smooth: true,
        symbol: 'none',
        lineStyle: {
          width: 2,
          color: '#3b82f6',
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0.05)' },
            ],
          },
        },
        emphasis: {
          focus: 'series',
        },
        animationDuration: 300,
      },
    ]

    // Lump Sum (orange dashed) - if enabled
    if (showLumpSum && primary.lumpSumResult?.points) {
      const lumpSumPoints = primary.lumpSumResult.points.slice(0, visibleIndex)
      series.push({
        name: 'Lump Sum',
        type: 'line',
        data: lumpSumPoints.map((p) => p.marketValue),
        smooth: true,
        symbol: 'none',
        lineStyle: {
          width: 2,
          color: '#f97316',
          type: 'dashed',
        },
        emphasis: {
          focus: 'series',
        },
        animationDuration: 300,
      })
    }

    // Benchmarks (gray dashed lines)
    benchmarks.forEach((bench, index) => {
      if (bench.result?.points && bench.result.points.length > 0) {
        const benchPoints = bench.result.points.slice(0, visibleIndex)
        series.push({
          name: bench.ticker,
          type: 'line',
          data: benchPoints.map((p) => p.marketValue),
          smooth: true,
          symbol: 'none',
          lineStyle: {
            width: 2,
            color: BENCHMARK_COLORS[index % BENCHMARK_COLORS.length],
            type: 'dashed',
          },
          emphasis: {
            focus: 'series',
          },
          animationDuration: 300,
        })
      }
    })

    return {
      backgroundColor: 'transparent',
      animation: true,
      animationDuration: 300,
      animationDurationUpdate: 300,
      animationEasing: 'cubicOut',
      animationEasingUpdate: 'cubicInOut',
      grid: {
        left: 70,
        right: 20,
        top: 60,
        bottom: 40,
        containLabel: false,
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        borderColor: '#374151',
        borderWidth: 1,
        padding: [12, 16],
        textStyle: {
          color: '#fff',
          fontSize: 13,
        },
        axisPointer: {
          type: 'cross',
          crossStyle: {
            color: '#6b7280',
          },
          lineStyle: {
            color: '#4b5563',
            type: 'dashed',
          },
        },
        formatter: (params: unknown) => {
          const paramArray = params as Array<{
            name: string
            seriesName: string
            value: number
            color: string
          }>
          if (!paramArray.length) return ''

          const date = new Date(paramArray[0].name).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
          })

          let html = `<div style="font-weight: 500; margin-bottom: 8px; color: #9ca3af;">${date}</div>`

          // Find principal and market value for gain/loss calculation
          let principal = 0
          let marketValue = 0

          paramArray.forEach((item) => {
            const color = item.color as string
            const formattedValue = formatCurrency(item.value)

            if (item.seriesName === 'Principal') {
              principal = item.value
            }
            if (item.seriesName === 'Market Value') {
              marketValue = item.value
            }

            html += `
              <div style="display: flex; justify-content: space-between; gap: 20px; margin: 4px 0;">
                <span style="display: flex; align-items: center; gap: 6px;">
                  <span style="width: 10px; height: 10px; border-radius: 50%; background: ${color};"></span>
                  ${item.seriesName}
                </span>
                <span style="font-weight: 600;">${formattedValue}</span>
              </div>
            `
          })

          // Add gain/loss if we have both values
          if (principal > 0 && marketValue > 0) {
            const gainLoss = marketValue - principal
            const gainLossPercent = (gainLoss / principal) * 100
            const isProfit = gainLoss >= 0
            const color = isProfit ? '#4ade80' : '#f87171'
            const sign = isProfit ? '+' : ''

            html += `
              <div style="border-top: 1px solid #374151; margin-top: 8px; padding-top: 8px; display: flex; justify-content: space-between; gap: 20px;">
                <span style="color: #9ca3af;">Gain/Loss</span>
                <span style="font-weight: 700; color: ${color};">
                  ${sign}${formatCurrency(gainLoss)} (${sign}${gainLossPercent.toFixed(1)}%)
                </span>
              </div>
            `
          }

          return html
        },
      },
      legend: {
        show: true,
        top: 10,
        left: 10,
        orient: 'horizontal',
        textStyle: {
          color: '#9ca3af',
          fontSize: 12,
        },
        itemWidth: 14,
        itemHeight: 14,
        itemGap: 16,
        icon: 'roundRect',
      },
      xAxis: {
        type: 'category',
        data: xData,
        boundaryGap: false,
        axisLine: {
          lineStyle: {
            color: '#374151',
          },
        },
        axisTick: {
          lineStyle: {
            color: '#374151',
          },
        },
        axisLabel: {
          color: '#9ca3af',
          fontSize: 11,
          hideOverlap: true,  // Auto-hide overlapping labels (ECharts 5.3+)
          interval: 'auto',   // Let ECharts auto-calculate label spacing
          formatter: (value: string) => {
            const date = new Date(value)
            return date.toLocaleDateString('en-US', {
              month: 'short',
              year: '2-digit',
            })
          },
        },
        splitLine: {
          show: false,
        },
      },
      yAxis: {
        type: 'value',
        animation: true,
        animationDuration: 300,
        animationDurationUpdate: 300,
        axisLine: {
          show: false,
        },
        axisTick: {
          show: false,
        },
        axisLabel: {
          color: '#9ca3af',
          fontSize: 11,
          formatter: formatAxisCurrency,
        },
        splitLine: {
          lineStyle: {
            color: '#374151',
            type: 'dashed',
          },
        },
      },
      series,
    }
  }, [primary, currentIndex, showLumpSum, benchmarks])

  // Determine display state
  const showLoading = primary?.isLoading
  const showError = primary?.error
  const showEmpty = !primary
  const showNoData =
    primary?.result?.points && primary.result.points.length === 0
  const showChart = !showLoading && !showError && !showEmpty && !showNoData

  return (
    <div className="h-[50vh] min-h-[400px] max-h-[700px] bg-gray-900/50 rounded-xl relative overflow-hidden">
      {/* Chart container */}
      {showChart && (
        <ReactECharts
          option={option}
          style={{ width: '100%', height: 'calc(100% - 32px)' }}
          opts={{ renderer: 'canvas' }}
          notMerge={false}
          lazyUpdate={true}
        />
      )}

      {/* State overlays */}
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
          <div className="text-center">
            <div className="text-red-400">{primary?.error}</div>
            {retryInSeconds !== null && retryInSeconds > 0 && (
              <div className="text-sm text-gray-400 mt-2">
                Retrying in {retryInSeconds}s...
              </div>
            )}
          </div>
        </div>
      )}

      {showNoData && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-gray-400">No data available for this period</div>
        </div>
      )}
    </div>
  )
}
