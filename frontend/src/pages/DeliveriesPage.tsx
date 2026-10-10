/**
 * Deliveries — Area Pengiriman.
 * Build export loads, verify them with an ITF-14 scan, and confirm departure
 * (which deducts stock — laporan.pdf §9.4/§9.11).
 */
import { useState } from 'react'
import Card from '../components/shared/Card'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import Icon from '../components/shared/Icon'
import { Field, Input } from '../components/shared/Form'
import DataTable, { type Column } from '../components/shared/DataTable'
import PageHeader from '../components/shared/PageHeader'
import ConfirmDialog from '../components/feedback/ConfirmDialog'
import { useToast } from '../components/feedback/Toast'

type DeliveryStatus = 'LOADING' | 'READY' | 'DEPARTED' | 'DELIVERED'

type Delivery = {
  id: string
  truckPlate: string
  destination: string
  driver: string
  units: number
  status: DeliveryStatus
  time: string
}

const STATUS_TONE: Record<DeliveryStatus, 'warning' | 'accent' | 'success' | 'neutral'> = {
  LOADING: 'warning',
  READY: 'accent',
  DEPARTED: 'success',
  DELIVERED: 'neutral',
}

const EXPECTED_LOAD = {
  itf: '01 08990012345678',
  units: 4,
  grade: 'A',
  batch: 'PLT-20260914-0001',
  destination: 'Jakarta',
}

export default function DeliveriesPage() {
  const toast = useToast()
  const [form, setForm] = useState({ truckPlate: '', destination: '', driverName: '', units: '' })
  const [scanItf, setScanItf] = useState('')
  const [verification, setVerification] = useState<null | { ok: boolean; message: string }>(null)
  const [confirmDepart, setConfirmDepart] = useState<Delivery | null>(null)

  const [deliveries, setDeliveries] = useState<Delivery[]>([
    { id: '1', truckPlate: 'B1234XYZ', destination: 'Jakarta', driver: 'Ahmad', units: 4, status: 'LOADING', time: '07:40' },
    { id: '2', truckPlate: 'B5678ABC', destination: 'Surabaya', driver: 'Budi', units: 2, status: 'READY', time: '08:10' },
    { id: '3', truckPlate: 'B9012DEF', destination: 'Semarang', driver: 'Citra', units: 3, status: 'DEPARTED', time: '08:55' },
  ])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.truckPlate.trim() || !form.destination.trim()) {
      toast.error('Truck plate and destination are required.')
      return
    }
    const units = Number(form.units)
    if (!(units > 0)) {
      toast.error('Number of packaging units must be greater than 0.')
      return
    }
    setDeliveries([
      {
        id: String(Date.now()),
        truckPlate: form.truckPlate.trim().toUpperCase(),
        destination: form.destination.trim(),
        driver: form.driverName.trim() || 'Unassigned',
        units,
        status: 'LOADING',
        time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      },
      ...deliveries,
    ])
    setForm({ truckPlate: '', destination: '', driverName: '', units: '' })
    toast.success('Delivery created — load the packaging units.')
  }

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault()
    const scanned = scanItf.replace(/\s/g, '')
    if (!scanned) {
      setVerification({ ok: false, message: 'Scan the ITF-14 code on the packaging unit.' })
      return
    }
    if (scanned === EXPECTED_LOAD.itf.replace(/\s/g, '')) {
      setVerification({ ok: true, message: `Load verified: ${EXPECTED_LOAD.units} units, grade ${EXPECTED_LOAD.grade}, batch ${EXPECTED_LOAD.batch}.` })
      toast.success('ITF-14 verified — load matches the manifest.')
    } else {
      setVerification({ ok: false, message: 'Load mismatch — count, grade, batch or destination does not match.' })
      toast.error('ITF-14 verification failed.')
    }
  }

  const confirmDeparture = () => {
    if (!confirmDepart) return
    setDeliveries((current) =>
      current.map((item) => (item.id === confirmDepart.id ? { ...item, status: 'DEPARTED' } : item)),
    )
    toast.success(`Truck ${confirmDepart.truckPlate} departed to ${confirmDepart.destination}.`)
    setConfirmDepart(null)
  }

  const columns: Column<Delivery>[] = [
    { key: 'time', label: 'Created', render: (row) => <span className="mono t-small">{row.time}</span> },
    { key: 'truckPlate', label: 'Truck plate', priority: true, render: (row) => <span className="mono cell-strong">{row.truckPlate}</span> },
    { key: 'destination', label: 'Destination', priority: true, render: (row) => <span className="t-small">{row.destination}</span> },
    { key: 'driver', label: 'Driver', render: (row) => <span className="t-small cell-secondary">{row.driver}</span> },
    { key: 'units', label: 'Units', align: 'right', render: (row) => <span className="cell-strong">{row.units}</span> },
    {
      key: 'status',
      label: 'Status',
      priority: true,
      render: (row) => <Badge tone={STATUS_TONE[row.status]} dot>{row.status}</Badge>,
    },
    {
      key: 'actions',
      label: 'Action',
      align: 'right',
      render: (row) =>
        row.status === 'LOADING' || row.status === 'READY' ? (
          <div className="row gap-xs justify-end">
            <Button size="sm" variant="outline" onClick={() => {
              setDeliveries((current) =>
                current.map((item) => (item.id === row.id ? { ...item, status: 'READY' } : item)),
              )
              toast.info(`${row.truckPlate} marked ready for verification.`)
            }}>
              Mark Ready
            </Button>
            <Button size="sm" variant="primary" icon="send" onClick={() => setConfirmDepart(row)}>
              Depart
            </Button>
          </div>
        ) : (
          <span className="t-caption text-text-light">
            {row.status === 'DEPARTED' ? 'In transit' : 'Delivered'}
          </span>
        ),
    },
  ]

  return (
    <div className="stack stack-lg">
      <PageHeader
        title="Deliveries"
        subtitle="Build export loads, verify with an ITF-14 scan, then record departure."
        actions={<Badge tone="accent">{deliveries.filter((item) => item.status !== 'DELIVERED').length} open</Badge>}
      />

      <div className="grid-stats">
        <div className="stat-card">
          <p className="stat-label">Active deliveries</p>
          <p className="stat-value">{deliveries.filter((item) => item.status !== 'DELIVERED').length}</p>
          <p className="stat-sub">Trucks scheduled</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Departed today</p>
          <p className="stat-value">{deliveries.filter((item) => item.status === 'DEPARTED').length}</p>
          <p className="stat-sub">Stock deducted</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Packaging units</p>
          <p className="stat-value">{deliveries.reduce((sum, item) => sum + item.units, 0)}</p>
          <p className="stat-sub">Across all loads</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Verification</p>
          <p className="stat-value" style={{ fontSize: 20 }}>ITF-14</p>
          <p className="stat-sub">Scan before departure</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-md">
        <Card title="Create delivery" subtitle="Compose the load from packaging units.">
          <form className="stack-md" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
              <Field label="Truck plate" htmlFor="delivery-plate" required>
                <Input
                  id="delivery-plate"
                  mono
                  value={form.truckPlate}
                  onChange={(e) => setForm({ ...form, truckPlate: e.target.value })}
                  placeholder="B1234XYZ"
                  required
                />
              </Field>
              <Field label="Destination" htmlFor="delivery-destination" required>
                <Input
                  id="delivery-destination"
                  value={form.destination}
                  onChange={(e) => setForm({ ...form, destination: e.target.value })}
                  placeholder="Jakarta"
                  required
                />
              </Field>
              <Field label="Driver name" htmlFor="delivery-driver">
                <Input
                  id="delivery-driver"
                  value={form.driverName}
                  onChange={(e) => setForm({ ...form, driverName: e.target.value })}
                  placeholder="Ahmad"
                />
              </Field>
              <Field label="Packaging units" htmlFor="delivery-units" required>
                <Input
                  id="delivery-units"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  value={form.units}
                  onChange={(e) => setForm({ ...form, units: e.target.value })}
                  placeholder="4"
                  required
                />
              </Field>
            </div>
            <div className="row gap-sm">
              <Button type="submit" variant="primary" icon="plus" touch>
                Create Delivery
              </Button>
            </div>
          </form>
        </Card>

        <Card title="Verify load" subtitle="Scan the ITF-14 label on a packaging unit.">
          <form className="stack-md" onSubmit={handleVerify}>
            <Field
              label="ITF-14 code"
              htmlFor="delivery-itf"
              required
              hint={`Expected: ${EXPECTED_LOAD.itf} · ${EXPECTED_LOAD.units} units · grade ${EXPECTED_LOAD.grade} · ${EXPECTED_LOAD.destination}`}
            >
              <Input
                id="delivery-itf"
                mono
                value={scanItf}
                onChange={(e) => setScanItf(e.target.value)}
                placeholder="01 08990012345678"
                required
              />
            </Field>
            <div className="row gap-sm">
              <Button type="submit" variant="outline" icon="scan" touch>
                Scan & Verify
              </Button>
            </div>

            {verification && (
              <div className={`alert ${verification.ok ? 'alert-success' : 'alert-danger'}`} role="status">
                <Icon name={verification.ok ? 'check-circle' : 'alert'} size={16} />
                <span>{verification.message}</span>
              </div>
            )}
          </form>
        </Card>
      </div>

      <section className="stack-sm">
        <div className="section-header">
          <h2 className="section-title">Loads</h2>
        </div>
        <DataTable
          columns={columns}
          data={deliveries}
          rowKey={(row) => row.id}
          emptyTitle="No deliveries recorded."
          emptyDescription="Create a delivery to compose the first export load."
        />
      </section>

      <ConfirmDialog
        open={Boolean(confirmDepart)}
        tone="danger"
        title="Confirm departure?"
        description={
          confirmDepart ? (
            <>
              Confirm departure of truck <strong>{confirmDepart.truckPlate}</strong> with{' '}
              <strong>{confirmDepart.units} packaging units</strong> to{' '}
              <strong>{confirmDepart.destination}</strong>? Stock will be deducted.
            </>
          ) : null
        }
        confirmLabel="Yes, Depart"
        onConfirm={confirmDeparture}
        onCancel={() => setConfirmDepart(null)}
      />
    </div>
  )
}
