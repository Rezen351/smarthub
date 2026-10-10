import { useState } from 'react'
import Card from '../components/shared/Card'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import Icon from '../components/shared/Icon'
import { Field, Input, Select } from '../components/shared/Form'
import DataTable, { type Column } from '../components/shared/DataTable'
import PageHeader from '../components/shared/PageHeader'
import { useToast } from '../components/feedback/Toast'

type Pallet = {
  id: string
  code: string
  farmer: string
  commodity: string
  harvestDate: string
  status: 'ACTIVE' | 'WEIGHED' | 'SORTED'
}

const STATUS_TONE: Record<Pallet['status'], 'success' | 'accent' | 'warning'> = {
  ACTIVE: 'accent',
  WEIGHED: 'warning',
  SORTED: 'success',
}

const nextCode = (index: number) => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `PLT-${date}-${String(index).padStart(4, '0')}`
}

export default function PalletsPage() {
  const toast = useToast()
  const [form, setForm] = useState({ farmerId: '', commodityId: 'Kentang', harvestDate: '', location: '' })
  const [pallets, setPallets] = useState<Pallet[]>([
    { id: '1', code: 'PLT-20260914-0001', farmer: 'Ahmad Santoso', commodity: 'Kentang', harvestDate: '2026-09-12', status: 'WEIGHED' },
    { id: '2', code: 'PLT-20260914-0002', farmer: 'Budi Prasetyo', commodity: 'Kentang', harvestDate: '2026-09-13', status: 'ACTIVE' },
  ])
  const [counter, setCounter] = useState(3)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.farmerId.trim()) {
      toast.error('Farmer ID is required to create a pallet.')
      return
    }
    const code = nextCode(counter)
    setCounter((value) => value + 1)
    setPallets([
      {
        id: String(counter),
        code,
        farmer: form.farmerId,
        commodity: form.commodityId,
        harvestDate: form.harvestDate || new Date().toISOString().slice(0, 10),
        status: 'ACTIVE' as Pallet['status'],
      },
      ...pallets,
    ])
    setForm({ farmerId: '', commodityId: 'Kentang', harvestDate: '', location: '' })
    toast.success(`Pallet ${code} created.`)
  }

  const columns: Column<Pallet>[] = [
    {
      key: 'code',
      label: 'Pallet code',
      priority: true,
      render: (row) => <span className="mono cell-strong">{row.code}</span>,
    },
    { key: 'farmer', label: 'Farmer', priority: true, render: (row) => <span className="t-small">{row.farmer}</span> },
    { key: 'commodity', label: 'Commodity', render: (row) => <Badge tone="accent" icon="leaf">{row.commodity}</Badge> },
    {
      key: 'harvestDate',
      label: 'Harvest date',
      render: (row) => <span className="mono t-small cell-secondary">{row.harvestDate}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      priority: true,
      render: (row) => <Badge tone={STATUS_TONE[row.status]} dot>{row.status}</Badge>,
    },
  ]

  const activeCount = pallets.filter((item) => item.status === 'ACTIVE').length

  return (
    <div className="stack stack-lg">
      <PageHeader
        title="Pallets"
        subtitle="Create pallets with a farmer link — the pallet is the base unit for all traceability."
        actions={<Badge tone="accent">{pallets.length} registered</Badge>}
      />

      <div className="grid-stats">
        <div className="stat-card">
          <p className="stat-label">Active pallets</p>
          <p className="stat-value">{activeCount}</p>
          <p className="stat-sub">Awaiting weighing</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Weighed</p>
          <p className="stat-value">{pallets.filter((item) => item.status === 'WEIGHED').length}</p>
          <p className="stat-sub">Approved weights</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Sorted</p>
          <p className="stat-value">{pallets.filter((item) => item.status === 'SORTED').length}</p>
          <p className="stat-sub">Grade labels issued</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Commodity</p>
          <p className="stat-value" style={{ fontSize: 20 }}>Kentang</p>
          <p className="stat-sub">Single active commodity</p>
        </div>
      </div>

      <Card title="Create Pallet" subtitle="Pallet codes are generated as PLT-YYYYMMDD-SEQ.">
        <form className="stack-md" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">
            <Field label="Farmer ID" htmlFor="pallet-farmer" required hint="Scan or type the farmer ID.">
              <Input
                id="pallet-farmer"
                mono
                value={form.farmerId}
                onChange={(e) => setForm({ ...form, farmerId: e.target.value })}
                placeholder="farmer-1"
                required
              />
            </Field>

            <Field label="Commodity" htmlFor="pallet-commodity" required>
              <Select
                id="pallet-commodity"
                value={form.commodityId}
                onChange={(e) => setForm({ ...form, commodityId: e.target.value })}
              >
                <option value="Kentang">Kentang</option>
                <option value="Tomat" disabled>
                  Tomat (not in scope)
                </option>
                <option value="Cabai" disabled>
                  Cabai (not in scope)
                </option>
              </Select>
            </Field>

            <Field label="Harvest date" htmlFor="pallet-harvest-date" hint="From the farmer's information.">
              <Input
                id="pallet-harvest-date"
                type="date"
                value={form.harvestDate}
                onChange={(e) => setForm({ ...form, harvestDate: e.target.value })}
              />
            </Field>

            <Field label="Location" htmlFor="pallet-location">
              <Input
                id="pallet-location"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Area Penerimaan"
              />
            </Field>
          </div>

          <div className="row gap-sm">
            <Button type="submit" variant="primary" icon="plus" touch>
              Create Pallet
            </Button>
            <span className="t-caption text-text-light">
              Weighing is only performed at the Receiving and Packing areas.
            </span>
          </div>
        </form>
      </Card>

      <section className="stack-sm">
        <div className="section-header">
          <h2 className="section-title">Pallet register</h2>
        </div>
        <DataTable
          columns={columns}
          data={pallets}
          rowKey={(row) => row.id}
          emptyTitle="No pallets registered."
          emptyDescription="Create the first pallet to link it to a farmer."
        />
      </section>

      <div className="alert alert-info">
        <Icon name="info" size={16} />
        <span>
          Each pallet carries the farmer, commodity and harvest date, and becomes the identity printed
          on the pallet QR label after the weight is approved.
        </span>
      </div>
    </div>
  )
}
