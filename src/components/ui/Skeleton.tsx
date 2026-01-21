interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-gray-700/50 rounded ${className}`}
    />
  )
}

export function SkeletonText({ className = '' }: SkeletonProps) {
  return <Skeleton className={`h-4 ${className}`} />
}

export function SkeletonCard({ className = '' }: SkeletonProps) {
  return (
    <div className={`bg-gray-800/50 rounded-lg p-4 ${className}`}>
      <Skeleton className="h-3 w-20 mb-2" />
      <Skeleton className="h-8 w-24" />
    </div>
  )
}

export function ChartSkeleton() {
  return (
    <div className="h-[400px] bg-gray-900/50 rounded-xl p-4 flex flex-col">
      {/* Y-axis labels */}
      <div className="flex h-full">
        <div className="w-16 flex flex-col justify-between py-4">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-8" />
        </div>

        {/* Chart area */}
        <div className="flex-1 flex flex-col justify-end relative">
          {/* Simulated chart bars/area */}
          <div className="absolute inset-0 flex items-end justify-around px-2 gap-1">
            {[20, 25, 30, 28, 35, 40, 38, 45, 50, 55, 52, 60].map((height, i) => (
              <div
                key={i}
                className="flex-1 bg-gradient-to-t from-gray-700/30 to-gray-600/10 rounded-t animate-pulse"
                style={{
                  height: `${height}%`,
                  animationDelay: `${i * 100}ms`,
                }}
              />
            ))}
          </div>

          {/* X-axis */}
          <div className="flex justify-between pt-2 mt-auto border-t border-gray-700">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-3 w-10" />
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </div>
  )
}

export function MetricsSkeleton() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-4 w-24" />
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  )
}
