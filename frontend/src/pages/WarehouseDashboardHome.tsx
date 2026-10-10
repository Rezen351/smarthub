import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Badge from '../components/shared/Badge'
import Card from '../components/shared/Card'
import Icon, { type IconName } from '../components/shared/Icon'
import PageHeader from '../components/shared/PageHeader'
import StatCard from '../components/shared/StatCard'

interface Stat {
  label: string
  value: string
  sub: string
  trend: 'up' | 'down' | 'neutral'
  icon: IconName
}

interface QuickAction {
  label: string
  path: string
  icon: IconName
  desc: string
  primary?: boolean
}

interface Activity {
  time: string
  action: string
  icon: IconName
  badge: string
  tone: 'success' | 'accent' | 'warning'
}

const stats: Stat[] = [
  { label: 'Total Stock', value: '2,340', sub: 'pouch units', trend: 'up', icon: 'box' },
  { label: 'Capacity Used', value: '78%', sub: '2,340 of 3,000 kg', trend: 'up', icon: 'stack' },
  { label: 'Pending Scan', value: '3', sub: 'Awaiting stock in', trend: 'down', icon: 'clock' },
  { label: 'Low Stock Grades', value: '1', sub: 'Grade C below 20%', trend: 'down', icon: 'alert' },
]

const quickActions: QuickAction[] = [
  { label: 'Stock In', path: '/dashboard/stock-in', icon: 'arrow-down', desc: 'Scan pouches in' },
  { label: 'Stock Out', path: '/dashboard/stock-out', icon: 'arrow-up', desc: 'Scan packaging out' },
  { label: 'Capacity Alert', path: '/dashboard/stock-in', icon: 'alert', desc: 'Free space 660 kg' },
]

const activities: Activity[] = [
  { time: '09:30', action: 'Stock In: +10 pouch Grade A (Kentang)', icon: 'arrow-down', badge: 'In', tone: 'success' },
  { time: '08:45', action: 'Stock Out: -50 kg Packaging (Tomat)', icon: 'arrow-up', badge: 'Out', tone: 'accent' },
  { time: '08:00', action: 'Capacity alert: 78% used', icon: 'alert', badge: 'Alert', tone: 'warning' },
]

const capacityPct = 78
const capacityKg = 3000
const usedKg = 2340

export default function WarehouseDashboardHome() {
  const { user } = useAuth()

  return (
    <div className="stack stack-lg">
      <PageHeader
        title={`Welcome back, ${user?.name ?? 'Operator'}`}
        subtitle="Warehouse — stock in, stock out, and capacity at a glance."
      />

      <div className="grid-stats">
        {stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            sub={stat.sub}
            trend={stat.trend}
            icon={<Icon name={stat.icon} size={16} />}
          />
        ))}
      </div>

      <Card title="Capacity" subtitle="Warehouse space used today">
        <div className="stack-sm">
          <div className="row between flex-wrap gap-sm">
            <span className="t-medium">{capacityPct}% used</span>
            <span className="t-small text-text-secondary mono">
              {usedKg.toLocaleString('en-US')} / {capacityKg.toLocaleString('en-US')} kg
            </span>
          </div>
          <div className="progress-track">
            <div
              className={`progress-fill ${capacityPct >= 90 ? 'is-danger' : capacityPct >= 80 ? 'is-warning' : ''}`}
              style={{ width: `${capacityPct}%` }}
            />
          </div>
          <div className="alert alert-warning" role="status">
            <Icon name="alert" size={16} />
            <span>
              Warehouse capacity at {capacityPct}% — only {(capacityKg - usedKg).toLocaleString('en-US')} kg free.
            </span>
          </div>
        </div>
      </Card>

      <section className="stack-sm">
        <div className="section-header">
          <h2 className="section-title">Quick actions</h2>
        </div>
        <div className="grid-quick">
          {quickActions.map((action) => (
            <Link key={action.label} to={action.path} className="quick-action">
              <span className={`icon-tile ${action.primary ? 'icon-tile-solid' : action.label === 'Capacity Alert' ? 'icon-tile-accent' : 'icon-tile'}`}>
                <Icon name={action.icon} size={18} />
              </span>
              <span className="quick-action-label">{action.label}</span>
              <span className="quick-action-desc">{action.desc}</span>
            </Link>
          ))}
        </div>
      </section>

      <Card title="Recent Movements" subtitle="Latest stock changes">
        <div className="stack">
          {activities.map((activity, index) => (
            <div key={index} className="row gap-md between py-3 border-b border-border last:border-0">
              <div className="row gap-md min-w-0">
                <span className="icon-tile flex-shrink-0">
                  <Icon name={activity.icon} size={18} />
                </span>
                <div className="min-w-0">
                  <p className="t-small text-truncate">{activity.action}</p>
                  <p className="t-caption text-text-secondary mono">{activity.time}</p>
                </div>
              </div>
              <Badge tone={activity.tone}>{activity.badge}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
