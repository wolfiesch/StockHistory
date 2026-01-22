'use client'

import { useEffect, useCallback, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useConfigStore } from '@/store/configStore'
import { useSimulationStore } from '@/store/simulationStore'
import { usePlaybackStore } from '@/store/playbackStore'
import { runDCASimulation, runLumpSumSimulation } from '@/lib/calculation/dcaEngine'
import { HTTPError } from '@/lib/api/httpError'
import type { PricePoint, DividendHistory } from '@/lib/api/types'

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
      const retryAfterSeconds = typeof data.retryAfterSeconds === 'number'
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
    retryAfterSeconds: Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? retryAfterSeconds
      : undefined,
  }
}

async function fetchStockData(
  symbol: string,
  from?: string,
  to?: string
): Promise<StockData> {
  const params = new URLSearchParams({ symbol })
  if (from) params.set('from', from)
  if (to) params.set('to', to)

  // Start both requests in parallel, but treat dividends as best-effort.
  const pricesPromise = fetch(`/api/stock/history?${params}`)
  const dividendsPromise = fetch(`/api/stock/dividends?${params}`).catch(() => null)

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
    dividends = Array.isArray(dividendsData.dividends) ? dividendsData.dividends : []
  }

  return { prices: pricesData.prices, dividends, dividendsUnavailable }
}

export function useDCASimulation() {
  const {
    ticker,
    amount,
    frequency,
    startDate,
    endDate,
    isDRIP,
    comparisonTickers,
    benchmarkTickers,
  } = useConfigStore()

  const {
    setPrimaryResult,
    setPrimaryLoading,
    setPrimaryError,
    addComparisonResult,
    setComparisonLoading,
    setComparisonError,
    removeComparison,
    addBenchmarkResult,
    setBenchmarkLoading,
    setBenchmarkError,
    removeBenchmark,
  } = useSimulationStore()

  const { reset: resetPlayback } = usePlaybackStore()

  const primaryRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const comparisonRetryTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const benchmarkRetryTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Always call the latest comparison/benchmark fetch after rate-limit delays.
  const runComparisonFetchRef = useRef<((ticker: string) => Promise<void>) | null>(null)
  const runBenchmarkFetchRef = useRef<((ticker: string) => Promise<void>) | null>(null)

  useEffect(() => {
    const comparisonTimeouts = comparisonRetryTimeoutsRef.current
    const benchmarkTimeouts = benchmarkRetryTimeoutsRef.current
    return () => {
      if (primaryRetryTimeoutRef.current) {
        clearTimeout(primaryRetryTimeoutRef.current)
      }

      Object.values(comparisonTimeouts).forEach((timeout) => {
        clearTimeout(timeout)
      })
      Object.values(benchmarkTimeouts).forEach((timeout) => {
        clearTimeout(timeout)
      })
    }
  }, [])

  // Ensure stable query key - use empty string fallback to prevent array size changes during hydration
  // This prevents React error: "The final argument passed to useEffect changed size between renders"
  const stableStartDate = startDate || ''
  const stableEndDate = endDate || ''

  // Primary ticker query
  const primaryQuery = useQuery({
    queryKey: ['stock-data', ticker, stableStartDate, stableEndDate],
    queryFn: () => fetchStockData(ticker, stableStartDate || undefined, stableEndDate || undefined),
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled: !!ticker && !!stableStartDate && !!stableEndDate,
    retry: false,
  })

  const {
    data: primaryData,
    isLoading: primaryIsLoading,
    error: primaryError,
    refetch: primaryRefetch,
  } = primaryQuery

  // If the query key changes, cancel any pending retry.
  useEffect(() => {
    if (primaryRetryTimeoutRef.current) {
      clearTimeout(primaryRetryTimeoutRef.current)
      primaryRetryTimeoutRef.current = null
    }
  }, [ticker, stableStartDate, stableEndDate])

  // Process primary simulation when data changes
  useEffect(() => {
    if (primaryIsLoading) {
      setPrimaryLoading(ticker)
      return
    }

    if (primaryError) {
      if (primaryError instanceof HTTPError) {
        const retryAfterSeconds = primaryError.retryAfterSeconds
        const shouldRetry = primaryError.status === 429
        const retryAt = shouldRetry
          ? Date.now() + (retryAfterSeconds ?? 30) * 1000
          : null

        setPrimaryError(ticker, primaryError.message, retryAt)

        if (shouldRetry) {
          if (primaryRetryTimeoutRef.current) {
            clearTimeout(primaryRetryTimeoutRef.current)
          }
          primaryRetryTimeoutRef.current = setTimeout(() => {
            primaryRetryTimeoutRef.current = null
            primaryRefetch()
          }, (retryAfterSeconds ?? 30) * 1000)
        }
        return
      }

      setPrimaryError(
        ticker,
        primaryError instanceof Error
          ? primaryError.message
          : 'Unknown error'
      )
      return
    }

    if (primaryData && stableStartDate) {
      if (primaryRetryTimeoutRef.current) {
        clearTimeout(primaryRetryTimeoutRef.current)
        primaryRetryTimeoutRef.current = null
      }

      const result = runDCASimulation(
        primaryData.prices,
        primaryData.dividends,
        { amount, frequency, startDate: stableStartDate, isDRIP }
      )
      const lumpSumResult = runLumpSumSimulation(
        primaryData.prices,
        primaryData.dividends,
        { amount, frequency, startDate: stableStartDate, isDRIP },
        result.totalInvested
      )
      setPrimaryResult(ticker, result, primaryData.dividendsUnavailable, lumpSumResult)
      resetPlayback()
    }
  }, [
    primaryData,
    primaryIsLoading,
    primaryError,
    primaryRefetch,
    ticker,
    amount,
    frequency,
    stableStartDate,
    isDRIP,
    setPrimaryResult,
    setPrimaryLoading,
    setPrimaryError,
    resetPlayback,
  ])

  // Comparison tickers queries
  const runComparisonFetch = useCallback(
    async (compTicker: string) => {
      if (!stableStartDate || !stableEndDate) return // Guard against hydration state
      setComparisonLoading(compTicker)
      try {
        const data = await fetchStockData(compTicker, stableStartDate, stableEndDate)
        const result = runDCASimulation(data.prices, data.dividends, {
          amount,
          frequency,
          startDate: stableStartDate,
          isDRIP,
        })
        addComparisonResult(compTicker, result, data.dividendsUnavailable)
      } catch (error) {
        if (error instanceof HTTPError && error.status === 429) {
          const retryAfterSeconds = error.retryAfterSeconds ?? 30
          const retryAt = Date.now() + retryAfterSeconds * 1000
          setComparisonError(compTicker, error.message, retryAt)

          const existing = comparisonRetryTimeoutsRef.current[compTicker]
          if (existing) clearTimeout(existing)
          comparisonRetryTimeoutsRef.current[compTicker] = setTimeout(() => {
            delete comparisonRetryTimeoutsRef.current[compTicker]
            // Only retry if still selected
            if (useConfigStore.getState().comparisonTickers.includes(compTicker)) {
              runComparisonFetchRef.current?.(compTicker)
            }
          }, retryAfterSeconds * 1000)
          return
        }

        setComparisonError(compTicker, error instanceof Error ? error.message : 'Unknown error')
      }
    },
    [
      amount,
      frequency,
      stableStartDate,
      stableEndDate,
      isDRIP,
      setComparisonLoading,
      addComparisonResult,
      setComparisonError,
    ]
  )

  useEffect(() => {
    runComparisonFetchRef.current = runComparisonFetch
  }, [runComparisonFetch])

  // Fetch comparison data when tickers change
  useEffect(() => {
    comparisonTickers.forEach(runComparisonFetch)
  }, [comparisonTickers, runComparisonFetch])

  // Clean up removed comparisons
  const { comparisons, benchmarks } = useSimulationStore.getState()
  useEffect(() => {
    comparisons.forEach((comp) => {
      if (!comparisonTickers.includes(comp.ticker)) {
        const timeout = comparisonRetryTimeoutsRef.current[comp.ticker]
        if (timeout) {
          clearTimeout(timeout)
          delete comparisonRetryTimeoutsRef.current[comp.ticker]
        }
        removeComparison(comp.ticker)
      }
    })
  }, [comparisonTickers, comparisons, removeComparison])

  // Benchmark tickers fetch (mirrors comparison pattern)
  const runBenchmarkFetch = useCallback(
    async (benchTicker: string) => {
      if (!stableStartDate || !stableEndDate) return // Guard against hydration state
      setBenchmarkLoading(benchTicker)
      try {
        const data = await fetchStockData(benchTicker, stableStartDate, stableEndDate)
        const result = runDCASimulation(data.prices, data.dividends, {
          amount,
          frequency,
          startDate: stableStartDate,
          isDRIP,
        })
        addBenchmarkResult(benchTicker, result, data.dividendsUnavailable)
      } catch (error) {
        if (error instanceof HTTPError && error.status === 429) {
          const retryAfterSeconds = error.retryAfterSeconds ?? 30
          const retryAt = Date.now() + retryAfterSeconds * 1000
          setBenchmarkError(benchTicker, error.message, retryAt)

          const existing = benchmarkRetryTimeoutsRef.current[benchTicker]
          if (existing) clearTimeout(existing)
          benchmarkRetryTimeoutsRef.current[benchTicker] = setTimeout(() => {
            delete benchmarkRetryTimeoutsRef.current[benchTicker]
            // Only retry if still selected
            if (useConfigStore.getState().benchmarkTickers.includes(benchTicker)) {
              runBenchmarkFetchRef.current?.(benchTicker)
            }
          }, retryAfterSeconds * 1000)
          return
        }

        setBenchmarkError(benchTicker, error instanceof Error ? error.message : 'Unknown error')
      }
    },
    [
      amount,
      frequency,
      stableStartDate,
      stableEndDate,
      isDRIP,
      setBenchmarkLoading,
      addBenchmarkResult,
      setBenchmarkError,
    ]
  )

  useEffect(() => {
    runBenchmarkFetchRef.current = runBenchmarkFetch
  }, [runBenchmarkFetch])

  // Fetch benchmark data when tickers change
  useEffect(() => {
    benchmarkTickers.forEach(runBenchmarkFetch)
  }, [benchmarkTickers, runBenchmarkFetch])

  // Clean up removed benchmarks
  useEffect(() => {
    benchmarks.forEach((bench) => {
      if (!benchmarkTickers.includes(bench.ticker)) {
        const timeout = benchmarkRetryTimeoutsRef.current[bench.ticker]
        if (timeout) {
          clearTimeout(timeout)
          delete benchmarkRetryTimeoutsRef.current[bench.ticker]
        }
        removeBenchmark(bench.ticker)
      }
    })
  }, [benchmarkTickers, benchmarks, removeBenchmark])

  return {
    isLoading: primaryQuery.isLoading,
    error: primaryQuery.error,
    refetch: primaryQuery.refetch,
  }
}
