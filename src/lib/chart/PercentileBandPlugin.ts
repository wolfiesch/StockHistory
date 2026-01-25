/**
 * Percentile Band Plugin for Lightweight Charts
 *
 * Custom plugin that renders filled percentile bands for rolling window analysis.
 * Uses canvas Path2D for efficient polygon rendering.
 *
 * Based on the Lightweight Charts plugin architecture (v4.1+):
 * - Implements ISeriesPrimitivePaneRenderer for custom canvas drawing
 * - Draws two filled bands: outer (p10-p90) and inner (p25-p75)
 * - Draws a median line (p50) on top
 */

import type { RollingChartDataPoint } from '../api/types'

export interface PercentileBandColors {
  outerBand: string // Color for p10-p90 band (lightest)
  innerBand: string // Color for p25-p75 band (medium)
  medianLine: string // Color for p50 line (darkest)
}

const DEFAULT_COLORS: PercentileBandColors = {
  outerBand: 'rgba(59, 130, 246, 0.15)', // Blue at 15% opacity
  innerBand: 'rgba(59, 130, 246, 0.3)', // Blue at 30% opacity
  medianLine: 'rgba(59, 130, 246, 1)', // Solid blue
}

/**
 * Draws a filled band between two value arrays.
 * Creates a polygon by tracing upper values forward, then lower values backward.
 */
function drawBand(
  ctx: CanvasRenderingContext2D,
  upperValues: number[],
  lowerValues: number[],
  timeCoords: number[],
  color: string,
  priceToY: (price: number) => number
): void {
  if (upperValues.length === 0 || timeCoords.length === 0) return

  const path = new Path2D()
  let started = false

  // Trace upper boundary (left to right)
  for (let i = 0; i < upperValues.length && i < timeCoords.length; i++) {
    const x = timeCoords[i]
    const y = priceToY(upperValues[i])

    if (!started) {
      path.moveTo(x, y)
      started = true
    } else {
      path.lineTo(x, y)
    }
  }

  // Trace lower boundary (right to left)
  for (let i = lowerValues.length - 1; i >= 0 && i < timeCoords.length; i--) {
    const x = timeCoords[i]
    const y = priceToY(lowerValues[i])
    path.lineTo(x, y)
  }

  path.closePath()
  ctx.fillStyle = color
  ctx.fill(path)
}

/**
 * Draws the median line (p50).
 */
function drawMedianLine(
  ctx: CanvasRenderingContext2D,
  values: number[],
  timeCoords: number[],
  color: string,
  lineWidth: number,
  priceToY: (price: number) => number
): void {
  if (values.length === 0 || timeCoords.length === 0) return

  ctx.beginPath()
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth

  for (let i = 0; i < values.length && i < timeCoords.length; i++) {
    const x = timeCoords[i]
    const y = priceToY(values[i])

    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  }

  ctx.stroke()
}

/**
 * Renderer configuration for percentile bands.
 */
export interface PercentileBandRendererConfig {
  data: RollingChartDataPoint[]
  colors: PercentileBandColors
  medianLineWidth: number
}

/**
 * Render percentile bands on a canvas.
 * This function should be called from within a chart's pane renderer.
 *
 * @param ctx - Canvas 2D rendering context
 * @param config - Renderer configuration
 * @param timeToX - Function to convert time value to X coordinate
 * @param priceToY - Function to convert price value to Y coordinate
 */
export function renderPercentileBands(
  ctx: CanvasRenderingContext2D,
  config: PercentileBandRendererConfig,
  timeToX: (time: number) => number,
  priceToY: (price: number) => number
): void {
  const { data, colors, medianLineWidth } = config

  if (data.length === 0) return

  // Pre-compute X coordinates for all time points
  const timeCoords = data.map((d) => timeToX(d.time))

  // Extract value arrays
  const p10 = data.map((d) => d.p10)
  const p25 = data.map((d) => d.p25)
  const p50 = data.map((d) => d.p50)
  const p75 = data.map((d) => d.p75)
  const p90 = data.map((d) => d.p90)

  // Draw outer band (p10-p90) first (bottom layer)
  drawBand(ctx, p90, p10, timeCoords, colors.outerBand, priceToY)

  // Draw inner band (p25-p75) on top
  drawBand(ctx, p75, p25, timeCoords, colors.innerBand, priceToY)

  // Draw median line (p50) on top
  drawMedianLine(ctx, p50, timeCoords, colors.medianLine, medianLineWidth, priceToY)
}

/**
 * Create a default renderer configuration with optional color overrides.
 */
export function createRendererConfig(
  data: RollingChartDataPoint[],
  colorOverrides?: Partial<PercentileBandColors>
): PercentileBandRendererConfig {
  return {
    data,
    colors: { ...DEFAULT_COLORS, ...colorOverrides },
    medianLineWidth: 2,
  }
}

/**
 * Get the min and max values from the data for auto-scaling.
 */
export function getDataRange(data: RollingChartDataPoint[]): {
  min: number
  max: number
} {
  if (data.length === 0) return { min: 0, max: 0 }

  let min = Infinity
  let max = -Infinity

  for (const point of data) {
    // p10 is the lowest, p90 is the highest
    if (point.p10 < min) min = point.p10
    if (point.p90 > max) max = point.p90
  }

  // Add some padding
  const range = max - min
  return {
    min: Math.max(0, min - range * 0.05),
    max: max + range * 0.05,
  }
}

/**
 * Format a value for display in tooltips.
 */
export function formatBandValue(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}
