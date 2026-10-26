import { useState, useEffect, useMemo } from 'react'
import Card from '../components/shared/Card'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import Icon, { type IconName } from '../components/shared/Icon'
import PageHeader from '../components/shared/PageHeader'
import StatCard from '../components/shared/StatCard'
import { useToast } from '../components/feedback/Toast'
import { usePackhouseStore } from '../hooks/usePackhouseStore'
import { api } from '../services/api'

interface Stat {
  label: string
  value: string
  sub: string
  trend: 'up' | 'down' | 'neutral'
  icon: IconName
}

export default function ReportsPage() {
  const toast = useToast()
  const [range, setRange] = useState('7d')
  const [farmerCount, setFarmerCount] = useState<number>(1)
  const { bufferWarings, sortedBatches, finishedStock, deliveries } = usePackhouseStore()

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

  const handleExportCsv = () => {
    const rows = [
      ['Report Generated', new Date().toISOString()],
      ['Range', range],
      [],
      ['=== INTAKE WARING TRANSACTIONS ==='],
      ['Date', 'Code', 'Farmer Name', 'Village', 'Gross Weight (kg)', 'Status'],
      ...bufferWarings.map((w) => [w.date, w.code, w.farmerName, w.farmerVillage || '', String(w.grossWeightKg), w.status]),
      [],
      ['=== SORTING BATCH TRANSACTIONS ==='],
      ['Timestamp', 'Pallet ID', 'Origin Waring', 'Farmer', 'Gross (kg)', 'Grade A (kg)', 'Grade B (kg)', 'Grade C (kg)', 'Loss (kg)', 'Yield %', 'Washing'],
      ...sortedBatches.map((b) => [b.timestamp, b.palletCode, b.waringCode, b.farmerName, String(b.grossIntakeKg), String(b.gradeAKg), String(b.gradeBKg), String(b.gradeCKg), String(b.shrinkageKg), `${(100 - b.shrinkagePct).toFixed(1)}%`, b.washingRecord]),
      [],
      ['=== FINISHED GOODS INVENTORY ==='],
      ['Packed Time', 'Code', 'Package Standard', 'Grade', 'Units', 'Total Weight (kg)', 'Location'],
      ...finishedStock.map((f) => [f.packedTime, f.code, f.packageType, f.grade, String(f.units), String(f.totalWeightKg), f.storageLocation]),
      [],
      ['=== DELIVERIES & DISPATCH ==='],
      ['Date', 'Truck Plate', 'Destination', 'Driver', 'Units', 'Status'],
      ...deliveries.map((d) => [d.date, d.truckPlate, d.destination, d.driver, String(d.units), d.status]),
    ]

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')).join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `packhouse_report_${range}_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('CSV Report exported successfully.')
  }

  return (
    <div className="stack stack-lg">
      <PageHeader
        title="Reports"
        subtitle="System-wide recap of deposits, sorting stock and deliveries."
        actions={
          <>
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
            <Button
              variant="outline"
              size="sm"
              icon="download"
              onClick={handleExportCsv}
            >
              Export
            </Button>
          </>
        }
      />

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
              <Badge tone="accent" icon="leaf">
                Kentang only
              </Badge>
              <Badge tone="neutral">{range === 'all' ? 'All time' : `Last ${range}`}</Badge>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Operations summary" subtitle="Volume per station">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">
          {[
            { label: 'Receiving', value: `${bufferWarings.length} weighings`, icon: 'scale' as IconName },
            { label: 'Sorting', value: `${sortedBatches.length} batches`, icon: 'sortir' as IconName },
            { label: 'Packing', value: `${finishedStock.length} units`, icon: 'package' as IconName },
            { label: 'Warehouse', value: `${Math.min(100, Math.round((totalWeighedKg / 3000) * 100))}% capacity`, icon: 'box' as IconName },
          ].map((item) => (
            <div key={item.label} className="row gap-md">
              <span className="icon-tile icon-tile-accent">
                <Icon name={item.icon} size={18} />
              </span>
              <div className="stack-xs">
                <p className="t-caption text-text-secondary uppercase">{item.label}</p>
                <p className="t-medium">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
