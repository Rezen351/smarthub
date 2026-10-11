import { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Badge from '../components/shared/Badge'
import Card from '../components/shared/Card'
import Icon, { type IconName } from '../components/shared/Icon'
import PageHeader from '../components/shared/PageHeader'
import StatCard from '../components/shared/StatCard'

interface Stat {
  label: string
  value: ReactNode
  sub: ReactNode
  trend?: 'up' | 'down' | 'neutral'
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
  { label: "Today's Pouches", value: '342', sub: '1 kg packs', trend: 'up', icon: 'package' },
  {
    label: 'Grade Distribution',
    value: (
      <div className="flex items-baseline justify-between gap-1 py-0.5 w-full">
        <div className="flex items-baseline gap-1">
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">A:</span>
          <span className="text-xl font-bold text-foreground">180</span>
        </div>
        <span className="text-muted-foreground/30 font-light">·</span>
        <div className="flex items-baseline gap-1">
          <span className="text-xs font-bold text-sky-600 dark:text-sky-400">B:</span>
          <span className="text-xl font-bold text-foreground">120</span>
        </div>
        <span className="text-muted-foreground/30 font-light">·</span>
        <div className="flex items-baseline gap-1">
          <span className="text-xs font-bold text-amber-600 dark:text-amber-400">C:</span>
          <span className="text-xl font-bold text-foreground">42</span>
        </div>
      </div>
    ),
    sub: (
      <div className="space-y-1 w-full pt-0.5">
        <div className="flex h-1.5 w-full rounded-none overflow-hidden bg-muted">
          <div style={{ width: '52.6%' }} className="bg-emerald-500" title="Grade A: 53%" />
          <div style={{ width: '35.1%' }} className="bg-sky-500" title="Grade B: 35%" />
          <div style={{ width: '12.3%' }} className="bg-amber-500" title="Grade C: 12%" />
        </div>
        <span className="text-[11px] text-muted-foreground font-medium block">
          53% A · 35% B · 12% C
        </span>
      </div>
    ),
    trend: 'neutral',
    icon: 'grade',
  },
  { label: 'Scale Stations', value: '3 Online', sub: 'Channels A, B, C', trend: 'up', icon: 'scale' },
  { label: 'Printer Status', value: 'Ready', sub: 'Pouch thermal printer', trend: 'neutral', icon: 'print' },
]

const quickActions: QuickAction[] = [
  { label: 'Packaging Station', path: '/dashboard/packaging', icon: 'package', desc: 'Live scale weighing & label printing', primary: true },
  { label: 'Scale Settings', path: '/dashboard/settings', icon: 'settings', desc: 'Configure 3 Modbus TCP scale channels' },
  { label: 'Packaging History', path: '/dashboard/packaging', icon: 'history', desc: "Today's labelled pouches" },
]

const activities: Activity[] = [
  { time: '11:08', action: 'Pouch PCH-20261010-002 labelled: 0.998 kg - Grade B (Station 2)', icon: 'package', status: 'Labelled', tone: 'success' },
  { time: '11:05', action: 'Pouch PCH-20261010-001 labelled: 1.002 kg - Grade A (Station 1)', icon: 'package', status: 'Labelled', tone: 'success' },
  { time: '10:50', action: 'Scale Station 3 Modbus TCP verified: 192.168.1.103:502', icon: 'scale', status: 'Online', tone: 'accent' },
]

export default function PackagingDashboardHome() {
  const { user } = useAuth()

  return (
    <div className="stack stack-lg">
      <PageHeader
        title={`Welcome back, ${user?.name ?? 'Packaging Operator'}`}
        subtitle="Packaging area — live 1 kg pouch weighing, grade selection, and GS1 QR/EAN-13 label printing across 3 scale stations."
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

      <Card title="Recent Activity" subtitle="Latest packaging events">
        <div className="stack">
          {activities.map((activity, index) => (
            <div key={index} className="row gap-md between py-3 border-b border-border last:border-0">
              <div className="row gap-md min-w-0">
                <span className="icon-tile flex-shrink-0">
                  <Icon name={activity.icon} size={18} />
                </span>
                <div className="stack-none min-w-0">
                  <p className="t-small text-text truncate">{activity.action}</p>
                  <span className="mono t-caption text-text-light">{activity.time}</span>
                </div>
              </div>
              <Badge tone={activity.tone}>{activity.status}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

