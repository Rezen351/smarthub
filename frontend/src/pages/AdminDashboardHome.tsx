import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
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
  tone: 'neutral' | 'accent' | 'success' | 'warning'
}

const stats: Stat[] = [
  { label: 'Total Users', value: '24', sub: '6 roles configured', trend: 'up', icon: 'users' },
  { label: 'Active Today', value: '18', sub: '75% of accounts', trend: 'up', icon: 'check-circle' },
  { label: 'Pending Approvals', value: '5', sub: 'Weighing records', trend: 'down', icon: 'clock' },
  { label: 'System Status', value: 'Online', sub: 'All services healthy', trend: 'neutral', icon: 'shield' },
]

const quickActions: QuickAction[] = [
  { label: 'Manage Users', path: '/dashboard/users', icon: 'users', desc: 'Accounts & roles' },
  { label: 'View Reports', path: '/dashboard/reports', icon: 'reports', desc: 'Setoran & stock' },
  { label: 'Settings', path: '/dashboard/settings', icon: 'settings', desc: 'Commodity & labels' },
]

const activities: Activity[] = [
  { time: '10:30', action: 'New user registered: operator@enyx.local', icon: 'user', badge: 'User', tone: 'accent' },
  { time: '09:15', action: 'System backup completed', icon: 'shield', badge: 'System', tone: 'success' },
  { time: '08:00', action: 'Daily report generated', icon: 'reports', badge: 'Report', tone: 'neutral' },
]

export default function AdminDashboardHome() {
  const { user } = useAuth()

  return (
    <div className="stack stack-lg">
      <PageHeader
        title={`Welcome back, ${user?.name ?? 'Admin'}`}
        subtitle="System overview — users, master data and reports."
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

      <Card title="Recent Activity" subtitle="Latest system events">
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

      <Card
        title="Master data"
        subtitle="Single active commodity: Kentang (grade A/B/C)."
        action={
          <Link to="/dashboard/settings">
            <Button variant="outline" size="sm" icon="settings">
              Configure
            </Button>
          </Link>
        }
      >
        <div className="row gap-sm flex-wrap">
          <Badge tone="accent" icon="leaf">
            Kentang · active
          </Badge>
          <Badge tone="neutral">Tomat · disabled</Badge>
          <Badge tone="neutral">Cabai · disabled</Badge>
          <span className="t-caption text-text-secondary">
            Multi-commodity schema is ready; only Kentang is enabled in this scope.
          </span>
        </div>
      </Card>
    </div>
  )
}
