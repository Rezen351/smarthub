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
  const trendClass = trend === 'up' ? 'stat-trend-up' : trend === 'down' ? 'stat-trend-down' : ''
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="stat-label">{label}</p>
        {icon && <span className="text-text-light">{icon}</span>}
      </div>
      <p className={`stat-value ${large ? 'stat-value-lg' : ''}`}>{value}</p>
      {sub && <p className={`stat-sub ${trendClass}`}>{sub}</p>}
    </>
  )

  if (onClick) {
    return (
      <button type="button" className="stat-card text-left w-full" onClick={onClick}>
        {content}
      </button>
    )
  }
  return <div className="stat-card">{content}</div>
}
