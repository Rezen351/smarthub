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
  { label: "Today's Weighing", value: '156', sub: 'kg processed', trend: 'up', icon: 'scale' },
  { label: 'Active Pallets', value: '24', sub: '3 created today', trend: 'up', icon: 'pallet' },
  { label: 'Pending Approval', value: '5', sub: 'Awaiting verify', trend: 'down', icon: 'clock' },
  { label: 'Approved Today', value: '12', sub: 'Labels ready', trend: 'up', icon: 'check-circle' },
]

const quickActions: QuickAction[] = [
  { label: 'New Weighing', path: '/dashboard/weighing', icon: 'scale', desc: 'Scan, weigh, approve', primary: true },
  { label: 'Pallets', path: '/dashboard/pallets', icon: 'pallet', desc: 'Pallet register' },
  { label: 'Weighing History', path: '/dashboard/weighing', icon: 'history', desc: "Today's records" },
]

const activities: Activity[] = [
  { time: '10:15', action: 'Weighing recorded: 45.5 kg — Grade A', icon: 'scale', status: 'Approved', tone: 'success' },
  { time: '09:45', action: 'Weighing recorded: 30.0 kg — Grade B', icon: 'scale', status: 'Approved', tone: 'success' },
  { time: '09:30', action: 'Pallet PLT-20260914-0002 created', icon: 'pallet', status: 'Pending', tone: 'warning' },
]

export default function WeighingDashboardHome() {
  const { user } = useAuth()

  return (
    <div className="stack stack-lg">
      <PageHeader
        title={`Welcome back, ${user?.name ?? 'Operator'}`}
        subtitle="Receiving area — scan the farmer ID, weigh the sacks, approve the official weight."
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
          <span className="t-caption text-text-secondary">Weighing happens only in Receiving and Packing</span>
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

      <Card title="Recent Weighings" subtitle="Latest records from this station">
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
