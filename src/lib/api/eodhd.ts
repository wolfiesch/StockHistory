// EODHD API client adapted for Next.js server-side usage
import { HTTPError } from './httpError'
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

function parseRetryAfterSeconds(response: Response): number | undefined {
  const header = response.headers.get('retry-after')
  if (!header) return undefined
  const parsed = parseInt(header, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    const retryAfterSeconds = parseRetryAfterSeconds(response)
    if (response.status === 429) {
      throw new HTTPError(
        'Rate limited by data provider. Please try again later.',
        429,
        retryAfterSeconds ?? 60
      )
    }

    if (response.status === 404) {
      throw new HTTPError(`Ticker not found: ${symbol.toUpperCase()}`, 404)
    }

    throw new HTTPError(
      `Data provider error (${response.status}). Please try again later.`,
      response.status
    )
  }

  const data = await response.json()

  if (data?.code && data?.message) {
    const code = typeof data.code === 'number'
      ? data.code
      : typeof data.code === 'string'
        ? parseInt(data.code, 10)
        : NaN
    const status = Number.isFinite(code) && code > 0 ? code : 400
    throw new HTTPError(String(data.message), status)
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

    const retryAfterSeconds = parseRetryAfterSeconds(response)
    if (response.status === 429) {
      throw new HTTPError(
        'Rate limited by data provider. Please try again later.',
        429,
        retryAfterSeconds ?? 60
      )
    }

    throw new HTTPError(
      `Data provider error (${response.status}). Please try again later.`,
      response.status
    )
  }

  const data = await response.json()

  if (data?.code && data?.message) {
    const code = typeof data.code === 'number'
      ? data.code
      : typeof data.code === 'string'
        ? parseInt(data.code, 10)
        : NaN
    const status = Number.isFinite(code) && code > 0 ? code : 400
    throw new HTTPError(String(data.message), status)
  }

  if (!Array.isArray(data)) return []

  // Parse dividends from the /div endpoint format
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
