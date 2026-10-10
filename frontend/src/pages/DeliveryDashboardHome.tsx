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
  status: string
  tone: 'success' | 'warning' | 'accent'
}

const stats: Stat[] = [
  { label: 'Active Deliveries', value: '5', sub: 'Trucks scheduled', trend: 'up', icon: 'truck' },
  { label: 'Pending Packaging', value: '8', sub: 'Units to pack', trend: 'down', icon: 'package' },
  { label: 'Completed Today', value: '3', sub: 'Departed loads', trend: 'up', icon: 'check-circle' },
  { label: 'Awaiting Verification', value: '2', sub: 'ITF-14 scans', trend: 'down', icon: 'scan' },
]

const quickActions: QuickAction[] = [
  { label: 'Packaging', path: '/dashboard/packaging', icon: 'package', desc: 'Export units 10/50 kg' },
  { label: 'Deliveries', path: '/dashboard/deliveries', icon: 'truck', desc: 'Create & depart', primary: true },
  { label: 'Verify Load', path: '/dashboard/deliveries', icon: 'scan', desc: 'Scan ITF-14' },
]

const activities: Activity[] = [
  { time: '08:00', action: 'Delivery B1234XYZ departed to Jakarta', icon: 'truck', status: 'Departed', tone: 'success' },
  { time: '07:30', action: 'Packaging PKG-001 created (50 kg Kentang)', icon: 'package', status: 'Packed', tone: 'success' },
  { time: '07:00', action: 'Delivery B5678ABC load verification pending', icon: 'scan', status: 'Pending', tone: 'warning' },
]

export default function DeliveryDashboardHome() {
  const { user } = useAuth()

  return (
    <div className="stack stack-lg">
      <PageHeader
        title={`Welcome back, ${user?.name ?? 'Operator'}`}
        subtitle="Delivery — build export loads, verify with an ITF-14 scan, then record departure."
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

      <section className="stack-sm">
        <div className="section-header">
          <h2 className="section-title">Quick actions</h2>
          <span className="t-caption text-text-secondary">Stock is deducted only after departure is confirmed</span>
        </div>
        <div className="grid-quick">
          {quickActions.map((action) => (
            <Link key={action.label} to={action.path} className="quick-action">
              <span className={`icon-tile ${action.primary ? 'icon-tile-solid' : 'icon-tile-accent'}`}>
                <Icon name={action.icon} size={18} />
              </span>
              <span className="quick-action-label">{action.label}</span>
              <span className="quick-action-desc">{action.desc}</span>
            </Link>
          ))}
        </div>
      </section>

      <Card title="Recent Activity" subtitle="Latest packaging and delivery events">
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
              <Badge tone={activity.tone} dot={activity.tone === 'success'}>
                {activity.status}
              </Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
