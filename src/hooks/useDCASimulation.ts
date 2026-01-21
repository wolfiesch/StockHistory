'use client'

import { useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useConfigStore } from '@/store/configStore'
import { useSimulationStore } from '@/store/simulationStore'
import { usePlaybackStore } from '@/store/playbackStore'
import { runDCASimulation } from '@/lib/calculation/dcaEngine'
import type { PricePoint, DividendHistory } from '@/lib/api/types'

interface StockData {
  prices: PricePoint[]
  dividends: DividendHistory[]
}

async function fetchStockData(
  symbol: string,
  from?: string
): Promise<StockData> {
  const params = new URLSearchParams({ symbol })
  if (from) params.set('from', from)

  const [pricesRes, dividendsRes] = await Promise.all([
    fetch(`/api/stock/history?${params}`),
    fetch(`/api/stock/dividends?${params}`),
  ])

  if (!pricesRes.ok) {
    const error = await pricesRes.json()
    throw new Error(error.error || 'Failed to fetch prices')
  }

  if (!dividendsRes.ok) {
    const error = await dividendsRes.json()
    throw new Error(error.error || 'Failed to fetch dividends')
  }

  const pricesData = await pricesRes.json()
  const dividendsData = await dividendsRes.json()

  return {
    prices: pricesData.prices,
    dividends: dividendsData.dividends,
  }
}

export function useDCASimulation() {
  const {
    ticker,
    amount,
    frequency,
    startDate,
    isDRIP,
    comparisonTickers,
  } = useConfigStore()

  const {
    setPrimaryResult,
    setPrimaryLoading,
    setPrimaryError,
    addComparisonResult,
    setComparisonLoading,
    setComparisonError,
    removeComparison,
  } = useSimulationStore()

  const { reset: resetPlayback } = usePlaybackStore()

  // Primary ticker query
  const primaryQuery = useQuery({
    queryKey: ['stock-data', ticker, startDate],
    queryFn: () => fetchStockData(ticker, startDate),
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled: !!ticker,
  })

  // Process primary simulation when data changes
  useEffect(() => {
    if (primaryQuery.isLoading) {
      setPrimaryLoading(ticker)
      return
    }

    if (primaryQuery.error) {
      setPrimaryError(
        ticker,
        primaryQuery.error instanceof Error
          ? primaryQuery.error.message
          : 'Unknown error'
      )
      return
    }

    if (primaryQuery.data) {
      const result = runDCASimulation(
        primaryQuery.data.prices,
        primaryQuery.data.dividends,
        { amount, frequency, startDate, isDRIP }
      )
      setPrimaryResult(ticker, result)
      resetPlayback()
    }
  }, [
    primaryQuery.data,
    primaryQuery.isLoading,
    primaryQuery.error,
    ticker,
    amount,
    frequency,
    startDate,
    isDRIP,
    setPrimaryResult,
    setPrimaryLoading,
    setPrimaryError,
    resetPlayback,
  ])

  // Comparison tickers queries
  const fetchComparison = useCallback(
    async (compTicker: string) => {
      setComparisonLoading(compTicker)
      try {
        const data = await fetchStockData(compTicker, startDate)
        const result = runDCASimulation(data.prices, data.dividends, {
          amount,
          frequency,
          startDate,
          isDRIP,
        })
        addComparisonResult(compTicker, result)
      } catch (error) {
        setComparisonError(
          compTicker,
          error instanceof Error ? error.message : 'Unknown error'
        )
      }
    },
    [
      amount,
      frequency,
      startDate,
      isDRIP,
      setComparisonLoading,
      addComparisonResult,
      setComparisonError,
    ]
  )

  // Fetch comparison data when tickers change
  useEffect(() => {
    comparisonTickers.forEach(fetchComparison)
  }, [comparisonTickers, fetchComparison])

  // Clean up removed comparisons
  const { comparisons } = useSimulationStore.getState()
  useEffect(() => {
    comparisons.forEach((comp) => {
      if (!comparisonTickers.includes(comp.ticker)) {
        removeComparison(comp.ticker)
      }
    })
  }, [comparisonTickers, comparisons, removeComparison])

  return {
    isLoading: primaryQuery.isLoading,
    error: primaryQuery.error,
    refetch: primaryQuery.refetch,
  }
}
