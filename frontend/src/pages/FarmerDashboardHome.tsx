import { idText } from '@/lib/indonesian'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Card from '../components/shared/Card'
import Icon, { type IconName } from '../components/shared/Icon'
import EmptyState from '../components/shared/EmptyState'
import { Skeleton } from '../components/ui/skeleton'
import { api, type FarmerSummary } from '../services/api'

/* One accent color per commodity row so the stacked bar and legend match. */
const BAR_COLORS = ['bg-accent', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500', 'bg-rose-500']

const quickActions: { label: string; path: string; icon: IconName; desc: string }[] = [
  { label: 'My Deposits', path: '/dashboard/my-deliveries', icon: 'clipboard', desc: 'History per pallet' },
  { label: 'My QR', path: '/dashboard/farmer-qr', icon: 'qr', desc: 'Show at the weighing station' },
  { label: 'Track Product', path: '/traceability', icon: 'search', desc: 'Public traceability' },
  { label: 'Profile', path: '/dashboard/profile', icon: 'user', desc: 'Farm & contact data' },
]

const formatKg = (value: number) => `${value.toLocaleString('id-ID')} kg`

export default function FarmerDashboardHome() {
  const { user } = useAuth()
  const [summary, setSummary] = useState<FarmerSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const farmerId = user?.farmerId

  useEffect(() => {
    setSummary(null)
    setError('')
    if (!farmerId) {
      setLoading(false)
      setError('No farmer profile is linked to this account.')
      return
    }
    setLoading(true)
    const controller = new AbortController()
    let fetching = false

    const fetchSummary = async () => {
      if (fetching || controller.signal.aborted) return
      fetching = true
      try {
        const data = await api.farmers.summary(farmerId, controller.signal)
        if (controller.signal.aborted) return
        setSummary(data)
        setError('')
      } catch {
        if (!controller.signal.aborted) setError('Could not update reception totals. Retrying…')
      } finally {
        fetching = false
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    const refresh = () => {
      if (document.visibilityState !== 'hidden') void fetchSummary()
    }
    void fetchSummary()
    const interval = window.setInterval(refresh, 5000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      controller.abort()
      window.clearInterval(interval)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [farmerId])

  const total = summary?.totalDeposited ?? 0
  const commodities = (summary?.commodities ?? [])
    .slice()
    .sort((a, b) => b.totalKg - a.totalKg)
    .map((c, index) => ({
      ...c,
      share: total > 0 ? (c.totalKg / total) * 100 : 0,
      color: BAR_COLORS[index % BAR_COLORS.length],
    }))

  return (
    <div className="flex flex-col gap-6">
      {/* Greeting */}
      <header>
        <p className="text-sm text-muted-foreground">{idText("Welcome back,")}</p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{user?.name ?? 'Farmer'}</h1>
      </header>

      {/* Hero: total deposits */}
      <section className="notch-corner border border-[#eaeaea] bg-black text-white p-6 md:p-8 rounded-none flex flex-col gap-5 md:flex-row md:items-end md:justify-between shadow-xs">
        <div className="flex flex-col gap-1">
          <div className="inline-flex items-center gap-2 font-mono-custom text-[11px] text-[#f59e0b] tracking-[0.2em] uppercase font-semibold">
            <span className="w-2 h-2 rounded-none bg-[#ea580c]"></span>
            <span>TOTAL RECEPTION · NET WEIGHT</span>
          </div>
          {loading ? (
            <Skeleton className="h-10 w-48 bg-white/15" />
          ) : (
            <span className="text-4xl md:text-5xl font-bold tracking-tight tabular-nums font-display text-white">{summary ? formatKg(total) : '—'}</span>
          )}
          <span className="text-xs text-white/70 font-mono">
            {loading
              ? 'Loading reception totals…'
              : summary
                ? `Across ${commodities.length} ${commodities.length === 1 ? 'commodity' : 'commodities'}`
                : 'Reception totals unavailable'}
          </span>
        </div>
        <Link
          to="/dashboard/farmer-qr"
          className="pulse-btn inline-flex items-center justify-center gap-2 rounded-none bg-[#ea580c] text-white font-heading tracking-wider uppercase text-xs px-5 min-h-[44px] hover:bg-[#c2410c] transition-all font-semibold"
        >
          <Icon name="qr" size={16} />
          {idText("Show my QR")}
        </Link>
      </section>

      {/* Per-commodity breakdown */}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Card title={idText("Deposits by commodity")} subtitle="Share of your total reception net weight">
        {loading ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-3 w-full" />
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        ) : !summary ? (
          <p className="text-sm text-muted-foreground">Reception totals are unavailable.</p>
        ) : commodities.length === 0 ? (
          <EmptyState
            icon="leaf"
            title={idText("No deposits yet")}
            description="Your deposits appear after Reception is saved."
          />
        ) : (
          <div className="flex flex-col gap-5">
            {/* Stacked share bar */}
            <div className="flex h-3 w-full overflow-hidden rounded-none bg-muted border border-border" aria-hidden="true">
              {commodities.map((c) => (
                <div key={c.commodityId} className={c.color} style={{ width: `${c.share}%` }} />
              ))}
            </div>

            <ul className="flex flex-col divide-y divide-border">
              {commodities.map((c) => (
                <li key={c.commodityId} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <span className={`size-2.5 rounded-none shrink-0 ${c.color}`} aria-hidden="true" />
                  <span className="text-sm font-medium text-foreground flex-1 min-w-0 truncate">
                    {idText(c.commodityName)}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums w-12 text-right font-mono">
                    {idText(c.share.toFixed(1))}%
                  </span>
                  <span className="text-sm font-semibold tabular-nums font-mono w-24 text-right">
                    {idText(formatKg(c.totalKg))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* Quick actions */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold tracking-tight text-foreground font-heading uppercase tracking-wider">{idText("Quick actions")}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              to={action.path}
              className="group flex flex-col gap-2 rounded-none border border-border bg-card p-4 min-h-[112px] transition-all hover:border-[#ea580c] hover:bg-[#fff7ed] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="icon-tile icon-tile-accent rounded-none">
                <Icon name={action.icon} size={18} />
              </span>
              <span className="text-sm font-semibold text-foreground flex items-center gap-1 font-heading uppercase tracking-wide">
                {idText(action.label)}
                <Icon
                  name="chevron-right"
                  size={14}
                  className="text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-[#ea580c]"
                />
              </span>
              <span className="text-xs text-muted-foreground">{idText(action.desc)}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
