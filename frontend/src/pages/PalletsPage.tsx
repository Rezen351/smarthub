import { useState } from 'react'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import Icon from '../components/shared/Icon'
import DataTable, { type Column } from '../components/shared/DataTable'
import PageHeader from '../components/shared/PageHeader'
import { useToast } from '../components/feedback/Toast'

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
      render: (row) => <span className="mono cell-strong">{row.code}</span>,
    },
    {
      key: 'farmer',
      label: 'Farmer',
      priority: true,
      render: (row) => <span className="t-small cell-strong">{row.farmer}</span>,
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
      render: (row) => <span className="cell-strong">{row.weightKg.toFixed(3)}</span>,
    },
    {
      key: 'depositDate',
      label: 'Deposit Date',
      render: (row) => (
        <span className="mono t-small cell-secondary">
          {row.depositDate} <span className="t-caption text-text-light">(Auto)</span>
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
    <div className="stack stack-lg">
      <PageHeader
        title="Pallet Register"
        subtitle="Pallet IDs are generated and printed automatically when the weighing operator approves intake weight."
        actions={<Badge tone="accent">{pallets.length} registered</Badge>}
      />

      <div className="grid-stats">
        <div className="stat-card">
          <p className="stat-label">Total Pallets</p>
          <p className="stat-value">{pallets.length}</p>
          <p className="stat-sub">Generated from approved weights</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Awaiting Sorting</p>
          <p className="stat-value">{weighedCount}</p>
          <p className="stat-sub">Labeled & ready in receiving</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Sorted</p>
          <p className="stat-value">{sortedCount}</p>
          <p className="stat-sub">Grading completed</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Commodity</p>
          <p className="stat-value" style={{ fontSize: 20 }}>
            Kentang
          </p>
          <p className="stat-sub">Single active commodity</p>
        </div>
      </div>

      <div className="alert alert-info">
        <Icon name="info" size={16} />
        <span>
          <strong>Automated Lifecycle:</strong> There is no manual "Create Pallet" step. Pallet IDs
          are automatically issued and sent to the label printer upon official weight approval on
          the Weighing page.
        </span>
      </div>

      <section className="stack-sm">
        <div className="section-header">
          <h2 className="section-title">Registered Pallets</h2>
          <span className="t-caption text-text-secondary">
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
