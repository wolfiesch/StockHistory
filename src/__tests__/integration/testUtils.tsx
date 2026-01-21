import { ReactNode } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * Creates a fresh QueryClient for each test
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
    },
  })
}

/**
 * Wrapper component that provides all necessary context providers
 */
interface TestProvidersProps {
  children: ReactNode
  queryClient?: QueryClient
}

export function TestProviders({ children, queryClient }: TestProvidersProps) {
  const client = queryClient ?? createTestQueryClient()
  return (
    <QueryClientProvider client={client}>
      {children}
    </QueryClientProvider>
  )
}

/**
 * Custom render function that wraps components with necessary providers
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & { queryClient?: QueryClient }
) {
  const { queryClient, ...renderOptions } = options ?? {}

  return render(ui, {
    wrapper: ({ children }) => (
      <TestProviders queryClient={queryClient}>{children}</TestProviders>
    ),
    ...renderOptions,
  })
}

/**
 * Mock localStorage implementation for testing
 */
export function createMockLocalStorage() {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
    get length() {
      return Object.keys(store).length
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    getStore: () => ({ ...store }),
  }
}

/**
 * Mock window.location for URL testing
 */
export function mockWindowLocation(url: string) {
  const urlObj = new URL(url)

  Object.defineProperty(window, 'location', {
    value: {
      href: url,
      origin: urlObj.origin,
      pathname: urlObj.pathname,
      search: urlObj.search,
      hash: urlObj.hash,
      host: urlObj.host,
      hostname: urlObj.hostname,
      port: urlObj.port,
      protocol: urlObj.protocol,
    },
    writable: true,
  })
}

/**
 * Mock history.replaceState for URL sync testing
 */
export function createMockHistory() {
  const calls: Array<{ state: unknown; title: string; url?: string }> = []

  const originalReplaceState = window.history.replaceState.bind(window.history)

  window.history.replaceState = (state: unknown, title: string, url?: string | URL | null) => {
    calls.push({ state, title, url: url?.toString() })
  }

  return {
    calls,
    restore: () => {
      window.history.replaceState = originalReplaceState
    },
  }
}

/**
 * Wait for a condition to be true
 */
export async function waitForCondition(
  condition: () => boolean,
  timeout = 1000,
  interval = 50
): Promise<void> {
  const start = Date.now()
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error('Condition not met within timeout')
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }
}

/**
 * Create mock API responses for stock data
 */
export const mockStockData = {
  history: {
    prices: [
      { date: '2023-01-03', open: 125, high: 127, low: 124, close: 126, volume: 1000000 },
      { date: '2023-01-10', open: 126, high: 129, low: 125, close: 128, volume: 1100000 },
      { date: '2023-01-17', open: 128, high: 131, low: 127, close: 130, volume: 1200000 },
      { date: '2023-01-24', open: 130, high: 133, low: 129, close: 132, volume: 1150000 },
      { date: '2023-01-31', open: 132, high: 135, low: 131, close: 134, volume: 1250000 },
      { date: '2023-02-07', open: 134, high: 137, low: 133, close: 136, volume: 1300000 },
      { date: '2023-02-14', open: 136, high: 139, low: 135, close: 138, volume: 1350000 },
      { date: '2023-02-21', open: 138, high: 141, low: 137, close: 140, volume: 1400000 },
      { date: '2023-02-28', open: 140, high: 143, low: 139, close: 142, volume: 1450000 },
      { date: '2023-03-07', open: 142, high: 145, low: 141, close: 144, volume: 1500000 },
    ],
    symbol: 'AAPL',
  },
  dividends: {
    dividends: [
      { exDate: '2023-02-10', paymentDate: '2023-02-16', amount: 0.23, yield: 0.5 },
    ],
    symbol: 'AAPL',
  },
  validate: {
    valid: true,
    name: 'Apple Inc.',
  },
}

/**
 * Create a mock fetch function for API testing
 */
export function createMockFetch(responses: Record<string, unknown>) {
  return (url: string) => {
    const urlObj = new URL(url, 'http://localhost:3000')
    const path = urlObj.pathname

    for (const [pattern, response] of Object.entries(responses)) {
      if (path.includes(pattern)) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(response),
        })
      }
    }

    return Promise.resolve({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'Not found' }),
    })
  }
}
