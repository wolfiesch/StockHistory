/**
 * Web Worker for Rolling Window DCA Analysis
 *
 * Offloads the heavy computation of rolling window analysis to a separate thread,
 * preventing UI blocking when processing large datasets (e.g., 20+ years of data
 * with 180+ rolling windows).
 *
 * Communication Protocol:
 * - Parent sends: RollingWorkerRequest
 * - Worker sends: RollingWorkerResponse
 */

import { runRollingWindowAnalysis, getAvailableHorizons } from '../calculation/rollingWindowEngine'
import type {
  PricePoint,
  DividendHistory,
  RollingWindowConfig,
  RollingWindowResult,
  HorizonYears,
} from '../api/types'

// Message types for type-safe worker communication
export interface RollingWorkerRequest {
  type: 'COMPUTE'
  id: string
  payload: {
    prices: PricePoint[]
    dividends: DividendHistory[]
    config: RollingWindowConfig
  }
}

export interface RollingWorkerResponse {
  type: 'SUCCESS' | 'ERROR' | 'HORIZONS'
  id: string
  result?: RollingWindowResult
  availableHorizons?: HorizonYears[]
  error?: string
}

// Worker context - this is the worker's global scope
const ctx: Worker = self as unknown as Worker

ctx.onmessage = (event: MessageEvent<RollingWorkerRequest>) => {
  const { type, id, payload } = event.data

  if (type === 'COMPUTE') {
    try {
      const { prices, dividends, config } = payload

      // First, compute available horizons
      const availableHorizons = getAvailableHorizons(prices)

      // Check if requested horizon is available
      if (!availableHorizons.includes(config.horizonYears)) {
        ctx.postMessage({
          type: 'ERROR',
          id,
          error: `Insufficient data for ${config.horizonYears}-year horizon. Available: ${
            availableHorizons.length > 0 ? availableHorizons.join(', ') + ' years' : 'none'
          }`,
          availableHorizons,
        } satisfies RollingWorkerResponse)
        return
      }

      // Run the analysis
      const result = runRollingWindowAnalysis(prices, dividends, config)

      ctx.postMessage({
        type: 'SUCCESS',
        id,
        result,
        availableHorizons,
      } satisfies RollingWorkerResponse)
    } catch (error) {
      ctx.postMessage({
        type: 'ERROR',
        id,
        error: error instanceof Error ? error.message : 'Unknown error in worker',
      } satisfies RollingWorkerResponse)
    }
  }
}

// Export for module compatibility
export {}
