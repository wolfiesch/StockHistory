'use client'

import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useConfigStore } from '@/store/configStore'
import { useRollingAnalysisStore } from '@/store/rollingAnalysisStore'
import { useRollingWorker } from './useRollingWorker'
import { HTTPError } from '@/lib/api/httpError'
import type {
  PricePoint,
  DividendHistory,
  RollingChartDataPoint,
  RollingWindowResult,
} from '@/lib/api/types'

interface StockData {
  prices: PricePoint[]
  dividends: DividendHistory[]
  dividendsUnavailable: boolean
}

async function readAPIError(response: Response): Promise<{
  message: string
  retryAfterSeconds?: number
}> {
  try {
    const data = await response.json()
    if (data && typeof data.error === 'string') {
      const retryAfterSeconds =
        typeof data.retryAfterSeconds === 'number'
          ? data.retryAfterSeconds
          : undefined
      return { message: data.error, retryAfterSeconds }
    }
  } catch {
    // ignore
  }

  const retryHeader = response.headers.get('retry-after')
  const retryAfterSeconds = retryHeader ? parseInt(retryHeader, 10) : NaN

  return {
    message: `Request failed (${response.status})`,
    retryAfterSeconds:
      Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? retryAfterSeconds
        : undefined,
  }
}

/**
 * Fetch full historical data for a ticker (no date filtering).
 * Rolling analysis needs the complete history to maximize window count.
 */
async function fetchFullStockData(symbol: string): Promise<StockData> {
  const params = new URLSearchParams({ symbol })

  // Start both requests in parallel
  const pricesPromise = fetch(`/api/stock/history?${params}`)
  const dividendsPromise = fetch(`/api/stock/dividends?${params}`).catch(
    () => null
  )

  const pricesRes = await pricesPromise
  if (!pricesRes.ok) {
    const { message, retryAfterSeconds } = await readAPIError(pricesRes)
    throw new HTTPError(message, pricesRes.status, retryAfterSeconds)
  }
  const pricesData = await pricesRes.json()

  let dividends: DividendHistory[] = []
  let dividendsUnavailable = false

  const dividendsRes = await dividendsPromise
  if (!dividendsRes || !dividendsRes.ok) {
    dividendsUnavailable = true
  } else {
    const dividendsData = await dividendsRes.json()
    dividends = Array.isArray(dividendsData.dividends)
      ? dividendsData.dividends
      : []
  }

  return { prices: pricesData.prices, dividends, dividendsUnavailable }
}

/**
 * Get reference start date for calendar mode.
 * Uses the median window's start date as the representative timeline.
 */
function getCalendarReferenceDate(result: RollingWindowResult): Date {
  const { windows } = result
  if (windows.length === 0) {
    return new Date()
  }

  // Sort windows by start date to find median
  const sortedDates = windows
    .map((w) => new Date(w.startDate).getTime())
    .sort((a, b) => a - b)

  const medianIndex = Math.floor(sortedDates.length / 2)
  return new Date(sortedDates[medianIndex])
}

/**
 * Convert month offset to Unix timestamp (seconds since epoch).
 * Lightweight Charts uses seconds, not milliseconds.
 */
function monthOffsetToTimestamp(referenceDate: Date, monthOffset: number): number {
  const date = new Date(referenceDate)
  date.setMonth(date.getMonth() + monthOffset)
  // Return seconds (Lightweight Charts uses seconds)
  return Math.floor(date.getTime() / 1000)
}

/**
 * Transform rolling analysis result to chart-ready data points.
 *
 * In normalized mode: X-axis shows month offsets (0, 1, 2, ...)
 * In calendar mode: X-axis shows actual dates using median window as reference
 */
function transformToChartData(
  result: RollingWindowResult,
  xAxisMode: 'normalized' | 'calendar'
): RollingChartDataPoint[] {
  const { normalizedBands } = result
  const { monthOffsets, valueBands } = normalizedBands

  if (monthOffsets.length === 0) return []

  // Get reference date for calendar mode (only computed when needed)
  const referenceDate =
    xAxisMode === 'calendar' ? getCalendarReferenceDate(result) : null

  const chartData: RollingChartDataPoint[] = []

  for (let i = 0; i < monthOffsets.length; i++) {
    // For normalized mode: use month offset directly
    // For calendar mode: convert to Unix timestamp using reference date
    const time =
      xAxisMode === 'normalized'
        ? monthOffsets[i]
        : monthOffsetToTimestamp(referenceDate!, monthOffsets[i])

    chartData.push({
      time,
      p10: valueBands.p10[i] ?? 0,
      p25: valueBands.p25[i] ?? 0,
      p50: valueBands.p50[i] ?? 0,
      p75: valueBands.p75[i] ?? 0,
      p90: valueBands.p90[i] ?? 0,
    })
  }

  return chartData
}

/**
 * Hook for managing rolling window DCA analysis.
 *
 * Only activates when viewMode is 'rolling'. Fetches full historical data,
 * computes rolling window analysis (via Web Worker), and updates the store.
 *
 * Uses a Web Worker to offload heavy computation, keeping the UI responsive
 * even when processing 20+ years of data with 180+ rolling windows.
 */
export function useRollingWindowAnalysis() {
  const {
    ticker,
    amount,
    frequency,
    isDRIP,
    viewMode,
    rollingHorizon,
    rollingXAxisMode,
  } = useConfigStore()

  const {
    setResult,
    setChartData,
    setComputing,
    setError,
    setAvailableHorizons,
    clearResults,
  } = useRollingAnalysisStore()

  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastComputeParamsRef = useRef<string | null>(null)

  // Web Worker for heavy computation
  const worker = useRollingWorker()

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
    }
  }, [])

  // Only fetch data when in rolling mode
  const isRollingMode = viewMode === 'rolling'

  const query = useQuery({
    queryKey: ['rolling-stock-data', ticker],
    queryFn: () => fetchFullStockData(ticker),
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled: isRollingMode && !!ticker,
    retry: false,
  })

  const { data, isLoading, error, refetch } = query

  // Clear retry timeout when ticker changes
  useEffect(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }
  }, [ticker])

  // Store worker ref for stable access in effects
  const workerRef = useRef(worker)
  workerRef.current = worker

  // Trigger worker computation when data or config changes
  useEffect(() => {
    if (!isRollingMode) {
      clearResults()
      workerRef.current.cancel()
      lastComputeParamsRef.current = null
      return
    }

    if (isLoading) {
      setComputing(true)
      return
    }

    if (error) {
      if (error instanceof HTTPError) {
        const retryAfterSeconds = error.retryAfterSeconds
        const shouldRetry = error.status === 429

        setError(error.message)

        if (shouldRetry) {
          if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current)
          }
          retryTimeoutRef.current = setTimeout(
            () => {
              retryTimeoutRef.current = null
              refetch()
            },
            (retryAfterSeconds ?? 30) * 1000
          )
        }
        return
      }

      setError(error instanceof Error ? error.message : 'Unknown error')
      return
    }

    if (!data?.prices || data.prices.length === 0) {
      return
    }

    // Create a key for the current computation parameters
    const computeKey = `${ticker}-${amount}-${frequency}-${rollingHorizon}-${isDRIP}`

    // Skip if we already computed with these exact parameters
    if (computeKey === lastComputeParamsRef.current) {
      return
    }

    lastComputeParamsRef.current = computeKey
    setComputing(true)

    // Offload computation to Web Worker (using ref for stable access)
    workerRef.current.compute(data.prices, data.dividends, {
      ticker,
      amount,
      frequency,
      horizonYears: rollingHorizon,
      isDRIP,
    })
  }, [
    isRollingMode,
    isLoading,
    error,
    data?.prices,
    data?.dividends,
    ticker,
    amount,
    frequency,
    rollingHorizon,
    isDRIP,
    refetch,
    setComputing,
    setError,
    clearResults,
  ])

  // Handle worker results - extract values to avoid object reference issues
  const workerResult = worker.result
  const workerError = worker.error
  const workerHorizons = worker.availableHorizons
  const workerIsComputing = worker.isComputing

  useEffect(() => {
    if (workerError) {
      setError(workerError)
      return
    }

    if (workerHorizons) {
      setAvailableHorizons(workerHorizons)
    }

    if (workerResult && isRollingMode) {
      setResult(workerResult)
      const chartData = transformToChartData(workerResult, rollingXAxisMode)
      setChartData(chartData)
    }
  }, [
    workerResult,
    workerError,
    workerHorizons,
    isRollingMode,
    rollingXAxisMode,
    setResult,
    setChartData,
    setError,
    setAvailableHorizons,
  ])

  // Update chart data when X-axis mode changes (without recomputing)
  useEffect(() => {
    if (workerResult && isRollingMode) {
      const chartData = transformToChartData(workerResult, rollingXAxisMode)
      setChartData(chartData)
    }
  }, [rollingXAxisMode, workerResult, isRollingMode, setChartData])

  return {
    isLoading: isLoading || workerIsComputing,
    error: error || workerError,
    refetch,
  }
}
