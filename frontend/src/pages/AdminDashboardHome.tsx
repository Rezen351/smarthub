import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Badge from '../components/shared/Badge'
import Card from '../components/shared/Card'
import Icon, { type IconName } from '../components/shared/Icon'
import PageHeader from '../components/shared/PageHeader'
import StatCard from '../components/shared/StatCard'
import { api } from '../services/api'
import { formatSafeTime, formatSafeDate } from '../lib/utils'

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

const quickActions: QuickAction[] = [
  { label: 'Station 01: Reception', path: '/dashboard/weighing', icon: 'scale', desc: 'Gross intake scale & waring QR' },
  { label: 'Station 02: Sorting', path: '/dashboard/sorting', icon: 'sortir', desc: 'Sizing, washing & grade weighing' },
  { label: 'Station 03: Packaging', path: '/dashboard/packaging', icon: 'package', desc: 'Retail 1 kg & bulk export', primary: true },
  { label: 'Warehouse Ledger', path: '/dashboard/warehouse', icon: 'box', desc: 'Buffer & finished goods storage' },
  { label: 'Deliveries & Dispatch', path: '/dashboard/deliveries', icon: 'truck', desc: 'Manifest scan & truck departure' },
  { label: 'User Admin', path: '/dashboard/users', icon: 'users', desc: '3-role RBAC accounts' },
      { label: 'Settings', path: '/dashboard/settings', icon: 'settings', desc: 'Scale and thermal printer settings' },
]

export default function AdminDashboardHome() {
  const { user } = useAuth()
  const [metrics, setMetrics] = useState({
    intakeKg: 0,
    waringCount: 0,
    yieldPct: 0,
    shrinkagePct: 0,
    hasBatches: false,
    scalesOnline: 0,
    scalesTotal: 0,
    userCount: 0,
    activities: [] as Activity[],
  })

  useEffect(() => {
    async function loadData() {
      try {
        const [weighingRes, sortingRes, scalesRes, usersRes] = await Promise.allSettled([
          api.weighing.list(),
          api.sorting.batches(),
          api.scales.list(),
          api.auth.users(),
        ])

        let intakeKg = 0
        let waringCount = 0
        const activities: Activity[] = []

        if (weighingRes.status === 'fulfilled' && Array.isArray(weighingRes.value)) {
          const todayStr = new Date().toISOString().slice(0, 10)
          const todays = weighingRes.value.filter((w: any) => {
            const wDate = formatSafeDate(w.createdAt)
            return wDate === todayStr
          })
          intakeKg = todays.reduce((acc: number, w: any) => acc + (Number(w.grossWeightKg) || 0), 0)
          waringCount = todays.length

          // Generate recent activity items from latest warings
          weighingRes.value.slice(0, 3).forEach((w: any) => {
            activities.push({
              time: formatSafeTime(w.createdAt || w.approvedAt),
              action: `Intake waring ${w.code} weighed: ${w.grossWeightKg} kg (${w.farmerName})`,
              icon: 'scale',
              badge: 'Intake',
              tone: 'accent',
            })
          })
        }

        let yieldPct = 0
        let shrinkagePct = 0
        let hasBatches = false
        if (sortingRes.status === 'fulfilled' && Array.isArray(sortingRes.value) && sortingRes.value.length > 0) {
          hasBatches = true
          const totalIntake = sortingRes.value.reduce((acc: number, b: any) => acc + (Number(b.grossWeightKg) || 0), 0)
          const totalGraded = sortingRes.value.reduce((acc: number, b: any) => acc + (Number(b.totalGradedKg) || 0), 0)
          if (totalIntake > 0) {
            yieldPct = (totalGraded / totalIntake) * 100
            shrinkagePct = 100 - yieldPct
          }
        }

        let scalesOnline = 0
        let scalesTotal = 0
        if (scalesRes.status === 'fulfilled' && Array.isArray(scalesRes.value)) {
          scalesOnline = scalesRes.value.filter((s: any) => s.online).length
          scalesTotal = scalesRes.value.length
        }

        const userCount =
          usersRes.status === 'fulfilled' && Array.isArray(usersRes.value) ? usersRes.value.length : 0

        setMetrics({
          intakeKg: parseFloat(intakeKg.toFixed(2)),
          waringCount,
          yieldPct: parseFloat(yieldPct.toFixed(1)),
          shrinkagePct: parseFloat(shrinkagePct.toFixed(1)),
          hasBatches,
          scalesOnline,
          scalesTotal,
          userCount,
          activities,
        })
      } catch {
        // keep defaults
      }
    }

    loadData()
  }, [])

  return (
    <div className="stack stack-lg">
      <PageHeader
        title={`Welcome back, ${user?.name ?? 'Admin'}`}
        subtitle="Overview of users, operations, and reports."
      />

      <div className="grid-stats">
        <StatCard
          label="System Users"
          value={String(metrics.userCount)}
          sub="Admin, Operator, Farmer"
          trend="neutral"
          icon={<Icon name="users" size={16} />}
        />
        <StatCard
          label="Intake Today"
          value={`${metrics.intakeKg.toLocaleString()} kg`}
          sub={`${metrics.waringCount} Warings received`}
          trend="neutral"
          icon={<Icon name="scale" size={16} />}
        />
        <StatCard
          label="Sorting Yield"
          value={metrics.hasBatches ? `${metrics.yieldPct.toFixed(1)}%` : '0.0%'}
          sub={metrics.hasBatches ? `${metrics.shrinkagePct.toFixed(1)}% Shrinkage` : 'No batches sorted'}
          trend="neutral"
          icon={<Icon name="clipboard" size={16} />}
        />
        <StatCard
          label="Scales Status"
          value={`${metrics.scalesOnline}/${metrics.scalesTotal} Online`}
          sub="Reception, Sorting, Packaging"
          trend="neutral"
          icon={<Icon name="shield" size={16} />}
        />
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

      <Card title="Recent Activity" subtitle="Latest activity across the packhouse.">
        <div className="stack">
          {metrics.activities.length === 0 && (
            <p className="t-small text-text-secondary py-3">No recent activity.</p>
          )}
          {metrics.activities.map((activity, index) => (
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
