import { NextRequest, NextResponse } from 'next/server'
import { getDividends } from '@/lib/api/eodhd'
import { HTTPError } from '@/lib/api/httpError'
import { checkRateLimit, getClientIp } from '@/lib/server/rateLimit'

const RATE_LIMIT = {
  limit: 60,
  windowMs: 60_000,
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol')
  const from = searchParams.get('from') ?? undefined
  const to = searchParams.get('to') ?? undefined

  const ip = getClientIp(request)
  const rate = checkRateLimit({
    key: `stock-history:dividends:${ip}`,
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
        retryAfterSeconds: rate.retryAfterSeconds,
      },
      { status: 429, headers: rateHeaders }
    )
  }

  if (!symbol) {
    return NextResponse.json(
      { error: 'Symbol parameter is required' },
      { status: 400, headers: rateHeaders }
    )
  }

  try {
    const dividends = await getDividends(symbol, from, to)
    return NextResponse.json({ dividends, symbol }, { headers: rateHeaders })
  } catch (error) {
    if (error instanceof HTTPError) {
      if (error.status === 429 && error.retryAfterSeconds) {
        rateHeaders.set('Retry-After', String(error.retryAfterSeconds))
      }
      return NextResponse.json(
        { error: error.message, retryAfterSeconds: error.retryAfterSeconds },
        { status: error.status, headers: rateHeaders }
      )
    }

    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Server error: ${message}` },
      { status: 500, headers: rateHeaders }
    )
  }
}
