/**
 * Weighing — Area Penerimaan (Receiving).
 *
 * Implements the receiving workflow from docs/laporan.pdf §9.4:
 *   Scan farmer ID → create pallet → weigh (Auto / Manual) → approve → print pallet label.
 * Weighing is only performed in the Receiving and Packing areas.
 */
import { useState, useEffect } from 'react'
import Card from '../components/shared/Card'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import Icon from '../components/shared/Icon'
import { Field, Input, Select, Textarea } from '../components/shared/Form'
import DataTable, { type Column } from '../components/shared/DataTable'
import PageHeader from '../components/shared/PageHeader'
import ConfirmDialog from '../components/feedback/ConfirmDialog'
import { useToast } from '../components/feedback/Toast'
import ScaleWeightInput from '../components/operator/ScaleWeightInput'
import { useSessionContext } from '../hooks/useSessionContext'

type TransportMode = 'wifi' | 'ethernet'
type WeighingStatus = 'PENDING' | 'APPROVED'

type WeighingRecord = {
  id: string
  palletCode: string
  farmerName: string
  grade: string
  weightKg: number
  harvestDate: string
  note: string
  time: string
  status: WeighingStatus
}

const FARMERS = [
  { id: 'farmer-1', name: 'Ahmad Santoso', village: 'Dieng, Wonosobo' },
  { id: 'farmer-2', name: 'Budi Prasetyo', village: 'Berastagi, Karo' },
  { id: 'farmer-3', name: 'Siti Rahayu', village: 'Pangalengan, Bandung' },
]

const GRADES = ['A', 'B', 'C']
const SCALE_CAPACITY_KG = 150

const nextPalletCode = (index: number) => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `PLT-${date}-${String(index).padStart(4, '0')}`
}

const today = () => new Date().toISOString().slice(0, 10)

const statusTone: Record<WeighingStatus, 'success' | 'warning'> = {
  APPROVED: 'success',
  PENDING: 'warning',
}

export default function WeighingPage() {
  const toast = useToast()
  const { farmer, pallet, active, startScan } = useSessionContext()

  /* ── Scan & context ── */
  const [scanFarmerId, setScanFarmerId] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState('')

  /* ── Weighing form ── */
  const [grade, setGrade] = useState('A')
  const [weightKg, setWeightKg] = useState('')
  const [harvestDate, setHarvestDate] = useState('')
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmApprove, setConfirmApprove] = useState<WeighingRecord | null>(null)

  const [records, setRecords] = useState<WeighingRecord[]>([
    {
      id: '1',
      palletCode: 'PLT-20260914-0001',
      farmerName: 'Ahmad Santoso',
      grade: 'A',
      weightKg: 45.5,
      harvestDate: '2026-09-12',
      note: '',
      time: '10:15',
      status: 'APPROVED',
    },
    {
      id: '2',
      palletCode: 'PLT-20260913-0002',
      farmerName: 'Budi Prasetyo',
      grade: 'B',
      weightKg: 38.2,
      harvestDate: '2026-09-12',
      note: '',
      time: '09:45',
      status: 'PENDING',
    },
  ])
  const [palletCounter, setPalletCounter] = useState(3)

  /* ── Transmitter configuration (firmware transport) ── */
  const [transportMode, setTransportMode] = useState<TransportMode>('wifi')
  const [transportStatus, setTransportStatus] = useState({
    staConnected: false,
    ethernetActive: false,
    ethernetIp: '',
    apSsid: 'ENYX-SMARTHUB-AP',
    apIp: '192.168.4.1',
  })
  const [transportSaving, setTransportSaving] = useState(false)

  useEffect(() => {
    fetchTransportStatus()
  }, [])

  const fetchTransportStatus = async () => {
    try {
      const res = await fetch('/api/weighing/transport')
      const json = await res.json()
      if (json.success) {
        setTransportMode(json.data.transportMode || 'wifi')
        setTransportStatus(json.data)
      }
    } catch (e) {
      console.error('Failed to fetch transport status', e)
    }
  }

  const handleTransportSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setTransportSaving(true)
    try {
      const res = await fetch('/api/weighing/transport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: transportMode }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(json.message)
        await fetchTransportStatus()
      } else {
        toast.error(json.error?.message || 'Failed to save transport mode')
      }
    } catch {
      toast.error('Error saving transport configuration')
    } finally {
      setTransportSaving(false)
    }
  }

  /* ── Scan farmer ID: opens the session context ── */
  const handleScan = async () => {
    setScanError('')
    const selected = FARMERS.find((item) => item.id === scanFarmerId)
    if (!selected) {
      setScanError('Barcode not recognized — try manual input.')
      return
    }

    setScanning(true)
    const code = nextPalletCode(palletCounter)
    setPalletCounter((value) => value + 1)

    await new Promise((resolve) => window.setTimeout(resolve, 450))
    startScan({ id: selected.id, name: selected.name }, code, harvestDate || today(), grade)
    setScanning(false)
    toast.success(`Context set: ${selected.name} · ${code}`)
  }

  /* ── Save / approve / correct ── */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    if (!active || !pallet || !farmer) {
      setFormError('Scan a farmer ID first to set the session context.')
      return
    }
    if (!(Number(weightKg) > 0)) {
      setFormError('Weight must be greater than 0 kg.')
      return
    }
    if (Number(weightKg) > SCALE_CAPACITY_KG) {
      setFormError(`Weight exceeds the scale capacity of ${SCALE_CAPACITY_KG} kg.`)
      return
    }

    const payload: WeighingRecord = {
      id: editingId ?? String(Date.now()),
      palletCode: pallet.code,
      farmerName: farmer.name,
      grade,
      weightKg: Number(Number(weightKg).toFixed(3)),
      harvestDate: harvestDate || pallet.harvestDate || today(),
      note,
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      status: 'PENDING',
    }

    if (editingId) {
      setRecords((current) => current.map((item) => (item.id === editingId ? payload : item)))
      setEditingId(null)
      toast.info('Weighing updated — awaiting approval.')
    } else {
      setRecords((current) => [payload, ...current])
      toast.success('Weighing recorded — pending approval.')
    }

    setWeightKg('')
    setNote('')
  }

  const handleApprove = () => {
    if (!confirmApprove) return
    setRecords((current) =>
      current.map((item) =>
        item.id === confirmApprove.id ? { ...item, status: 'APPROVED' as WeighingStatus } : item,
      ),
    )
    toast.success(`Weight approved for pallet ${confirmApprove.palletCode}`)
    setConfirmApprove(null)
  }

  /* Koreksi: muat kembali data ke form untuk ditimbang ulang */
  const handleKoreksi = (record: WeighingRecord) => {
    setEditingId(record.id)
    setGrade(record.grade)
    setWeightKg(String(record.weightKg))
    setHarvestDate(record.harvestDate)
    setNote(record.note)
    setRecords((current) => current.filter((item) => item.id !== record.id))
    toast.warning('Record loaded back for re-weighing.')
  }

  const handlePrintPalletLabel = (record: WeighingRecord) => {
    if (record.status !== 'APPROVED') {
      toast.error('Only approved records can print a pallet label.')
      return
    }
    toast.warning('Printing pallet label…')
    window.setTimeout(() => toast.success(`Label ${record.palletCode} sent to printer.`), 900)
  }

  const columns: Column<WeighingRecord>[] = [
    {
      key: 'time',
      label: 'Time',
      render: (row) => <span className="mono t-small">{row.time}</span>,
    },
    {
      key: 'palletCode',
      label: 'Pallet',
      priority: true,
      render: (row) => <span className="mono cell-strong">{row.palletCode}</span>,
    },
    {
      key: 'farmerName',
      label: 'Farmer',
      priority: true,
      render: (row) => <span className="t-small">{row.farmerName}</span>,
    },
    {
      key: 'grade',
      label: 'Grade',
      priority: true,
      render: (row) => <Badge tone="accent">{row.grade}</Badge>,
    },
    {
      key: 'weightKg',
      label: 'Weight (kg)',
      align: 'right',
      render: (row) => <span className="cell-strong">{row.weightKg.toFixed(3)}</span>,
    },
    {
      key: 'harvestDate',
      label: 'Harvest date',
      render: (row) => <span className="mono t-small cell-secondary">{row.harvestDate}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge tone={statusTone[row.status]} dot={row.status === 'APPROVED'}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (row) =>
        row.status === 'PENDING' ? (
          <div className="row gap-xs justify-end">
            <Button size="sm" variant="primary" icon="check" onClick={() => setConfirmApprove(row)}>
              Approve
            </Button>
            <Button size="sm" variant="outline" icon="refresh" onClick={() => handleKoreksi(row)}>
              Koreksi
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" icon="print" onClick={() => handlePrintPalletLabel(row)}>
            Print Label
          </Button>
        ),
    },
  ]

  const pendingCount = records.filter((item) => item.status === 'PENDING').length
  const approvedToday = records.filter((item) => item.status === 'APPROVED').length

  return (
    <div className="stack stack-lg">
      <PageHeader
        title="Weighing"
        subtitle="Receiving area — scan the farmer ID, weigh the sacks, then approve the official weight."
        actions={
          <Button
            variant="outline"
            size="sm"
            icon="history"
            onClick={() => document.getElementById('weighing-records')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Today's records ({records.length})
          </Button>
        }
      />

      <div className="grid-stats">
        <div className="stat-card">
          <p className="stat-label">Pending approval</p>
          <p className="stat-value">{pendingCount}</p>
          <p className="stat-sub">Waiting for verification</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Approved today</p>
          <p className="stat-value">{approvedToday}</p>
          <p className="stat-sub stat-trend-up">
            <Icon name="arrow-up" size={12} /> labels ready to print
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Scale</p>
          <p className="stat-value" style={{ fontSize: 20 }}>
            {transportStatus.ethernetActive ? 'Ethernet' : transportMode === 'wifi' ? 'WiFi' : 'WiFi'}
          </p>
          <p className="stat-sub">
            {transportStatus.staConnected ? 'Transmitter online' : 'Transmitter offline'}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Capacity</p>
          <p className="stat-value">{SCALE_CAPACITY_KG}</p>
          <p className="stat-sub">kg per weighing</p>
        </div>
      </div>

      {/* ── Scan & context ── */}
      <Card
        title="Scan & Context"
        subtitle="Scan the farmer ID to bind every weighing to the right farmer and pallet."
        action={
          active ? (
            <Badge tone="success" dot>
              Context active
            </Badge>
          ) : (
            <Badge tone="neutral" dot>
              No context
            </Badge>
          )
        }
      >
        <form
          className="stack-md"
          onSubmit={(e) => {
            e.preventDefault()
            handleScan()
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">
            <Field
              label="Farmer ID"
              htmlFor="scan-farmer"
              required
              hint="Select the scanned farmer barcode."
              error={scanError || undefined}
            >
              <Select
                id="scan-farmer"
                value={scanFarmerId}
                onChange={(e) => setScanFarmerId(e.target.value)}
                invalid={Boolean(scanError)}
              >
                <option value="">Scan or select farmer</option>
                {FARMERS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} — {item.id}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Harvest date" htmlFor="scan-harvest-date" hint="From the farmer's information.">
              <Input
                id="scan-harvest-date"
                type="date"
                value={harvestDate}
                onChange={(e) => setHarvestDate(e.target.value)}
              />
            </Field>

            <Field label="Default grade" htmlFor="scan-grade">
              <Select id="scan-grade" value={grade} onChange={(e) => setGrade(e.target.value)}>
                {GRADES.map((item) => (
                  <option key={item} value={item}>
                    Grade {item}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="flex items-end">
              <Button type="submit" variant="primary" icon="scan" block touch loading={scanning}>
                {scanning ? 'Scanning…' : 'Scan Farmer ID'}
              </Button>
            </div>
          </div>

          <div
            className={`scan-frame ${scanning ? 'is-scanning' : active ? 'is-success' : ''}`}
            aria-live="polite"
          >
            <Icon name={active ? 'check-circle' : 'scan'} size={22} />
            <p className="t-small font-semibold">
              {active ? 'Session context active' : 'Waiting for the first scan'}
            </p>
            <p className="t-caption text-text-secondary">
              {active
                ? `Farmer ${farmer?.name} · pallet ${pallet?.code}`
                : 'The context bar above shows the active farmer and pallet once a scan succeeds.'}
            </p>
          </div>
        </form>
      </Card>

      {/* ── Weighing form ── */}
      <Card
        title={editingId ? 'Re-weigh record' : 'New Weighing'}
        subtitle="Weighing is only performed at the Receiving and Packing areas."
      >
        <form className="stack-md" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
            <div className="stack-md">
              <ScaleWeightInput
                id="weighing-weight"
                label="Weight (kg)"
                hint="Locked from the live scale reading, or enter the indicator value manually."
                value={weightKg}
                onChange={setWeightKg}
                capacityKg={SCALE_CAPACITY_KG}
              />

              {formError && (
                <div className="alert alert-danger" role="alert">
                  <Icon name="alert" size={16} />
                  <span>{formError}</span>
                </div>
              )}
            </div>

            <div className="stack-md">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
                <Field label="Pallet" htmlFor="weighing-pallet">
                  <Input
                    id="weighing-pallet"
                    mono
                    value={pallet?.code ?? ''}
                    placeholder="Set by the scan above"
                    readOnly
                  />
                </Field>
                <Field label="Grade" htmlFor="weighing-grade" required>
                  <Select id="weighing-grade" value={grade} onChange={(e) => setGrade(e.target.value)}>
                    {GRADES.map((item) => (
                      <option key={item} value={item}>
                        Grade {item}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <Field label="Harvest date" htmlFor="weighing-harvest-date" required>
                <Input
                  id="weighing-harvest-date"
                  type="date"
                  value={harvestDate || pallet?.harvestDate || ''}
                  onChange={(e) => setHarvestDate(e.target.value)}
                />
              </Field>

              <Field label="Note (optional)" htmlFor="weighing-note">
                <Textarea
                  id="weighing-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Condition of the sacks, moisture, remarks…"
                />
              </Field>
            </div>
          </div>

          <div className="row gap-sm flex-wrap">
            <Button type="submit" variant="primary" icon="check" touch>
              {editingId ? 'Update Weighing' : 'Record Weighing'}
            </Button>
            {editingId && (
              <Button
                variant="ghost"
                icon="close"
                onClick={() => {
                  setEditingId(null)
                  setWeightKg('')
                  setNote('')
                }}
              >
                Cancel edit
              </Button>
            )}
            <span className="t-caption text-text-light">
              Records are saved as PENDING until an operator approves the weight.
            </span>
          </div>
        </form>
      </Card>

      {/* ── Records ── */}
      <div id="weighing-records" className="stack-sm">
        <div className="section-header">
          <h2 className="section-title">Today's records</h2>
          <span className="t-caption text-text-secondary">
            {pendingCount} pending · {approvedToday} approved
          </span>
        </div>
        <DataTable
          columns={columns}
          data={records}
          rowKey={(row) => row.id}
          emptyTitle="No weighing records today."
          emptyDescription="Scan a farmer ID and record the first weighing of the day."
          caption="Approve verifies the weight; koreksi loads the record back into the form for re-weighing."
        />
      </div>

      {/* ── Transmitter configuration ── */}
      <Card
        title="Transmitter Configuration"
        subtitle="Network transport used by the weighing transmitter."
      >
        <form className="stack-md" onSubmit={handleTransportSave}>
          <div className="radio-row" role="group" aria-label="Transport mode">
            <label className={`radio-card ${transportMode === 'wifi' ? 'is-active' : ''}`}>
              <input
                type="radio"
                name="transportMode"
                value="wifi"
                checked={transportMode === 'wifi'}
                onChange={(e) => setTransportMode(e.target.value as TransportMode)}
              />
              <Icon name="wifi" size={15} />
              WiFi
            </label>
            <label className={`radio-card ${transportMode === 'ethernet' ? 'is-active' : ''}`}>
              <input
                type="radio"
                name="transportMode"
                value="ethernet"
                checked={transportMode === 'ethernet'}
                onChange={(e) => setTransportMode(e.target.value as TransportMode)}
              />
              <Icon name="flash" size={15} />
              Ethernet (W5500)
            </label>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">
            {[
              ['AP SSID', transportStatus.apSsid],
              ['AP IP', transportStatus.apIp],
              ['WiFi status', transportStatus.staConnected ? 'Connected' : 'Disconnected'],
              [
                'Ethernet status',
                transportStatus.ethernetActive ? `Active (${transportStatus.ethernetIp})` : 'Inactive',
              ],
            ].map(([label, value]) => (
              <div key={label} className="stack-xs">
                <dt className="t-caption text-text-secondary uppercase">{label}</dt>
                <dd className="mono t-small">{value}</dd>
              </div>
            ))}
          </dl>

          <div>
            <Button type="submit" variant="outline" icon="check" loading={transportSaving}>
              {transportSaving ? 'Saving…' : 'Save Transport Configuration'}
            </Button>
          </div>
        </form>
      </Card>

      <ConfirmDialog
        open={Boolean(confirmApprove)}
        tone="danger"
        title="Approve weight?"
        description={
          confirmApprove ? (
            <>
              Approve weight <strong>{confirmApprove.weightKg.toFixed(3)} kg</strong> for pallet{' '}
              <strong>{confirmApprove.palletCode}</strong>? This cannot be changed after approval.
            </>
          ) : null
        }
        confirmLabel="Yes, Approve"
        onConfirm={handleApprove}
        onCancel={() => setConfirmApprove(null)}
      />
    </div>
  )
}
