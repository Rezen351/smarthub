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
  { label: 'Palet Aktif', value: '24', sub: '+3 hari ini', trend: 'up', icon: 'arrow-up' },
  { label: 'Penimbangan Hari Ini', value: '156', sub: 'kg diproses', trend: 'up', icon: 'arrow-up' },
  { label: 'Pengiriman Tertunda', value: '5', sub: '2 mendesak', trend: 'down', icon: 'arrow-down' },
  { label: 'Kapasitas Gudang', value: '78%', sub: '2.340 kg terpakai', trend: 'up', icon: 'arrow-up' },
]

const activities: Activity[] = [
  { time: '10:30', action: 'Palet PLT-20260914-0001 dibuat oleh Ahmad', icon: 'pallet', tone: 'neutral' },
  { time: '10:15', action: 'Penimbangan tercatat: 45,5 kg - Grade A', icon: 'scale', tone: 'accent' },
  { time: '09:45', action: 'Pouch PCH-PLT-20260914-0001-001 dibuat', icon: 'package', tone: 'neutral' },
  { time: '09:30', action: 'Stok gudang diperbarui: +10 pouch Grade A', icon: 'box', tone: 'neutral' },
]

export default function DashboardHome() {
  return (
    <div className="stack stack-lg">
      <PageHeader title="Dasbor" subtitle="Ringkasan operasional Anda" />

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

      <Card title="Aktivitas Terbaru" subtitle="Kejadian terbaru pada alur kerja Anda">
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
