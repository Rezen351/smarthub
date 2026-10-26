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
  { label: 'System Users', value: '3', sub: '3-Role RBAC (Admin, Operator, Farmer)', trend: 'neutral', icon: 'users' },
  { label: 'Intake Today', value: '1,420 kg', sub: '32 Warings received', trend: 'up', icon: 'scale' },
  { label: 'Sorting Yield', value: '91.4%', sub: '8.6% Shrinkage loss', trend: 'up', icon: 'clipboard' },
  { label: 'Scales Status', value: '3 Ready', sub: 'Reception, Sorting, Packaging', trend: 'neutral', icon: 'shield' },
]

const quickActions: QuickAction[] = [
  { label: 'Station 01: Reception', path: '/dashboard/weighing', icon: 'scale', desc: 'Gross intake scale & waring QR' },
  { label: 'Station 02: Sorting', path: '/dashboard/sorting', icon: 'sortir', desc: 'Sizing, washing & grade weighing' },
  { label: 'Station 03: Packaging', path: '/dashboard/packaging', icon: 'package', desc: 'Retail 1 kg & bulk export', primary: true },
  { label: 'Warehouse Ledger', path: '/dashboard/warehouse', icon: 'box', desc: 'Buffer & finished goods storage' },
  { label: 'Deliveries & Dispatch', path: '/dashboard/deliveries', icon: 'truck', desc: 'Manifest scan & truck departure' },
  { label: 'User Admin', path: '/dashboard/users', icon: 'users', desc: '3-role RBAC accounts' },
  { label: 'Scale Settings', path: '/dashboard/settings', icon: 'settings', desc: 'Transmitter IP & scale setup' },
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
