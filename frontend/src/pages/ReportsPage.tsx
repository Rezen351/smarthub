import { useState, useEffect, useMemo, useCallback } from 'react'
import Card from '../components/shared/Card'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import Icon, { type IconName } from '../components/shared/Icon'
import PageHeader from '../components/shared/PageHeader'
import StatCard from '../components/shared/StatCard'
import DataTable, { type Column } from '../components/shared/DataTable'
import { useToast } from '../components/feedback/Toast'
import { usePackhouseStore } from '../hooks/usePackhouseStore'
import { api } from '../services/api'
import { formatWeight } from '../lib/utils'

interface Stat {
  label: string
  value: string
  sub: string
  trend: 'up' | 'down' | 'neutral'
  icon: IconName
}

interface TransactionRow {
  id: string
  date: string
  time: string
  station: 'Reception' | 'Sorting' | 'Packaging' | 'Dispatch'
  reference: string
  description: string
  quantity: string
  status: string
}

export default function ReportsPage() {
  const toast = useToast()
  const [activeTab, setActiveTab] = useState<'overview' | 'daily' | 'monthly' | 'rankings'>('overview')
  const [range, setRange] = useState('7d')
  const [farmerCount, setFarmerCount] = useState<number>(0)
  const { bufferWarings, sortedBatches, finishedStock, deliveries } = usePackhouseStore()

  // Recap & Rankings state
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [rankingPeriod, setRankingPeriod] = useState<'all' | 'month' | 'today'>('all')

  const [dailyData, setDailyData] = useState<any>(null)
  const [dailyLoading, setDailyLoading] = useState(false)

  const [monthlyData, setMonthlyData] = useState<any>(null)
  const [monthlyLoading, setMonthlyLoading] = useState(false)

  const [rankings, setRankings] = useState<any[]>([])
  const [rankingsLoading, setRankingsLoading] = useState(false)

  useEffect(() => {
    let active = true
    api.farmers.list()
      .then((data) => {
        if (active && Array.isArray(data)) {
          setFarmerCount(data.length)
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  /* ── 1. Daily Recap loader ── */
  const loadDailyRecap = useCallback(async (date: string) => {
    setDailyLoading(true)
    try {
      const res = await api.reports.dailyRecap(date)
      if (res) {
        setDailyData(res)
      }
    } catch {
      // Fallback compute from local store bufferWarings
      const dateWarings = bufferWarings.filter((w) => w.date === date)
      const gKg = dateWarings.reduce((sum, w) => sum + (Number(w.grossWeightKg) || 0), 0)
      const tKg = dateWarings.reduce((sum, w) => sum + (Number((w as any).tareWeightKg) || 1.2), 0)
      const nKg = Math.max(0, gKg - tKg)
      const fMap = new Map<string, any>()
      dateWarings.forEach((w) => {
        const c = w.farmerId || 'FMR-?'
        const n = w.farmerName || 'Farmer'
        const v = w.farmerVillage || ''
        const tareVal = Number((w as any).tareWeightKg) || 1.2
        const grossVal = Number(w.grossWeightKg) || 0
        const cur = fMap.get(c) || { farmerCode: c, farmerName: n, village: v, warings: 0, grossWeightKg: 0, tareWeightKg: 0, netWeightKg: 0 }
        cur.warings += 1
        cur.grossWeightKg += grossVal
        cur.tareWeightKg += tareVal
        cur.netWeightKg += Math.max(0, grossVal - tareVal)
        fMap.set(c, cur)
      })
      setDailyData({
        date,
        totalWarings: dateWarings.length,
        uniqueFarmers: fMap.size,
        grossIntakeKg: gKg,
        tareWeightKg: tKg,
        netIntakeKg: nKg,
        sortingBatches: 0,
        gradeAKg: 0,
        gradeBKg: 0,
        gradeCKg: 0,
        shrinkageKg: 0,
        packagedUnits: 0,
        packagedWeightKg: 0,
        farmerBreakdown: Array.from(fMap.values()),
      })
    } finally {
      setDailyLoading(false)
    }
  }, [bufferWarings])

  /* ── 2. Monthly Recap loader ── */
  const loadMonthlyRecap = useCallback(async (month: string) => {
    setMonthlyLoading(true)
    try {
      const res = await api.reports.monthlyRecap(month)
      if (res) {
        setMonthlyData(res)
      }
    } catch {
      // Fallback
    } finally {
      setMonthlyLoading(false)
    }
  }, [])

  /* ── 3. Farmer Rankings loader ── */
  const loadFarmerRankings = useCallback(async (period: string) => {
    setRankingsLoading(true)
    try {
      const res = await api.reports.farmerRankings(50, period)
      if (res?.rankings) {
        setRankings(res.rankings)
      }
    } catch {
      // Fallback from store
      const map = new Map<string, any>()
      let total = 0
      bufferWarings.forEach((w) => {
        const c = w.farmerId || 'FMR-?'
        const n = w.farmerName || 'Farmer'
        const v = w.farmerVillage || ''
        const kg = Number(w.grossWeightKg) || 0
        total += kg
        const cur = map.get(c) || { farmerCode: c, farmerName: n, village: v, district: '', totalWarings: 0, totalGrossKg: 0, totalNetKg: 0 }
        cur.totalWarings += 1
        cur.totalGrossKg += kg
        cur.totalNetKg += Math.max(0, kg - 1.2)
        map.set(c, cur)
      })
      const sorted = Array.from(map.values()).sort((a, b) => b.totalGrossKg - a.totalGrossKg)
      setRankings(sorted.map((item, idx) => ({
        rank: idx + 1,
        ...item,
        sharePct: total > 0 ? (item.totalGrossKg / total) * 100 : 0,
      })))
    } finally {
      setRankingsLoading(false)
    }
  }, [bufferWarings])

  useEffect(() => {
    if (activeTab === 'daily') {
      void loadDailyRecap(selectedDate)
    } else if (activeTab === 'monthly') {
      void loadMonthlyRecap(selectedMonth)
    } else if (activeTab === 'rankings') {
      void loadFarmerRankings(rankingPeriod)
    }
  }, [activeTab, selectedDate, selectedMonth, rankingPeriod, loadDailyRecap, loadMonthlyRecap, loadFarmerRankings])

  /* Dynamic Aggregate Statistics */
  const totalWaringsCount = bufferWarings.length
  const totalWeighedKg = bufferWarings.reduce((sum, w) => sum + (Number(w.grossWeightKg) || 0), 0)
  const totalDeliveriesCount = deliveries.length

  const stats: Stat[] = useMemo(() => [
    { label: 'Total Farmers', value: farmerCount.toLocaleString('en-US'), sub: 'Registered farmers', trend: 'up', icon: 'users' },
    { label: 'Total Warings', value: totalWaringsCount.toLocaleString('en-US'), sub: 'Intake sacks recorded', trend: 'up', icon: 'box' },
    { label: 'Total Weighing (kg)', value: totalWeighedKg.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), sub: 'Live platform scales', trend: 'up', icon: 'scale' },
    { label: 'Total Deliveries', value: totalDeliveriesCount.toLocaleString('en-US'), sub: 'Outbound dispatches', trend: 'neutral', icon: 'truck' },
  ], [farmerCount, totalWaringsCount, totalWeighedKg, totalDeliveriesCount])

  /* Dynamic Weekly Intake by Day */
  const weekly = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const dayMap: Record<string, number> = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 }
    bufferWarings.forEach((w) => {
      if (w.date) {
        const d = new Date(w.date)
        if (!isNaN(d.getTime())) {
          const dayName = days[d.getDay()]
          if (dayName && dayMap[dayName] !== undefined) {
            dayMap[dayName] += Number(w.grossWeightKg) || 0
          }
        }
      }
    })
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => ({
      day,
      kg: Math.round(dayMap[day] || 0),
    }))
  }, [bufferWarings])

  const maxKg = Math.max(1, ...weekly.map((item) => item.kg))

  /* Dynamic Grade Distribution */
  const grades = useMemo(() => {
    const totalA = sortedBatches.reduce((sum, b) => sum + (Number(b.gradeAKg) || 0), 0)
    const totalB = sortedBatches.reduce((sum, b) => sum + (Number(b.gradeBKg) || 0), 0)
    const totalC = sortedBatches.reduce((sum, b) => sum + (Number(b.gradeCKg) || 0), 0)
    const totalGraded = totalA + totalB + totalC
    return [
      { grade: 'A', kg: Math.round(totalA), share: totalGraded > 0 ? Math.round((totalA / totalGraded) * 100) : 0 },
      { grade: 'B', kg: Math.round(totalB), share: totalGraded > 0 ? Math.round((totalB / totalGraded) * 100) : 0 },
      { grade: 'C', kg: Math.round(totalC), share: totalGraded > 0 ? Math.round((totalC / totalGraded) * 100) : 0 },
    ]
  }, [sortedBatches])

  const transactions = useMemo<TransactionRow[]>(() => {
    const allRows: TransactionRow[] = [
      ...bufferWarings.map((item) => ({
        id: `reception-${item.id}`,
        date: item.date || '—',
        time: item.intakeTime || '—',
        station: 'Reception' as const,
        reference: item.code,
        description: `${item.farmerName}${item.farmerVillage ? ` · ${item.farmerVillage}` : ''}`,
        quantity: `${formatWeight(item.grossWeightKg)} kg`,
        status: item.status,
      })),
      ...sortedBatches.map((item) => ({
        id: `sorting-${item.id}`,
        date: item.date || '—',
        time: item.timestamp || '—',
        station: 'Sorting' as const,
        reference: item.palletCode,
        description: `${item.waringCode} · ${item.washingRecord}`,
        quantity: `${formatWeight(item.totalGradedKg)} kg`,
        status: 'SORTED',
      })),
      ...finishedStock.map((item) => ({
        id: `packaging-${item.id}`,
        date: item.date || '—',
        time: item.packedTime || '—',
        station: 'Packaging' as const,
        reference: item.code,
        description: `${item.packageType} · Grade ${item.grade}`,
        quantity: `${item.units} units · ${formatWeight(item.totalWeightKg)} kg`,
        status: 'STORED',
      })),
      ...deliveries.map((item) => ({
        id: `dispatch-${item.id}`,
        date: item.date || '—',
        time: item.time || '—',
        station: 'Dispatch' as const,
        reference: item.truckPlate,
        description: `${item.destination} · ${item.driver}`,
        quantity: `${item.units} units`,
        status: item.status,
      })),
    ]

    const cutoffDays = range === '7d' ? 7 : range === '30d' ? 30 : null
    const cutoff = cutoffDays === null ? null : Date.now() - cutoffDays * 24 * 60 * 60 * 1000
    return allRows
      .filter((row) => {
        if (cutoff === null || row.date === '—') return true
        const timestamp = new Date(`${row.date}T00:00:00`).getTime()
        return !isNaN(timestamp) && timestamp >= cutoff
      })
      .sort((a, b) => {
        const timeA = new Date(`${a.date}T${a.time === '—' ? '00:00:00' : a.time}`).getTime()
        const timeB = new Date(`${b.date}T${b.time === '—' ? '00:00:00' : b.time}`).getTime()
        if (isNaN(timeA) || isNaN(timeB)) return 0
        return timeB - timeA
      })
  }, [bufferWarings, deliveries, finishedStock, range, sortedBatches])

  const transactionColumns: Column<TransactionRow>[] = [
    {
      key: 'timestamp',
      label: 'Timestamp',
      priority: true,
      render: (row) => (
        <div className="stack-none">
          <span className="mono t-small font-medium">{row.date}</span>
          <span className="t-caption text-text-secondary">{row.time}</span>
        </div>
      ),
    },
    {
      key: 'station',
      label: 'Station',
      priority: true,
      render: (row) => {
        const toneMap: Record<TransactionRow['station'], 'accent' | 'warning' | 'success' | 'neutral'> = {
          Reception: 'accent',
          Sorting: 'warning',
          Packaging: 'success',
          Dispatch: 'neutral',
        }
        return <Badge tone={toneMap[row.station]}>{row.station}</Badge>
      },
    },
    {
      key: 'reference',
      label: 'Identifier',
      render: (row) => <span className="mono t-small font-semibold">{row.reference}</span>,
    },
    {
      key: 'description',
      label: 'Description',
      render: (row) => <span className="t-small text-text-secondary">{row.description}</span>,
    },
    {
      key: 'quantity',
      label: 'Quantity',
      priority: true,
      align: 'right',
      render: (row) => <span className="mono t-small font-semibold text-text">{row.quantity}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      align: 'right',
      render: (row) => <Badge tone={row.status === 'APPROVED' || row.status === 'STORED' || row.status === 'SORTED' || row.status === 'DELIVERED' ? 'success' : 'neutral'}>{row.status}</Badge>,
    },
  ]

  const handleExportCsv = () => {
    const headers = ['Date', 'Time', 'Station', 'Identifier', 'Description', 'Quantity', 'Status']
    const rows = [
      headers,
      ...transactions.map((t) => [
        t.date,
        t.time,
        t.station,
        t.reference,
        t.description,
        t.quantity,
        t.status,
      ]),
    ]

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')).join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `smartgeulis_report_${range}_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('CSV Report exported successfully.')
  }

  return (
    <div className="stack stack-lg">
      <PageHeader
        title="Reports & Analytics"
        subtitle="Operational recaps per day, per month, farmer rankings, and OpenAPI Redoc."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon="reports"
              onClick={() => window.open('/docs', '_blank')}
            >
              OpenAPI Redoc
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon="download"
              onClick={handleExportCsv}
            >
              Export CSV
            </Button>
          </div>
        }
      />

      {/* ── Main Navigation Tabs ── */}
      <div className="tabs border-b border-border" role="tablist" aria-label="Report Views">
        {[
          { id: 'overview', label: 'Overview & Ledger', icon: 'clipboard' as IconName },
          { id: 'daily', label: 'Daily Recap (Per Hari)', icon: 'calendar' as IconName },
          { id: 'monthly', label: 'Monthly Recap (Per Bulan)', icon: 'reports' as IconName },
          { id: 'rankings', label: 'Farmer Leaderboard', icon: 'users' as IconName },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`tab ${activeTab === tab.id ? 'is-active' : ''} flex items-center gap-2`}
            onClick={() => setActiveTab(tab.id as any)}
          >
            <Icon name={tab.icon} size={15} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── TAB 1: OVERVIEW & LEDGER ── */}
      {activeTab === 'overview' && (
        <>
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
                  <Badge tone="accent" icon="leaf">Potatoes only</Badge>
                  <Badge tone="neutral">{range === 'all' ? 'All time' : `Last ${range}`}</Badge>
                </div>
              </div>
            </Card>
          </div>

          <Card
            title="Transaction Ledger"
            subtitle="Recorded activity from Reception through Dispatch."
            action={
              <div className="flex items-center gap-3">
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
                <Badge tone="neutral">{transactions.length} records</Badge>
              </div>
            }
            padding="none"
          >
            <DataTable
              columns={transactionColumns}
              data={transactions}
              rowKey={(row) => row.id}
              pageSize={10}
              emptyTitle="No transactions recorded."
              emptyDescription="Transactions appear after Station 01 records the first intake."
              caption="Transaction data is sourced from operational records; no sample rows are shown."
            />
          </Card>
        </>
      )}

      {/* ── TAB 2: DAILY RECAP (REKAP PER HARI) ── */}
      {activeTab === 'daily' && (
        <div className="stack stack-lg">
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 border border-border bg-card">
            <div className="flex items-center gap-3">
              <label htmlFor="daily-date-input" className="text-sm font-semibold text-text">
                Select Date:
              </label>
              <input
                id="daily-date-input"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="input input-sm font-mono"
              />
              <Button
                variant="outline"
                size="sm"
                icon="refresh"
                onClick={() => loadDailyRecap(selectedDate)}
                loading={dailyLoading}
              >
                Refresh
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={api.reports.downloadDailyCsvUrl(selectedDate)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-sm flex items-center gap-2"
                download={`smartgeulis_daily_recap_${selectedDate}.csv`}
              >
                <Icon name="download" size={14} />
                <span>Download Daily CSV (API)</span>
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Warings Received"
              value={dailyData ? String(dailyData.totalWarings) : '0'}
              sub={`${dailyData?.uniqueFarmers || 0} Delivering Farmers`}
              icon={<Icon name="box" size={16} />}
            />
            <StatCard
              label="Gross Intake (kg)"
              value={dailyData ? `${formatWeight(dailyData.grossIntakeKg)} kg` : '0.0 kg'}
              sub={`Net: ${dailyData ? formatWeight(dailyData.netIntakeKg) : '0.0'} kg`}
              icon={<Icon name="scale" size={16} />}
            />
            <StatCard
              label="Sorting Yield"
              value={dailyData ? `${dailyData.sortingBatches} Batches` : '0 Batches'}
              sub={`A: ${dailyData?.gradeAKg?.toFixed(1) || 0}kg · B: ${dailyData?.gradeBKg?.toFixed(1) || 0}kg`}
              icon={<Icon name="sortir" size={16} />}
            />
            <StatCard
              label="Retail Pouches"
              value={dailyData ? `${dailyData.packagedUnits} Units` : '0 Units'}
              sub={`Weight: ${dailyData?.packagedWeightKg?.toFixed(1) || 0} kg`}
              icon={<Icon name="package" size={16} />}
            />
          </div>

          <Card
            title={`Delivering Farmers on ${selectedDate}`}
            subtitle="Individual grower intake records and tare deductions"
            padding="none"
          >
            {dailyData?.farmerBreakdown && dailyData.farmerBreakdown.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th className="text-left">Farmer Code</th>
                      <th className="text-left">Farmer Name</th>
                      <th className="text-left">Village</th>
                      <th className="text-right">Warings</th>
                      <th className="text-right">Gross (kg)</th>
                      <th className="text-right">Tare (kg)</th>
                      <th className="text-right">Net Weight (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyData.farmerBreakdown.map((f: any) => (
                      <tr key={f.farmerCode}>
                        <td className="font-mono font-bold text-accent">{f.farmerCode}</td>
                        <td className="font-semibold">{f.farmerName}</td>
                        <td className="text-muted-foreground">{f.village || 'Garut'}</td>
                        <td className="text-right font-mono">{f.warings}</td>
                        <td className="text-right font-mono font-medium">{formatWeight(f.grossWeightKg)} kg</td>
                        <td className="text-right font-mono text-muted-foreground">{formatWeight(f.tareWeightKg)} kg</td>
                        <td className="text-right font-mono font-bold text-success">{formatWeight(f.netWeightKg)} kg</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                <Icon name="calendar" size={28} className="mx-auto mb-2 text-muted-foreground" />
                <p className="font-medium text-sm">No intake transactions recorded on {selectedDate}.</p>
                <p className="text-xs text-muted-foreground mt-1">Select another date or perform reception weighing.</p>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── TAB 3: MONTHLY RECAP (REKAP PER BULAN) ── */}
      {activeTab === 'monthly' && (
        <div className="stack stack-lg">
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 border border-border bg-card">
            <div className="flex items-center gap-3">
              <label htmlFor="monthly-month-input" className="text-sm font-semibold text-text">
                Select Month:
              </label>
              <input
                id="monthly-month-input"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="input input-sm font-mono"
              />
              <Button
                variant="outline"
                size="sm"
                icon="refresh"
                onClick={() => loadMonthlyRecap(selectedMonth)}
                loading={monthlyLoading}
              >
                Refresh
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={api.reports.downloadMonthlyCsvUrl(selectedMonth)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-sm flex items-center gap-2"
                download={`smartgeulis_monthly_recap_${selectedMonth}.csv`}
              >
                <Icon name="download" size={14} />
                <span>Download Monthly CSV (API)</span>
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Month Sacks Received"
              value={monthlyData ? String(monthlyData.totalWarings) : '0'}
              sub={`${monthlyData?.activeFarmers || 0} Active Growers`}
              icon={<Icon name="box" size={16} />}
            />
            <StatCard
              label="Total Net Weighed"
              value={monthlyData ? `${formatWeight(monthlyData.netIntakeKg)} kg` : '0.0 kg'}
              sub={`Gross: ${monthlyData ? formatWeight(monthlyData.grossIntakeKg) : '0.0'} kg`}
              icon={<Icon name="scale" size={16} />}
            />
            <StatCard
              label="Sorting Yield"
              value={monthlyData ? `${monthlyData.sortingBatches} Batches` : '0 Batches'}
              sub={`A: ${monthlyData?.gradeAKg?.toFixed(1) || 0}kg · B: ${monthlyData?.gradeBKg?.toFixed(1) || 0}kg`}
              icon={<Icon name="sortir" size={16} />}
            />
            <StatCard
              label="Packaged Pouches"
              value={monthlyData ? `${monthlyData.packagedUnits} Units` : '0 Units'}
              sub={`${monthlyData?.packagedWeightKg?.toFixed(1) || 0} kg shipped/stored`}
              icon={<Icon name="package" size={16} />}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card
                title={`Daily Breakdown in ${selectedMonth}`}
                subtitle="Day-by-day aggregate intake and delivery volumes"
                padding="none"
              >
                {monthlyData?.dailyBreakdown && monthlyData.dailyBreakdown.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="table w-full">
                      <thead>
                        <tr>
                          <th className="text-left">Date</th>
                          <th className="text-right">Warings</th>
                          <th className="text-right">Gross (kg)</th>
                          <th className="text-right">Net (kg)</th>
                          <th className="text-right">Farmers</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyData.dailyBreakdown.map((d: any) => (
                          <tr key={d.date}>
                            <td className="font-mono font-semibold">{d.date}</td>
                            <td className="text-right font-mono">{d.warings}</td>
                            <td className="text-right font-mono font-medium">{formatWeight(d.grossWeightKg)} kg</td>
                            <td className="text-right font-mono font-bold text-success">{formatWeight(d.netWeightKg)} kg</td>
                            <td className="text-right font-mono">{d.farmers}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-12 text-center text-muted-foreground">
                    <Icon name="bar-chart" size={28} className="mx-auto mb-2 text-muted-foreground" />
                    <p className="font-medium text-sm">No activity recorded for {selectedMonth}.</p>
                  </div>
                )}
              </Card>
            </div>

            <div>
              <Card
                title="Top 5 Farmers This Month"
                subtitle="Leading contributors by intake weight"
              >
                {monthlyData?.topFarmers && monthlyData.topFarmers.length > 0 ? (
                  <div className="divide-y divide-border">
                    {monthlyData.topFarmers.map((f: any, idx: number) => (
                      <div key={f.farmerCode} className="py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="flex size-6 shrink-0 items-center justify-center font-bold text-xs bg-muted text-muted-foreground">
                            #{idx + 1}
                          </span>
                          <div>
                            <p className="text-xs font-bold text-foreground">{f.farmerName}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{f.farmerCode} · {f.village || 'Garut'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-xs font-bold text-success">{formatWeight(f.grossWeightKg)} kg</p>
                          <p className="text-[10px] text-muted-foreground">{f.warings} Warings</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-6 text-center text-xs text-muted-foreground">No monthly farmer rankings.</p>
                )}
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: FARMER LEADERBOARD & EXPORT ── */}
      {activeTab === 'rankings' && (
        <div className="stack stack-lg">
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 border border-border bg-card">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-text">Leaderboard Period:</span>
              <div className="tabs" role="tablist">
                {[
                  { id: 'all', label: 'All Time' },
                  { id: 'month', label: 'This Month' },
                  { id: 'today', label: 'Today' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`tab ${rankingPeriod === p.id ? 'is-active' : ''}`}
                    onClick={() => setRankingPeriod(p.id as any)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={api.reports.downloadRankingsCsvUrl(50, rankingPeriod)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-sm flex items-center gap-2"
                download={`smartgeulis_farmer_rankings_${rankingPeriod}.csv`}
              >
                <Icon name="download" size={14} />
                <span>Download Leaderboard CSV (API)</span>
              </a>
            </div>
          </div>

          <Card
            title="Farmer Leaderboard (Rangking Petani)"
            subtitle="Ranked by total gross kilograms delivered with contribution share"
            padding="none"
          >
            {rankingsLoading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Loading farmer rankings…</div>
            ) : rankings.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th className="text-center w-14">Rank</th>
                      <th className="text-left">Farmer Code</th>
                      <th className="text-left">Farmer Name</th>
                      <th className="text-left">Village</th>
                      <th className="text-left">District</th>
                      <th className="text-right">Total Warings</th>
                      <th className="text-right">Gross Intake (kg)</th>
                      <th className="text-right">Net Intake (kg)</th>
                      <th className="text-right">Share (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankings.map((r: any) => (
                      <tr key={`${r.farmerCode}-${r.rank}`} className="hover:bg-muted/30 transition-colors">
                        <td className="text-center">
                          <span
                            className={`inline-flex size-7 items-center justify-center text-xs font-black ${
                              r.rank === 1
                                ? 'bg-amber-400 text-black shadow-xs'
                                : r.rank === 2
                                ? 'bg-slate-300 text-black'
                                : r.rank === 3
                                ? 'bg-amber-700 text-white'
                                : 'border border-border text-muted-foreground'
                            }`}
                          >
                            {r.rank === 1 ? '1 🥇' : r.rank === 2 ? '2 🥈' : r.rank === 3 ? '3 🥉' : r.rank}
                          </span>
                        </td>
                        <td className="font-mono font-bold text-accent">{r.farmerCode}</td>
                        <td className="font-semibold text-foreground">{r.farmerName}</td>
                        <td className="text-muted-foreground">{r.village || '—'}</td>
                        <td className="text-muted-foreground">{r.district || '—'}</td>
                        <td className="text-right font-mono">{r.totalWarings}</td>
                        <td className="text-right font-mono font-bold text-foreground">{formatWeight(r.totalGrossKg)} kg</td>
                        <td className="text-right font-mono font-medium text-success">{formatWeight(r.totalNetKg)} kg</td>
                        <td className="text-right font-mono font-bold text-accent">{r.sharePct?.toFixed(1) || 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                <Icon name="users" size={28} className="mx-auto mb-2 text-muted-foreground" />
                <p className="font-medium text-sm">No farmer intake data found for this period.</p>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
