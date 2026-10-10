/**
 * Weighing — Area Penerimaan (Receiving).
 *
 * Implements the revised receiving intake workflow:
 *   1. Scan / select Farmer ID (session context).
 *   2. Pure harvest intake weighing — deposit date is automatic by the system.
 *      No grade, no pallet ID prior to weighing, and no note.
 *   3. Approve official weight → automatically generates Pallet ID.
 *   4. Step: Print & affix Pallet Label (PLT-...).
 */
import { useState, useEffect } from 'react'
import Card from '../components/shared/Card'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import Icon from '../components/shared/Icon'
import { Field, Select } from '../components/shared/Form'
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
  farmerId: string
  farmerName: string
  weightKg: number
  depositDate: string
  time: string
  status: WeighingStatus
  palletCode?: string
}

const FARMERS = [
  { id: 'farmer-1', name: 'Ahmad Santoso', village: 'Dieng, Wonosobo' },
  { id: 'farmer-2', name: 'Budi Prasetyo', village: 'Berastagi, Karo' },
  { id: 'farmer-3', name: 'Siti Rahayu', village: 'Pangalengan, Bandung' },
]

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
  const { farmer, active, startScan } = useSessionContext()

  /* ── Scan & context ── */
  const [scanFarmerId, setScanFarmerId] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState('')

  /* ── Weighing form (purely weight) ── */
  const [weightKg, setWeightKg] = useState('')
  const [formError, setFormError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmApprove, setConfirmApprove] = useState<WeighingRecord | null>(null)

  /* ── Step: Print Pallet Label Modal ── */
  const [printModalRecord, setPrintModalRecord] = useState<WeighingRecord | null>(null)
  const [isPrinting, setIsPrinting] = useState(false)

  const [records, setRecords] = useState<WeighingRecord[]>([
    {
      id: '1',
      farmerId: 'farmer-1',
      farmerName: 'Ahmad Santoso',
      weightKg: 45.5,
      depositDate: today(),
      time: '10:15',
      status: 'APPROVED',
      palletCode: 'PLT-20261010-0001',
    },
    {
      id: '2',
      farmerId: 'farmer-2',
      farmerName: 'Budi Prasetyo',
      weightKg: 38.2,
      depositDate: today(),
      time: '09:45',
      status: 'PENDING',
    },
  ])
  const [palletCounter, setPalletCounter] = useState(2)

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

  /* ── Scan farmer ID: binds farmer context ── */
  const handleScan = async () => {
    setScanError('')
    const selected = FARMERS.find((item) => item.id === scanFarmerId)
    if (!selected) {
      setScanError('Farmer barcode not recognized — select a farmer from the list.')
      return
    }

    setScanning(true)
    await new Promise((resolve) => window.setTimeout(resolve, 350))
    startScan({ id: selected.id, name: selected.name })
    setScanning(false)
    toast.success(`Context set: ${selected.name}`)
  }

  /* ── Record pure harvest weighing ── */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    if (!active || !farmer) {
      setFormError('Select or scan a farmer first to set the session context.')
      return
    }
    if (!(Number(weightKg) > 0)) {
      setFormError('Weight must be greater than 0 kg.')
      return
    }
    if (Number(weightKg) > SCALE_CAPACITY_KG) {
      setFormError(`Weight exceeds scale capacity of ${SCALE_CAPACITY_KG} kg.`)
      return
    }

    const payload: WeighingRecord = {
      id: editingId ?? String(Date.now()),
      farmerId: farmer.id,
      farmerName: farmer.name,
      weightKg: Number(Number(weightKg).toFixed(3)),
      depositDate: today(), // Automatic by system
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      status: 'PENDING',
    }

    if (editingId) {
      setRecords((current) => current.map((item) => (item.id === editingId ? payload : item)))
      setEditingId(null)
      toast.info('Weighing updated — awaiting approval.')
    } else {
      setRecords((current) => [payload, ...current])
      toast.success('Harvest weighing recorded — pending approval.')
    }

    setWeightKg('')
  }

  /* ── Approval: generates Pallet ID and triggers Print Pallet Label step ── */
  const handleApprove = () => {
    if (!confirmApprove) return
    const assignedCode = confirmApprove.palletCode || nextPalletCode(palletCounter)
    if (!confirmApprove.palletCode) {
      setPalletCounter((value) => value + 1)
    }

    const updatedRecord: WeighingRecord = {
      ...confirmApprove,
      status: 'APPROVED',
      palletCode: assignedCode,
    }

    setRecords((current) =>
      current.map((item) => (item.id === confirmApprove.id ? updatedRecord : item)),
    )
    toast.success(`Weight approved! Pallet ${assignedCode} created.`)
    setConfirmApprove(null)

    // Trigger step print pallet label immediately
    setPrintModalRecord(updatedRecord)
  }

  /* Koreksi: reload weight back to form for re-weighing */
  const handleKoreksi = (record: WeighingRecord) => {
    setEditingId(record.id)
    setWeightKg(String(record.weightKg))
    setRecords((current) => current.filter((item) => item.id !== record.id))
    toast.warning('Record loaded back for re-weighing.')
  }

  const handlePrintPalletLabel = (record: WeighingRecord) => {
    if (record.status !== 'APPROVED') {
      toast.error('Only approved records can print a pallet label.')
      return
    }
    setPrintModalRecord(record)
  }

  const triggerPhysicalPrint = () => {
    if (!printModalRecord) return
    setIsPrinting(true)
    toast.warning('Sending pallet label to thermal printer…')
    window.setTimeout(() => {
      setIsPrinting(false)
      toast.success(`Label ${printModalRecord.palletCode} successfully sent to printer.`)
    }, 900)
  }

  const columns: Column<WeighingRecord>[] = [
    {
      key: 'time',
      label: 'Time',
      render: (row) => <span className="mono t-small">{row.time}</span>,
    },
    {
      key: 'farmerName',
      label: 'Farmer',
      priority: true,
      render: (row) => <span className="cell-strong">{row.farmerName}</span>,
    },
    {
      key: 'weightKg',
      label: 'Weight (kg)',
      priority: true,
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
      render: (row) => (
        <Badge tone={statusTone[row.status]} dot={row.status === 'APPROVED'}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'palletCode',
      label: 'Pallet ID',
      render: (row) =>
        row.palletCode ? (
          <span className="mono cell-strong">{row.palletCode}</span>
        ) : (
          <span className="t-caption text-text-light italic">Generated upon approval</span>
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
          <Button size="sm" variant="outline" icon="print" onClick={() => handlePrintPalletLabel(row)}>
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
        subtitle="Receiving area — identify farmer, weigh harvest intake (pure weighing), approve to generate pallet and print label."
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
            <Icon name="arrow-up" size={12} /> Pallets ready for sorting
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Scale Connection</p>
          <p className="stat-value" style={{ fontSize: 20 }}>
            {transportStatus.ethernetActive ? 'Ethernet' : transportMode === 'wifi' ? 'WiFi' : 'WiFi'}
          </p>
          <p className="stat-sub">
            {transportStatus.staConnected ? 'Transmitter online' : 'Transmitter ready'}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Capacity</p>
          <p className="stat-value">{SCALE_CAPACITY_KG}</p>
          <p className="stat-sub">kg per weighing</p>
        </div>
      </div>

      {/* ── Farmer Identification & Deposit Date ── */}
      <Card
        title="Farmer Intake Identification"
        subtitle="Select or scan the farmer barcode to associate the incoming harvest deposit."
        action={
          active && farmer ? (
            <Badge tone="success" dot>
              Context: {farmer.name}
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-md items-end">
            <div className="sm:col-span-2">
              <Field
                label="Farmer ID / Barcode"
                htmlFor="scan-farmer"
                required
                hint="Scan the barcode on the farmer's membership card or select from the directory."
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
                      {item.name} ({item.id}) — {item.village}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div>
              <Button type="submit" variant="primary" icon="scan" block touch loading={scanning}>
                {scanning ? 'Scanning…' : 'Scan / Select Farmer'}
              </Button>
            </div>
          </div>

          <div
            className={`scan-frame ${scanning ? 'is-scanning' : active && farmer ? 'is-success' : ''}`}
            aria-live="polite"
          >
            <Icon name={active && farmer ? 'check-circle' : 'scan'} size={22} />
            <p className="t-small font-semibold">
              {active && farmer ? `Active Intake: ${farmer.name}` : 'Waiting for farmer identification'}
            </p>
            <p className="t-caption text-text-secondary">
              Deposit date is automatic ({today()}). No grade or pallet ID is required prior to weighing.
            </p>
          </div>
        </form>
      </Card>

      {/* ── Weighing form (Purely Weighing) ── */}
      <Card
        title={editingId ? 'Re-weigh Harvest' : 'Weigh Harvest Intake'}
        subtitle="Pure harvest weighing. Deposit date is automatic; pallet ID is generated upon approval."
      >
        <form className="stack-md" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg items-start">
            <div className="stack-md">
              <ScaleWeightInput
                id="weighing-weight"
                label="Harvest Weight (kg)"
                hint="Auto-locks from live scale reading (Modbus TCP/MQTT) or enter manually."
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

            {/* Context & metadata summary */}
            <div className="stack-sm p-4 bg-surface-2 border border-border rounded-lg">
              <div className="row gap-xs items-center text-text-secondary t-caption uppercase font-semibold">
                <Icon name="info" size={14} /> Intake Metadata (System Generated)
              </div>

              <div className="grid grid-cols-2 gap-sm pt-2">
                <div>
                  <span className="t-caption text-text-secondary block">Active Farmer</span>
                  <span className="cell-strong text-sm">{farmer ? farmer.name : '—'}</span>
                </div>
                <div>
                  <span className="t-caption text-text-secondary block">Commodity</span>
                  <span className="cell-strong text-sm">Kentang (Potatoes)</span>
                </div>
                <div>
                  <span className="t-caption text-text-secondary block">Deposit Date (Tanggal Setor)</span>
                  <span className="mono text-sm cell-strong">
                    {today()} <Badge tone="accent">Auto</Badge>
                  </span>
                </div>
                <div>
                  <span className="t-caption text-text-secondary block">Pallet & Grading</span>
                  <span className="t-small text-text-secondary">Assigned at Approval & Sortir</span>
                </div>
              </div>

              <p className="t-caption text-text-light pt-2 border-t border-border mt-2">
                This intake step records pure harvest weight. Pallet ID will be created and printed upon approval.
              </p>
            </div>
          </div>

          <div className="row gap-sm flex-wrap items-center pt-2">
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
                }}
              >
                Cancel edit
              </Button>
            )}
            <span className="t-caption text-text-light">
              Record is saved as PENDING until verified by the weighing operator.
            </span>
          </div>
        </form>
      </Card>

      {/* ── Records Table ── */}
      <div id="weighing-records" className="stack-sm">
        <div className="section-header">
          <h2 className="section-title">Today's Harvest Weighing Records</h2>
          <span className="t-caption text-text-secondary">
            {pendingCount} pending · {approvedToday} approved
          </span>
        </div>
        <DataTable
          columns={columns}
          data={records}
          rowKey={(row) => row.id}
          emptyTitle="No harvest weighing records today."
          emptyDescription="Select a farmer and record the first harvest weighing."
          caption="Approve commits the weight and generates a Pallet ID for label printing; Koreksi reloads the weight into the scale form."
        />
      </div>

      {/* ── Transmitter configuration ── */}
      <Card
        title="Transmitter Configuration"
        subtitle="Network transport used by the weighing indicator transmitter."
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

      {/* ── Approval confirmation dialog ── */}
      <ConfirmDialog
        open={Boolean(confirmApprove)}
        tone="accent"
        title="Approve harvest weight?"
        description={
          confirmApprove ? (
            <>
              Approve official weight <strong>{confirmApprove.weightKg.toFixed(3)} kg</strong> for{' '}
              <strong>{confirmApprove.farmerName}</strong>? Upon approval, a Pallet ID will be generated
              and you will be prompted to print the pallet label.
            </>
          ) : null
        }
        confirmLabel="Yes, Approve Weight"
        onConfirm={handleApprove}
        onCancel={() => setConfirmApprove(null)}
      />

      {/* ── Step: Print Pallet Label Modal ── */}
      {printModalRecord && (
        <div
          className="dialog-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="print-dialog-title"
        >
          <div className="dialog" style={{ width: 'min(500px, 100%)' }}>
            <div className="row gap-xs items-center mb-2">
              <Badge tone="success" dot>
                Step: Print Pallet Label
              </Badge>
              <span className="t-caption text-text-secondary ml-auto">Approved</span>
            </div>

            <h2 className="dialog-title" id="print-dialog-title">
              Pallet Label Ready
            </h2>
            <p className="dialog-desc">
              Weight has been verified. Print the label below and affix it directly to the pallet box.
            </p>

            {/* Label Mockup Preview */}
            <div
              className="p-4 rounded-lg my-4 bg-white text-black border-2 border-dashed border-gray-400 font-mono shadow-sm"
              style={{ backgroundColor: '#ffffff', color: '#111827' }}
            >
              <div className="text-center pb-2 border-b border-gray-300">
                <span className="text-xs uppercase tracking-wider font-bold block text-gray-700">
                  E-Tani Smart Hub · Receiving Pallet
                </span>
                <span className="text-xl font-bold tracking-tight block text-gray-900 mt-1">
                  {printModalRecord.palletCode}
                </span>
              </div>

              {/* Barcode/QR simulation visualization */}
              <div className="flex items-center justify-center py-3 border-b border-gray-200">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className="flex gap-1 h-10 items-center justify-center px-4 bg-gray-100 rounded"
                    aria-label="Barcode simulation"
                  >
                    {[3, 1, 4, 2, 1, 3, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 2].map((w, idx) => (
                      <span
                        key={idx}
                        className="bg-black inline-block h-8"
                        style={{ width: `${w * 2}px` }}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] tracking-widest text-gray-600">
                    *{printModalRecord.palletCode}*
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-3">
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase">Farmer</span>
                  <span className="font-semibold">{printModalRecord.farmerName}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase">Commodity</span>
                  <span className="font-semibold">Kentang (Potatoes)</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase">Official Net Weight</span>
                  <span className="font-bold text-sm text-green-700">
                    {printModalRecord.weightKg.toFixed(3)} kg
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase">Deposit Date</span>
                  <span className="font-semibold">{printModalRecord.depositDate} (Auto)</span>
                </div>
              </div>
            </div>

            <div className="dialog-actions">
              <Button
                variant="outline"
                onClick={() => setPrintModalRecord(null)}
                disabled={isPrinting}
              >
                Close
              </Button>
              <Button
                variant="primary"
                icon="print"
                loading={isPrinting}
                onClick={triggerPhysicalPrint}
              >
                {isPrinting ? 'Printing…' : 'Print Pallet Label'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
