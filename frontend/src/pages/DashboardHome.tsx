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

interface Activity {
  time: string
  action: string
  icon: IconName
  tone: 'neutral' | 'accent'
}

const stats: Stat[] = [
  { label: 'Active Pallets', value: '24', sub: '+3 today', trend: 'up', icon: 'arrow-up' },
  { label: "Today's Weighing", value: '156', sub: 'kg processed', trend: 'up', icon: 'arrow-up' },
  { label: 'Pending Deliveries', value: '5', sub: '2 urgent', trend: 'down', icon: 'arrow-down' },
  { label: 'Warehouse Capacity', value: '78%', sub: '2,340 kg used', trend: 'up', icon: 'arrow-up' },
]

const activities: Activity[] = [
  { time: '10:30', action: 'Pallet PLT-20260914-0001 created by Ahmad', icon: 'pallet', tone: 'neutral' },
  { time: '10:15', action: 'Weighing recorded: 45.5 kg - Grade A', icon: 'scale', tone: 'accent' },
  { time: '09:45', action: 'Pouch PCH-PLT-20260914-0001-001 created', icon: 'package', tone: 'neutral' },
  { time: '09:30', action: 'Warehouse stock updated: +10 pouch Grade A', icon: 'box', tone: 'neutral' },
]

export default function DashboardHome() {
  return (
    <div className="stack stack-lg">
      <PageHeader title="Dashboard" subtitle="Overview of your operations" />

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

      <Card title="Recent Activity" subtitle="Latest events across your workflow">
        <div className="stack">
          {activities.map((activity, index) => (
            <div key={index} className="row gap-md py-3 border-b border-border last:border-0">
              <span className="mono t-caption text-text-light w-12 flex-shrink-0">{activity.time}</span>
              <span
                className={`icon-tile flex-shrink-0 ${activity.tone === 'accent' ? 'icon-tile-accent' : ''}`}
              >
                <Icon name={activity.icon} size={18} />
              </span>
              <span className="t-small text-text min-w-0">{activity.action}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
