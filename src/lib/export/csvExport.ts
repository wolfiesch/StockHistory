import type { SimulationResult, InvestmentFrequency } from '@/lib/api/types'

interface ExportConfig {
  ticker: string
  amount: number
  frequency: InvestmentFrequency
  startDate: string
  endDate: string
  isDRIP: boolean
}

/**
 * Converts simulation results to CSV format
 */
export function simulationToCSV(
  result: SimulationResult,
  config: ExportConfig
): string {
  const lines: string[] = []

  // Header with config info
  lines.push('# DCA Investment Simulation Export')
  lines.push(`# Ticker: ${config.ticker}`)
  lines.push(`# Investment Amount: $${config.amount} ${config.frequency}`)
  lines.push(`# Start Date: ${config.startDate}`)
  lines.push(`# End Date: ${config.endDate}`)
  lines.push(`# DRIP Enabled: ${config.isDRIP ? 'Yes' : 'No'}`)
  lines.push(`# Generated: ${new Date().toISOString()}`)
  lines.push('')

  // Summary
  lines.push('# Summary')
  lines.push(`# Total Invested: $${result.totalInvested.toFixed(2)}`)
  lines.push(`# Final Value: $${result.finalValue.toFixed(2)}`)
  lines.push(`# Total Return: ${result.totalReturn.toFixed(2)}%`)
  lines.push(`# CAGR: ${result.cagr.toFixed(2)}%`)
  lines.push(`# Total Dividends: $${result.totalDividends.toFixed(2)}`)
  lines.push(`# Final Shares: ${result.finalShares.toFixed(4)}`)
  lines.push('')

  // Column headers
  lines.push('Date,Principal,Market Value,Total Value,Shares,Dividends')

  // Data rows
  for (const point of result.points) {
    lines.push(
      [
        point.date,
        point.principal.toFixed(2),
        point.marketValue.toFixed(2),
        point.totalValue.toFixed(2),
        point.shares.toFixed(4),
        point.dividends.toFixed(2),
      ].join(',')
    )
  }

  return lines.join('\n')
}

/**
 * Triggers a CSV file download in the browser
 */
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}

/**
 * Export simulation results as a CSV file
 */
export function exportSimulationToCSV(
  result: SimulationResult,
  config: ExportConfig
): void {
  const csv = simulationToCSV(result, config)
  const filename = `dca-simulation-${config.ticker}-${new Date().toISOString().split('T')[0]}.csv`
  downloadCSV(csv, filename)
}
