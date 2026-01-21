import { describe, it, expect } from 'vitest'
import { generateMilestones, getActiveMilestone } from '../yAxisScaling'

describe('generateMilestones', () => {
  it('generates milestones in 1, 2.5, 5 pattern', () => {
    const milestones = generateMilestones(100000)

    // Should include: 1K, 2.5K, 5K, 10K, 25K, 50K, 100K
    expect(milestones).toContain(1000)
    expect(milestones).toContain(2500)
    expect(milestones).toContain(5000)
    expect(milestones).toContain(10000)
    expect(milestones).toContain(25000)
    expect(milestones).toContain(50000)
    expect(milestones).toContain(100000)
  })

  it('ensures final max is covered even when small', () => {
    const milestones = generateMilestones(500)

    // For small values, it adds a fallback milestone to cover the final max
    // 500 * 1.1 = 550, so first milestone is 550
    expect(milestones[0]).toBe(550)

    // Larger values should still get nice round milestones
    const bigMilestones = generateMilestones(50000)
    expect(bigMilestones[0]).toBe(1000)
  })

  it('covers final max value', () => {
    const finalMax = 750000
    const milestones = generateMilestones(finalMax)

    // Last milestone should cover the final max
    const lastMilestone = milestones[milestones.length - 1]
    expect(lastMilestone).toBeGreaterThanOrEqual(finalMax)
  })

  it('generates milestones for very large portfolios', () => {
    const milestones = generateMilestones(5000000)

    // Should include million-level milestones
    expect(milestones).toContain(1000000)
    expect(milestones).toContain(2500000)
    expect(milestones).toContain(5000000)
  })

  it('returns sorted array', () => {
    const milestones = generateMilestones(500000)

    for (let i = 1; i < milestones.length; i++) {
      expect(milestones[i]).toBeGreaterThan(milestones[i - 1])
    }
  })

  it('handles edge case of zero final max', () => {
    const milestones = generateMilestones(0)

    // Should still return at least one milestone
    expect(milestones.length).toBeGreaterThan(0)
  })
})

describe('getActiveMilestone', () => {
  const milestones = [1000, 2500, 5000, 10000, 25000, 50000, 100000]

  describe('initial selection (no current milestone)', () => {
    it('selects smallest milestone covering visible max with 15% headroom', () => {
      // visibleMax = 800, with 15% headroom = 920, smallest covering is 1000
      expect(getActiveMilestone(800, milestones, null)).toBe(1000)

      // visibleMax = 900, with 15% headroom = 1035, smallest covering is 2500
      expect(getActiveMilestone(900, milestones, null)).toBe(2500)

      // visibleMax = 2000, with 15% headroom = 2300, smallest covering is 2500
      expect(getActiveMilestone(2000, milestones, null)).toBe(2500)

      // visibleMax = 2200, with 15% headroom = 2530, smallest covering is 5000
      expect(getActiveMilestone(2200, milestones, null)).toBe(5000)
    })
  })

  describe('stepping up', () => {
    it('steps up when visible max exceeds current milestone headroom', () => {
      // Current at 10000, visible goes to 9000 (9000 * 1.15 = 10350 > 10000)
      expect(getActiveMilestone(9000, milestones, 10000)).toBe(25000)
    })

    it('stays at current milestone when within headroom', () => {
      // Current at 10000, visible at 8000 (8000 * 1.15 = 9200 < 10000)
      expect(getActiveMilestone(8000, milestones, 10000)).toBe(10000)
    })
  })

  describe('hysteresis (stepping down)', () => {
    it('does NOT step down when visible max > 40% of current milestone', () => {
      // Current at 50000, visible drops to 25000 (50% of current)
      // Even though 25000 milestone would fit, hysteresis keeps it at 50000
      expect(getActiveMilestone(25000, milestones, 50000)).toBe(50000)

      // Current at 50000, visible at 21000 (42% of current)
      expect(getActiveMilestone(21000, milestones, 50000)).toBe(50000)
    })

    it('steps down when visible max drops below 40% of current milestone', () => {
      // Current at 50000, visible drops to 19000 (38% of current)
      // Now it should step down
      expect(getActiveMilestone(19000, milestones, 50000)).toBe(25000)

      // Current at 50000, visible drops to 10000 (20% of current)
      expect(getActiveMilestone(10000, milestones, 50000)).toBe(25000)
    })

    it('prevents oscillation during market dips', () => {
      // Simulate a market dip scenario
      let current: number | null = null

      // Start: visible = 8000 → milestone = 10000
      current = getActiveMilestone(8000, milestones, current)
      expect(current).toBe(10000)

      // Grow: visible = 20000 → milestone = 25000
      current = getActiveMilestone(20000, milestones, current)
      expect(current).toBe(25000)

      // Small dip: visible = 18000 → should stay at 25000 (hysteresis)
      current = getActiveMilestone(18000, milestones, current)
      expect(current).toBe(25000)

      // Bigger dip: visible = 12000 → still stay at 25000 (48% > 40%)
      current = getActiveMilestone(12000, milestones, current)
      expect(current).toBe(25000)

      // Recovery: visible = 20000 → still at 25000 (within headroom)
      current = getActiveMilestone(20000, milestones, current)
      expect(current).toBe(25000)

      // Continued growth: visible = 22000 → steps up to 50000 (22000 * 1.15 = 25300 > 25000)
      current = getActiveMilestone(22000, milestones, current)
      expect(current).toBe(50000)
    })
  })

  describe('edge cases', () => {
    it('uses last milestone when visible max exceeds all milestones', () => {
      expect(getActiveMilestone(150000, milestones, null)).toBe(100000)
    })

    it('handles empty milestones array gracefully', () => {
      // With empty array, should return undefined (which gets treated as NaN)
      // This is an edge case that shouldn't happen in practice
      const result = getActiveMilestone(1000, [], null)
      expect(result).toBeUndefined()
    })

    it('handles single milestone', () => {
      const singleMilestone = [50000]
      expect(getActiveMilestone(1000, singleMilestone, null)).toBe(50000)
      expect(getActiveMilestone(100000, singleMilestone, null)).toBe(50000)
    })
  })
})

describe('integration: milestone progression', () => {
  it('simulates 20-year DCA growth pattern', () => {
    // Simulate portfolio growing from $500 to $1M over time
    const finalMax = 1000000
    const milestones = generateMilestones(finalMax)

    // Track milestones as portfolio grows
    let currentMilestone: number | null = null
    const milestoneHistory: number[] = []

    // Simulate monthly growth points
    const growthPoints = [
      500, 1000, 2000, 4000, 8000, 15000, 30000, 60000,
      100000, 200000, 400000, 600000, 800000, 1000000,
    ]

    for (const visibleMax of growthPoints) {
      currentMilestone = getActiveMilestone(visibleMax, milestones, currentMilestone)
      milestoneHistory.push(currentMilestone)
    }

    // Verify milestones only increase (no stepping down during growth)
    for (let i = 1; i < milestoneHistory.length; i++) {
      expect(milestoneHistory[i]).toBeGreaterThanOrEqual(milestoneHistory[i - 1])
    }

    // Verify we hit the expected milestones
    expect(milestoneHistory).toContain(1000)
    expect(milestoneHistory).toContain(10000)
    expect(milestoneHistory).toContain(100000)
    expect(milestoneHistory).toContain(1000000)
  })
})
