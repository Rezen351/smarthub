import React from 'react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
  icon?: React.ReactNode
  large?: boolean
  onClick?: () => void
}

export default function StatCard({ label, value, sub, trend = 'neutral', icon, large, onClick }: StatCardProps) {
  const trendColor =
    trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-600' : 'text-muted-foreground'

  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        {icon && <span className="text-muted-foreground/80 shrink-0">{icon}</span>}
      </div>
      <p
        className={cn(
          'font-bold tracking-tight tabular-nums text-foreground',
          large ? 'text-3xl md:text-4xl' : 'text-2xl md:text-3xl',
        )}
      >
        {value}
      </p>
      {sub && <p className={cn('text-xs font-medium', trendColor)}>{sub}</p>}
    </>
  )

  const cardClasses =
    'rounded-lg border border-border bg-card p-4 flex flex-col gap-1.5 shadow-xs transition-colors'

  if (onClick) {
    return (
      <button
        type="button"
        className={cn(cardClasses, 'text-left w-full hover:bg-muted/40 cursor-pointer')}
        onClick={onClick}
      >
        {content}
      </button>
    )
  }
  return <div className={cardClasses}>{content}</div>
}
