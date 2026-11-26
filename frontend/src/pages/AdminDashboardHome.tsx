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
import { LiveWeightSparkline } from '../components/dashboard/LiveWeightSparkline'
import { DailyDepositChart, WeeklyDepositChart } from '../components/dashboard/DepositChart'
import { GradeQualityPanel } from '../components/dashboard/GradeQualityPanel'
import { api } from '../services/api'
import { formatWeight } from '../lib/utils'
import { idText, translateStatus } from '@/lib/i18n'

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
  isStable?: boolean
  capacityKg?: number
  weightKg: number | null
  endpoint: string
}

const defaultScales: ScaleState[] = [
  { stationId: '01', label: 'Penerimaan', online: false, isStable: true, capacityKg: 300, weightKg: null, endpoint: 'Belum dikonfigurasi' },
  { stationId: '02', label: 'Sortasi', online: false, isStable: true, capacityKg: 40, weightKg: null, endpoint: 'Belum dikonfigurasi' },
  { stationId: '03', label: 'Pengemasan', online: false, isStable: true, capacityKg: 40, weightKg: null, endpoint: 'Belum dikonfigurasi' },
]

const quickActions = [
  { label: 'Stasiun 01: Penerimaan', path: '/dashboard/weighing', icon: 'scale' as IconName, description: 'Penimbangan masuk dan pencatatan Waring' },
  { label: 'Stasiun 02: Sortasi', path: '/dashboard/sorting', icon: 'sortir' as IconName, description: 'Hasil grade dan penautan palet' },
  { label: 'Stasiun 03: Pengemasan', path: '/dashboard/packaging', icon: 'package' as IconName, description: 'Produksi kemasan barang jadi' },
  { label: 'Buku Gudang', path: '/dashboard/warehouse', icon: 'box' as IconName, description: 'Stok buffer dan barang jadi' },
  { label: 'Laporan & Rekap', path: '/dashboard/reports', icon: 'reports' as IconName, description: 'Rekap harian/bulanan dan ekspor CSV' },
  { label: 'Dokumentasi API (OpenAPI)', path: '/docs', icon: 'clipboard' as IconName, description: 'Spesifikasi & skema OpenAPI 3.0 interaktif', external: true },
]

export interface FarmerRankingItem {
  rank: number
  code: string
  name: string
  village: string
  totalWarings: number
  totalKg: number
  sharePct: number
}

function getLocalDateStr(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function AdminDashboardHome() {
  const { user } = useAuth()
  const { bufferWarings, sortedBatches, finishedStock, deliveries, syncWithBackend } = usePackhouseStore()
  const [presentationMode, setPresentationMode] = useState(false)
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const [lastSyncedAt, setLastSyncedAt] = useState(() => new Date())
  const [loading, setLoading] = useState(true)
  const [dataOnline, setDataOnline] = useState(false)
  const [userCount, setUserCount] = useState(0)
  const [farmerCount, setFarmerCount] = useState(0)
  const [scales, setScales] = useState<ScaleState[]>(defaultScales)
  const [scaleHistories, setScaleHistories] = useState<Record<string, number[]>>({
    '01': [0, 0, 0, 0],
    '02': [18.2, 18.2, 18.2, 18.2],
    '03': [1.0, 1.0, 1.0, 1.0],
  })
  const [dbRankings, setDbRankings] = useState<FarmerRankingItem[]>([])
  const [monthlyBreakdown, setMonthlyBreakdown] = useState<
    { date: string; warings: number; grossWeightKg: number; netWeightKg: number }[]
  >([])

  const loadSystemData = useCallback(async () => {
    const [usersResult, farmersResult, scalesResult, rankingsResult, monthlyRecapResult] = await Promise.allSettled([
      api.auth.users(),
      api.farmers.list(),
      api.scales.list(),
      api.reports.farmerRankings(10),
      api.reports.monthlyRecap(),
      syncWithBackend(),
    ])

    if (usersResult.status === 'fulfilled' && Array.isArray(usersResult.value)) setUserCount(usersResult.value.length)
    if (farmersResult.status === 'fulfilled' && Array.isArray(farmersResult.value)) setFarmerCount(farmersResult.value.length)
    if (monthlyRecapResult.status === 'fulfilled' && monthlyRecapResult.value?.dailyBreakdown) {
      setMonthlyBreakdown(monthlyRecapResult.value.dailyBreakdown)
    }
    if (rankingsResult.status === 'fulfilled' && rankingsResult.value?.rankings) {
      setDbRankings(rankingsResult.value.rankings.map((r: any) => ({
        rank: r.rank,
        code: r.farmerCode,
        name: r.farmerName,
        village: r.village,
        totalWarings: r.totalWarings,
        totalKg: r.totalGrossKg,
        sharePct: r.sharePct,
      })))
    }
    if (scalesResult.status === 'fulfilled' && Array.isArray(scalesResult.value)) {
      setScales(defaultScales.map((station) => {
        const scale = scalesResult.value.find((item: any) => item.stationId === station.stationId)
        if (!scale) return station
        return {
          ...station,
          online: scale.online === true,
          isStable: scale.isStable !== false,
          capacityKg: scale.capacityKg ? Number(scale.capacityKg) : station.capacityKg,
          weightKg: Number.isFinite(Number(scale.weightKg)) ? Number(scale.weightKg) : null,
          endpoint: scale.ip && scale.port ? `${scale.ip}:${scale.port}` : 'Belum dikonfigurasi',
        }
      }))
    }
    setDataOnline([usersResult, farmersResult, scalesResult, rankingsResult].some((result) => result.status === 'fulfilled'))
    setLastSyncedAt(new Date())
    setLoading(false)
  }, [syncWithBackend])

  const pollScales = useCallback(async () => {
    try {
      const res = await api.scales.list()
      if (Array.isArray(res)) {
        setScales((prev) =>
          prev.map((station) => {
            const item = res.find((s: any) => s.stationId === station.stationId)
            if (!item) return station
            const w = Number.isFinite(Number(item.weightKg)) ? Number(item.weightKg) : null
            return {
              ...station,
              online: item.online === true,
              isStable: item.isStable !== false,
              capacityKg: item.capacityKg ? Number(item.capacityKg) : station.capacityKg,
              weightKg: w,
              endpoint: item.ip && item.port ? `${item.ip}:${item.port}` : station.endpoint,
            }
          })
        )
        setScaleHistories((prev) => {
          const next = { ...prev }
          res.forEach((item: any) => {
            const sId = item.stationId
            const w = Number.isFinite(Number(item.weightKg)) ? Number(item.weightKg) : 0
            const cur = next[sId] ? [...next[sId]] : []
            cur.push(w)
            if (cur.length > 20) cur.shift()
            next[sId] = cur
          })
          return next
        })
      }
    } catch {
      // Periodic retry
    }
  }, [])

  useEffect(() => {
    void loadSystemData()
    void pollScales()
    const dataTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadSystemData()
      }
    }, presentationMode ? 5000 : 15000)
    const scaleTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void pollScales()
      }
    }, presentationMode ? 2500 : 5000)
    const clockTimer = window.setInterval(() => setCurrentTime(new Date()), 1000)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void loadSystemData()
        void pollScales()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.clearInterval(dataTimer)
      window.clearInterval(scaleTimer)
      window.clearInterval(clockTimer)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [loadSystemData, pollScales, presentationMode])

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
    const today = getLocalDateStr(new Date())
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

  const commodityIntake = useMemo(() => {
    const totals = new Map<string, { name: string; kg: number; count: number }>()
    bufferWarings.forEach((item) => {
      const name = item.commodityName || 'Komoditas belum ditentukan'
      const key = item.commodityId || item.commodityCode || name
      const entry = totals.get(key) || { name, kg: 0, count: 0 }
      entry.kg += Number(item.grossWeightKg) || 0
      entry.count += 1
      totals.set(key, entry)
    })
    return Array.from(totals.entries()).sort((a, b) => b[1].kg - a[1].kg)
  }, [bufferWarings])

  const liveRankings = useMemo<FarmerRankingItem[]>(() => {
    if (bufferWarings.length === 0 && dbRankings.length > 0) return dbRankings
    const map = new Map<string, { code: string; name: string; village: string; totalWarings: number; totalKg: number }>()
    let totalAllKg = 0

    bufferWarings.forEach((w) => {
      const code = w.farmerId || 'FMR-?'
      const name = w.farmerName || 'Petani'
      const village = w.farmerVillage || ''
      const kg = Number(w.grossWeightKg) || 0
      totalAllKg += kg

      const key = `${code}-${name}`
      const existing = map.get(key)
      if (existing) {
        existing.totalWarings += 1
        existing.totalKg += kg
      } else {
        map.set(key, { code, name, village, totalWarings: 1, totalKg: kg })
      }
    })

    const sorted = Array.from(map.values()).sort((a, b) => b.totalKg - a.totalKg)
    if (sorted.length === 0 && dbRankings.length > 0) return dbRankings
    return sorted.map((item, idx) => ({
      rank: idx + 1,
      ...item,
      sharePct: totalAllKg > 0 ? (item.totalKg / totalAllKg) * 100 : 0,
    }))
  }, [bufferWarings, dbRankings])

  const activities = useMemo<Activity[]>(() => {
    const reception = bufferWarings.slice(0, 2).map((item) => ({
      id: `reception-${item.id}`, stage: 'Stasiun 01', time: `${item.date} ${item.intakeTime}`.trim(),
      action: `${item.code} · ${formatWeight(item.grossWeightKg)} kg · ${item.farmerName}`,
      icon: 'scale' as IconName, badge: 'Penerimaan', tone: 'accent' as const,
    }))
    const sorting = sortedBatches.slice(0, 2).map((item) => ({
      id: `sorting-${item.id}`, stage: 'Stasiun 02', time: `${item.date ?? '—'} ${item.timestamp || '—'}`,
      action: `${item.waringCode} · ${formatWeight(item.totalGradedKg)} kg tersortasi · ${item.palletCode}`,
      icon: 'sortir' as IconName, badge: 'Sortasi', tone: 'success' as const,
    }))
    const packaging = finishedStock.slice(0, 2).map((item) => ({
      id: `packaging-${item.id}`, stage: 'Stasiun 03', time: `${item.date ?? '—'} ${item.packedTime || '—'}`,
      action: `${item.code} · ${item.units} unit · ${formatWeight(item.totalWeightKg)} kg`,
      icon: 'package' as IconName, badge: 'Pengemasan', tone: 'accent' as const,
    }))
    const dispatch = deliveries.slice(0, 2).map((item) => ({
      id: `delivery-${item.id}`, stage: 'Pengiriman', time: `${item.date} ${item.time}`.trim(),
      action: `${item.truckPlate} · ${item.destination} · ${item.units} unit`, icon: 'truck' as IconName,
      badge: translateStatus(item.status), tone: item.status === 'DEPARTED' || item.status === 'DELIVERED' ? 'success' as const : 'warning' as const,
    }))
    return [...reception, ...sorting, ...packaging, ...dispatch]
  }, [bufferWarings, deliveries, finishedStock, sortedBatches])

  // ── Warehouse Storage Calculations ──
  const WAREHOUSE_CAPACITY_KG = 10000 // 10 Ton
  const bufferWaitingKg = useMemo(() => {
    return bufferWarings
      .filter((w) => w.status === 'BUFFER_WAITING')
      .reduce((sum, w) => sum + (Number(w.grossWeightKg) || 0), 0)
  }, [bufferWarings])
  const totalWarehouseKg = bufferWaitingKg + metrics.finishedWeightKg
  const warehousePct = Math.min(100, (totalWarehouseKg / WAREHOUSE_CAPACITY_KG) * 100)

  // ── Sorting & Grade Quality Metrics ──
  const gradeMetrics = useMemo(() => {
    let grossIntakeKg = 0
    let totalGradedKg = 0
    let gradeAKg = 0
    let gradeBKg = 0
    let gradeCKg = 0

    sortedBatches.forEach((b) => {
      grossIntakeKg += Number(b.grossIntakeKg) || 0
      totalGradedKg += Number(b.totalGradedKg) || 0
      gradeAKg += Number(b.gradeAKg) || 0
      gradeBKg += Number(b.gradeBKg) || 0
      gradeCKg += Number(b.gradeCKg) || 0
    })

    const yieldPct = grossIntakeKg > 0 ? (totalGradedKg / grossIntakeKg) * 100 : 0

    return {
      grossIntakeKg,
      totalGradedKg,
      gradeAKg,
      gradeBKg,
      gradeCKg,
      yieldPct,
    }
  }, [sortedBatches])

  // ── Deposit Intake Chart Data (Today & Past 7 Days) ──
  const depositChartData = useMemo(() => {
    const todayStr = getLocalDateStr(new Date())
    const todayWarings = bufferWarings.filter((w) => w.date === todayStr)

    // 1. Hourly slots for Today (spanning 04:00 to 18:00)
    const hours = ['04:00', '05:00', '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00']
    const todayHourly = hours.map((hStr) => {
      const hNum = parseInt(hStr.slice(0, 2), 10)
      const matching = todayWarings.filter((w) => {
        const itemHour = parseInt((w.intakeTime || '00:00').slice(0, 2), 10)
        return itemHour === hNum
      })
      const grossKg = matching.reduce((sum, item) => sum + (Number(item.grossWeightKg) || 0), 0)
      return {
        hour: hStr,
        grossKg,
        warings: matching.length,
      }
    })

    const todayTotalKg = todayWarings.reduce((sum, item) => sum + (Number(item.grossWeightKg) || 0), 0)

    // 2. Past 7 Days (D-6 to Today)
    const now = new Date()
    const past7Days = []
    let weekTotalKg = 0
    let weekWarings = 0

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const dateStr = getLocalDateStr(d)
      const isToday = dateStr === todayStr

      const localDayWarings = bufferWarings.filter((w) => w.date === dateStr)
      const dbDay = monthlyBreakdown.find((b) => b.date === dateStr)

      const grossKg =
        localDayWarings.length > 0
          ? localDayWarings.reduce((sum, w) => sum + (Number(w.grossWeightKg) || 0), 0)
          : dbDay
          ? dbDay.grossWeightKg
          : 0

      const waringsCount =
        localDayWarings.length > 0
          ? localDayWarings.length
          : dbDay
          ? dbDay.warings
          : 0

      weekTotalKg += grossKg
      weekWarings += waringsCount

      const dayLabel = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' })
      const fullDateLabel = d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })

      past7Days.push({
        date: dateStr,
        dayLabel,
        fullDateLabel,
        grossKg,
        warings: waringsCount,
        isToday,
      })
    }

    return {
      todayHourly,
      past7Days,
      todayTotalKg,
      todayWarings: todayWarings.length,
      weekTotalKg,
      weekWarings,
    }
  }, [bufferWarings, monthlyBreakdown])

  const activityFeed = (
    <div className="divide-y divide-border">
      {activities.length === 0 ? (
        <div className="py-8 text-center">
          <Icon name="history" size={22} className="mx-auto text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Belum ada aktivitas operasional.</p>
          <p className="mt-1 text-xs text-muted-foreground">Transaksi muncul setelah Stasiun 01 mencatat penerimaan pertama.</p>
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
        <div
          className="fixed inset-0 z-[90] flex flex-col bg-[#0c0a09] text-white overflow-y-auto xl:overflow-hidden p-3 xl:p-4 gap-2.5"
          role="dialog"
          aria-modal="true"
          aria-label="Presentasi Operasional"
        >
          {/* Header */}
          <header className="shrink-0 h-11 flex items-center justify-between border-b border-white/10 bg-[#0c0a09]/95 px-3 backdrop-blur">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-lg font-black tracking-tight truncate">{idText('PACKHOUSE OPERATIONS')}</span>
              <span className="border border-[#ea580c]/50 bg-[#ea580c]/15 px-2.5 py-0.5 text-xs font-mono font-bold uppercase tracking-widest text-[#fb923c] shrink-0">
                Langsung
              </span>
              <span className="hidden md:inline text-xs text-white/55 font-mono shrink-0">
                · Sinkron {lastSyncedAt.toLocaleTimeString('id-ID')}
              </span>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <div className="text-right">
                <span className="font-mono text-lg xl:text-xl font-bold tabular-nums text-white">
                  {currentTime.toLocaleTimeString('id-ID')}
                </span>
                <span className="text-xs uppercase tracking-wider text-white/60 ml-2">
                  {currentTime.toLocaleDateString('id-ID', {
                    weekday: 'short',
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <Button
                variant="outline"
                icon="compress"
                onClick={exitPresentationMode}
                className="border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white text-xs py-1 px-3"
              >
                Keluar
              </Button>
            </div>
          </header>

          {/* Row 1: Executive KPI Ribbon (4 High-Density Cards) */}
          <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-2.5 xl:gap-3">
            {/* Card 1: Total Intake */}
            <div className="border border-white/10 bg-white/[0.04] p-2.5 xl:p-3 flex items-center gap-3">
              <div className="size-10 xl:size-11 rounded border border-[#ea580c]/30 bg-[#ea580c]/15 flex items-center justify-center text-[#f97316] shrink-0">
                <Icon name="scale" size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-white/70 truncate">
                    Total Penerimaan
                  </p>
                  <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-[#ea580c]/20 text-[#fb923c] shrink-0">
                    St. 01
                  </span>
                </div>
                <p className="text-2xl xl:text-3xl font-black font-mono tabular-nums text-white leading-tight">
                  {formatWeight(metrics.intakeKg)} <span className="text-sm font-bold text-[#f97316]">kg</span>
                </p>
                <p className="text-xs text-white/60 truncate">
                  {metrics.todayWarings} Waring ditimbang hari ini
                </p>
              </div>
            </div>

            {/* Card 2: Sorting & Yield Recovery */}
            <div className="border border-white/10 bg-white/[0.04] p-2.5 xl:p-3 flex items-center gap-3">
              <div className="size-10 xl:size-11 rounded border border-amber-500/30 bg-amber-500/15 flex items-center justify-center text-amber-400 shrink-0">
                <Icon name="sortir" size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-white/70 truncate">
                    Sortasi &amp; Rendemen
                  </p>
                  <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 shrink-0">
                    {gradeMetrics.yieldPct > 0 ? `${gradeMetrics.yieldPct.toFixed(1)}%` : 'St. 02'}
                  </span>
                </div>
                <p className="text-2xl xl:text-3xl font-black font-mono tabular-nums text-white leading-tight">
                  {formatWeight(gradeMetrics.totalGradedKg)} <span className="text-sm font-bold text-amber-400">kg</span>
                </p>
                <p className="text-[11px] text-white/65 leading-snug">
                  {metrics.sortedBatches} Batch · A: {formatWeight(gradeMetrics.gradeAKg)} kg · B: {formatWeight(gradeMetrics.gradeBKg)} kg · C: {formatWeight(gradeMetrics.gradeCKg)} kg
                </p>
              </div>
            </div>

            {/* Card 3: Packaging & Dispatch */}
            <div className="border border-white/10 bg-white/[0.04] p-2.5 xl:p-3 flex items-center gap-3">
              <div className="size-10 xl:size-11 rounded border border-[#f97316]/30 bg-[#f97316]/15 flex items-center justify-center text-[#f97316] shrink-0">
                <Icon name="package" size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-white/70 truncate">
                    Pengemasan &amp; Keluar
                  </p>
                  <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-[#f97316]/20 text-[#fb923c] shrink-0">
                    St. 03
                  </span>
                </div>
                <p className="text-2xl xl:text-3xl font-black font-mono tabular-nums text-white leading-tight">
                  {metrics.finishedUnits} <span className="text-sm font-bold text-[#f97316]">unit</span>
                </p>
                <p className="text-xs text-white/60 truncate">
                  {formatWeight(metrics.finishedWeightKg)} kg dikemas · {metrics.activeDeliveries} pengiriman aktif
                </p>
              </div>
            </div>

            {/* Card 4: Warehouse Capacity & Stock */}
            <div className="border border-white/10 bg-white/[0.04] p-2.5 xl:p-3 flex items-center gap-3">
              <div className="size-10 xl:size-11 rounded border border-amber-500/30 bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0">
                <Icon name="box" size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wider text-white/70 truncate">
                  Kapasitas Gudang
                </p>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-2xl xl:text-3xl font-black font-mono tabular-nums text-white leading-tight">
                    {formatWeight(totalWarehouseKg)} <span className="text-sm font-bold text-amber-400">kg</span>
                  </p>
                  <span className="text-lg xl:text-xl font-black font-mono tabular-nums text-amber-400 shrink-0">
                    {warehousePct.toFixed(1)}%
                  </span>
                </div>
                {/* Progress bar */}
                <div className="mt-1.5 h-2 w-full bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#ea580c] to-[#f59e0b] transition-all duration-500 rounded-full"
                    style={{ width: `${Math.max(4, Math.min(100, warehousePct))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Compact Commodity Intake Strip */}
          {commodityIntake.length > 0 && (
            <section className="shrink-0 border border-white/10 bg-white/[0.04] px-3 py-1.5 flex items-center gap-3 overflow-x-auto">
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/60 shrink-0">
                Per Komoditas
              </span>
              <div className="flex items-center gap-2 min-w-0">
                {commodityIntake.map(([key, commodity]) => (
                  <div
                    key={key}
                    className="shrink-0 border border-white/10 bg-white/[0.03] px-2.5 py-1 flex items-center gap-2 text-xs"
                  >
                    <span className="font-semibold text-white truncate max-w-[160px]" title={commodity.name}>
                      {commodity.name}
                    </span>
                    <span className="text-white/50 font-mono">{commodity.count}w</span>
                    <span className="font-mono font-bold text-orange-400 tabular-nums">
                      {formatWeight(commodity.kg)} kg
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Row 2: Central Analytics & Quality Grid (Daily, Weekly, Grade Quality) */}
          <div className="flex-1 min-h-[240px] grid grid-cols-12 gap-2.5 xl:gap-3">
            <DailyDepositChart
              data={depositChartData.todayHourly}
              totalKg={depositChartData.todayTotalKg}
              warings={depositChartData.todayWarings}
              theme="dark"
              className="col-span-12 md:col-span-5 h-full"
            />
            <WeeklyDepositChart
              data={depositChartData.past7Days}
              totalKg={depositChartData.weekTotalKg}
              warings={depositChartData.weekWarings}
              theme="dark"
              className="col-span-12 md:col-span-4 h-full"
            />
            <GradeQualityPanel
              grossIntakeKg={gradeMetrics.grossIntakeKg}
              totalGradedKg={gradeMetrics.totalGradedKg}
              gradeAKg={gradeMetrics.gradeAKg}
              gradeBKg={gradeMetrics.gradeBKg}
              gradeCKg={gradeMetrics.gradeCKg}
              theme="dark"
              className="col-span-12 md:col-span-3 h-full"
            />
          </div>

          {/* Row 3: Operational Tri-Panel (Left: Farmer Leaderboard, Center: Activity Log, Right: Scale Telemetry) */}
          <div className="shrink-0 grid grid-cols-1 lg:grid-cols-3 gap-2.5 xl:gap-3">
            {/* Left: Farmer Leaderboard */}
            <div className="min-h-[175px] border border-white/10 bg-white/[0.04] p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1.5 shrink-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                    Peringkat Petani
                  </h3>
                  <span className="text-[10px] bg-[#ea580c]/20 border border-[#ea580c]/40 text-[#f97316] px-1.5 py-0.5 rounded font-mono font-bold">
                    Teratas
                  </span>
                </div>
                <span className="font-mono text-xs text-[#f97316] font-bold">
                  {liveRankings.length} Aktif
                </span>
              </div>

              <div className="flex-1 min-h-0 divide-y divide-white/10 overflow-hidden flex flex-col justify-around">
                {liveRankings.length === 0 ? (
                  <p className="text-xs text-white/50 text-center py-6">Belum ada data peringkat petani.</p>
                ) : liveRankings.slice(0, 3).map((f) => (
                  <div key={`${f.code}-${f.rank}`} className="py-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`flex size-6 shrink-0 items-center justify-center text-xs font-black ${
                            f.rank === 1
                              ? 'bg-amber-400 text-black'
                              : f.rank === 2
                              ? 'bg-slate-300 text-black'
                              : 'bg-amber-700 text-white'
                          }`}
                        >
                          {f.rank}
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-white truncate leading-tight">
                            {f.name}
                          </p>
                          <p className="text-xs text-white/55 truncate">
                            {f.code} · {f.village || 'Garut'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono text-sm font-bold text-[#fb923c] tabular-nums">
                          {formatWeight(f.totalKg)} kg
                        </p>
                        <p className="text-xs font-mono text-white/55">
                          {f.totalWarings}w · {f.sharePct.toFixed(0)}%
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Center: Activity Log */}
            <div className="min-h-[175px] border border-white/10 bg-white/[0.04] p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1.5 shrink-0">
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                  Log Aktivitas
                </h3>
                <span className="font-mono text-xs text-white/60">{activities.length} aktivitas</span>
              </div>
              <div className="flex-1 min-h-0 divide-y divide-white/10 overflow-hidden flex flex-col justify-around">
                {activities.length === 0 ? (
                  <p className="text-xs text-white/50 text-center py-6">Belum ada aktivitas operasional.</p>
                ) : activities.slice(0, 3).map((activity) => (
                  <div key={activity.id} className="flex min-w-0 items-center gap-2.5 py-1">
                    <span className="flex size-6 shrink-0 items-center justify-center bg-[#ea580c]/15 text-[#f97316]">
                      <Icon name={activity.icon} size={13} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#fb923c] leading-tight">
                        {activity.stage} · {activity.time}
                      </p>
                      <p className="truncate text-xs xl:text-sm text-white/90">{activity.action}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Scale Telemetry */}
            <div className="min-h-[175px] border border-white/10 bg-white/[0.04] p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1.5 shrink-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                    Telemetri Timbangan
                  </h3>
                  <span className="size-2 rounded-full bg-[#ea580c] animate-pulse" />
                </div>
                <span className="text-xs font-mono text-[#f97316] font-bold">
                  {metrics.onlineScales}/3 Terhubung
                </span>
              </div>

              <div className="flex-1 min-h-0 flex flex-col justify-around divide-y divide-white/10">
                {scales.map((scale) => {
                  const hist = scaleHistories[scale.stationId] || []
                  return (
                    <div key={scale.stationId} className="py-1 first:pt-0 last:pb-0 flex items-center justify-between gap-2.5">
                      <div className="w-[104px] shrink-0">
                        <p className="text-xs font-bold uppercase text-white truncate">
                          St. {scale.stationId} {scale.label}
                        </p>
                        <span
                          className={`text-[9.5px] font-mono px-1.5 py-0.5 rounded font-bold uppercase ${
                            scale.online
                              ? scale.isStable !== false
                                ? 'bg-[#ea580c]/20 text-[#fb923c]'
                                : 'bg-amber-400/20 text-amber-300'
                              : 'bg-white/5 text-white/40'
                          }`}
                        >
                          {scale.online ? (scale.isStable !== false ? 'STABIL' : 'GERAK') : 'MATI'}
                        </span>
                      </div>

                      {/* Real-time live weight sparkline */}
                      <div className="flex-1 min-w-0">
                        <LiveWeightSparkline
                          data={hist}
                          online={scale.online}
                          isStable={scale.isStable}
                          capacityKg={scale.capacityKg}
                          height={22}
                          strokeWidth={1.75}
                        />
                      </div>

                      <div className="w-[92px] text-right shrink-0">
                        <p className="font-mono text-sm xl:text-base font-black tabular-nums text-white leading-tight whitespace-nowrap">
                          {scale.weightKg === null ? '—' : `${formatWeight(scale.weightKg)} kg`}
                        </p>
                        <p className={`text-[10px] font-bold uppercase ${scale.online ? 'text-[#fb923c]' : 'text-amber-400'}`}>
                          {scale.online ? 'Terhubung' : 'Terputus'}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <PageHeader
          title={`Dasbor Operasional${user?.name ? ` · ${user.name}` : ''}`}
          subtitle="Status operasional langsung dari Penerimaan hingga Pengiriman."
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                icon="clipboard"
                onClick={() => window.open('/docs', '_blank')}
              >
                Dokumentasi API
              </Button>
              <Button
                variant="primary"
                icon="expand"
                onClick={enterPresentationMode}
              >
                {idText('Presentation Mode')}
              </Button>
            </div>
          }
        />

        <div className="flex flex-wrap items-center justify-between gap-3 border border-border bg-card px-4 py-3">
          <div className="flex items-center gap-3"><Badge tone={dataOnline ? 'success' : 'warning'} dot live>{dataOnline ? 'Data Terhubung' : 'Data Tidak Tersedia'}</Badge><span className="text-xs text-muted-foreground">Pembaruan terakhir {lastSyncedAt.toLocaleTimeString('id-ID')}</span></div>
          <span className="text-xs font-mono text-muted-foreground">{loading ? 'Memuat data sistem…' : `${metrics.onlineScales}/3 timbangan terhubung`}</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Penerimaan Kotor Hari Ini" value={`${formatWeight(metrics.intakeKg)} kg`} sub={`${metrics.todayWarings} Waring tercatat`} icon={<Icon name="scale" size={17} />} />
          <StatCard label="Penyimpanan Gudang" value={`${formatWeight(totalWarehouseKg)} kg`} sub={`${warehousePct.toFixed(1)}% dari kapasitas 10 Ton`} icon={<Icon name="box" size={17} />} />
          <StatCard label="Rendemen Sortasi" value={metrics.sortedBatches ? `${metrics.yieldPct.toFixed(1)}%` : '—'} sub={`${metrics.sortedBatches} batch selesai`} icon={<Icon name="sortir" size={17} />} />
          <StatCard label="Akun Terdaftar" value={String(userCount)} sub={`${farmerCount} profil petani`} icon={<Icon name="users" size={17} />} />
        </div>

        {/* Deposit Intake Analytics Charts & Quality Panel */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <DailyDepositChart
            data={depositChartData.todayHourly}
            totalKg={depositChartData.todayTotalKg}
            warings={depositChartData.todayWarings}
            theme="light"
            className="md:col-span-5"
          />
          <WeeklyDepositChart
            data={depositChartData.past7Days}
            totalKg={depositChartData.weekTotalKg}
            warings={depositChartData.weekWarings}
            theme="light"
            className="md:col-span-4"
          />
          <GradeQualityPanel
            grossIntakeKg={gradeMetrics.grossIntakeKg}
            totalGradedKg={gradeMetrics.totalGradedKg}
            gradeAKg={gradeMetrics.gradeAKg}
            gradeBKg={gradeMetrics.gradeBKg}
            gradeCKg={gradeMetrics.gradeCKg}
            theme="light"
            className="md:col-span-3"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card title="Peringkat Petani" subtitle="Petani teratas berdasarkan volume penerimaan.">
            {liveRankings.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <Icon name="users" size={22} className="mx-auto text-muted-foreground mb-2" />
                <p>Belum ada data penerimaan.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {liveRankings.slice(0, 5).map((f) => (
                  <div key={`${f.code}-${f.rank}`} className="py-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`flex size-6 shrink-0 items-center justify-center text-xs font-bold ${
                            f.rank === 1
                              ? 'bg-amber-400 text-black'
                              : f.rank === 2
                              ? 'bg-slate-300 text-black'
                              : f.rank === 3
                              ? 'bg-amber-700 text-white'
                              : 'border border-border text-muted-foreground'
                          }`}
                        >
                          {f.rank}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate text-foreground">{f.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {f.code} · {f.village || 'Garut'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono text-xs font-bold text-foreground">
                          {formatWeight(f.totalKg)} kg
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {f.totalWarings} Waring
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card title="Aktivitas Terbaru" subtitle={`${idText('Station 01 through final dispatch')}.`}>{activityFeed}</Card>
          <Card title="Jaringan Timbangan" subtitle="Status dan telemetri Modbus TCP langsung.">
            <div className="divide-y divide-border">
              {scales.map((scale) => {
                const hist = scaleHistories[scale.stationId] || []
                return (
                  <div key={scale.stationId} className="py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold uppercase tracking-wider">
                            Stasiun {scale.stationId} · {scale.label}
                          </p>
                          <span
                            className={`text-[8.5px] font-mono px-1 py-0.2 rounded font-bold uppercase ${
                              scale.online
                                ? scale.isStable !== false
                                  ? 'bg-[#ea580c]/15 text-[#c2410c]'
                                  : 'bg-amber-100 text-amber-800'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {scale.online ? (scale.isStable !== false ? 'STABIL' : 'GERAK') : 'TERPUTUS'}
                          </span>
                        </div>
                        <p className="font-mono text-[10.5px] text-muted-foreground">{scale.endpoint}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm font-bold text-foreground">
                          {scale.weightKg === null ? '—' : `${formatWeight(scale.weightKg)} kg`}
                        </p>
                        <Badge tone={scale.online ? 'accent' : 'warning'} dot>
                          {scale.online ? 'Terhubung' : 'Terputus'}
                        </Badge>
                      </div>
                    </div>
                    {/* Live Weight Sparkline on standard card */}
                    <div className="pt-1">
                      <LiveWeightSparkline
                        data={hist}
                        online={scale.online}
                        isStable={scale.isStable}
                        capacityKg={scale.capacityKg}
                        height={28}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>

        <section>
          <div className="mb-3"><h2 className="text-base font-bold">Operasional</h2><p className="text-xs text-muted-foreground">Buka konsol stasiun langsung atau laporan transaksi.</p></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {quickActions.map((action) => (
              <Link key={action.path} to={action.path} className="flex items-center gap-3 border border-border bg-card p-4 transition-colors hover:border-[#ea580c]">
                <span className="flex size-10 shrink-0 items-center justify-center bg-[#fff7ed] text-[#ea580c]"><Icon name={action.icon} size={18} /></span>
                <span className="min-w-0"><span className="block text-sm font-semibold">{action.label}</span><span className="block truncate text-xs text-muted-foreground">{action.description}</span></span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}
