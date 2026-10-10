/**
 * Warehouse Out — Area Gudang.
 * Manual stock removal is destructive, so it is confirmed (laporan.pdf §9.11).
 */
import { useState } from 'react'
import Card from '../components/shared/Card'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import { Field, Input, Select } from '../components/shared/Form'
import DataTable, { type Column } from '../components/shared/DataTable'
import PageHeader from '../components/shared/PageHeader'
import ConfirmDialog from '../components/feedback/ConfirmDialog'
import { useToast } from '../components/feedback/Toast'

type StockOutRecord = {
  id: string
  code: string
  grade: 'A' | 'B' | 'C'
  quantity: number
  destination: string
  time: string
}

type PendingRemoval = Omit<StockOutRecord, 'id' | 'time'>

export default function StockOutPage() {
  const toast = useToast()
  const [form, setForm] = useState({ code: '', grade: 'A', quantity: '', destination: '' })
  const [confirmRemoval, setConfirmRemoval] = useState<PendingRemoval | null>(null)
  const [records, setRecords] = useState<StockOutRecord[]>([
    { id: '1', code: 'PKG-001', grade: 'A', quantity: 50, destination: 'Jakarta', time: '08:00' },
  ])

  const available = 120

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const quantity = Number(form.quantity)
    if (!form.code.trim()) {
      toast.error('Scan the packaging or pouch code first.')
      return
    }
    if (!(quantity > 0)) {
      toast.error('Quantity must be greater than 0.')
      return
    }
    if (quantity > available) {
      toast.error(`Only ${available} units of grade ${form.grade} are in stock.`)
      return
    }
    setConfirmRemoval({
      code: form.code.trim(),
      grade: form.grade as StockOutRecord['grade'],
      quantity,
      destination: form.destination.trim() || 'Internal transfer',
    })
  }

  const confirmStockOut = () => {
    if (!confirmRemoval) return
    setRecords([
      {
        id: String(Date.now()),
        ...confirmRemoval,
        time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      },
      ...records,
    ])
    toast.success(`Removed ${confirmRemoval.quantity} units of grade ${confirmRemoval.grade} from stock.`)
    setConfirmRemoval(null)
    setForm({ code: '', grade: form.grade, quantity: '', destination: '' })
  }

  const columns: Column<StockOutRecord>[] = [
    { key: 'time', label: 'Time', render: (row) => <span className="mono t-small">{row.time}</span> },
    { key: 'code', label: 'Code', priority: true, render: (row) => <span className="mono cell-strong">{row.code}</span> },
    { key: 'grade', label: 'Grade', priority: true, render: (row) => <Badge tone="accent">{row.grade}</Badge> },
    { key: 'quantity', label: 'Units', align: 'right', priority: true, render: (row) => <span className="cell-strong">{row.quantity}</span> },
    { key: 'destination', label: 'Destination', render: (row) => <span className="t-small cell-secondary">{row.destination}</span> },
  ]

  const totalOut = records.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="stack stack-lg">
      <PageHeader
        title="Stock Out"
        subtitle="Scan packaging or pouches leaving the warehouse — removals are permanent."
        actions={<Badge tone="accent">{totalOut} units out today</Badge>}
      />

      <div className="grid-stats">
        <div className="stat-card">
          <p className="stat-label">Units out today</p>
          <p className="stat-value">{totalOut}</p>
          <p className="stat-sub">Across {records.length} records</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Grade in stock</p>
          <p className="stat-value">{available}</p>
          <p className="stat-sub">units of grade {form.grade}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Last removal</p>
          <p className="stat-value" style={{ fontSize: 20 }}>{records[0]?.code ?? '—'}</p>
          <p className="stat-sub">{records[0]?.destination ?? 'No removals yet'}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Export packaging</p>
          <p className="stat-value" style={{ fontSize: 20 }}>ITF-14</p>
          <p className="stat-sub">Label standard for export units</p>
        </div>
      </div>

      <Card title="Scan stock out" subtitle="Removing stock immediately reduces the warehouse total.">
        <form className="stack-md" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">
            <Field label="Packaging / pouch code" htmlFor="stockout-code" required>
              <Input
                id="stockout-code"
                mono
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="PKG-002"
                required
              />
            </Field>

            <Field label="Grade" htmlFor="stockout-grade">
              <Select value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}>
                <option value="A">Grade A</option>
                <option value="B">Grade B</option>
                <option value="C">Grade C</option>
              </Select>
            </Field>

            <Field label="Quantity" htmlFor="stockout-quantity" required hint={`${available} units available.`}>
              <Input
                id="stockout-quantity"
                type="number"
                inputMode="numeric"
                min="1"
                max={available}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                placeholder="20"
                required
              />
            </Field>

            <Field label="Destination" htmlFor="stockout-destination">
              <Input
                id="stockout-destination"
                value={form.destination}
                onChange={(e) => setForm({ ...form, destination: e.target.value })}
                placeholder="Surabaya"
              />
            </Field>
          </div>

          <div className="row gap-sm">
            <Button type="submit" variant="danger" icon="arrow-up" touch>
              Record Stock Out
            </Button>
            <span className="t-caption text-text-light">A confirmation step protects against accidental removals.</span>
          </div>
        </form>
      </Card>

      <section className="stack-sm">
        <div className="section-header">
          <h2 className="section-title">Stock out history</h2>
        </div>
        <DataTable
          columns={columns}
          data={records}
          rowKey={(row) => row.id}
          emptyTitle="No stock out recorded."
          emptyDescription="Scan a packaging code to record the first removal."
        />
      </section>

      <ConfirmDialog
        open={Boolean(confirmRemoval)}
        tone="danger"
        title="Remove stock?"
        description={
          confirmRemoval ? (
            <>
              Remove <strong>{confirmRemoval.quantity} units</strong> of grade{' '}
              <strong>{confirmRemoval.grade}</strong> ({confirmRemoval.code}) from stock? This action is
              permanent.
            </>
          ) : null
        }
        confirmLabel="Yes, Remove"
        onConfirm={confirmStockOut}
        onCancel={() => setConfirmRemoval(null)}
      />
    </div>
  )
}
