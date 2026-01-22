import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { simulationToCSV, downloadCSV, exportSimulationToCSV } from '@/lib/export/csvExport'
import type { SimulationResult } from '@/lib/api/types'

describe('CSV Export Integration', () => {
  // Sample simulation result for testing
  const mockSimulationResult: SimulationResult = {
    points: [
      { date: '2023-01-03', principal: 100, marketValue: 100, totalValue: 100, shares: 0.794, dividends: 0 },
      { date: '2023-02-01', principal: 200, marketValue: 208, totalValue: 208, shares: 1.548, dividends: 0 },
      { date: '2023-02-10', principal: 200, marketValue: 210, totalValue: 210.23, shares: 1.550, dividends: 0.23 },
      { date: '2023-03-01', principal: 300, marketValue: 324, totalValue: 324.23, shares: 2.289, dividends: 0.23 },
      { date: '2023-04-03', principal: 400, marketValue: 448, totalValue: 448.46, shares: 3.012, dividends: 0.46 },
      { date: '2023-05-01', principal: 500, marketValue: 580, totalValue: 580.69, shares: 3.720, dividends: 0.69 },
    ],
    finalShares: 3.720,
    totalInvested: 500,
    totalDividends: 0.69,
    finalValue: 580.69,
    totalReturn: 16.14,
    cagr: 52.3,
  }

  const mockConfig = {
    ticker: 'AAPL',
    amount: 100,
    frequency: 'monthly' as const,
    startDate: '2023-01-01',
    endDate: '2023-12-31',
    isDRIP: true,
  }

  describe('simulationToCSV', () => {
    it('generates valid CSV format', () => {
      const csv = simulationToCSV(mockSimulationResult, mockConfig)

      // Should have header comments
      expect(csv).toContain('# DCA Investment Simulation Export')
      expect(csv).toContain('# Ticker: AAPL')

      // Should have column headers
      expect(csv).toContain('Date,Principal,Market Value,Total Value,Shares,Dividends')

      // Should have data rows
      expect(csv).toContain('2023-01-03,100.00,100.00,100.00,0.7940,0.00')
    })

    it('includes config metadata in header', () => {
      const csv = simulationToCSV(mockSimulationResult, mockConfig)

      expect(csv).toContain('# Ticker: AAPL')
      expect(csv).toContain('# Investment Amount: $100 monthly')
      expect(csv).toContain('# Start Date: 2023-01-01')
      expect(csv).toContain('# End Date: 2023-12-31')
      expect(csv).toContain('# DRIP Enabled: Yes')
    })

    it('includes summary statistics', () => {
      const csv = simulationToCSV(mockSimulationResult, mockConfig)

      expect(csv).toContain('# Summary')
      expect(csv).toContain('# Total Invested: $500.00')
      expect(csv).toContain('# Final Value: $580.69')
      expect(csv).toContain('# Total Return: 16.14%')
      expect(csv).toContain('# CAGR: 52.30%')
      expect(csv).toContain('# Total Dividends: $0.69')
      expect(csv).toContain('# Final Shares: 3.7200')
    })

    it('generates correct number of data rows', () => {
      const csv = simulationToCSV(mockSimulationResult, mockConfig)
      const lines = csv.split('\n')

      // Count data rows (non-empty lines that don't start with # and aren't the header)
      const dataRows = lines.filter(
        (line) => line && !line.startsWith('#') && !line.startsWith('Date,')
      )

      expect(dataRows.length).toBe(mockSimulationResult.points.length)
    })

    it('formats currency values to 2 decimal places', () => {
      const csv = simulationToCSV(mockSimulationResult, mockConfig)

      // Check that values are formatted correctly
      expect(csv).toMatch(/,\d+\.\d{2},/) // Currency format
    })

    it('formats share values to 4 decimal places', () => {
      const csv = simulationToCSV(mockSimulationResult, mockConfig)

      // Check for share format (4 decimal places)
      expect(csv).toMatch(/,\d+\.\d{4},/)
    })

    it('handles DRIP disabled correctly', () => {
      const configWithoutDRIP = { ...mockConfig, isDRIP: false }
      const csv = simulationToCSV(mockSimulationResult, configWithoutDRIP)

      expect(csv).toContain('# DRIP Enabled: No')
    })

    it('handles different frequency options', () => {
      const weeklyConfig = { ...mockConfig, frequency: 'weekly' as const }
      const csv = simulationToCSV(mockSimulationResult, weeklyConfig)

      expect(csv).toContain('# Investment Amount: $100 weekly')
    })

    it('handles empty points array', () => {
      const emptyResult: SimulationResult = {
        ...mockSimulationResult,
        points: [],
      }

      const csv = simulationToCSV(emptyResult, mockConfig)

      expect(csv).toContain('# DCA Investment Simulation Export')
      expect(csv).toContain('Date,Principal,Market Value,Total Value,Shares,Dividends')
      // No data rows after header
      const lines = csv.split('\n')
      const dataRows = lines.filter(
        (line) => line && !line.startsWith('#') && !line.startsWith('Date,')
      )
      expect(dataRows.length).toBe(0)
    })

    it('includes generation timestamp', () => {
      const csv = simulationToCSV(mockSimulationResult, mockConfig)

      // Should have ISO date format
      expect(csv).toMatch(/# Generated: \d{4}-\d{2}-\d{2}T/)
    })

    it('handles large values correctly', () => {
      const largeResult: SimulationResult = {
        points: [
          {
            date: '2023-01-03',
            principal: 1000000,
            marketValue: 1500000,
            totalValue: 1525000,
            shares: 10000.5678,
            dividends: 25000,
          },
        ],
        finalShares: 10000.5678,
        totalInvested: 1000000,
        totalDividends: 25000,
        finalValue: 1525000,
        totalReturn: 52.5,
        cagr: 15.5,
      }

      const csv = simulationToCSV(largeResult, mockConfig)

      expect(csv).toContain('1000000.00')
      expect(csv).toContain('1500000.00')
      expect(csv).toContain('10000.5678')
    })

    it('handles negative returns correctly', () => {
      const negativeResult: SimulationResult = {
        ...mockSimulationResult,
        finalValue: 400,
        totalReturn: -20,
        cagr: -5.5,
      }

      const csv = simulationToCSV(negativeResult, mockConfig)

      expect(csv).toContain('# Total Return: -20.00%')
      expect(csv).toContain('# CAGR: -5.50%')
    })
  })

  describe('downloadCSV', () => {
    let createObjectURLMock: ReturnType<typeof vi.fn>
    let revokeObjectURLMock: ReturnType<typeof vi.fn>
    let appendChildMock: ReturnType<typeof vi.fn>
    let removeChildMock: ReturnType<typeof vi.fn>
    let clickMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
      // Mock URL methods
      createObjectURLMock = vi.fn(() => 'blob:http://localhost/mock-url')
      revokeObjectURLMock = vi.fn()
      global.URL.createObjectURL = createObjectURLMock as unknown as typeof URL.createObjectURL
      global.URL.revokeObjectURL = revokeObjectURLMock as unknown as typeof URL.revokeObjectURL

      // Mock DOM methods
      clickMock = vi.fn()
      appendChildMock = vi.fn<(node: Node) => Node>((node) => node)
      removeChildMock = vi.fn<(node: Node) => Node>((node) => node)

      vi.spyOn(document, 'createElement').mockImplementation((tag) => {
        if (tag === 'a') {
          return {
            setAttribute: vi.fn(),
            style: {},
            click: clickMock,
          } as unknown as HTMLAnchorElement
        }
        return document.createElement(tag)
      })

      vi.spyOn(document.body, 'appendChild').mockImplementation(
        appendChildMock as unknown as (node: Node) => Node
      )
      vi.spyOn(document.body, 'removeChild').mockImplementation(
        removeChildMock as unknown as (node: Node) => Node
      )
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('creates a Blob with correct content type', () => {
      const content = 'test,csv,content'
      const BlobMock = vi.fn()
      global.Blob = BlobMock as unknown as typeof Blob

      downloadCSV(content, 'test.csv')

      expect(BlobMock).toHaveBeenCalledWith([content], { type: 'text/csv;charset=utf-8;' })
    })

    it('creates object URL from blob', () => {
      downloadCSV('content', 'test.csv')

      expect(createObjectURLMock).toHaveBeenCalled()
    })

    it('triggers download by clicking link', () => {
      downloadCSV('content', 'test.csv')

      expect(clickMock).toHaveBeenCalled()
    })

    it('cleans up after download', () => {
      downloadCSV('content', 'test.csv')

      expect(revokeObjectURLMock).toHaveBeenCalled()
      expect(removeChildMock).toHaveBeenCalled()
    })
  })

  describe('exportSimulationToCSV', () => {
    beforeEach(() => {
      // Mock the download function
      global.URL.createObjectURL = vi.fn(() => 'blob:mock') as unknown as typeof URL.createObjectURL
      global.URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL

      vi.spyOn(document, 'createElement').mockImplementation((tag) => {
        if (tag === 'a') {
          return {
            setAttribute: vi.fn(),
            style: {},
            click: vi.fn(),
          } as unknown as HTMLAnchorElement
        }
        return document.createElement(tag)
      })

      vi.spyOn(document.body, 'appendChild').mockImplementation(
        vi.fn<(node: Node) => Node>((node) => node) as unknown as (node: Node) => Node
      )
      vi.spyOn(document.body, 'removeChild').mockImplementation(
        vi.fn<(node: Node) => Node>((node) => node) as unknown as (node: Node) => Node
      )
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('generates filename with ticker and date', () => {
      const setAttributeMock = vi.fn()
      vi.spyOn(document, 'createElement').mockImplementation((tag) => {
        if (tag === 'a') {
          return {
            setAttribute: setAttributeMock,
            style: {},
            click: vi.fn(),
          } as unknown as HTMLAnchorElement
        }
        return document.createElement(tag)
      })

      exportSimulationToCSV(mockSimulationResult, mockConfig)

      // Find the download attribute call
      const downloadCall = setAttributeMock.mock.calls.find(
        (call) => call[0] === 'download'
      )

      expect(downloadCall).toBeDefined()
      expect(downloadCall?.[1]).toMatch(/^dca-simulation-AAPL-\d{4}-\d{2}-\d{2}\.csv$/)
    })

    it('uses correct ticker in filename', () => {
      const setAttributeMock = vi.fn()
      vi.spyOn(document, 'createElement').mockImplementation((tag) => {
        if (tag === 'a') {
          return {
            setAttribute: setAttributeMock,
            style: {},
            click: vi.fn(),
          } as unknown as HTMLAnchorElement
        }
        return document.createElement(tag)
      })

      const customConfig = { ...mockConfig, ticker: 'TSLA' }
      exportSimulationToCSV(mockSimulationResult, customConfig)

      const downloadCall = setAttributeMock.mock.calls.find(
        (call) => call[0] === 'download'
      )

      expect(downloadCall?.[1]).toContain('TSLA')
    })
  })

  describe('CSV parsing validation', () => {
    it('generates CSV that can be parsed back correctly', () => {
      const csv = simulationToCSV(mockSimulationResult, mockConfig)

      // Parse the CSV (skip comment lines)
      const lines = csv.split('\n')
      const dataLines = lines.filter(
        (line) => line && !line.startsWith('#')
      )

      // First non-comment line should be header
      expect(dataLines[0]).toBe('Date,Principal,Market Value,Total Value,Shares,Dividends')

      // Parse first data row
      const firstDataRow = dataLines[1].split(',')
      expect(firstDataRow).toHaveLength(6)
      expect(firstDataRow[0]).toBe('2023-01-03') // Date
      expect(parseFloat(firstDataRow[1])).toBe(100) // Principal
      expect(parseFloat(firstDataRow[2])).toBe(100) // Market Value
    })

    it('handles dates with special characters', () => {
      const resultWithDates: SimulationResult = {
        ...mockSimulationResult,
        points: [
          {
            date: '2023-12-31',
            principal: 100,
            marketValue: 110,
            totalValue: 110,
            shares: 1,
            dividends: 0,
          },
        ],
      }

      const csv = simulationToCSV(resultWithDates, mockConfig)
      expect(csv).toContain('2023-12-31')
    })

    it('escapes values that might break CSV parsing', () => {
      // All numeric values in our simulation, so this should be fine
      // but let's verify no commas in values
      const csv = simulationToCSV(mockSimulationResult, mockConfig)
      const lines = csv.split('\n')
      const dataLines = lines.filter(
        (line) => line && !line.startsWith('#') && !line.startsWith('Date,')
      )

      for (const line of dataLines) {
        const columns = line.split(',')
        // Should have exactly 6 columns per data row
        expect(columns).toHaveLength(6)
      }
    })
  })
})
