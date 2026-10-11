import { useState } from 'react'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import DataTable, { type Column } from '../components/shared/DataTable'
import PageHeader from '../components/shared/PageHeader'
import { useToast } from '../components/feedback/Toast'
import { formatWeight } from '../lib/utils'

type Pallet = {
  id: string
  code: string
  farmer: string
  commodity: string
  weightKg: number
  depositDate: string
  status: 'WEIGHED' | 'SORTED'
}

const STATUS_TONE: Record<Pallet['status'], 'success' | 'accent' | 'warning'> = {
  WEIGHED: 'accent',
  SORTED: 'success',
}

export default function PalletsPage() {
  const toast = useToast()
  const [pallets] = useState<Pallet[]>([
    {
      id: '1',
      code: 'PLT-20261010-0001',
      farmer: 'Ahmad Santoso',
      commodity: 'Kentang',
      weightKg: 45.5,
      depositDate: '2026-10-10',
      status: 'WEIGHED',
    },
    {
      id: '2',
      code: 'PLT-20261010-0002',
      farmer: 'Budi Prasetyo',
      commodity: 'Kentang',
      weightKg: 38.2,
      depositDate: '2026-10-10',
      status: 'WEIGHED',
    },
    {
      id: '3',
      code: 'PLT-20261009-0003',
      farmer: 'Siti Rahayu',
      commodity: 'Kentang',
      weightKg: 52.0,
      depositDate: '2026-10-09',
      status: 'SORTED',
    },
  ])

  const handlePrintLabel = (pallet: Pallet) => {
    toast.warning(`Sending label ${pallet.code} to printer…`)
    window.setTimeout(() => {
      toast.success(`Label ${pallet.code} successfully printed.`)
    }, 800)
  }

  const columns: Column<Pallet>[] = [
    {
      key: 'code',
      label: 'Pallet Code',
      priority: true,
      render: (row) => <span className="font-mono font-bold text-foreground">{row.code}</span>,
    },
    {
      key: 'farmer',
      label: 'Farmer',
      priority: true,
      render: (row) => <span className="text-sm font-semibold text-foreground">{row.farmer}</span>,
    },
    {
      key: 'commodity',
      label: 'Commodity',
      render: (row) => (
        <Badge tone="accent" icon="leaf">
          {row.commodity}
        </Badge>
      ),
    },
    {
      key: 'weightKg',
      label: 'Approved Weight (kg)',
      align: 'right',
      render: (row) => <span className="font-mono font-bold text-foreground">{formatWeight(row.weightKg)}</span>,
    },
    {
      key: 'depositDate',
      label: 'Deposit Date',
      render: (row) => (
        <span className="font-mono text-xs text-foreground">
          {row.depositDate} <span className="text-xs text-muted-foreground">(Auto)</span>
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      priority: true,
      render: (row) => (
        <Badge tone={STATUS_TONE[row.status]} dot>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Action',
      align: 'right',
      render: (row) => (
        <Button size="sm" variant="outline" icon="print" onClick={() => handlePrintLabel(row)}>
          Print Label
        </Button>
      ),
    },
  ]

  const weighedCount = pallets.filter((item) => item.status === 'WEIGHED').length
  const sortedCount = pallets.filter((item) => item.status === 'SORTED').length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pallet Register"
        subtitle="Pallet IDs are generated and printed automatically when the weighing operator approves intake weight."
        actions={<Badge tone="accent">{pallets.length} registered</Badge>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-1">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Pallets</p>
          <p className="text-2xl font-bold tracking-tight text-foreground">{pallets.length}</p>
          <p className="text-xs text-muted-foreground">Generated from approved weights</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-1">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Awaiting Sorting</p>
          <p className="text-2xl font-bold tracking-tight text-foreground">{weighedCount}</p>
          <p className="text-xs text-muted-foreground">Labeled & ready in receiving</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-1">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Sorted</p>
          <p className="text-2xl font-bold tracking-tight text-foreground">{sortedCount}</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Grading completed</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-1">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Commodity</p>
          <p className="text-lg font-bold tracking-tight text-foreground">Kentang</p>
          <p className="text-xs text-muted-foreground">Single active commodity</p>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight text-foreground">Registered Pallets</h2>
          <span className="text-xs text-muted-foreground">
            Pallet is the base unit for lot-level traceability into Sorting and Packing
          </span>
        </div>
        <DataTable
          columns={columns}
          data={pallets}
          rowKey={(row) => row.id}
          emptyTitle="No pallets registered yet."
          emptyDescription="Pallets are created automatically once the weighing operator approves intake weight."
        />
      </section>
    </div>
  )
}
