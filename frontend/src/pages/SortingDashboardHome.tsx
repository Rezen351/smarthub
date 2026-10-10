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
  { label: 'Pending Grading', value: '12', sub: 'Pallets to sort', trend: 'down', icon: 'sortir' },
  { label: 'Grades Recorded', value: '156', sub: 'kg allocated today', trend: 'up', icon: 'grade' },
  { label: 'Labels Printed', value: '142', sub: 'Grade labels', trend: 'up', icon: 'label' },
  { label: 'Grade Labels Queued', value: '3', sub: 'Waiting for printer', trend: 'neutral', icon: 'print' },
]

const quickActions: QuickAction[] = [
  { label: 'Sorting', path: '/dashboard/grading', icon: 'sortir', desc: 'Grade A/B/C per pallet', primary: true },
  { label: 'Label Queue', path: '/dashboard/labels', icon: 'label', desc: 'Print grade labels' },
  { label: 'Sorting History', path: '/dashboard/grading', icon: 'history', desc: 'Records per pallet' },
]

const activities: Activity[] = [
  { time: '10:15', action: 'Grade A: 45.5 kg recorded', icon: 'grade', status: 'Recorded', tone: 'success' },
  { time: '09:45', action: 'Pouch PCH-PLT-20260914-0001-001 created', icon: 'package', status: 'Packed', tone: 'success' },
  { time: '09:30', action: 'Label printed: PCH-PLT-20260914-0001-001', icon: 'label', status: 'Queued', tone: 'warning' },
]

export default function SortingDashboardHome() {
  const { user } = useAuth()

  return (
    <div className="stack stack-lg">
      <PageHeader
        title={`Welcome back, ${user?.name ?? 'Operator'}`}
        subtitle="Sorting area — split the harvest into grade A/B/C and print the grade labels."
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
          <span className="t-caption text-text-secondary">Sorting needs no scale — weight comes from the pouches</span>
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

      <Card title="Recent Activity" subtitle="Latest sorting and label events">
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
