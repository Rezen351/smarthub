import { useState } from 'react'
import Card from '../components/shared/Card'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import Icon, { type IconName } from '../components/shared/Icon'
import PageHeader from '../components/shared/PageHeader'
import StatCard from '../components/shared/StatCard'
import { useToast } from '../components/feedback/Toast'

interface Stat {
  label: string
  value: string
  sub: string
  trend: 'up' | 'down' | 'neutral'
  icon: IconName
}

const stats: Stat[] = [
  { label: 'Total Farmers', value: '128', sub: '+6 this week', trend: 'up', icon: 'users' },
  { label: 'Total Pallets', value: '1,245', sub: 'Since go-live', trend: 'up', icon: 'pallet' },
  { label: 'Total Weighing (kg)', value: '45,670', sub: 'Approved records', trend: 'up', icon: 'scale' },
  { label: 'Total Deliveries', value: '89', sub: '12 in transit', trend: 'neutral', icon: 'truck' },
]

const weekly = [
  { day: 'Mon', kg: 420 },
  { day: 'Tue', kg: 610 },
  { day: 'Wed', kg: 380 },
  { day: 'Thu', kg: 720 },
  { day: 'Fri', kg: 540 },
  { day: 'Sat', kg: 260 },
  { day: 'Sun', kg: 180 },
]

const maxKg = Math.max(...weekly.map((item) => item.kg))

const grades = [
  { grade: 'A', kg: 19800, share: 43 },
  { grade: 'B', kg: 16200, share: 36 },
  { grade: 'C', kg: 9670, share: 21 },
]

export default function ReportsPage() {
  const toast = useToast()
  const [range, setRange] = useState('7d')

  return (
    <div className="stack stack-lg">
      <PageHeader
        title="Reports"
        subtitle="System-wide recap of deposits, sorting stock and deliveries."
        actions={
          <>
            <div className="tabs" role="tablist" aria-label="Reporting range">
              {[
                { id: '7d', label: '7 days' },
                { id: '30d', label: '30 days' },
                { id: 'all', label: 'All time' },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={range === option.id}
                  className={`tab ${range === option.id ? 'is-active' : ''}`}
                  onClick={() => setRange(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              icon="download"
              onClick={() => toast.info('Preparing CSV export…')}
            >
              Export
            </Button>
          </>
        }
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-md">
        <Card title="Weekly weighing" subtitle="Approved kilograms per day">
          <div className="stack-md">
            <div className="row gap-sm" style={{ alignItems: 'flex-end', height: 180 }}>
              {weekly.map((item) => (
                <div key={item.day} className="stack-xs" style={{ flex: 1, alignItems: 'center' }}>
                  <span className="t-caption text-text-secondary num">{item.kg}</span>
                  <div
                    className="progress-fill"
                    style={{
                      width: '100%',
                      maxWidth: 40,
                      height: `${Math.max(4, (item.kg / maxKg) * 120)}px`,
                      background: 'var(--color-accent)',
                      borderRadius: '4px 4px 0 0',
                    }}
                  />
                  <span className="t-caption text-text-light">{item.day}</span>
                </div>
              ))}
            </div>
            <p className="t-caption text-text-secondary">
              Total {weekly.reduce((sum, item) => sum + item.kg, 0).toLocaleString('en-US')} kg in the last 7 days.
            </p>
          </div>
        </Card>

        <Card title="Grade distribution" subtitle="Share of approved weight per grade">
          <div className="stack-md">
            {grades.map((item) => (
              <div key={item.grade} className="stack-xs">
                <div className="row between gap-sm">
                  <span className="t-small font-semibold">Grade {item.grade}</span>
                  <span className="mono t-small text-text-secondary">{item.kg.toLocaleString('en-US')} kg</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${item.share}%` }} />
                </div>
                <span className="t-caption text-text-secondary">{item.share}% of total</span>
              </div>
            ))}
            <div className="divider" />
            <div className="row gap-sm flex-wrap">
              <Badge tone="accent" icon="leaf">
                Kentang only
              </Badge>
              <Badge tone="neutral">{range === 'all' ? 'All time' : `Last ${range}`}</Badge>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Operations summary" subtitle="Volume per station">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">
          {[
            { label: 'Receiving', value: '214 weighings', icon: 'scale' as IconName },
            { label: 'Sorting', value: '186 grade groups', icon: 'sortir' as IconName },
            { label: 'Packing', value: '1,120 pouches', icon: 'package' as IconName },
            { label: 'Warehouse', value: '78% capacity', icon: 'box' as IconName },
          ].map((item) => (
            <div key={item.label} className="row gap-md">
              <span className="icon-tile icon-tile-accent">
                <Icon name={item.icon} size={18} />
              </span>
              <div className="stack-xs">
                <p className="t-caption text-text-secondary uppercase">{item.label}</p>
                <p className="t-medium">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
