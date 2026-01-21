/**
 * Y-Axis Dynamic Scaling Utilities
 *
 * Provides smooth "zoom out" effect for chart animations by using
 * milestone-based stepping with hysteresis to prevent jitter.
 */

/**
 * Generate "nice" milestone values for Y-axis scaling
 * Pattern: $1K → $2.5K → $5K → $10K → $25K → $50K → $100K → $250K → $500K → $1M...
 */
export function generateMilestones(finalMax: number): number[] {
  const bases = [1, 2.5, 5]
  const milestones: number[] = []
  let magnitude = 1000 // Start at $1K minimum

  while (magnitude <= finalMax * 2) {
    for (const base of bases) {
      const value = base * magnitude
      if (value <= finalMax * 1.5) {
        milestones.push(value)
      }
    }
    magnitude *= 10
  }

  // Ensure we have at least the final max covered
  if (milestones.length === 0 || milestones[milestones.length - 1] < finalMax) {
    milestones.push(Math.ceil(finalMax * 1.1))
  }

  return milestones.sort((a, b) => a - b)
}

/**
 * Find appropriate milestone for current visible data with hysteresis
 * - 15% headroom above visible max
 * - Only step DOWN if visible max drops below 40% of current (prevents oscillation)
 */
export function getActiveMilestone(
  visibleMax: number,
  milestones: number[],
  currentMilestone: number | null
): number {
  const headroom = 1.15 // 15% above visible max
  const targetMax = visibleMax * headroom

  // Find smallest milestone that covers target
  const nextMilestone = milestones.find(m => m >= targetMax) || milestones[milestones.length - 1]

  // If no current milestone, just use the calculated one
  if (currentMilestone === null) {
    return nextMilestone
  }

  // Hysteresis: don't step down unless visible is < 40% of current
  if (nextMilestone < currentMilestone && visibleMax > currentMilestone * 0.4) {
    return currentMilestone
  }

  return nextMilestone
}
