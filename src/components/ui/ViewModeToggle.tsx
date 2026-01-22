'use client'

import { useConfigStore } from '@/store/configStore'
import type { ViewMode } from '@/lib/api/types'

interface ViewModeOption {
  value: ViewMode
  label: string
  description: string
}

const VIEW_MODE_OPTIONS: ViewModeOption[] = [
  {
    value: 'single',
    label: 'Single Scenario',
    description: 'Simulate a specific date range',
  },
  {
    value: 'rolling',
    label: 'Rolling Analysis',
    description: 'All historical windows',
  },
]

export function ViewModeToggle() {
  const { viewMode, setViewMode } = useConfigStore()

  return (
    <div className="inline-flex items-center bg-gray-800/50 rounded-lg p-1">
      {VIEW_MODE_OPTIONS.map((option) => (
        <button
          key={option.value}
          onClick={() => setViewMode(option.value)}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200
            ${
              viewMode === option.value
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
            }`}
          title={option.description}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
