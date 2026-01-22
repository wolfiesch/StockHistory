'use client'

import dynamic from 'next/dynamic'
import { ChartSkeleton } from '@/components/ui/Skeleton'

/**
 * Dynamic import wrapper for DCAChartECharts
 * - SSR disabled to prevent canvas/window issues during server rendering
 * - ECharts requires browser APIs for canvas rendering
 * - Shows skeleton while the chart component loads
 */
export const DCAChartEChartsWrapper = dynamic(
  () => import('./DCAChartECharts').then(mod => mod.DCAChartECharts),
  {
    ssr: false,
    loading: () => <ChartSkeleton />
  }
)
