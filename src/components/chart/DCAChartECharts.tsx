'use client'

import { useMemo, useRef } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { useSimulationStore } from '@/store/simulationStore'
import { usePlaybackStore } from '@/store/playbackStore'
import { formatCurrency } from '@/lib/calculation/dcaEngine'
import { ChartSkeleton } from '@/components/ui/Skeleton'

/**
 * DCA Chart using ECharts
 * - No watermark (unlike TradingView)
 * - Uses dynamic interval calculation for x-axis labels (~10 labels max)
 */
export function DCAChartECharts() {
  const chartRef = useRef<ReactECharts>(null)

  const { primary } = useSimulationStore()
  const { currentIndex } = usePlaybackStore()

  // Slice data up to current playback index for progressive reveal
  const visibleData = useMemo(() => {
    if (!primary?.result?.points) return null
    const visibleIndex = Math.min(currentIndex + 1, primary.result.points.length)
    return primary.result.points.slice(0, visibleIndex)
  }, [primary?.result?.points, currentIndex])

  // Build ECharts option
  const option: EChartsOption = useMemo(() => {
    if (!visibleData || visibleData.length === 0) {
      return {}
    }

    const dates = visibleData.map((p) => p.date)
    const principalData = visibleData.map((p) => p.principal)
    const marketValueData = visibleData.map((p) => p.marketValue)

    // Calculate interval from FULL dataset to keep labels stable during playback
    // Using visible data length causes labels to shift as playback progresses
    const fullDataLength = primary?.result?.points?.length ?? dates.length
    const labelInterval = Math.max(1, Math.floor(fullDataLength / 10))

    return {
      backgroundColor: 'transparent',
      animation: false, // Disable animation for smooth playback
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1f2937',
        borderColor: '#374151',
        textStyle: {
          color: '#e5e7eb',
        },
        formatter: (params: unknown) => {
          const data = params as Array<{
            axisValue: string
            marker: string
            seriesName: string
            value: number
          }>
          if (!data || data.length === 0) return ''

          const date = new Date(data[0].axisValue).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
          })

          const principal = data.find((d) => d.seriesName === 'Principal')?.value ?? 0
          const marketValue = data.find((d) => d.seriesName === 'Market Value')?.value ?? 0
          const gainLoss = marketValue - principal
          const gainLossPercent = principal > 0 ? (gainLoss / principal) * 100 : 0
          const isProfit = gainLoss >= 0

          return `
            <div style="font-size: 12px;">
              <div style="color: #9ca3af; margin-bottom: 8px;">${date}</div>
              <div style="display: flex; justify-content: space-between; gap: 16px;">
                <span style="color: #22c55e;">Principal</span>
                <span style="color: white; font-weight: 500;">${formatCurrency(principal)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 16px;">
                <span style="color: #3b82f6;">Market Value</span>
                <span style="color: white; font-weight: 500;">${formatCurrency(marketValue)}</span>
              </div>
              <div style="border-top: 1px solid #374151; margin-top: 8px; padding-top: 8px; display: flex; justify-content: space-between; gap: 16px;">
                <span style="color: #9ca3af;">Gain/Loss</span>
                <span style="color: ${isProfit ? '#4ade80' : '#f87171'}; font-weight: bold;">
                  ${isProfit ? '+' : ''}${formatCurrency(gainLoss)} (${isProfit ? '+' : ''}${gainLossPercent.toFixed(1)}%)
                </span>
              </div>
            </div>
          `
        },
      },
      legend: {
        data: ['Principal', 'Market Value'],
        top: 10,
        left: 10,
        textStyle: {
          color: '#9ca3af',
        },
        icon: 'circle',
        itemWidth: 10,
        itemHeight: 10,
      },
      grid: {
        left: 10,
        right: 60,
        top: 50,
        bottom: 30,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: dates,
        boundaryGap: false,
        axisLine: {
          lineStyle: {
            color: '#374151',
          },
        },
        axisLabel: {
          color: '#9ca3af',
          fontSize: 11,
          interval: labelInterval - 1, // Show every Nth label (0-indexed, so -1)
          rotate: dates.length > 60 ? 45 : 0, // Rotate labels for very long date ranges
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
        position: 'right',
        axisLine: {
          show: false,
        },
        axisLabel: {
          color: '#9ca3af',
          fontSize: 11,
          formatter: (value: number) => {
            if (value >= 1000) {
              return `$${(value / 1000).toFixed(0)}k`
            }
            return `$${value}`
          },
        },
        splitLine: {
          lineStyle: {
            color: '#374151',
            type: 'dashed',
          },
        },
      },
      series: [
        {
          name: 'Principal',
          type: 'line',
          data: principalData,
          smooth: false,
          symbol: 'none',
          lineStyle: {
            color: '#22c55e',
            width: 2,
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(34, 197, 94, 0.4)' },
                { offset: 1, color: 'rgba(34, 197, 94, 0.0)' },
              ],
            },
          },
        },
        {
          name: 'Market Value',
          type: 'line',
          data: marketValueData,
          smooth: false,
          symbol: 'none',
          lineStyle: {
            color: '#3b82f6',
            width: 2,
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(59, 130, 246, 0.4)' },
                { offset: 1, color: 'rgba(59, 130, 246, 0.0)' },
              ],
            },
          },
        },
      ],
    }
  }, [visibleData, primary?.result?.points])

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
          ref={chartRef}
          opts={{ renderer: 'canvas' }}
          notMerge={true}
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
          <div className="text-red-400">{primary?.error}</div>
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
