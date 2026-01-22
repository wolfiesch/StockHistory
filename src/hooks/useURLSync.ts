'use client'

import { useEffect, useRef } from 'react'
import { useConfigStore } from '@/store/configStore'
import type { InvestmentFrequency, ViewMode, HorizonYears, RollingXAxisMode } from '@/lib/api/types'

const VALID_FREQUENCIES: InvestmentFrequency[] = ['weekly', 'biweekly', 'monthly']
const VALID_VIEW_MODES: ViewMode[] = ['single', 'rolling']
const VALID_HORIZONS: HorizonYears[] = [5, 10, 15, 20]
const VALID_X_AXIS_MODES: RollingXAxisMode[] = ['normalized', 'calendar']
const TICKER_PATTERN = /^[A-Z0-9]{1,10}(?:[.-][A-Z0-9]{1,6})?$/

/**
 * Syncs configuration state with URL parameters for shareable links.
 *
 * URL params:
 * - t: ticker (e.g., AAPL)
 * - a: amount (e.g., 100)
 * - f: frequency (weekly, biweekly, monthly)
 * - s: start date (YYYY-MM-DD)
 * - e: end date (YYYY-MM-DD)
 * - d: DRIP enabled (1 or 0)
 * - c: comparison tickers (comma-separated, e.g., MSFT,GOOGL)
 * - b: benchmark tickers (comma-separated, e.g., SPY,QQQ)
 * - v: view mode (single, rolling)
 * - h: rolling horizon (5, 10, 15, 20)
 * - x: rolling X-axis mode (normalized, calendar)
 */
export function useURLSync() {
  console.log('useURLSync')
  const hasInitialized = useRef(false)
  const {
    ticker,
    amount,
    frequency,
    startDate,
    endDate,
    isDRIP,
    comparisonTickers,
    benchmarkTickers,
    viewMode,
    rollingHorizon,
    rollingXAxisMode,
    setConfig,
    _hasHydrated,
  } = useConfigStore()

  // On mount, read URL params and apply them (URL takes precedence over localStorage)
  useEffect(() => {
    if (hasInitialized.current || typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)

    // Only apply URL params if there are any config-related params
    const hasConfigParams = params.has('t') || params.has('a') || params.has('f') ||
                           params.has('s') || params.has('e') || params.has('d') || params.has('c') ||
                           params.has('b') || params.has('v') || params.has('h') || params.has('x')
    console.log('hasConfigParams', hasConfigParams)
    if (!hasConfigParams) {
      hasInitialized.current = true
      return
    }

    const config: Parameters<typeof setConfig>[0] = {}

    // Parse ticker
    const urlTicker = params.get('t')
    if (urlTicker) {
      const normalizedTicker = urlTicker.toUpperCase()
      if (TICKER_PATTERN.test(normalizedTicker)) {
        config.ticker = normalizedTicker
      }
    }

    // Parse amount
    const urlAmount = params.get('a')
    if (urlAmount) {
      const parsed = parseInt(urlAmount, 10)
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 10000) {
        config.amount = parsed
      }
    }

    // Parse frequency
    const urlFrequency = params.get('f') as InvestmentFrequency
    if (urlFrequency && VALID_FREQUENCIES.includes(urlFrequency)) {
      config.frequency = urlFrequency
    }

    // Parse start date
    const urlStartDate = params.get('s')
    if (urlStartDate && /^\d{4}-\d{2}-\d{2}$/.test(urlStartDate)) {
      const date = new Date(urlStartDate)
      if (!isNaN(date.getTime())) {
        config.startDate = urlStartDate
      }
    }

    // Parse end date
    const urlEndDate = params.get('e')
    if (urlEndDate && /^\d{4}-\d{2}-\d{2}$/.test(urlEndDate)) {
      const date = new Date(urlEndDate)
      if (!isNaN(date.getTime())) {
        config.endDate = urlEndDate
      }
    }

    // Parse DRIP
    const urlDRIP = params.get('d')
    if (urlDRIP === '0' || urlDRIP === '1') {
      config.isDRIP = urlDRIP === '1'
    }

    // Parse comparison tickers
    const urlComparisons = params.get('c')
    if (urlComparisons) {
      const tickers = urlComparisons
        .split(',')
        .map((t) => t.trim().toUpperCase())
        .filter((t) => TICKER_PATTERN.test(t))
        .slice(0, 2)
      if (tickers.length > 0) {
        config.comparisonTickers = tickers
      }
    }

    // Parse benchmark tickers
    const urlBenchmarks = params.get('b')
    if (urlBenchmarks) {
      const tickers = urlBenchmarks
        .split(',')
        .map((t) => t.trim().toUpperCase())
        .filter((t) => TICKER_PATTERN.test(t))
        .slice(0, 4) // Max 4 benchmarks (3 presets + 1 custom)
      if (tickers.length > 0) {
        config.benchmarkTickers = tickers
      }
    }

    // Parse view mode
    const urlViewMode = params.get('v') as ViewMode
    if (urlViewMode && VALID_VIEW_MODES.includes(urlViewMode)) {
      config.viewMode = urlViewMode
    }

    // Parse rolling horizon
    const urlHorizon = params.get('h')
    if (urlHorizon) {
      const parsed = parseInt(urlHorizon, 10) as HorizonYears
      if (VALID_HORIZONS.includes(parsed)) {
        config.rollingHorizon = parsed
      }
    }

    // Parse rolling X-axis mode
    const urlXAxisMode = params.get('x') as RollingXAxisMode
    if (urlXAxisMode && VALID_X_AXIS_MODES.includes(urlXAxisMode)) {
      config.rollingXAxisMode = urlXAxisMode
    }

    // Apply config if we parsed anything
    if (Object.keys(config).length > 0) {
      setConfig(config)
    }

    hasInitialized.current = true
  }, [setConfig])

  // Update URL when config changes (after initial hydration)
  useEffect(() => {
    if (!_hasHydrated || !hasInitialized.current || typeof window === 'undefined') return

    const params = new URLSearchParams()

    params.set('t', ticker)
    params.set('a', amount.toString())
    params.set('f', frequency)
    params.set('s', startDate)
    params.set('e', endDate)
    params.set('d', isDRIP ? '1' : '0')

    if (comparisonTickers.length > 0) {
      params.set('c', comparisonTickers.join(','))
    }

    if (benchmarkTickers.length > 0) {
      params.set('b', benchmarkTickers.join(','))
    }

    // Rolling analysis params
    params.set('v', viewMode)
    if (viewMode === 'rolling') {
      params.set('h', rollingHorizon.toString())
      params.set('x', rollingXAxisMode)
    }

    const newUrl = `${window.location.pathname}?${params.toString()}`
    window.history.replaceState({}, '', newUrl)
  }, [ticker, amount, frequency, startDate, endDate, isDRIP, comparisonTickers, benchmarkTickers, viewMode, rollingHorizon, rollingXAxisMode, _hasHydrated])
}

/**
 * Get a shareable URL for the current configuration (useful for sharing)
 * 
 */
export function getShareableURL(): string {
  if (typeof window === 'undefined') return ''

  const state = useConfigStore.getState()
  const params = new URLSearchParams()

  params.set('t', state.ticker)
  params.set('a', state.amount.toString())
  params.set('f', state.frequency)
  params.set('s', state.startDate)
  params.set('e', state.endDate)
  params.set('d', state.isDRIP ? '1' : '0')

  if (state.comparisonTickers.length > 0) {
    params.set('c', state.comparisonTickers.join(','))
  }

  if (state.benchmarkTickers.length > 0) {
    params.set('b', state.benchmarkTickers.join(','))
  }

  // Rolling analysis params
  params.set('v', state.viewMode)
  if (state.viewMode === 'rolling') {
    params.set('h', state.rollingHorizon.toString())
    params.set('x', state.rollingXAxisMode)
  }

  return `${window.location.origin}${window.location.pathname}?${params.toString()}`
}
