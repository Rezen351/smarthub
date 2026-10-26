import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import Icon from '../components/shared/Icon'
import DataTable, { type Column } from '../components/shared/DataTable'
import PageHeader from '../components/shared/PageHeader'
import StatCard from '../components/shared/StatCard'
import { useToast } from '../components/feedback/Toast'
import { formatWeight } from '../lib/utils'
import { usePackhouseStore, type BufferWaringItem, type FinishedStockItem } from '../hooks/usePackhouseStore'

type WarehouseZone = 'buffer' | 'finished'

export default function WarehousePage() {
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialZone = (searchParams.get('zone') as WarehouseZone) || 'buffer'
  const [activeZone, setActiveZone] = useState<WarehouseZone>(initialZone)
  const { waitingWarings, finishedStock, markWaringSorted } = usePackhouseStore()

  const bufferItems = waitingWarings
  const finishedItems = finishedStock

  useEffect(() => {
    const qZone = searchParams.get('zone')
    if (qZone === 'buffer' || qZone === 'finished') {
      setActiveZone(qZone)
    }
  }, [searchParams])

  const handleSwitchZone = (zone: WarehouseZone) => {
    setActiveZone(zone)
    setSearchParams({ zone })
  }

  const handleDispatchToSorting = (item: { code: string }) => {
    markWaringSorted(item.code)
    toast.success(`Waring ${item.code} dispatched to Station 2: Sorting.`)
  }

  /* Buffer Metrics */
  const bufferTotalKg = waitingWarings.reduce((sum, i) => sum + i.grossWeightKg, 0)
  const bufferCapacityKg = 3000
  const bufferPct = Math.round((bufferTotalKg / bufferCapacityKg) * 100)

  /* Finished Metrics */
  const finishedTotalUnits = finishedItems.reduce((sum, i) => sum + i.units, 0)
  const finishedTotalKg = finishedItems.reduce((sum, i) => sum + i.totalWeightKg, 0)
  const finishedCapacityUnits = 5000
  const finishedPct = Math.round((finishedTotalUnits / finishedCapacityUnits) * 100)

  const bufferColumns: Column<BufferWaringItem>[] = [
    {
      key: 'code',
      label: 'Waring Code',
      priority: true,
      render: (row) => <span className="font-mono font-bold text-foreground">{row.code}</span>,
    },
    {
      key: 'farmerName',
      label: 'Farmer',
      render: (row) => <span className="font-semibold text-foreground text-sm">{row.farmerName}</span>,
    },
    {
      key: 'grossWeightKg',
      label: 'Gross Weight',
      align: 'right',
      priority: true,
      render: (row) => (
        <span className="font-mono font-bold text-emerald-800">
          {formatWeight(row.grossWeightKg)} kg
        </span>
      ),
    },
    {
      key: 'intakeTime',
      label: 'Intake Time',
      render: (row) => (
        <div>
          <span className="font-mono text-xs text-foreground block">{row.intakeTime}</span>
          <span className="text-[10px] text-muted-foreground">{row.date || 'Today'}</span>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Queue Status',
      render: () => (
        <Badge tone="warning" dot>
          FIFO Awaiting Sort
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Action',
      align: 'right',
      render: (row) => (
        <Button
          size="sm"
          variant="primary"
          icon="check"
          onClick={() => handleDispatchToSorting(row)}
        >
          Send to Sort
        </Button>
      ),
    },
  ]

  const finishedColumns: Column<FinishedStockItem>[] = [
    {
      key: 'code',
      label: 'Batch Code',
      priority: true,
      render: (row) => <span className="font-mono font-bold text-foreground">{row.code}</span>,
    },
    {
      key: 'packageType',
      label: 'Package Standard',
      render: (row) => <span className="text-sm font-semibold text-foreground">{row.packageType}</span>,
    },
    {
      key: 'grade',
      label: 'Grade',
      render: (row) => <Badge tone="accent">Grade {row.grade}</Badge>,
    },
    {
      key: 'units',
      label: 'Quantity Units',
      align: 'right',
      priority: true,
      render: (row) => <span className="font-mono font-bold text-foreground">{row.units}</span>,
    },
    {
      key: 'totalWeightKg',
      label: 'Weight kg',
      align: 'right',
      render: (row) => (
        <span className="font-mono font-bold text-emerald-800">
          {formatWeight(row.totalWeightKg)} kg
        </span>
      ),
    },
    {
      key: 'storageLocation',
      label: 'Rack / Bay',
      render: (row) => (
        <span className="font-mono text-xs bg-muted px-2 py-0.5 border border-border">
          {row.storageLocation}
        </span>
      ),
    },
    {
      key: 'packedTime',
      label: 'Time',
      render: (row) => <span className="font-mono text-xs text-muted-foreground">{row.packedTime}</span>,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouse Inventory"
        subtitle="Dual zone storage for harvest buffer and finished goods."
        actions={
          <div className="flex items-center gap-2">
            <Badge tone="accent">2 Zones Active</Badge>
          </div>
        }
      />

      {/* Zone Switcher Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Zone 1 Card */}
        <button
          type="button"
          onClick={() => handleSwitchZone('buffer')}
          className={`p-5 border text-left rounded-none transition-all cursor-pointer flex items-start justify-between ${
            activeZone === 'buffer'
              ? 'border-emerald-600 bg-emerald-50/60 shadow-sm'
              : 'border-border bg-card hover:bg-muted/30'
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-muted-foreground">ZONE 01</span>
              <Badge tone={activeZone === 'buffer' ? 'success' : 'neutral'}>
                {bufferItems.length} Warings Queued
              </Badge>
            </div>
            <h3 className="font-bold text-lg text-foreground mt-1">
              Raw Harvest Buffer
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Queue for waring sacks awaiting sorting.
            </p>
            <div className="mt-3 flex items-center gap-3 text-xs font-mono">
              <span className="font-bold text-emerald-800">{formatWeight(bufferTotalKg)} kg queued</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">Capacity: {bufferPct}%</span>
            </div>
          </div>
          <div
            className={`w-9 h-9 border flex items-center justify-center shrink-0 ${
              activeZone === 'buffer'
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-border bg-muted text-muted-foreground'
            }`}
          >
            <Icon name="box" size={18} />
          </div>
        </button>

        {/* Zone 2 Card */}
        <button
          type="button"
          onClick={() => handleSwitchZone('finished')}
          className={`p-5 border text-left rounded-none transition-all cursor-pointer flex items-start justify-between ${
            activeZone === 'finished'
              ? 'border-blue-600 bg-blue-50/60 shadow-sm'
              : 'border-border bg-card hover:bg-muted/30'
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-muted-foreground">ZONE 02</span>
              <Badge tone={activeZone === 'finished' ? 'accent' : 'neutral'}>
                {finishedTotalUnits} Units in Stock
              </Badge>
            </div>
            <h3 className="font-bold text-lg text-foreground mt-1">
              Finished Goods Storage
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Retail pouches and export cartons ready for dispatch.
            </p>
            <div className="mt-3 flex items-center gap-3 text-xs font-mono">
              <span className="font-bold text-blue-800">{formatWeight(finishedTotalKg)} kg total</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">Usage: {finishedPct}%</span>
            </div>
          </div>
          <div
            className={`w-9 h-9 border flex items-center justify-center shrink-0 ${
              activeZone === 'finished'
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-border bg-muted text-muted-foreground'
            }`}
          >
            <Icon name="stack" size={18} />
          </div>
        </button>
      </div>

      {/* ── ZONE 1 CONTENT: RAW BUFFER ── */}
      {activeZone === 'buffer' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Waiting Warings"
              value={`${bufferItems.length}`}
              sub="Unsorted raw sacks"
              trend="neutral"
              icon={<Icon name="box" size={16} />}
            />
            <StatCard
              label="Buffer Weight"
              value={`${formatWeight(bufferTotalKg)} kg`}
              sub="Gross intake weight"
              trend="up"
              icon={<Icon name="scale" size={16} />}
            />
            <StatCard
              label="Buffer Utilization"
              value={`${bufferPct}%`}
              sub={`${bufferCapacityKg - bufferTotalKg} kg free space`}
              trend={bufferPct > 80 ? 'up' : 'neutral'}
              icon={<Icon name="stack" size={16} />}
            />
            <StatCard
              label="FIFO Queue Order"
              value="Active"
              sub="Oldest sack: 1.2 hrs"
              trend="neutral"
              icon={<Icon name="clock" size={16} />}
            />
          </div>

          <div className="bg-card border border-border p-6 rounded-none shadow-sm space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-bold text-base text-foreground">
                  Raw Harvest Buffer Queue (FIFO Management)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Warings from intake weighing waiting for manual sorting and pallet association.
                </p>
              </div>
              <Link to="/dashboard/sorting">
                <Button variant="primary" icon="check">
                  Open Sorting Station
                </Button>
              </Link>
            </div>

            <DataTable rowKey={(row) => row.id} columns={bufferColumns} data={bufferItems} />
          </div>
        </div>
      )}

      {/* ── ZONE 2 CONTENT: FINISHED GOODS ── */}
      {activeZone === 'finished' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Ready Units"
              value={`${finishedTotalUnits}`}
              sub="Pouches & export cartons"
              trend="up"
              icon={<Icon name="package" size={16} />}
            />
            <StatCard
              label="Finished Net Weight"
              value={`${formatWeight(finishedTotalKg)} kg`}
              sub="Packaged potato inventory"
              trend="up"
              icon={<Icon name="scale" size={16} />}
            />
            <StatCard
              label="Grade A Stock"
              value="270 kg"
              sub="Pouches & 10kg crates"
              trend="neutral"
              icon={<Icon name="leaf" size={16} />}
            />
            <StatCard
              label="Storage Rack Utilization"
              value={`${finishedPct}%`}
              sub="Warehouse Bay A-C"
              trend="neutral"
              icon={<Icon name="box" size={16} />}
            />
          </div>

          <div className="bg-card border border-border p-6 rounded-none shadow-sm space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-bold text-base text-foreground">
                  Finished Goods Inventory Ledger
                </h3>
                <p className="text-xs text-muted-foreground">
                  Packaged items ready for scan verification and dispatch loading.
                </p>
              </div>
              <Link to="/dashboard/deliveries">
                <Button variant="primary" icon="truck">
                  Open Dispatch & Deliveries
                </Button>
              </Link>
            </div>

            <DataTable rowKey={(row) => row.id} columns={finishedColumns} data={finishedItems} />
          </div>
        </div>
      )}
    </div>
  )
}
