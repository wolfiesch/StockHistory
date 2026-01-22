'use client'

import dynamic from 'next/dynamic'
import { ChartSkeleton } from '@/components/ui/Skeleton'

/**
 * Dynamic import wrapper for DCAChartECharts
 * - SSR disabled to prevent canvas/chart issues during server rendering
 * - Shows skeleton while the chart component loads
 * - Uses ECharts (no watermark, with hideOverlap for x-axis labels)
 */
export const DCAChart = dynamic(
  () => import('./DCAChartECharts').then(mod => mod.DCAChartECharts),
  {
    ssr: false,
    loading: () => <ChartSkeleton />
  }
)
