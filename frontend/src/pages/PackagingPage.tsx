/**
 * Packaging — Area Pengepakan (Packing).
 * Pouches are filled to a 1 kg target with ±5 g tolerance and labelled without
 * scanning, because grade and pallet are already labelled (laporan.pdf §9.4/§9.6).
 */
import { useState } from 'react'
import Card from '../components/shared/Card'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import Icon from '../components/shared/Icon'
import { Field, Input, Select } from '../components/shared/Form'
import DataTable, { type Column } from '../components/shared/DataTable'
import PageHeader from '../components/shared/PageHeader'
import ConfirmDialog from '../components/feedback/ConfirmDialog'
import { useToast } from '../components/feedback/Toast'
import ScaleWeightInput from '../components/operator/ScaleWeightInput'

type PackagingUnit = {
  id: string
  code: string
  size: '10kg' | '50kg'
  commodity: string
  pouches: number
  status: 'ACTIVE' | 'PACKED'
  created: string
}

const TARGET_KG = 1
const TOLERANCE_KG = 0.005
const POUCH_SCALE_CAPACITY_KG = 5

export default function PackagingPage() {
  const toast = useToast()
  const [form, setForm] = useState({ palletCode: 'PLT-20260914-0001', grade: 'A', quantity: '10', size: '10kg' as PackagingUnit['size'] })
  const [pouchWeight, setPouchWeight] = useState('')
  const [confirmPack, setConfirmPack] = useState(false)

  const [pouches, setPouches] = useState([
    { id: '1', code: 'PCH-PLT-20260914-0001-001', grade: 'A', weightKg: 1.0, status: 'LABELLED' as const },
    { id: '2', code: 'PCH-PLT-20260914-0001-002', grade: 'A', weightKg: 1.0, status: 'LABELLED' as const },
  ])

  const [units, setUnits] = useState<PackagingUnit[]>([
    { id: '1', code: 'PKG-001', size: '10kg', commodity: 'Kentang', pouches: 10, status: 'PACKED', created: '07:30' },
    { id: '2', code: 'PKG-002', size: '50kg', commodity: 'Kentang', pouches: 50, status: 'ACTIVE', created: '07:52' },
  ])

  const weightValue = Number(pouchWeight)
  const withinTolerance = Math.abs(weightValue - TARGET_KG) <= TOLERANCE_KG

  const handleFillPouch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!(weightValue > 0)) {
      toast.error('Pouch weight must be greater than 0 kg.')
      return
    }
    const seq = String(pouches.length + 1).padStart(3, '0')
    setPouches([
      {
        id: String(Date.now()),
        code: `PCH-${form.palletCode}-${seq}`,
        grade: form.grade,
        weightKg: Number(weightValue.toFixed(3)),
        status: 'LABELLED',
      },
      ...pouches,
    ])
    toast.success(`Pouch filled at ${weightValue.toFixed(3)} kg — label queued.`)
    setPouchWeight('')
  }

  const handleCreateUnit = () => {
    setConfirmPack(true)
  }

  const confirmCreateUnit = () => {
    const quantity = Number(form.quantity)
    if (!(quantity > 0)) {
      toast.error('Pouch quantity must be greater than 0.')
      setConfirmPack(false)
      return
    }
    const seq = String(units.length + 1).padStart(3, '0')
    setUnits([
      {
        id: String(Date.now()),
        code: `PKG-${seq}`,
        size: form.size,
        commodity: 'Kentang',
        pouches: quantity,
        status: 'ACTIVE',
        created: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      },
      ...units,
    ])
    setConfirmPack(false)
    toast.success(`Packaging unit PKG-${seq} created with ${quantity} pouches.`)
  }

  const pouchColumns: Column<(typeof pouches)[number]>[] = [
    { key: 'code', label: 'Pouch code', priority: true, render: (row) => <span className="mono cell-strong">{row.code}</span> },
    { key: 'grade', label: 'Grade', priority: true, render: (row) => <Badge tone="accent">{row.grade}</Badge> },
    {
      key: 'weightKg',
      label: 'Weight (kg)',
      align: 'right',
      priority: true,
      render: (row) => <span className="cell-strong">{row.weightKg.toFixed(3)}</span>,
    },
    {
      key: 'status',
      label: 'Label',
      render: (row) => (
        <Badge tone="success" dot>
          {row.status}
        </Badge>
      ),
    },
  ]

  const unitColumns: Column<PackagingUnit>[] = [
    { key: 'code', label: 'Code', priority: true, render: (row) => <span className="mono cell-strong">{row.code}</span> },
    { key: 'size', label: 'Size', priority: true, render: (row) => <span className="t-small">{row.size}</span> },
    { key: 'commodity', label: 'Commodity', render: (row) => <Badge tone="accent" icon="leaf">{row.commodity}</Badge> },
    { key: 'pouches', label: 'Pouches', align: 'right', render: (row) => <span className="cell-strong">{row.pouches}</span> },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <Badge tone={row.status === 'PACKED' ? 'success' : 'warning'} dot>{row.status}</Badge>,
    },
  ]

  return (
    <div className="stack stack-lg">
      <PageHeader
        title="Packaging"
        subtitle="Packing area — fill 1 kg pouches per grade, then bundle them into export units."
        actions={
          <Badge tone={withinTolerance ? 'success' : 'neutral'} dot={withinTolerance}>
            Target {TARGET_KG} kg ±{TOLERANCE_KG * 1000} g
          </Badge>
        }
      />

      <div className="grid-stats">
        <div className="stat-card">
          <p className="stat-label">Pouches labelled</p>
          <p className="stat-value">{pouches.length}</p>
          <p className="stat-sub">QR + EAN-13 printed</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Active units</p>
          <p className="stat-value">{units.filter((unit) => unit.status === 'ACTIVE').length}</p>
          <p className="stat-sub">Being filled</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Packed units</p>
          <p className="stat-value">{units.filter((unit) => unit.status === 'PACKED').length}</p>
          <p className="stat-sub">Ready for warehouse</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Pouch weight</p>
          <p className="stat-value">{pouchWeight ? Number(pouchWeight).toFixed(3) : '—'}</p>
          <p className="stat-sub">{withinTolerance ? 'Within tolerance' : 'Weigh the pouch'}</p>
        </div>
      </div>

      <Card
        title="Fill pouch"
        subtitle="No scan needed — grade and pallet come from the sortir labels."
        footer="A pouch label prints with the QR GS1 Digital Link and the parallel EAN-13 code."
      >
        <form className="stack-md" onSubmit={handleFillPouch}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
            <div className="stack-md">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
                <Field label="Pallet" htmlFor="packaging-pallet">
                  <Input id="packaging-pallet" mono value={form.palletCode} readOnly />
                </Field>
                <Field label="Grade" htmlFor="packaging-grade" required>
                  <Select value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}>
                    <option value="A">Grade A</option>
                    <option value="B">Grade B</option>
                    <option value="C">Grade C</option>
                  </Select>
                </Field>
              </div>

              <ScaleWeightInput
                id="packaging-weight"
                label="Pouch weight (kg)"
                hint="Auto mode shows the 1 kg target with a ±5 g tolerance."
                value={pouchWeight}
                onChange={setPouchWeight}
                targetKg={TARGET_KG}
                toleranceKg={TOLERANCE_KG}
                capacityKg={POUCH_SCALE_CAPACITY_KG}
              />
            </div>

            <div className="stack-md">
              <div className="label-preview">
                <div className="label-qr">
                  <Icon name="qr" size={44} className="text-text-light" />
                </div>
                <div className="label-body">
                  <p className="t-caption text-text-secondary uppercase">Pouch label preview</p>
                  <p className="mono t-medium text-truncate">PCH-{form.palletCode}-{String(pouches.length + 1).padStart(3, '0')}</p>
                  <div className="divider" style={{ margin: '8px 0' }} />
                  <dl className="stack-xs">
                    <div className="label-row">
                      <dt>Grade</dt>
                      <dd>{form.grade}</dd>
                    </div>
                    <div className="label-row">
                      <dt>Target</dt>
                      <dd>{TARGET_KG} kg ±{TOLERANCE_KG * 1000} g</dd>
                    </div>
                    <div className="label-row">
                      <dt>Weight</dt>
                      <dd>{pouchWeight ? `${Number(pouchWeight).toFixed(3)} kg` : '—'}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div className="row gap-sm flex-wrap">
                <Button type="submit" variant="primary" icon="check" touch disabled={!withinTolerance}>
                  Fill & Label Pouch
                </Button>
                <Button type="button" variant="outline" icon="package" onClick={handleCreateUnit}>
                  Create Packaging Unit
                </Button>
              </div>
              {!withinTolerance && (
                <p className="field-hint">
                  The pouch weight must be within ±{TOLERANCE_KG * 1000} g of the {TARGET_KG} kg target.
                </p>
              )}
            </div>
          </div>
        </form>
      </Card>

      <section className="stack-sm">
        <div className="section-header">
          <h2 className="section-title">Labelled pouches</h2>
          <span className="t-caption text-text-secondary">{pouches.length} pouches</span>
        </div>
        <DataTable
          columns={pouchColumns}
          data={pouches}
          rowKey={(row) => row.id}
          emptyTitle="No pouches labelled yet."
          emptyDescription="Fill the first 1 kg pouch to print its label."
        />
      </section>

      <section className="stack-sm">
        <div className="section-header">
          <h2 className="section-title">Packaging units</h2>
          <span className="t-caption text-text-secondary">Export units carry an ITF-14 label</span>
        </div>
        <DataTable
          columns={unitColumns}
          data={units}
          rowKey={(row) => row.id}
          emptyTitle="No packaging units created."
          emptyDescription="Bundle labelled pouches into a 10 kg or 50 kg export unit."
        />
      </section>

      <ConfirmDialog
        open={confirmPack}
        tone="accent"
        title="Create packaging unit?"
        description={
          <>
            Create a <strong>{form.size}</strong> export unit from the labelled pouches of pallet{' '}
            <strong>{form.palletCode}</strong>? An ITF-14 label is generated for the unit.
          </>
        }
        confirmLabel="Yes, Create"
        onConfirm={confirmCreateUnit}
        onCancel={() => setConfirmPack(false)}
      />
    </div>
  )
}
