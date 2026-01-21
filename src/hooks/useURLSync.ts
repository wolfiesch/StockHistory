'use client'

import { useEffect, useRef } from 'react'
import { useConfigStore } from '@/store/configStore'
import type { InvestmentFrequency } from '@/lib/api/types'

const VALID_FREQUENCIES: InvestmentFrequency[] = ['weekly', 'biweekly', 'monthly']

/**
 * Syncs configuration state with URL parameters for shareable links.
 *
 * URL params:
 * - t: ticker (e.g., AAPL)
 * - a: amount (e.g., 100)
 * - f: frequency (weekly, biweekly, monthly)
 * - s: start date (YYYY-MM-DD)
 * - d: DRIP enabled (1 or 0)
 * - c: comparison tickers (comma-separated, e.g., MSFT,GOOGL)
 */
export function useURLSync() {
  console.log('useURLSync')
  const hasInitialized = useRef(false)
  const {
    ticker,
    amount,
    frequency,
    startDate,
    isDRIP,
    comparisonTickers,
    setConfig,
    _hasHydrated,
  } = useConfigStore()

  // On mount, read URL params and apply them (URL takes precedence over localStorage)
  useEffect(() => {
    if (hasInitialized.current || typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)

    // Only apply URL params if there are any config-related params
    const hasConfigParams = params.has('t') || params.has('a') || params.has('f') ||
                           params.has('s') || params.has('d') || params.has('c')
    console.log('hasConfigParams', hasConfigParams)
    if (!hasConfigParams) {
      hasInitialized.current = true
      return
    }

    const config: Parameters<typeof setConfig>[0] = {}

    // Parse ticker
    const urlTicker = params.get('t')
    if (urlTicker && /^[A-Za-z]{1,5}$/.test(urlTicker)) {
      config.ticker = urlTicker.toUpperCase()
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
        .filter((t) => /^[A-Z]{1,5}$/.test(t))
        .slice(0, 2)
      if (tickers.length > 0) {
        config.comparisonTickers = tickers
      }
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
    params.set('d', isDRIP ? '1' : '0')

    if (comparisonTickers.length > 0) {
      params.set('c', comparisonTickers.join(','))
    }

    const newUrl = `${window.location.pathname}?${params.toString()}`
    window.history.replaceState({}, '', newUrl)
  }, [ticker, amount, frequency, startDate, isDRIP, comparisonTickers, _hasHydrated])
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
  params.set('d', state.isDRIP ? '1' : '0')

  if (state.comparisonTickers.length > 0) {
    params.set('c', state.comparisonTickers.join(','))
  }

  return `${window.location.origin}${window.location.pathname}?${params.toString()}`
}
