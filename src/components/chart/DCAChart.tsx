'use client'

import dynamic from 'next/dynamic'
import { ChartSkeleton } from '@/components/ui/Skeleton'

/**
 * Dynamic import wrapper for DCAChartCanvas
 * - SSR disabled to prevent WebGL/canvas issues during server rendering
 * - Shows skeleton while the chart component loads
 */
export const DCAChart = dynamic(
  () => import('./DCAChartCanvas').then(mod => mod.DCAChartCanvas),
  {
    ssr: false,
    loading: () => <ChartSkeleton />
  }
)
