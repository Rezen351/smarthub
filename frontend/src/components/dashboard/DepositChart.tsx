import React, { useState, useId } from 'react'
import { formatWeight } from '../../lib/utils'

export interface HourlyDepositItem {
  hour: string // e.g. "04:00", "05:00", "06:00"
  grossKg: number
  warings: number
}

export interface DailyDepositItem {
  date: string // "YYYY-MM-DD"
  dayLabel: string // e.g. "Sen 09", "Rab 11"
  fullDateLabel: string // e.g. "Wednesday, 11 Nov 2026"
  grossKg: number
  warings: number
  isToday: boolean
}

interface SingleChartPanelProps {
  title: string
  subtitle: string
  items: {
    label: string
    subLabel: string
    value: number
    count: number
    isHighlight?: boolean
    tooltipTitle: string
  }[]
  totalKg: number
  totalWarings: number
  statRightLabel: string
  statRightValue: string
  highlightColor?: string
  theme?: 'dark' | 'light'
  className?: string
}

const SingleChartPanel: React.FC<SingleChartPanelProps> = ({
  title,
  subtitle,
  items,
  totalKg,
  totalWarings,
  statRightLabel,
  statRightValue,
  highlightColor = '#f97316',
  theme = 'dark',
  className = '',
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const chartId = useId()
  const isDark = theme === 'dark'

  const maxVal = Math.max(...items.map((i) => i.value), 5)
  const chartHeight = 90
  const svgWidth = 460
  const nBars = items.length
  const usableWidth = svgWidth - 28
  const slotWidth = usableWidth / nBars
  const barWidth = Math.min(28, Math.max(8, slotWidth - 6))

  const active = hoveredIdx !== null && items[hoveredIdx] ? items[hoveredIdx] : null

  return (
    <div
      className={`relative flex flex-col justify-between ${
        isDark
          ? 'bg-white/[0.04] border border-white/10 text-white'
          : 'bg-card border border-border text-foreground'
      } p-3 xl:p-3.5 overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className={`text-sm xl:text-base font-bold tracking-tight uppercase ${isDark ? 'text-white' : 'text-foreground'}`}>
              {title}
            </h3>
            <span
              className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 border ${
                isDark
                  ? 'border-[#ea580c]/40 bg-[#ea580c]/15 text-[#fb923c]'
                  : 'border-orange-500/30 bg-orange-50 text-orange-700'
              }`}
            >
              Live
            </span>
          </div>
          <p className={`text-xs ${isDark ? 'text-white/60' : 'text-muted-foreground'}`}>
            {subtitle}
          </p>
        </div>

        {/* Quick KPI stats */}
        <div className="text-right shrink-0">
          <p className="font-mono text-base xl:text-lg font-black tabular-nums text-[#f97316] leading-tight">
            {formatWeight(totalKg)} kg
          </p>
          <p className={`text-xs font-mono ${isDark ? 'text-white/65' : 'text-muted-foreground'}`}>
            {totalWarings}w · {statRightLabel}: <span className={`${isDark ? 'text-amber-400' : 'text-amber-600'} font-bold`}>{statRightValue}</span>
          </p>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="relative w-full flex-1 min-h-0 flex items-end">
        {/* Hover Tooltip */}
        {active && (
          <div
            className={`absolute top-0 right-1 z-20 px-2.5 py-1 border text-xs shadow-lg pointer-events-none ${
              isDark ? 'bg-black/90 border-[#ea580c]/50 text-white' : 'bg-popover border-border text-foreground'
            }`}
          >
            <span className="font-bold">{active.tooltipTitle}: </span>
            <span className="text-[#f97316] font-bold font-mono">{formatWeight(active.value)} kg </span>
            <span className={isDark ? 'text-white/60' : 'text-muted-foreground'}>({active.count}w)</span>
          </div>
        )}

        <svg viewBox={`0 0 ${svgWidth} ${chartHeight + 28}`} className="w-full h-auto overflow-visible">
          <defs>
            <linearGradient id={`${chartId}-grad-orange`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#ea580c" />
            </linearGradient>
            <linearGradient id={`${chartId}-grad-highlight`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={highlightColor} />
              <stop offset="100%" stopColor="#c2410c" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0.5, 1].map((pct) => {
            const y = chartHeight - pct * (chartHeight - 16)
            return (
              <g key={pct}>
                <line
                  x1="14"
                  y1={y}
                  x2={svgWidth - 14}
                  y2={y}
                  stroke={isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'}
                  strokeDasharray="3 3"
                />
                <text
                  x="10"
                  y={y + 3}
                  textAnchor="end"
                  fontSize="9.5"
                  fontFamily="monospace"
                  fill={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)'}
                >
                  {(pct * maxVal).toFixed(0)}
                </text>
              </g>
            )
          })}

          {/* Baseline */}
          <line
            x1="14"
            y1={chartHeight}
            x2={svgWidth - 14}
            y2={chartHeight}
            stroke={isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)'}
            strokeWidth="1"
          />

          {/* Bars */}
          {items.map((item, idx) => {
            const xCenter = 14 + idx * slotWidth + slotWidth / 2
            const x = xCenter - barWidth / 2
            const barH = item.value > 0 ? Math.max(5, (item.value / maxVal) * (chartHeight - 16)) : 2.5
            const y = chartHeight - barH
            const isHovered = hoveredIdx === idx

            return (
              <g
                key={`${item.label}-${idx}`}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <rect x={14 + idx * slotWidth} y={0} width={slotWidth} height={chartHeight + 28} fill="transparent" />

                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barH}
                  rx="2.5"
                  ry="2.5"
                  fill={
                    item.value === 0
                      ? isDark
                        ? 'rgba(255,255,255,0.06)'
                        : 'rgba(0,0,0,0.04)'
                      : item.isHighlight
                      ? `url(#${chartId}-grad-highlight)`
                      : `url(#${chartId}-grad-orange)`
                  }
                  opacity={isHovered ? 1 : 0.9}
                  stroke={isHovered ? '#ffffff' : item.isHighlight ? highlightColor : 'none'}
                  strokeWidth={isHovered ? 1.5 : item.isHighlight ? 1 : 0}
                />

                {item.value > 0 && (
                  <text
                    x={xCenter}
                    y={y - 4}
                    textAnchor="middle"
                    fontSize={nBars > 10 ? '9' : '10.5'}
                    fontWeight="bold"
                    fontFamily="monospace"
                    fill={isDark ? '#fb923c' : '#ea580c'}
                  >
                    {formatWeight(item.value)}
                  </text>
                )}

                <text
                  x={xCenter}
                  y={chartHeight + 11}
                  textAnchor="middle"
                  fontSize={nBars > 10 ? '9.5' : '11'}
                  fontFamily="monospace"
                  fontWeight={item.isHighlight ? 'bold' : 'normal'}
                  fill={
                    item.isHighlight
                      ? '#f59e0b'
                      : isDark
                      ? 'rgba(255,255,255,0.7)'
                      : 'rgba(0,0,0,0.75)'
                  }
                >
                  {item.label}
                </text>

                <text
                  x={xCenter}
                  y={chartHeight + 21}
                  textAnchor="middle"
                  fontSize="8.5"
                  fontFamily="monospace"
                  fill={
                    item.count > 0
                      ? isDark
                        ? 'rgba(255,255,255,0.85)'
                        : 'rgba(0,0,0,0.85)'
                      : isDark
                      ? 'rgba(255,255,255,0.25)'
                      : 'rgba(0,0,0,0.3)'
                  }
                >
                  {item.count > 0 ? `${item.count}w` : '—'}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

// ── Daily Deposit Chart ──
export interface DailyDepositChartProps {
  data: HourlyDepositItem[]
  totalKg: number
  warings: number
  theme?: 'dark' | 'light'
  className?: string
}

export const DailyDepositChart: React.FC<DailyDepositChartProps> = ({
  data,
  totalKg,
  warings,
  theme = 'dark',
  className = '',
}) => {
  const peakHourly = data.reduce(
    (max, item) => (item.grossKg > max.grossKg ? item : max),
    { hour: '—', grossKg: 0, warings: 0 }
  )

  const items = data.map((h) => ({
    label: h.hour,
    subLabel: `${h.warings}w`,
    value: h.grossKg,
    count: h.warings,
    isHighlight: h.grossKg > 0,
    tooltipTitle: `Hour ${h.hour}`,
  }))

  return (
    <SingleChartPanel
      title="Daily Intake · Today"
      subtitle="Hourly gross intake weight (kg) distribution"
      items={items}
      totalKg={totalKg}
      totalWarings={warings}
      statRightLabel="Peak"
      statRightValue={peakHourly.grossKg > 0 ? `${peakHourly.hour}` : '—'}
      highlightColor="#f97316"
      theme={theme}
      className={className}
    />
  )
}

// ── Weekly Deposit Chart ──
export interface WeeklyDepositChartProps {
  data: DailyDepositItem[]
  totalKg: number
  warings: number
  theme?: 'dark' | 'light'
  className?: string
}

export const WeeklyDepositChart: React.FC<WeeklyDepositChartProps> = ({
  data,
  totalKg,
  warings,
  theme = 'dark',
  className = '',
}) => {
  const avgDaily = data.length > 0 ? totalKg / data.length : 0

  const items = data.map((d) => ({
    label: d.dayLabel,
    subLabel: `${d.warings}w`,
    value: d.grossKg,
    count: d.warings,
    isHighlight: d.isToday,
    tooltipTitle: d.fullDateLabel || d.date,
  }))

  return (
    <SingleChartPanel
      title="Weekly Intake · Past 7 Days"
      subtitle="Daily deposit volume trend over the past 7 days"
      items={items}
      totalKg={totalKg}
      totalWarings={warings}
      statRightLabel="Avg"
      statRightValue={`${formatWeight(avgDaily)} kg/d`}
      highlightColor="#f59e0b"
      theme={theme}
      className={className}
    />
  )
}

// ── Backwards-compatible Combined DepositChart for Standard Mode ──
export interface DepositChartProps {
  todayHourly: HourlyDepositItem[]
  past7Days: DailyDepositItem[]
  todayTotalKg: number
  todayWarings: number
  weekTotalKg: number
  weekWarings: number
  theme?: 'dark' | 'light'
  className?: string
}

export const DepositChart: React.FC<DepositChartProps> = ({
  todayHourly,
  past7Days,
  todayTotalKg,
  todayWarings,
  weekTotalKg,
  weekWarings,
  theme = 'dark',
  className = '',
}) => {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 ${className}`}>
      <DailyDepositChart
        data={todayHourly}
        totalKg={todayTotalKg}
        warings={todayWarings}
        theme={theme}
      />
      <WeeklyDepositChart
        data={past7Days}
        totalKg={weekTotalKg}
        warings={weekWarings}
        theme={theme}
      />
    </div>
  )
}
