import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Badge from '../components/shared/Badge'
import Icon, { type IconName } from '../components/shared/Icon'
import PageHeader from '../components/shared/PageHeader'
import StatCard from '../components/shared/StatCard'
import { api } from '../services/api'
import { formatSafeDate } from '../lib/utils'

interface WorkstationCard {
  id: string
  number: string
  title: string
  subtitle: string
  path: string
  icon: IconName
  tag: string
  badgeTone: 'accent' | 'success' | 'warning' | 'neutral'
  scaleName: string
  metric: string
}

interface ScaleTcpNode {
  id: string
  stationNum: string
  stationLabel: string
  scaleRole: string
  ip: string
  capacity: string
  status: 'ONLINE' | 'STANDBY' | 'OFFLINE'
  liveWeightKg?: number
}

export default function OperatorDashboardHome() {
  const [metrics, setMetrics] = useState({
    grossIntakeKg: 0,
    grossIntakeWarings: 0,
    bufferWarings: 0,
    bufferKg: 0,
    yieldPct: 0,
    shrinkagePct: 0,
    hasBatches: false,
    finishedUnits: 0,
    finishedPouches: 0,
    finishedCartons: 0,
  })

  const [tcpNodes, setTcpNodes] = useState<ScaleTcpNode[]>([
    {
      id: 'scale-01',
      stationNum: '01',
      stationLabel: 'Reception',
      scaleRole: 'Scale',
      ip: 'Not configured',
      capacity: 'Not configured',
      status: 'OFFLINE',
    },
    {
      id: 'scale-02',
      stationNum: '02',
      stationLabel: 'Sorting',
      scaleRole: 'Scale',
      ip: 'Not configured',
      capacity: 'Not configured',
      status: 'OFFLINE',
    },
    {
      id: 'scale-03',
      stationNum: '03',
      stationLabel: 'Packaging',
      scaleRole: 'Scale',
      ip: 'Not configured',
      capacity: 'Not configured',
      status: 'OFFLINE',
    },
  ])

  const fetchLiveMetrics = useCallback(async () => {
    try {
      const [overviewRes, weighingRes, sortingRes, scalesRes] = await Promise.allSettled([
        api.warehouse.overview(),
        api.weighing.list(),
        api.sorting.batches(),
        api.scales.list(),
      ])

      // 1. Process Warehouse Overview
      let bufferCount = 0
      let bufferTotalKg = 0
      let fUnits = 0
      let fPouches = 0
      let fCartons = 0

      if (overviewRes.status === 'fulfilled' && overviewRes.value) {
        const ov = overviewRes.value
        bufferCount = ov.bufferZone?.waringCount ?? 0
        bufferTotalKg = ov.bufferZone?.totalWeightKg ?? 0
        fUnits = ov.finishedGoodsZone?.totalUnits ?? 0
        fPouches = ov.finishedGoodsZone?.pouchCount ?? 0
        fCartons = ov.finishedGoodsZone?.cartonCount ?? 0
      }

      // 2. Process Intake Today
      let todayKg = 0
      let todayWarings = 0
      if (weighingRes.status === 'fulfilled' && Array.isArray(weighingRes.value)) {
        const todayStr = new Date().toISOString().slice(0, 10)
        const todays = weighingRes.value.filter((w: any) => {
          const wDate = formatSafeDate(w.createdAt)
          return wDate === todayStr
        })
        todayKg = todays.reduce((acc: number, w: any) => acc + (Number(w.grossWeightKg) || 0), 0)
        todayWarings = todays.length
      }

      // 3. Process Sorting Yield
      let avgYield = 0
      let avgShrinkage = 0
      let hasBatches = false
      if (sortingRes.status === 'fulfilled' && Array.isArray(sortingRes.value) && sortingRes.value.length > 0) {
        hasBatches = true
        const totalIntake = sortingRes.value.reduce((acc: number, b: any) => acc + (Number(b.grossWeightKg) || 0), 0)
        const totalGraded = sortingRes.value.reduce((acc: number, b: any) => acc + (Number(b.totalGradedKg) || 0), 0)
        if (totalIntake > 0) {
          avgYield = (totalGraded / totalIntake) * 100
          avgShrinkage = 100 - avgYield
        }
      }

      setMetrics({
        grossIntakeKg: parseFloat(todayKg.toFixed(2)),
        grossIntakeWarings: todayWarings,
        bufferWarings: bufferCount,
        bufferKg: parseFloat(bufferTotalKg.toFixed(2)),
        yieldPct: parseFloat(avgYield.toFixed(1)),
        shrinkagePct: parseFloat(avgShrinkage.toFixed(1)),
        hasBatches,
        finishedUnits: fUnits,
        finishedPouches: fPouches,
        finishedCartons: fCartons,
      })

      // 4. Process Scale Health
      if (scalesRes.status === 'fulfilled' && Array.isArray(scalesRes.value)) {
        setTcpNodes((prev) =>
          prev.map((node) => {
            const live = scalesRes.value.find((s: any) => s.stationId === node.stationNum)
            if (!live) return node
            return {
              ...node,
              ip: `${live.ip}:${live.port}`,
              capacity: Number(live.capacityKg) > 0 ? `${Number(live.capacityKg)} kg` : 'Not configured',
              status: live.online ? 'ONLINE' : 'OFFLINE',
              liveWeightKg: live.weightKg,
            }
          })
        )
      }
    } catch {
      // Keep existing state if offline
    }
  }, [])

  useEffect(() => {
    fetchLiveMetrics()
    const timer = window.setInterval(fetchLiveMetrics, 5000)
    return () => window.clearInterval(timer)
  }, [fetchLiveMetrics])

  const workstations: WorkstationCard[] = [
    {
      id: 'ws-1',
      number: '01',
      title: 'Reception',
      subtitle: 'Harvest intake weighing and buffer queue',
      path: '/dashboard/weighing',
      icon: 'scale',
      tag: 'STATION 01',
      badgeTone: 'accent',
      scaleName: `Scale (${tcpNodes.find((node) => node.stationNum === '01')?.capacity || 'Not configured'})`,
      metric: `${metrics.grossIntakeKg.toLocaleString()} kg · ${metrics.grossIntakeWarings} Warings`,
    },
    {
      id: 'ws-2',
      number: '02',
      title: 'Sorting',
      subtitle: 'Sizing, washing, and grade weighing',
      path: '/dashboard/sorting',
      icon: 'sortir',
      tag: 'STATION 02',
      badgeTone: 'success',
      scaleName: `Scale (${tcpNodes.find((node) => node.stationNum === '02')?.capacity || 'Not configured'})`,
      metric: metrics.hasBatches
        ? `${metrics.yieldPct.toFixed(1)}% Yield · ${metrics.shrinkagePct.toFixed(1)}% Loss`
        : '0 Batches · Ready to Sort',
    },
    {
      id: 'ws-3',
      number: '03',
      title: 'Packaging',
      subtitle: 'Retail pouches, cartons, and storage',
      path: '/dashboard/packaging',
      icon: 'package',
      tag: 'STATION 03',
      badgeTone: 'accent',
      scaleName: `Scale (${tcpNodes.find((node) => node.stationNum === '03')?.capacity || 'Not configured'})`,
      metric: `${metrics.finishedPouches} pouches · ${metrics.finishedCartons} crates`,
    },
  ]

  const onlineScaleCount = tcpNodes.filter((n) => n.status === 'ONLINE').length
  const allScalesOnline = tcpNodes.length === 3 && onlineScaleCount === 3

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workstation Hub"
        subtitle="Select a physical workstation console to operate."
        actions={
          <Badge tone={allScalesOnline ? 'success' : 'warning'} dot live>
            {allScalesOnline ? 'All 3 Scales Online' : onlineScaleCount > 0 ? `${onlineScaleCount}/3 Scales Online` : 'All Scales Offline'}
          </Badge>
        }
      />

      {/* Summary KPI Strip — 100% Real Database Queries */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Today Gross Intake"
          value={`${metrics.grossIntakeKg.toLocaleString()} kg`}
          sub={`${metrics.grossIntakeWarings} Warings`}
          icon="scale"
          trend="neutral"
        />
        <StatCard
          label="Buffer Queue"
          value={`${metrics.bufferWarings} Warings`}
          sub={
            metrics.bufferWarings > 0
              ? `${metrics.bufferKg.toLocaleString()} kg awaiting sort`
              : 'Queue empty'
          }
          icon="box"
          trend="neutral"
        />
        <StatCard
          label="Yield Efficiency"
          value={metrics.hasBatches ? `${metrics.yieldPct.toFixed(1)}%` : '0.0%'}
          sub={metrics.hasBatches ? `${metrics.shrinkagePct.toFixed(1)}% Shrinkage` : 'No batches sorted'}
          icon="clipboard"
          trend="neutral"
        />
        <StatCard
          label="Finished Goods Stock"
          value={`${metrics.finishedUnits} units`}
          sub={metrics.finishedUnits > 0 ? 'Ready for dispatch' : '0 units ready'}
          icon="package"
          trend="neutral"
        />
      </div>

      {/* 3 Workstation Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-foreground tracking-tight">
              Workstations
            </h2>
            <p className="text-xs text-muted-foreground">
              Select a physical workstation to operate.
            </p>
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            {onlineScaleCount} Online
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {workstations.map((ws) => (
            <Link
              key={ws.id}
              to={ws.path}
              className="group block border border-border bg-card p-6 rounded-none shadow-xs hover:border-[#ea580c] hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 border border-border bg-muted/40 group-hover:bg-emerald-50 group-hover:border-emerald-300 text-foreground group-hover:text-emerald-800 flex items-center justify-center font-bold text-lg font-mono transition-colors">
                    {ws.number}
                  </div>
                  <Badge tone={ws.badgeTone}>
                    {ws.tag}
                  </Badge>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-foreground tracking-tight group-hover:text-[#0E5030] transition-colors">
                    {ws.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {ws.subtitle}
                  </p>
                </div>

                <div className="p-3 bg-muted/20 border border-border/80 text-xs space-y-1.5 font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Scale:</span>
                    <span className="font-semibold text-foreground">{ws.scaleName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Today Run:</span>
                    <span className="font-semibold text-[#0E5030]">{ws.metric}</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border mt-4 flex items-center justify-between text-xs font-bold text-[#0E5030]">
                <span>Open Console</span>
                <Icon name="check" size={16} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
