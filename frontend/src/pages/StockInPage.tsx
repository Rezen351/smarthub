/**
 * Warehouse In — Area Gudang.
 * Scan pouches/pallets into stock and keep the capacity under control.
 */
import { useState } from 'react'
import Card from '../components/shared/Card'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import Icon from '../components/shared/Icon'
import { Field, Input, Select } from '../components/shared/Form'
import DataTable, { type Column } from '../components/shared/DataTable'
import PageHeader from '../components/shared/PageHeader'
import { useToast } from '../components/feedback/Toast'

type StockInRecord = {
  id: string
  code: string
  grade: 'A' | 'B' | 'C'
  quantity: number
  warehouse: string
  time: string
}

const WAREHOUSES = [
  { id: 'WH-01', label: 'WH-01 · Main hall', capacityKg: 3000, usedKg: 2340 },
]

export default function StockInPage() {
  const toast = useToast()
  const [form, setForm] = useState({ code: '', grade: '', quantity: '', warehouseId: 'WH-01' })
  const [records, setRecords] = useState<StockInRecord[]>([
    { id: '1', code: 'PCH-PLT-20260914-0001-001', grade: 'A', quantity: 10, warehouse: 'WH-01', time: '09:30' },
    { id: '2', code: 'PCH-PLT-20260914-0001-002', grade: 'A', quantity: 10, warehouse: 'WH-01', time: '09:34' },
  ])

  const warehouse = WAREHOUSES.find((item) => item.id === form.warehouseId) ?? WAREHOUSES[0]
  const usedKg = warehouse.usedKg + records.reduce((sum, item) => sum + item.quantity, 0)
  const capacityPct = Math.round((usedKg / warehouse.capacityKg) * 100)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const quantity = Number(form.quantity)
    if (!form.code.trim()) {
      toast.error('Scan a pouch or pallet code first.')
      return
    }
    if (!(quantity > 0)) {
      toast.error('Quantity must be greater than 0.')
      return
    }
    if (usedKg + quantity > warehouse.capacityKg) {
      toast.error(`${warehouse.id} is full — only ${(warehouse.capacityKg - usedKg).toLocaleString('en-US')} kg free.`)
      return
    }

    setRecords([
      {
        id: String(Date.now()),
        code: form.code.trim(),
        grade: (form.grade || 'A') as StockInRecord['grade'],
        quantity,
        warehouse: form.warehouseId,
        time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      },
      ...records,
    ])
    setForm({ code: '', grade: '', quantity: '', warehouseId: form.warehouseId })
    toast.success('Stock recorded in.')
  }

  const columns: Column<StockInRecord>[] = [
    { key: 'time', label: 'Time', render: (row) => <span className="mono t-small">{row.time}</span> },
    { key: 'code', label: 'Pouch / Pallet code', priority: true, render: (row) => <span className="mono cell-strong">{row.code}</span> },
    { key: 'grade', label: 'Grade', priority: true, render: (row) => <Badge tone="accent">{row.grade}</Badge> },
    { key: 'quantity', label: 'Units', align: 'right', priority: true, render: (row) => <span className="cell-strong">{row.quantity}</span> },
    { key: 'warehouse', label: 'Warehouse', render: (row) => <span className="mono t-small cell-secondary">{row.warehouse}</span> },
  ]

  return (
    <div className="stack stack-lg">
      <PageHeader
        title="Stock In"
        subtitle="Scan pouches or pallets to record stock entering the warehouse."
        actions={
          <Badge tone={capacityPct >= 80 ? 'warning' : 'success'} dot>
            {capacityPct}% capacity
          </Badge>
        }
      />

      <div className="grid-stats">
        <div className="stat-card">
          <p className="stat-label">Units in today</p>
          <p className="stat-value">{records.reduce((sum, item) => sum + item.quantity, 0)}</p>
          <p className="stat-sub">Across {new Set(records.map((item) => item.code)).size} codes</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Warehouse</p>
          <p className="stat-value" style={{ fontSize: 20 }}>{warehouse.id}</p>
          <p className="stat-sub">{warehouse.label}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Used</p>
          <p className="stat-value">{usedKg.toLocaleString('en-US')}</p>
          <p className="stat-sub">kg of {warehouse.capacityKg.toLocaleString('en-US')} kg</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Free space</p>
          <p className="stat-value">{Math.max(0, warehouse.capacityKg - usedKg).toLocaleString('en-US')}</p>
          <p className="stat-sub">kg available</p>
        </div>
      </div>

      <Card title="Scan stock in" subtitle="A barcode scan fills the code automatically.">
        <form className="stack-md" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">
            <Field label="Pouch / Pallet code" htmlFor="stockin-code" required>
              <Input
                id="stockin-code"
                mono
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="PCH-PLT-20260914-0001-003"
                required
              />
            </Field>

            <Field label="Grade" htmlFor="stockin-grade">
              <Select value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}>
                <option value="">Detect from label</option>
                <option value="A">Grade A</option>
                <option value="B">Grade B</option>
                <option value="C">Grade C</option>
              </Select>
            </Field>

            <Field label="Quantity" htmlFor="stockin-quantity" required>
              <Input
                id="stockin-quantity"
                type="number"
                inputMode="numeric"
                min="1"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                placeholder="10"
                required
              />
            </Field>

            <Field label="Warehouse" htmlFor="stockin-warehouse">
              <Select
                id="stockin-warehouse"
                value={form.warehouseId}
                onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}
              >
                {WAREHOUSES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="row gap-sm">
            <Button type="submit" variant="primary" icon="plus" touch>
              Record Stock In
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Capacity" subtitle={`${warehouse.label} · ${usedKg.toLocaleString('en-US')} kg used`}>
        <div className="stack-sm">
          <div className="progress-track">
            <div
              className={`progress-fill ${capacityPct >= 90 ? 'is-danger' : capacityPct >= 80 ? 'is-warning' : ''}`}
              style={{ width: `${Math.min(100, capacityPct)}%` }}
            />
          </div>
          {capacityPct >= 80 && (
            <div className="alert alert-warning">
              <Icon name="alert" size={16} />
              <span>Capacity alert: {capacityPct}% used — only {Math.max(0, warehouse.capacityKg - usedKg).toLocaleString('en-US')} kg free.</span>
            </div>
          )}
        </div>
      </Card>

      <section className="stack-sm">
        <div className="section-header">
          <h2 className="section-title">Stock in history</h2>
        </div>
        <DataTable
          columns={columns}
          data={records}
          rowKey={(row) => row.id}
          emptyTitle="No stock recorded yet."
          emptyDescription="Scan a pouch or pallet code to record the first stock in."
        />
      </section>
    </div>
  )
}
