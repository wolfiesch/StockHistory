import { describe, it, expect, beforeEach } from 'vitest'
import { useConfigStore } from '@/store/configStore'
import { useRollingAnalysisStore } from '@/store/rollingAnalysisStore'

describe('View Mode Toggle Integration', () => {
  beforeEach(() => {
    // Clear localStorage and reset stores
    localStorage.clear()
    useConfigStore.getState().resetConfig()
    useRollingAnalysisStore.getState().clearResults()
  })

  describe('initial state', () => {
    it('defaults to single view mode', () => {
      const state = useConfigStore.getState()
      expect(state.viewMode).toBe('single')
    })

    it('defaults to 10-year rolling horizon', () => {
      const state = useConfigStore.getState()
      expect(state.rollingHorizon).toBe(10)
    })

    it('defaults to normalized x-axis mode', () => {
      const state = useConfigStore.getState()
      expect(state.rollingXAxisMode).toBe('normalized')
    })
  })

  describe('setViewMode', () => {
    it('switches from single to rolling', () => {
      useConfigStore.getState().setViewMode('rolling')
      expect(useConfigStore.getState().viewMode).toBe('rolling')
    })

    it('switches from rolling to single', () => {
      useConfigStore.getState().setViewMode('rolling')
      useConfigStore.getState().setViewMode('single')
      expect(useConfigStore.getState().viewMode).toBe('single')
    })

    it('preserves other config when switching modes', () => {
      // Set up some config
      useConfigStore.getState().setTicker('MSFT')
      useConfigStore.getState().setAmount(500)
      useConfigStore.getState().setFrequency('weekly')

      // Switch mode
      useConfigStore.getState().setViewMode('rolling')

      // Verify other config preserved
      const state = useConfigStore.getState()
      expect(state.ticker).toBe('MSFT')
      expect(state.amount).toBe(500)
      expect(state.frequency).toBe('weekly')
      expect(state.viewMode).toBe('rolling')
    })
  })

  describe('setRollingHorizon', () => {
    it('sets 5-year horizon', () => {
      useConfigStore.getState().setRollingHorizon(5)
      expect(useConfigStore.getState().rollingHorizon).toBe(5)
    })

    it('sets 10-year horizon', () => {
      useConfigStore.getState().setRollingHorizon(10)
      expect(useConfigStore.getState().rollingHorizon).toBe(10)
    })

    it('sets 15-year horizon', () => {
      useConfigStore.getState().setRollingHorizon(15)
      expect(useConfigStore.getState().rollingHorizon).toBe(15)
    })

    it('sets 20-year horizon', () => {
      useConfigStore.getState().setRollingHorizon(20)
      expect(useConfigStore.getState().rollingHorizon).toBe(20)
    })

    it('preserves view mode when changing horizon', () => {
      useConfigStore.getState().setViewMode('rolling')
      useConfigStore.getState().setRollingHorizon(15)

      const state = useConfigStore.getState()
      expect(state.viewMode).toBe('rolling')
      expect(state.rollingHorizon).toBe(15)
    })
  })

  describe('setRollingXAxisMode', () => {
    it('sets normalized mode', () => {
      useConfigStore.getState().setRollingXAxisMode('normalized')
      expect(useConfigStore.getState().rollingXAxisMode).toBe('normalized')
    })

    it('sets calendar mode', () => {
      useConfigStore.getState().setRollingXAxisMode('calendar')
      expect(useConfigStore.getState().rollingXAxisMode).toBe('calendar')
    })
  })

  describe('state persistence across mode switches', () => {
    it('rolling settings persist when switching back to single', () => {
      // Configure rolling settings
      useConfigStore.getState().setViewMode('rolling')
      useConfigStore.getState().setRollingHorizon(15)
      useConfigStore.getState().setRollingXAxisMode('calendar')

      // Switch to single
      useConfigStore.getState().setViewMode('single')

      // Switch back to rolling
      useConfigStore.getState().setViewMode('rolling')

      // Settings should be preserved
      const state = useConfigStore.getState()
      expect(state.rollingHorizon).toBe(15)
      expect(state.rollingXAxisMode).toBe('calendar')
    })

    it('single scenario settings persist when in rolling mode', () => {
      // Configure single scenario
      useConfigStore.getState().setAmount(200)
      useConfigStore.getState().setFrequency('biweekly')
      useConfigStore.getState().setIsDRIP(false)

      // Switch to rolling
      useConfigStore.getState().setViewMode('rolling')

      // Settings should persist
      const state = useConfigStore.getState()
      expect(state.amount).toBe(200)
      expect(state.frequency).toBe('biweekly')
      expect(state.isDRIP).toBe(false)
    })
  })

  describe('bulk config update via setConfig', () => {
    it('updates view mode via setConfig', () => {
      useConfigStore.getState().setConfig({ viewMode: 'rolling' })
      expect(useConfigStore.getState().viewMode).toBe('rolling')
    })

    it('updates multiple rolling settings at once', () => {
      useConfigStore.getState().setConfig({
        viewMode: 'rolling',
        rollingHorizon: 20,
        rollingXAxisMode: 'calendar',
      })

      const state = useConfigStore.getState()
      expect(state.viewMode).toBe('rolling')
      expect(state.rollingHorizon).toBe(20)
      expect(state.rollingXAxisMode).toBe('calendar')
    })

    it('partial updates preserve unspecified fields', () => {
      useConfigStore.getState().setViewMode('rolling')
      useConfigStore.getState().setRollingHorizon(15)

      // Only update x-axis mode
      useConfigStore.getState().setConfig({ rollingXAxisMode: 'calendar' })

      const state = useConfigStore.getState()
      expect(state.viewMode).toBe('rolling')
      expect(state.rollingHorizon).toBe(15)
      expect(state.rollingXAxisMode).toBe('calendar')
    })
  })

  describe('rolling analysis store interaction', () => {
    it('rolling analysis store starts empty regardless of view mode', () => {
      useConfigStore.getState().setViewMode('rolling')

      const rollingState = useRollingAnalysisStore.getState()
      expect(rollingState.result).toBeNull()
      expect(rollingState.isComputing).toBe(false)
    })

    it('clearing rolling results does not affect config view mode', () => {
      useConfigStore.getState().setViewMode('rolling')
      useRollingAnalysisStore.getState().clearResults()

      expect(useConfigStore.getState().viewMode).toBe('rolling')
    })
  })

  describe('resetConfig behavior', () => {
    it('resets view mode to single', () => {
      useConfigStore.getState().setViewMode('rolling')
      useConfigStore.getState().resetConfig()
      expect(useConfigStore.getState().viewMode).toBe('single')
    })

    it('resets rolling horizon to 10', () => {
      useConfigStore.getState().setRollingHorizon(20)
      useConfigStore.getState().resetConfig()
      expect(useConfigStore.getState().rollingHorizon).toBe(10)
    })

    it('resets x-axis mode to normalized', () => {
      useConfigStore.getState().setRollingXAxisMode('calendar')
      useConfigStore.getState().resetConfig()
      expect(useConfigStore.getState().rollingXAxisMode).toBe('normalized')
    })
  })
})
