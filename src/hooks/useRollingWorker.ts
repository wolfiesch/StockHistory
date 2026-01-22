'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import {
  runRollingWindowAnalysis,
  getAvailableHorizons,
} from '@/lib/calculation/rollingWindowEngine'
import type {
  PricePoint,
  DividendHistory,
  RollingWindowConfig,
  RollingWindowResult,
  HorizonYears,
} from '@/lib/api/types'
import type {
  RollingWorkerRequest,
  RollingWorkerResponse,
} from '@/lib/workers/rollingAnalysisWorker'

interface WorkerResult {
  result: RollingWindowResult | null
  availableHorizons: HorizonYears[]
  error: string | null
}

interface UseRollingWorkerReturn {
  compute: (
    prices: PricePoint[],
    dividends: DividendHistory[],
    config: RollingWindowConfig
  ) => void
  result: RollingWindowResult | null
  availableHorizons: HorizonYears[]
  isComputing: boolean
  error: string | null
  cancel: () => void
}

/**
 * Hook for managing rolling window analysis computation.
 *
 * Features:
 * - Attempts Web Worker for non-blocking computation
 * - Falls back to synchronous computation if worker fails
 * - Automatic cleanup on unmount
 * - Request cancellation support
 */
export function useRollingWorker(): UseRollingWorkerReturn {
  const workerRef = useRef<Worker | null>(null)
  const workerFailedRef = useRef(false)
  const requestIdRef = useRef<string | null>(null)

  const [state, setState] = useState<WorkerResult & { isComputing: boolean }>({
    result: null,
    availableHorizons: [5, 10, 15, 20],
    error: null,
    isComputing: false,
  })

  // Synchronous fallback computation
  const computeSync = useCallback(
    (
      prices: PricePoint[],
      dividends: DividendHistory[],
      config: RollingWindowConfig,
      id: string
    ) => {
      // Use setTimeout to make it async (allow React to update UI)
      setTimeout(() => {
        // Check if request was cancelled
        if (id !== requestIdRef.current) {
          return
        }

        try {
          const availableHorizons = getAvailableHorizons(prices)

          if (!availableHorizons.includes(config.horizonYears)) {
            setState((prev) => ({
              ...prev,
              error: `Insufficient data for ${config.horizonYears}-year horizon`,
              isComputing: false,
              availableHorizons,
            }))
            return
          }

          const result = runRollingWindowAnalysis(prices, dividends, config)

          // Check again if cancelled during computation
          if (id !== requestIdRef.current) {
            return
          }

          setState({
            result,
            availableHorizons,
            error: null,
            isComputing: false,
          })
        } catch (error) {
          if (id === requestIdRef.current) {
            setState((prev) => ({
              ...prev,
              error: error instanceof Error ? error.message : 'Computation error',
              isComputing: false,
            }))
          }
        }
      }, 0)
    },
    []
  )

  // Initialize worker lazily
  const getWorker = useCallback(() => {
    if (workerFailedRef.current) {
      return null
    }

    if (!workerRef.current) {
      try {
        // Using dynamic import URL pattern for Next.js webpack bundling
        workerRef.current = new Worker(
          new URL('../lib/workers/rollingAnalysisWorker.ts', import.meta.url),
          { type: 'module' }
        )

        workerRef.current.onmessage = (event: MessageEvent<RollingWorkerResponse>) => {
          const { type, id, result, availableHorizons, error } = event.data

          // Ignore responses for cancelled/outdated requests
          if (id !== requestIdRef.current) {
            return
          }

          if (type === 'SUCCESS' && result) {
            setState({
              result,
              availableHorizons: availableHorizons ?? [5, 10, 15, 20],
              error: null,
              isComputing: false,
            })
          } else if (type === 'ERROR') {
            setState((prev) => ({
              ...prev,
              error: error ?? 'Unknown error',
              isComputing: false,
              availableHorizons: availableHorizons ?? prev.availableHorizons,
            }))
          }
        }

        workerRef.current.onerror = () => {
          // Worker failed - mark as failed and terminate
          workerFailedRef.current = true
          if (workerRef.current) {
            workerRef.current.terminate()
            workerRef.current = null
          }
        }
      } catch {
        // Worker creation failed - fall back to sync
        workerFailedRef.current = true
        return null
      }
    }

    return workerRef.current
  }, [])

  // Cleanup worker on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate()
        workerRef.current = null
      }
    }
  }, [])

  // Compute function - tries worker first, falls back to sync
  const compute = useCallback(
    (
      prices: PricePoint[],
      dividends: DividendHistory[],
      config: RollingWindowConfig
    ) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      requestIdRef.current = id

      setState((prev) => ({
        ...prev,
        isComputing: true,
        error: null,
      }))

      const worker = getWorker()

      if (worker) {
        // Use Web Worker for non-blocking computation
        const request: RollingWorkerRequest = {
          type: 'COMPUTE',
          id,
          payload: { prices, dividends, config },
        }
        worker.postMessage(request)
      } else {
        // Fall back to synchronous computation (wrapped in setTimeout)
        computeSync(prices, dividends, config, id)
      }
    },
    [getWorker, computeSync]
  )

  // Cancel current computation
  const cancel = useCallback(() => {
    requestIdRef.current = null
    setState((prev) => ({
      ...prev,
      isComputing: false,
    }))
  }, [])

  return {
    compute,
    result: state.result,
    availableHorizons: state.availableHorizons,
    isComputing: state.isComputing,
    error: state.error,
    cancel,
  }
}
