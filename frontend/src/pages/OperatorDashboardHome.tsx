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
      stationLabel: 'Penerimaan',
      scaleRole: 'Timbangan',
      ip: 'Belum dikonfigurasi',
      capacity: 'Belum dikonfigurasi',
      status: 'OFFLINE',
    },
    {
      id: 'scale-02',
      stationNum: '02',
      stationLabel: 'Sortasi',
      scaleRole: 'Timbangan',
      ip: 'Belum dikonfigurasi',
      capacity: 'Belum dikonfigurasi',
      status: 'OFFLINE',
    },
    {
      id: 'scale-03',
      stationNum: '03',
      stationLabel: 'Pengemasan',
      scaleRole: 'Timbangan',
      ip: 'Belum dikonfigurasi',
      capacity: 'Belum dikonfigurasi',
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
              capacity: Number(live.capacityKg) > 0 ? `${Number(live.capacityKg)} kg` : 'Belum dikonfigurasi',
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
      title: 'Penerimaan',
      subtitle: 'Penimbangan hasil panen masuk dan antrean buffer',
      path: '/dashboard/weighing',
      icon: 'scale',
      tag: 'STASIUN 01',
      badgeTone: 'accent',
      scaleName: `Timbangan (${tcpNodes.find((node) => node.stationNum === '01')?.capacity || 'Belum dikonfigurasi'})`,
      metric: `${metrics.grossIntakeKg.toLocaleString('id-ID')} kg · ${metrics.grossIntakeWarings} Waring`,
    },
    {
      id: 'ws-2',
      number: '02',
      title: 'Sortasi',
      subtitle: 'Pengukuran, pencucian, dan penimbangan grade',
      path: '/dashboard/sorting',
      icon: 'sortir',
      tag: 'STASIUN 02',
      badgeTone: 'success',
      scaleName: `Timbangan (${tcpNodes.find((node) => node.stationNum === '02')?.capacity || 'Belum dikonfigurasi'})`,
      metric: metrics.hasBatches
        ? `${metrics.yieldPct.toFixed(1)}% Hasil · ${metrics.shrinkagePct.toFixed(1)}% Susut`
        : '0 Batch · Siap Sortasi',
    },
    {
      id: 'ws-3',
      number: '03',
      title: 'Pengemasan',
      subtitle: 'Pouch ritel, karton, dan penyimpanan',
      path: '/dashboard/packaging',
      icon: 'package',
      tag: 'STASIUN 03',
      badgeTone: 'accent',
      scaleName: `Timbangan (${tcpNodes.find((node) => node.stationNum === '03')?.capacity || 'Belum dikonfigurasi'})`,
      metric: `${metrics.finishedPouches} pouch · ${metrics.finishedCartons} krat`,
    },
  ]

  const onlineScaleCount = tcpNodes.filter((n) => n.status === 'ONLINE').length
  const allScalesOnline = tcpNodes.length === 3 && onlineScaleCount === 3

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pusat Stasiun Kerja"
        subtitle="Pilih konsol stasiun kerja untuk dioperasikan."
        actions={
          <Badge tone={allScalesOnline ? 'success' : 'warning'} dot live>
            {allScalesOnline ? 'Semua 3 Timbangan Terhubung' : onlineScaleCount > 0 ? `${onlineScaleCount}/3 Timbangan Terhubung` : 'Semua Timbangan Terputus'}
          </Badge>
        }
      />

      {/* Summary KPI Strip — 100% Real Database Queries */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Penerimaan Kotor Hari Ini"
          value={`${metrics.grossIntakeKg.toLocaleString('id-ID')} kg`}
          sub={`${metrics.grossIntakeWarings} Waring`}
          icon="scale"
          trend="neutral"
        />
        <StatCard
          label="Antrean Buffer"
          value={`${metrics.bufferWarings} Waring`}
          sub={
            metrics.bufferWarings > 0
              ? `${metrics.bufferKg.toLocaleString('id-ID')} kg menunggu sortasi`
              : 'Antrean kosong'
          }
          icon="box"
          trend="neutral"
        />
        <StatCard
          label="Efisiensi Hasil"
          value={metrics.hasBatches ? `${metrics.yieldPct.toFixed(1)}%` : '0.0%'}
          sub={metrics.hasBatches ? `${metrics.shrinkagePct.toFixed(1)}% Susut` : 'Belum ada batch disortasi'}
          icon="clipboard"
          trend="neutral"
        />
        <StatCard
          label="Stok Barang Jadi"
          value={`${metrics.finishedUnits} unit`}
          sub={metrics.finishedUnits > 0 ? 'Siap dikirim' : '0 unit siap'}
          icon="package"
          trend="neutral"
        />
      </div>

      {/* 3 Workstation Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-foreground tracking-tight">
              Stasiun Kerja
            </h2>
            <p className="text-xs text-muted-foreground">
              Pilih stasiun kerja fisik untuk dioperasikan.
            </p>
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            {onlineScaleCount} Terhubung
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
                    <span className="text-muted-foreground">Timbangan:</span>
                    <span className="font-semibold text-foreground">{ws.scaleName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Operasi Hari Ini:</span>
                    <span className="font-semibold text-[#0E5030]">{ws.metric}</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border mt-4 flex items-center justify-between text-xs font-bold text-[#0E5030]">
                <span>Buka Konsol</span>
                <Icon name="check" size={16} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
