import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { usePackhouseStore } from '../hooks/usePackhouseStore'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import Card from '../components/shared/Card'
import Icon, { type IconName } from '../components/shared/Icon'
import PageHeader from '../components/shared/PageHeader'
import StatCard from '../components/shared/StatCard'
import { api } from '../services/api'
import { formatWeight } from '../lib/utils'

interface Activity {
  id: string
  stage: string
  time: string
  action: string
  icon: IconName
  badge: string
  tone: 'neutral' | 'accent' | 'success' | 'warning'
}

interface ScaleState {
  stationId: string
  label: string
  online: boolean
  weightKg: number | null
  endpoint: string
}

const defaultScales: ScaleState[] = [
  { stationId: '01', label: 'Reception', online: false, weightKg: null, endpoint: 'Not configured' },
  { stationId: '02', label: 'Sorting', online: false, weightKg: null, endpoint: 'Not configured' },
  { stationId: '03', label: 'Packaging', online: false, weightKg: null, endpoint: 'Not configured' },
]

const quickActions = [
  { label: 'Station 01: Reception', path: '/dashboard/weighing', icon: 'scale' as IconName, description: 'Intake weighing and Waring records' },
  { label: 'Station 02: Sorting', path: '/dashboard/sorting', icon: 'sortir' as IconName, description: 'Grade yield and pallet linkage' },
  { label: 'Station 03: Packaging', path: '/dashboard/packaging', icon: 'package' as IconName, description: 'Finished package production' },
  { label: 'Warehouse Ledger', path: '/dashboard/warehouse', icon: 'box' as IconName, description: 'Buffer and finished inventory' },
  { label: 'Deliveries', path: '/dashboard/deliveries', icon: 'truck' as IconName, description: 'Outbound loading and dispatch' },
  { label: 'Reports', path: '/dashboard/reports', icon: 'reports' as IconName, description: 'Operational transaction ledger' },
]

export default function AdminDashboardHome() {
  const { user } = useAuth()
  const { bufferWarings, sortedBatches, finishedStock, deliveries } = usePackhouseStore()
  const [presentationMode, setPresentationMode] = useState(false)
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const [loading, setLoading] = useState(true)
  const [dataOnline, setDataOnline] = useState(false)
  const [userCount, setUserCount] = useState(0)
  const [farmerCount, setFarmerCount] = useState(0)
  const [scales, setScales] = useState<ScaleState[]>(defaultScales)

  const loadSystemData = useCallback(async () => {
    const [usersResult, farmersResult, scalesResult] = await Promise.allSettled([
      api.auth.users(),
      api.farmers.list(),
      api.scales.list(),
    ])

    if (usersResult.status === 'fulfilled' && Array.isArray(usersResult.value)) setUserCount(usersResult.value.length)
    if (farmersResult.status === 'fulfilled' && Array.isArray(farmersResult.value)) setFarmerCount(farmersResult.value.length)
    if (scalesResult.status === 'fulfilled' && Array.isArray(scalesResult.value)) {
      setScales(defaultScales.map((station) => {
        const scale = scalesResult.value.find((item: any) => item.stationId === station.stationId)
        if (!scale) return station
        return {
          ...station,
          online: scale.online === true,
          weightKg: Number.isFinite(Number(scale.weightKg)) ? Number(scale.weightKg) : null,
          endpoint: scale.ip && scale.port ? `${scale.ip}:${scale.port}` : 'Not configured',
        }
      }))
    }
    setDataOnline([usersResult, farmersResult, scalesResult].some((result) => result.status === 'fulfilled'))
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadSystemData()
    const dataTimer = window.setInterval(loadSystemData, 15000)
    const clockTimer = window.setInterval(() => setCurrentTime(new Date()), 1000)
    return () => {
      window.clearInterval(dataTimer)
      window.clearInterval(clockTimer)
    }
  }, [loadSystemData])

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) setPresentationMode(false)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const enterPresentationMode = () => {
    setPresentationMode(true)
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {})
  }

  const exitPresentationMode = () => {
    setPresentationMode(false)
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
  }

  const metrics = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const todayWarings = bufferWarings.filter((item) => item.date === today)
    const intakeKg = todayWarings.reduce((sum, item) => sum + (Number(item.grossWeightKg) || 0), 0)
    const grossSortedKg = sortedBatches.reduce((sum, item) => sum + (Number(item.grossIntakeKg) || 0), 0)
    const gradedKg = sortedBatches.reduce((sum, item) => sum + (Number(item.totalGradedKg) || 0), 0)
    const finishedUnits = finishedStock.reduce((sum, item) => sum + (Number(item.units) || 0), 0)
    return {
      todayWarings: todayWarings.length,
      intakeKg,
      waitingWarings: bufferWarings.filter((item) => item.status === 'BUFFER_WAITING').length,
      sortedBatches: sortedBatches.length,
      yieldPct: grossSortedKg > 0 ? (gradedKg / grossSortedKg) * 100 : 0,
      finishedUnits,
      finishedWeightKg: finishedStock.reduce((sum, item) => sum + (Number(item.totalWeightKg) || 0), 0),
      activeDeliveries: deliveries.filter((item) => item.status !== 'DELIVERED').length,
      onlineScales: scales.filter((item) => item.online).length,
    }
  }, [bufferWarings, deliveries, finishedStock, scales, sortedBatches])

  const activities = useMemo<Activity[]>(() => {
    const reception = bufferWarings.slice(0, 2).map((item) => ({
      id: `reception-${item.id}`, stage: 'Station 01', time: `${item.date} ${item.intakeTime}`.trim(),
      action: `${item.code} · ${formatWeight(item.grossWeightKg)} kg · ${item.farmerName}`,
      icon: 'scale' as IconName, badge: 'Reception', tone: 'accent' as const,
    }))
    const sorting = sortedBatches.slice(0, 2).map((item) => ({
      id: `sorting-${item.id}`, stage: 'Station 02', time: `${item.date ?? '—'} ${item.timestamp || '—'}`,
      action: `${item.waringCode} · ${formatWeight(item.totalGradedKg)} kg graded · ${item.palletCode}`,
      icon: 'sortir' as IconName, badge: 'Sorting', tone: 'success' as const,
    }))
    const packaging = finishedStock.slice(0, 2).map((item) => ({
      id: `packaging-${item.id}`, stage: 'Station 03', time: `${item.date ?? '—'} ${item.packedTime || '—'}`,
      action: `${item.code} · ${item.units} units · ${formatWeight(item.totalWeightKg)} kg`,
      icon: 'package' as IconName, badge: 'Packaging', tone: 'accent' as const,
    }))
    const dispatch = deliveries.slice(0, 2).map((item) => ({
      id: `delivery-${item.id}`, stage: 'Dispatch', time: `${item.date} ${item.time}`.trim(),
      action: `${item.truckPlate} · ${item.destination} · ${item.units} units`, icon: 'truck' as IconName,
      badge: item.status, tone: item.status === 'DEPARTED' || item.status === 'DELIVERED' ? 'success' as const : 'warning' as const,
    }))
    return [...reception, ...sorting, ...packaging, ...dispatch]
  }, [bufferWarings, deliveries, finishedStock, sortedBatches])

  const flow = [
    { number: '01', label: 'Reception', value: `${metrics.todayWarings} Warings`, sub: `${formatWeight(metrics.intakeKg)} kg today`, icon: 'scale' as IconName, path: '/dashboard/weighing' },
    { number: '02', label: 'Sorting', value: `${metrics.sortedBatches} Batches`, sub: metrics.sortedBatches ? `${metrics.yieldPct.toFixed(1)}% yield` : 'No completed batches', icon: 'sortir' as IconName, path: '/dashboard/sorting' },
    { number: '03', label: 'Packaging', value: `${metrics.finishedUnits} Units`, sub: `${formatWeight(metrics.finishedWeightKg)} kg stored`, icon: 'package' as IconName, path: '/dashboard/packaging' },
    { number: '04', label: 'Warehouse', value: `${metrics.waitingWarings} Waiting`, sub: `${metrics.finishedUnits} finished units`, icon: 'box' as IconName, path: '/dashboard/warehouse' },
    { number: '05', label: 'Dispatch', value: `${metrics.activeDeliveries} Active`, sub: `${deliveries.length} total records`, icon: 'truck' as IconName, path: '/dashboard/deliveries' },
  ]

  const activityFeed = (
    <div className="divide-y divide-border">
      {activities.length === 0 ? (
        <div className="py-8 text-center">
          <Icon name="history" size={22} className="mx-auto text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">No operational activity recorded.</p>
          <p className="mt-1 text-xs text-muted-foreground">Transactions will appear after Station 01 records the first intake.</p>
        </div>
      ) : activities.map((activity) => (
        <div key={activity.id} className="flex items-center justify-between gap-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center border border-border bg-muted/40"><Icon name={activity.icon} size={17} /></span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{activity.stage}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{activity.time}</span>
              </div>
              <p className="truncate text-sm font-medium text-foreground">{activity.action}</p>
            </div>
          </div>
          <Badge tone={activity.tone}>{activity.badge}</Badge>
        </div>
      ))}
    </div>
  )

  return (
    <>
      {presentationMode && (
        <div className="fixed inset-0 z-[90] overflow-auto bg-[#07110c] text-white" role="dialog" aria-modal="true" aria-label="Operations Presentation">
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#07110c]/95 px-8 py-5 backdrop-blur">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-black tracking-tight">PACKHOUSE OPERATIONS</span>
                <span className="border border-emerald-400/40 bg-emerald-400/10 px-2 py-1 text-[11px] font-mono font-bold uppercase tracking-widest text-emerald-300">Live</span>
              </div>
              <p className="mt-1 text-sm text-white/55">Station 01–03 · Warehouse · Dispatch</p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="font-mono text-3xl font-bold tabular-nums">{currentTime.toLocaleTimeString('en-GB')}</p>
                <p className="text-xs uppercase tracking-wider text-white/50">{currentTime.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</p>
              </div>
              <Button variant="outline" icon="compress" onClick={exitPresentationMode} className="border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white">Exit</Button>
            </div>
          </header>

          <main className="mx-auto grid min-h-[calc(100vh-96px)] max-w-[1800px] grid-cols-12 gap-5 p-6 xl:p-8">
            {[
              { label: 'Gross Intake Today', value: `${formatWeight(metrics.intakeKg)} kg`, detail: `${metrics.todayWarings} Warings`, icon: 'scale' as IconName },
              { label: 'Sorting Yield', value: metrics.sortedBatches ? `${metrics.yieldPct.toFixed(1)}%` : '—', detail: `${metrics.sortedBatches} completed batches`, icon: 'sortir' as IconName },
              { label: 'Finished Inventory', value: `${metrics.finishedUnits}`, detail: `${formatWeight(metrics.finishedWeightKg)} kg available`, icon: 'package' as IconName },
              { label: 'System Readiness', value: `${metrics.onlineScales}/3`, detail: 'Scales online', icon: 'shield' as IconName },
            ].map((item) => (
              <section key={item.label} className="col-span-3 border border-white/10 bg-white/[0.04] p-5">
                <div className="flex items-center justify-between text-white/55"><p className="text-xs font-bold uppercase tracking-[0.14em]">{item.label}</p><Icon name={item.icon} size={20} /></div>
                <p className="mt-3 text-4xl font-black tracking-tight tabular-nums text-white">{item.value}</p>
                <p className="mt-1 text-sm text-emerald-300">{item.detail}</p>
              </section>
            ))}

            <section className="col-span-12 border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-5 flex items-center justify-between">
                <div><h2 className="text-lg font-bold">Operational Flow</h2><p className="text-xs text-white/50">Live transaction volume across the complete packhouse workflow</p></div>
                <span className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${dataOnline ? 'text-emerald-300' : 'text-amber-300'}`}><span className={`size-2 rounded-full ${dataOnline ? 'bg-emerald-400' : 'bg-amber-400'}`} />{dataOnline ? 'Data Connected' : 'Data Unavailable'}</span>
              </div>
              <div className="grid grid-cols-5 gap-3">
                {flow.map((item, index) => (
                  <div key={item.number} className="relative border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center justify-between"><span className="font-mono text-xs font-bold text-emerald-300">STAGE {item.number}</span><Icon name={item.icon} size={19} className="text-white/50" /></div>
                    <p className="mt-5 text-sm font-bold uppercase tracking-wider text-white/60">{item.label}</p>
                    <p className="mt-1 text-2xl font-black tabular-nums">{item.value}</p>
                    <p className="mt-1 text-xs text-white/45">{item.sub}</p>
                    {index < flow.length - 1 && <span className="absolute -right-3 top-1/2 z-10 text-emerald-400">›</span>}
                  </div>
                ))}
              </div>
            </section>

            <section className="col-span-8 border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-3 flex items-center justify-between"><div><h2 className="text-lg font-bold">Recent Activity</h2><p className="text-xs text-white/50">Station 01 through final dispatch</p></div><span className="font-mono text-xs text-white/40">{activities.length} events</span></div>
              {activities.length === 0 ? <p className="border-t border-white/10 py-8 text-center text-sm text-white/45">No operational activity recorded.</p> : (
                <div className="grid grid-cols-2 gap-x-6">
                  {activities.slice(0, 8).map((activity) => (
                    <div key={activity.id} className="flex min-w-0 items-center gap-3 border-t border-white/10 py-3">
                      <span className="flex size-9 shrink-0 items-center justify-center bg-emerald-400/10 text-emerald-300"><Icon name={activity.icon} size={17} /></span>
                      <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">{activity.stage} · {activity.time}</p><p className="truncate text-sm text-white/80">{activity.action}</p></div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="col-span-4 border border-white/10 bg-white/[0.04] p-5">
              <h2 className="text-lg font-bold">Scale Network</h2><p className="mb-3 text-xs text-white/50">Live Modbus TCP nodes</p>
              <div className="divide-y divide-white/10">
                {scales.map((scale) => (
                  <div key={scale.stationId} className="flex items-center justify-between py-3">
                    <div><p className="text-xs font-bold uppercase tracking-wider">Station {scale.stationId} · {scale.label}</p><p className="font-mono text-[11px] text-white/40">{scale.endpoint}</p></div>
                    <div className="text-right"><p className="font-mono text-lg font-bold">{scale.weightKg === null ? '—' : `${formatWeight(scale.weightKg)} kg`}</p><p className={`text-[10px] font-bold uppercase tracking-wider ${scale.online ? 'text-emerald-300' : 'text-amber-300'}`}>{scale.online ? 'Online' : 'Offline'}</p></div>
                  </div>
                ))}
              </div>
            </section>
          </main>
        </div>
      )}

      <div className="space-y-6">
        <PageHeader title={`Operations Dashboard${user?.name ? ` · ${user.name}` : ''}`} subtitle="Live operational status from Reception through Dispatch." actions={<Button variant="primary" icon="expand" onClick={enterPresentationMode}>Presentation Mode</Button>} />

        <div className="flex flex-wrap items-center justify-between gap-3 border border-border bg-card px-4 py-3">
          <div className="flex items-center gap-3"><Badge tone={dataOnline ? 'success' : 'warning'} dot live>{dataOnline ? 'Data Connected' : 'Data Unavailable'}</Badge><span className="text-xs text-muted-foreground">Last refresh {currentTime.toLocaleTimeString('en-GB')}</span></div>
          <span className="text-xs font-mono text-muted-foreground">{loading ? 'Loading system data…' : `${metrics.onlineScales}/3 scales online`}</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Gross Intake Today" value={`${formatWeight(metrics.intakeKg)} kg`} sub={`${metrics.todayWarings} Warings recorded`} icon={<Icon name="scale" size={17} />} />
          <StatCard label="Sorting Yield" value={metrics.sortedBatches ? `${metrics.yieldPct.toFixed(1)}%` : '—'} sub={`${metrics.sortedBatches} completed batches`} icon={<Icon name="sortir" size={17} />} />
          <StatCard label="Finished Inventory" value={`${metrics.finishedUnits} units`} sub={`${formatWeight(metrics.finishedWeightKg)} kg stored`} icon={<Icon name="package" size={17} />} />
          <StatCard label="Registered Accounts" value={String(userCount)} sub={`${farmerCount} farmer profiles`} icon={<Icon name="users" size={17} />} />
        </div>

        <Card title="Operational Flow" subtitle="Current volume from Station 01 through final dispatch." padding="sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            {flow.map((item) => (
              <Link key={item.number} to={item.path} className="group border border-border bg-muted/20 p-4 transition-colors hover:border-emerald-400 hover:bg-emerald-50/50">
                <div className="flex items-center justify-between"><span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Stage {item.number}</span><Icon name={item.icon} size={17} className="text-muted-foreground group-hover:text-emerald-700" /></div>
                <p className="mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">{item.label}</p><p className="mt-1 text-xl font-black tabular-nums">{item.value}</p><p className="mt-1 text-xs text-muted-foreground">{item.sub}</p>
              </Link>
            ))}
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card title="Recent Activity" subtitle="Station 01 through final dispatch." className="xl:col-span-2">{activityFeed}</Card>
          <Card title="Scale Network" subtitle="Live Modbus TCP status.">
            <div className="divide-y divide-border">
              {scales.map((scale) => (
                <div key={scale.stationId} className="flex items-center justify-between py-3">
                  <div><p className="text-xs font-bold uppercase tracking-wider">Station {scale.stationId} · {scale.label}</p><p className="font-mono text-[11px] text-muted-foreground">{scale.endpoint}</p></div>
                  <div className="text-right"><p className="font-mono text-sm font-bold">{scale.weightKg === null ? '—' : `${formatWeight(scale.weightKg)} kg`}</p><Badge tone={scale.online ? 'success' : 'warning'} dot>{scale.online ? 'Online' : 'Offline'}</Badge></div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <section>
          <div className="mb-3"><h2 className="text-base font-bold">Operations</h2><p className="text-xs text-muted-foreground">Open a live console or transaction report.</p></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {quickActions.map((action) => (
              <Link key={action.path} to={action.path} className="flex items-center gap-3 border border-border bg-card p-4 transition-colors hover:border-emerald-400">
                <span className="flex size-10 shrink-0 items-center justify-center bg-emerald-50 text-emerald-800"><Icon name={action.icon} size={18} /></span>
                <span className="min-w-0"><span className="block text-sm font-semibold">{action.label}</span><span className="block truncate text-xs text-muted-foreground">{action.description}</span></span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}
