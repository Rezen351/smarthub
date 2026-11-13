import { useCallback, useEffect, useState } from 'react'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import Card from '../components/shared/Card'
import DataTable, { type Column } from '../components/shared/DataTable'
import ConfirmDialog from '../components/feedback/ConfirmDialog'
import { Field, Input } from '../components/shared/Form'
import PageHeader from '../components/shared/PageHeader'
import { useToast } from '../components/feedback/Toast'
import { usePackhouseStore } from '../hooks/usePackhouseStore'
import { api } from '../services/api'

interface Delivery {
  id: string
  code: string
  truckPlate: string
  destination: string
  driverName: string
  status: 'LOADING' | 'READY' | 'DEPARTED'
  units: number
  verifiedUnits: number
  packageCodes: string[]
  createdAt: string
}

export default function DeliveriesPage() {
  const toast = useToast()
  const { syncWithBackend } = usePackhouseStore()
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [form, setForm] = useState({ truckPlate: '', destination: '', driverName: '', grade: 'A' as 'A' | 'B' | 'C', units: '' })
  const [scanCode, setScanCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDepart, setConfirmDepart] = useState<Delivery | null>(null)

  const refresh = useCallback(async () => {
    try {
      const data = await api.deliveries.list()
      setDeliveries(Array.isArray(data) ? data : [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load deliveries.')
    }
  }, [toast])

  useEffect(() => { void refresh() }, [refresh])

  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    const units = Number(form.units)
    if (!Number.isInteger(units) || units < 1) { toast.error('Enter a valid unit count.'); return }
    setBusy(true)
    try {
      const saved = await api.deliveries.create({ ...form, units })
      setSelectedId(saved.id)
      setForm({ truckPlate: '', destination: '', driverName: '', grade: 'A', units: '' })
      await refresh()
      toast.success(`Delivery ${saved.code} created. Scan each assigned package.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create delivery.')
    } finally { setBusy(false) }
  }

  const verify = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedId) { toast.error('Select a delivery first.'); return }
    if (!scanCode.trim()) { toast.error('Scan a package code or barcode.'); return }
    setBusy(true)
    try {
      const result = await api.deliveries.verify(selectedId, scanCode.trim())
      setScanCode('')
      await refresh()
      toast.success(`${result.code} verified. ${result.remainingUnits} package(s) remaining.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Package verification failed.')
    } finally { setBusy(false) }
  }

  const depart = async () => {
    if (!confirmDepart) return
    setBusy(true)
    try {
      await api.deliveries.depart(confirmDepart.id)
      await Promise.all([refresh(), syncWithBackend()])
      toast.success(`Truck ${confirmDepart.truckPlate} departed.`)
      setConfirmDepart(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not record departure.')
    } finally { setBusy(false) }
  }

  const selected = deliveries.find((delivery) => delivery.id === selectedId)
  const columns: Column<Delivery>[] = [
    { key: 'code', label: 'Delivery', priority: true, render: (row) => <span className="font-mono">{row.code}</span> },
    { key: 'truckPlate', label: 'Truck', priority: true },
    { key: 'destination', label: 'Destination', priority: true },
    { key: 'units', label: 'Packages', render: (row) => `${row.verifiedUnits}/${row.units} verified` },
    { key: 'status', label: 'Status', render: (row) => <Badge tone={row.status === 'DEPARTED' ? 'success' : row.status === 'READY' ? 'accent' : 'warning'}>{row.status}</Badge> },
    { key: 'actions', label: 'Action', render: (row) => row.status === 'DEPARTED' ? null : <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setSelectedId(row.id)}>Select</Button><Button size="sm" variant="primary" disabled={row.status !== 'READY' || busy} onClick={() => setConfirmDepart(row)}>Depart</Button></div> },
  ]

  return <div className="stack stack-lg">
    <PageHeader title="Deliveries" subtitle="Allocate packages, scan every label, then record departure." />
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-md">
      <Card title="Create delivery" subtitle="Assign stored packages by grade.">
        <form className="stack-md" onSubmit={create}>
          <Field label="Truck plate" htmlFor="delivery-plate" required><Input id="delivery-plate" value={form.truckPlate} onChange={(e) => setForm({ ...form, truckPlate: e.target.value })} required /></Field>
          <Field label="Destination" htmlFor="delivery-destination" required><Input id="delivery-destination" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} required /></Field>
          <Field label="Driver name" htmlFor="delivery-driver"><Input id="delivery-driver" value={form.driverName} onChange={(e) => setForm({ ...form, driverName: e.target.value })} /></Field>
          <Field label="Grade" htmlFor="delivery-grade" required><select id="delivery-grade" className="form-input" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value as 'A' | 'B' | 'C' })}><option value="A">Grade A</option><option value="B">Grade B</option><option value="C">Grade C</option></select></Field>
          <Field label="Packaging units" htmlFor="delivery-units" required><Input id="delivery-units" type="number" min="1" step="1" value={form.units} onChange={(e) => setForm({ ...form, units: e.target.value })} required /></Field>
          <Button type="submit" variant="primary" disabled={busy}>Create Delivery</Button>
        </form>
      </Card>
      <Card title="Verify load" subtitle={selected ? `${selected.code} · ${selected.verifiedUnits}/${selected.units} packages verified` : 'Select a delivery from the table.'}>
        <form className="stack-md" onSubmit={verify}>
          {selected && <p className="text-xs text-muted-foreground">Assigned labels: {selected.packageCodes.join(', ')}</p>}
          <Field label="Package code or barcode" htmlFor="delivery-scan" required><Input id="delivery-scan" mono value={scanCode} onChange={(e) => setScanCode(e.target.value)} placeholder="Scan package label" required /></Field>
          <Button type="submit" variant="primary" disabled={busy || !selected || selected.status === 'DEPARTED'}>Scan & Verify</Button>
        </form>
      </Card>
    </div>
    <Card title="Loads"><DataTable columns={columns} data={deliveries} rowKey={(row) => row.id} emptyTitle="No deliveries recorded." /></Card>
    <ConfirmDialog open={Boolean(confirmDepart)} title="Confirm departure?" description={confirmDepart ? `Depart ${confirmDepart.truckPlate} with ${confirmDepart.units} verified packages?` : null} confirmLabel="Depart" onConfirm={depart} onCancel={() => setConfirmDepart(null)} />
  </div>
}
