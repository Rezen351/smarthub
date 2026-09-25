import { useAuth } from '../hooks/useAuth'
import Card from '../components/shared/Card'
import { useEffect, useState } from 'react'
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

        const farmerId = (user as any)?.farmerId || user?.id
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
        }
      })
    : []

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <p className="text-sm text-text-secondary mb-1">Welcome back,</p>
        <h1 className="text-2xl font-bold text-text">{user?.name}</h1>
      </div>

      <Card>
        <h3 className="card-title mb-4">Deposit Overview</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-background border border-border p-4 rounded-sm">
            <div className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">Commodities</div>
            <div className="text-xl font-bold text-text">{summary ? summary.commodities.length : '-'}</div>
          </div>
          <div className="bg-background border border-border p-4 rounded-sm">
            <div className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">Total Deposited</div>
            <div className="text-xl font-bold text-text">{loading ? '-' : totalDepositedFormatted}</div>
          </div>
          <div className="bg-background border border-border p-4 rounded-sm">
            <div className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">Types</div>
            <div className="text-xl font-bold text-text">{loading ? '-' : summary ? summary.commodities.length : '0'}</div>
          </div>
        </div>
      </Card>

      <div>
        <h2 className="text-lg font-semibold text-text mb-3">Total Deposited</h2>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-text-secondary">Total Setoran</div>
              <div className="text-3xl font-bold text-text">
                {loading ? '...' : totalDepositedFormatted}
              </div>
            </div>
            <div className="text-4xl">🏦</div>
          </div>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-text mb-3">Per Commodity</h2>
        <Card>
          {loading ? (
            <div className="text-center text-text-secondary py-4">Loading...</div>
          ) : commodityStats.length === 0 ? (
            <div className="text-center text-text-secondary py-4">No deposits yet</div>
          ) : (
            <div className="space-y-4">
              {commodityStats.map((commodity) => (
                <div key={commodity.name}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-sm font-medium text-text">{commodity.name}</div>
                    <div className="text-sm text-text-secondary">{commodity.amount}</div>
                  </div>
                  <div className="w-full bg-background rounded-sm h-2">
                    <div
                      className="bg-accent h-2 rounded-sm"
                      style={{ width: commodity.percentage }}
                    ></div>
                  </div>
                  <div className="text-xs text-text-secondary mt-1">{commodity.percentage} of total</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-text mb-3">Quick Actions</h2>
        <div className="grid grid-cols-3 gap-4">
          <a
            href="/dashboard/my-deliveries"
            className="bg-surface border border-border rounded-sm p-4 text-center hover:border-primary transition-colors"
          >
            <div className="text-2xl mb-2">🚛</div>
            <div className="text-sm font-medium text-text">My Deliveries</div>
          </a>
          <a
            href="/dashboard/traceability"
            className="bg-surface border border-border rounded-sm p-4 text-center hover:border-primary transition-colors"
          >
            <div className="text-2xl mb-2">🔍</div>
            <div className="text-sm font-medium text-text">Traceability</div>
          </a>
          <a
            href="/dashboard/my-deliveries"
            className="bg-surface border border-border rounded-sm p-4 text-center hover:border-primary transition-colors"
          >
            <div className="text-2xl mb-2">📋</div>
            <div className="text-sm font-medium text-text">History</div>
          </a>
        </div>
      </div>
    </div>
  )
}
