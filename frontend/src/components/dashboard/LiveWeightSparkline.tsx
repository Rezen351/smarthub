import React from 'react'

interface LiveWeightSparklineProps {
  data: number[]
  online: boolean
  isStable?: boolean
  capacityKg?: number
  height?: number
  strokeWidth?: number
  showLabels?: boolean
  className?: string
}

export const LiveWeightSparkline: React.FC<LiveWeightSparklineProps> = ({
  data,
  online,
  isStable = true,
  capacityKg,
  height = 42,
  strokeWidth = 2,
  showLabels = false,
  className = '',
}) => {
  // Ensure we have at least 2 points to draw a line
  const points = data.length === 0 ? [0, 0] : data.length === 1 ? [data[0], data[0]] : data

  const width = 180
  const svgHeight = height
  const padTop = 6
  const padBottom = 6
  const usableHeight = svgHeight - padTop - padBottom

  const minVal = Math.min(...points)
  const maxVal = Math.max(...points)
  // Ensure non-zero range so we don't divide by zero
  const range = maxVal - minVal > 0.05 ? maxVal - minVal : 1

  const coordinates = points.map((val, idx) => {
    const x = (idx / (points.length - 1)) * (width - 8) + 4
    const normalizedY = (val - minVal) / range
    const y = svgHeight - padBottom - normalizedY * usableHeight
    return { x, y, val }
  })

  const pathD = coordinates.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}` : `${acc} L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`
  }, '')

  const lastPt = coordinates[coordinates.length - 1]
  const firstPt = coordinates[0]
  const areaD = `${pathD} L ${lastPt.x.toFixed(1)} ${svgHeight} L ${firstPt.x.toFixed(1)} ${svgHeight} Z`

  // Dynamic color palette harmonized with SmartGeulis Logo (Orange #ea580c, Amber #f59e0b)
  const strokeColor = !online ? '#71717a' : isStable ? '#ea580c' : '#f59e0b'
  const gradientId = React.useId()

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="relative w-full overflow-hidden" style={{ height: svgHeight }}>
        <svg
          viewBox={`0 0 ${width} ${svgHeight}`}
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity={online ? 0.35 : 0.08} />
              <stop offset="100%" stopColor={strokeColor} stopOpacity={0.0} />
            </linearGradient>
          </defs>

          {/* Area Fill */}
          <path d={areaD} fill={`url(#${gradientId})`} />

          {/* Line Path */}
          <path
            d={pathD}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          {/* Real-time Pulsing Tip on Last Point */}
          {online && (
            <>
              <circle
                cx={lastPt.x}
                cy={lastPt.y}
                r="5"
                fill={strokeColor}
                className="animate-ping opacity-60"
              />
              <circle
                cx={lastPt.x}
                cy={lastPt.y}
                r="3"
                fill="#ffffff"
                stroke={strokeColor}
                strokeWidth="1.5"
              />
            </>
          )}
        </svg>
      </div>

      {showLabels && (
        <div className="flex items-center justify-between mt-1 text-xs font-mono text-white/50">
          <span>Min {minVal.toFixed(2)} kg</span>
          {capacityKg && <span>Cap {capacityKg} kg</span>}
          <span className="text-[#fb923c] font-bold">Max {maxVal.toFixed(2)} kg</span>
        </div>
      )}
    </div>
  )
}

