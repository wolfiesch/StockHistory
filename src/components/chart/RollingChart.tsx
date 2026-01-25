'use client'

import dynamic from 'next/dynamic'
import { ChartSkeleton } from '@/components/ui/Skeleton'

/**
 * Dynamic import wrapper for RollingChartCanvas
 * - SSR disabled to prevent WebGL/canvas issues during server rendering
 * - Shows skeleton while the chart component loads
 */
export const RollingChart = dynamic(
  () => import('./RollingChartCanvas').then((mod) => mod.RollingChartCanvas),
  {
    ssr: false,
    loading: () => <ChartSkeleton />,
  }
)
