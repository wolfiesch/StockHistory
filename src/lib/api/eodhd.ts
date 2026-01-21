// EODHD API client adapted for Next.js server-side usage
import type { PricePoint, DividendHistory } from './types'

const EOD_BASE_URL = 'https://eodhd.com/api'

const withSuffix = (symbol: string) =>
  symbol.includes('.') ? symbol : `${symbol}.US`

function parseNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function parsePricePoints(values: any[]): PricePoint[] {
  return (values ?? [])
    .map((item) => {
      const datetime = item.datetime ?? item.date ?? ''
      const date = datetime ? datetime.split(' ')[0] : ''
      // Use adjusted_close for split-adjusted prices (handles stock splits correctly)
      // Fall back to close if adjusted_close is not available
      const closePrice = parseNumber(item.adjusted_close ?? item.close)
      return {
        date,
        open: parseNumber(item.open),
        high: parseNumber(item.high),
        low: parseNumber(item.low),
        close: closePrice,
        volume: parseNumber(item.volume),
      }
    })
    .filter((point) => point.close > 0 && point.date)
}

export async function getDaily(
  symbol: string,
  from?: string,
  to?: string,
  apiKey?: string
): Promise<PricePoint[]> {
  const key = apiKey || process.env.EODHD_API_KEY
  if (!key) throw new Error('EODHD API key not configured')

  const params = new URLSearchParams({
    api_token: key,
    fmt: 'json',
    order: 'asc',
  })
  if (from) params.set('from', from)
  if (to) params.set('to', to)

  const url = `${EOD_BASE_URL}/eod/${withSuffix(symbol)}?${params}`
  const response = await fetch(url, { next: { revalidate: 3600 } })

  if (!response.ok) {
    throw new Error(`EODHD API error: ${response.status}`)
  }

  const data = await response.json()

  if (data?.code && data?.message) {
    throw new Error(data.message)
  }

  if (Array.isArray(data)) {
    return parsePricePoints(data)
  }

  return []
}

export async function getDividends(
  symbol: string,
  from?: string,
  to?: string,
  apiKey?: string
): Promise<DividendHistory[]> {
  const key = apiKey || process.env.EODHD_API_KEY
  if (!key) throw new Error('EODHD API key not configured')

  // Use the dedicated dividends endpoint
  const params = new URLSearchParams({
    api_token: key,
    fmt: 'json',
  })
  if (from) params.set('from', from)
  if (to) params.set('to', to)

  const url = `${EOD_BASE_URL}/div/${withSuffix(symbol)}?${params}`
  const response = await fetch(url, { next: { revalidate: 3600 } })

  if (!response.ok) {
    // Return empty array if dividends unavailable (some tickers don't have dividends)
    if (response.status === 404) return []
    throw new Error(`EODHD API error: ${response.status}`)
  }

  const data = await response.json()

  if (data?.code && data?.message) {
    throw new Error(data.message)
  }

  if (!Array.isArray(data)) return []

  // Parse dividends from the /div endpoint format
  const dividends: DividendHistory[] = data.map((entry: any) => ({
    exDate: entry.date ?? '',
    paymentDate: entry.paymentDate ?? '',
    amount: parseNumber(entry.value), // Use 'value' which is the adjusted amount
    yield: 0, // Yield not provided in this endpoint
  }))

  // Filter valid entries and sort by date ascending
  return dividends
    .filter(d => d.exDate && d.amount > 0)
    .sort((a, b) => a.exDate.localeCompare(b.exDate))
}
