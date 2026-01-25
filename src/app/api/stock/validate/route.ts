import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/server/rateLimit'

const EOD_BASE_URL = 'https://eodhd.com/api'
const TICKER_PATTERN = /^[A-Z0-9]{1,10}(?:[.-][A-Z0-9]{1,6})?$/

const RATE_LIMIT = {
  limit: 60,
  windowMs: 60_000,
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol')

  const ip = getClientIp(request)
  const rate = checkRateLimit({
    key: `stock-history:validate:${ip}`,
    limit: RATE_LIMIT.limit,
    windowMs: RATE_LIMIT.windowMs,
  })

  const rateHeaders = new Headers({
    'X-RateLimit-Limit': String(rate.limit),
    'X-RateLimit-Remaining': String(rate.remaining),
    'X-RateLimit-Reset': String(Math.ceil(rate.resetAtMs / 1000)),
  })

  if (!rate.ok) {
    rateHeaders.set('Retry-After', String(rate.retryAfterSeconds))
    return NextResponse.json(
      {
        error: 'Rate limited: too many requests',
        valid: false,
        retryAfterSeconds: rate.retryAfterSeconds,
      },
      { status: 429, headers: rateHeaders }
    )
  }

  if (!symbol) {
    return NextResponse.json(
      { error: 'Symbol parameter is required', valid: false },
      { status: 400, headers: rateHeaders }
    )
  }

  // Client-side format check
  const normalized = symbol.toUpperCase().trim()
  if (!TICKER_PATTERN.test(normalized)) {
    return NextResponse.json({
      valid: false,
      error: 'Invalid ticker format (letters/numbers, optional . or - suffix)',
    }, { headers: rateHeaders })
  }

  const apiKey = process.env.EODHD_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'API key not configured', valid: false },
      { status: 500, headers: rateHeaders }
    )
  }

  try {
    // Quick check by fetching recent data (limit to 1 day for speed)
    const today = new Date().toISOString().split('T')[0]
    const params = new URLSearchParams({
      api_token: apiKey,
      fmt: 'json',
      from: today,
    })

    const symbolForApi = (normalized.includes('.') || normalized.includes('-'))
      ? normalized
      : `${normalized}.US`
    const url = `${EOD_BASE_URL}/eod/${symbolForApi}?${params}`
    const response = await fetch(url, { next: { revalidate: 86400 } }) // Cache for 24h

    if (!response.ok) {
      return NextResponse.json({
        valid: false,
        error: 'Ticker not found',
      }, { headers: rateHeaders })
    }

    const data = await response.json()

    // Check for error response from EODHD
    if (data?.code && data?.message) {
      return NextResponse.json({
        valid: false,
        error: data.message,
      }, { headers: rateHeaders })
    }

    // EODHD returns an empty array for unknown tickers, or array with data for valid ones
    // But since we're querying today's date, we might get empty for valid tickers too
    // So we'll also try the search endpoint for company name
    const searchUrl = `${EOD_BASE_URL}/search/${normalized}?api_token=${apiKey}&limit=1`
    const searchResponse = await fetch(searchUrl, { next: { revalidate: 86400 } })

    if (searchResponse.ok) {
      const searchData = await searchResponse.json()
      if (Array.isArray(searchData) && searchData.length > 0) {
        const match = searchData.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (item: any) => item.Code?.toUpperCase() === normalized
        )
        if (match) {
          return NextResponse.json({
            valid: true,
            name: match.Name,
            exchange: match.Exchange,
          }, { headers: rateHeaders })
        }
      }
    }

    // Fallback: if we got any price data, it's valid
    if (Array.isArray(data) && data.length >= 0) {
      return NextResponse.json({
        valid: true,
      }, { headers: rateHeaders })
    }

    return NextResponse.json({
      valid: false,
      error: 'Ticker not found',
    }, { headers: rateHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { valid: false, error: message },
      { status: 500, headers: rateHeaders }
    )
  }
}
