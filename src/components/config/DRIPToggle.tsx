'use client'

import { useConfigStore } from '@/store/configStore'

export function DRIPToggle() {
  const { isDRIP, setIsDRIP } = useConfigStore()

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-400">
        Dividend Reinvestment (DRIP)
      </label>
      <div className="flex items-center gap-4">
        <button
          onClick={() => setIsDRIP(true)}
          className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
            isDRIP
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          Reinvest
        </button>
        <button
          onClick={() => setIsDRIP(false)}
          className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
            !isDRIP
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          Accumulate
        </button>
      </div>
      <p className="text-xs text-gray-500">
        {isDRIP
          ? 'Dividends are automatically reinvested to buy more shares'
          : 'Dividends accumulate as cash (shown in yellow)'}
      </p>
    </div>
  )
}
