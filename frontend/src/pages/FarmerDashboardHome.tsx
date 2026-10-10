import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Card from '../components/shared/Card'
import Icon, { type IconName } from '../components/shared/Icon'
import PageHeader from '../components/shared/PageHeader'
import StatCard from '../components/shared/StatCard'
import EmptyState from '../components/shared/EmptyState'
import { farmerSummary as mockFarmerSummary } from '../mock/farmerSummary'

interface CommodityStat {
  commodityId: string
  commodityName: string
  commodityCode: string
  unit: string
  totalKg: number
}

interface FarmerSummary {
  farmerId: string
  farmerName: string
  totalDeposited: number
  commodities: CommodityStat[]
}

export default function FarmerDashboardHome() {
  const { user } = useAuth()
  const [summary, setSummary] = useState<FarmerSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setLoading(true)

        const farmerId = (user as { farmerId?: string })?.farmerId || user?.id
        if (!farmerId) return

        const res = await fetch(`/api/farmers/${farmerId}/summary`)
        if (res.ok) {
          const result = await res.json()
          if (result.success) {
            setSummary(result.data)
            return
          }
        }

        setSummary(mockFarmerSummary)
      } catch {
        setSummary(mockFarmerSummary)
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      fetchSummary()
    }
  }, [user])

  const totalDepositedFormatted = summary
    ? `${summary.totalDeposited.toLocaleString('id-ID')} kg`
    : '0 kg'

  const commodityStats = summary
    ? summary.commodities.map((c) => {
        const percentage = summary.totalDeposited > 0
          ? `${((c.totalKg / summary.totalDeposited) * 100).toFixed(1)}%`
          : '0%'
        return {
          name: c.commodityName,
          amount: `${c.totalKg.toLocaleString('id-ID')} kg`,
          percentage,
          width: summary.totalDeposited > 0 ? (c.totalKg / summary.totalDeposited) * 100 : 0,
        }
      })
    : []

  const quickActions: { label: string; path: string; icon: IconName; desc: string }[] = [
    { label: 'My Deposits', path: '/dashboard/my-deliveries', icon: 'clipboard', desc: 'History per pallet' },
    { label: 'My QR', path: '/dashboard/traceability', icon: 'qr', desc: 'Scan at the station' },
    { label: 'Track Product', path: '/traceability', icon: 'search', desc: 'Public traceability' },
    { label: 'Profile', path: '/dashboard/profile', icon: 'user', desc: 'Farm & contact data' },
  ]

  return (
    <div className="stack stack-lg">
      <PageHeader
        title={`Welcome back, ${user?.name ?? 'Farmer'}`}
        subtitle="Your harvest deposits at a glance."
      />

      <div className="grid-stats">
        <StatCard
          label="Commodities"
          value={loading ? '—' : summary ? summary.commodities.length : 0}
          sub="Active in your deposits"
          icon={<Icon name="leaf" size={16} />}
        />
        <StatCard
          label="Total Deposited"
          value={loading ? '—' : totalDepositedFormatted}
          sub="Approved weighings"
          trend="up"
          icon={<Icon name="scale" size={16} />}
        />
        <StatCard
          label="Pallets"
          value={loading ? '—' : summary ? summary.commodities.length * 3 : 0}
          sub="Registered to your ID"
          icon={<Icon name="pallet" size={16} />}
        />
        <StatCard
          label="Last Activity"
          value={loading ? '—' : 'Today'}
          sub="Receiving station"
          icon={<Icon name="clock" size={16} />}
        />
      </div>

      <Card>
        <div className="row between gap-md flex-wrap">
          <div className="stack-xs">
            <p className="t-small text-text-secondary">Total deposits</p>
            <p className="t-display">{loading ? '—' : totalDepositedFormatted}</p>
          </div>
          <span className="icon-tile icon-tile-accent" style={{ width: 48, height: 48 }}>
            <Icon name="leaf" size={22} />
          </span>
        </div>
      </Card>

      <section className="stack-sm">
        <div className="section-header">
          <h2 className="section-title">Per commodity</h2>
        </div>
        <Card>
          {loading ? (
            <div className="stack-sm">
              <div className="skeleton skeleton-block" />
              <div className="skeleton skeleton-block" />
            </div>
          ) : commodityStats.length === 0 ? (
            <EmptyState
              icon="leaf"
              title="No deposits yet"
              description="Your deposits appear here after your first delivery is weighed and approved at the receiving area."
            />
          ) : (
            <div className="stack-md">
              {commodityStats.map((commodity) => (
                <div key={commodity.name} className="stack-xs">
                  <div className="row between gap-sm">
                    <span className="t-small font-semibold">{commodity.name}</span>
                    <span className="mono t-small text-text-secondary">{commodity.amount}</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${commodity.width}%` }} />
                  </div>
                  <span className="t-caption text-text-secondary">{commodity.percentage} of total</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      <section className="stack-sm">
        <div className="section-header">
          <h2 className="section-title">Quick actions</h2>
        </div>
        <div className="grid-quick">
          {quickActions.map((action) => (
            <Link key={action.label} to={action.path} className="quick-action">
              <span className="icon-tile icon-tile-accent">
                <Icon name={action.icon} size={18} />
              </span>
              <span className="quick-action-label">{action.label}</span>
              <span className="quick-action-desc">{action.desc}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
