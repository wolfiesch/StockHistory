import type { NextRequest } from 'next/server'

interface RateLimitEntry {
  count: number
  resetAtMs: number
}

export interface RateLimitResult {
  ok: boolean
  limit: number
  remaining: number
  resetAtMs: number
  retryAfterSeconds: number
}

const store = new Map<string, RateLimitEntry>()

export function getClientIp(request: NextRequest): string {
  const xForwardedFor = request.headers.get('x-forwarded-for')
  if (xForwardedFor) return xForwardedFor.split(',')[0]?.trim() || 'unknown'

  const xRealIp = request.headers.get('x-real-ip')
  if (xRealIp) return xRealIp.trim()

  const requestIp = (request as { ip?: string }).ip
  return requestIp || 'unknown'
}

// Fixed-window in-memory rate limiter.
// Note: in serverless environments, this is per-instance (best-effort).
export function checkRateLimit(params: {
  key: string
  limit: number
  windowMs: number
}): RateLimitResult {
  const { key, limit, windowMs } = params
  const now = Date.now()

  const existing = store.get(key)
  if (!existing || now >= existing.resetAtMs) {
    const resetAtMs = now + windowMs
    store.set(key, { count: 1, resetAtMs })
    return {
      ok: true,
      limit,
      remaining: Math.max(0, limit - 1),
      resetAtMs,
      retryAfterSeconds: 0,
    }
  }

  if (existing.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAtMs - now) / 1000))
    return {
      ok: false,
      limit,
      remaining: 0,
      resetAtMs: existing.resetAtMs,
      retryAfterSeconds,
    }
  }

  const nextCount = existing.count + 1
  store.set(key, { count: nextCount, resetAtMs: existing.resetAtMs })

  return {
    ok: true,
    limit,
    remaining: Math.max(0, limit - nextCount),
    resetAtMs: existing.resetAtMs,
    retryAfterSeconds: 0,
  }
}
