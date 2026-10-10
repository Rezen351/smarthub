/**
 * Weighing — Area Penerimaan (Receiving Intake Station).
 *
 * Implements the revised pure intake weighing workflow with Focus Mode (Full Screen):
 *   Sequential 3-step workflow:
 *     1. Step 1: Farmer Identification (Scan barcode or select from directory)
 *     2. Step 2: Harvest Weighing (Live scale reading via Modbus TCP/MQTT or manual)
 *     3. Step 3: Approve & Print Label (Pallet ID generation, farmer receipt & pallet QR label)
 *
 * Weight transmitter network configuration is managed in Configuration (Settings).
 */
import { useState, useEffect, useRef } from 'react'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import Icon from '../components/shared/Icon'
import Logo from '../components/shared/Logo'
import { Input } from '../components/shared/Form'
import DataTable, { type Column } from '../components/shared/DataTable'
import PageHeader from '../components/shared/PageHeader'
import { useToast } from '../components/feedback/Toast'
import ScaleWeightInput from '../components/operator/ScaleWeightInput'
import { useSessionContext } from '../hooks/useSessionContext'

type WeighingStatus = 'PENDING' | 'APPROVED'

type WeighingRecord = {
  id: string
  farmerId: string
  farmerName: string
  farmerVillage?: string
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

  /* ── Mode State ── */
  const [focusMode, setFocusMode] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1)

  /* ── Step 1: Scan & Farmer Identification ── */
  const [scanFarmerId, setScanFarmerId] = useState('')
  const [manualSearch, setManualSearch] = useState('')
  const [scanError, setScanError] = useState('')
  const scanInputRef = useRef<HTMLInputElement>(null)

  /* ── Step 2: Weighing Form ── */
  const [weightKg, setWeightKg] = useState('')
  const [formError, setFormError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  /* ── Step 3: Approval & Print State ── */
  const [confirmApprove, setConfirmApprove] = useState<WeighingRecord | null>(null)
  const [printModalRecord, setPrintModalRecord] = useState<WeighingRecord | null>(null)
  const [approvedSuccessRecord, setApprovedSuccessRecord] = useState<WeighingRecord | null>(null)
  const [isPrinting, setIsPrinting] = useState(false)
  const [printTab, setPrintTab] = useState<'both' | 'receipt' | 'label'>('both')

  /* ── Records Ledger ── */
  const [records, setRecords] = useState<WeighingRecord[]>([
    {
      id: '1',
      farmerId: 'farmer-1',
      farmerName: 'Ahmad Santoso',
      farmerVillage: 'Dieng, Wonosobo',
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
      farmerVillage: 'Berastagi, Karo',
      weightKg: 38.2,
      depositDate: today(),
      time: '09:45',
      status: 'PENDING',
    },
  ])
  const [palletCounter, setPalletCounter] = useState(2)

  /* Auto-focus scanner input in Step 1 */
  useEffect(() => {
    if (activeStep === 1) {
      const timer = window.setTimeout(() => {
        scanInputRef.current?.focus()
      }, 100)
      return () => window.clearTimeout(timer)
    }
  }, [activeStep, focusMode])

  /* Fullscreen & Esc handler */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && focusMode) {
        setFocusMode(false)
        if (document.fullscreenElement) {
          document.exitFullscreen?.().catch(() => {})
        }
      }
    }
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }

    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [focusMode])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {})
    } else {
      document.exitFullscreen?.().catch(() => {})
    }
  }

  const enterFocusMode = () => {
    setFocusMode(true)
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {})
    }
  }

  const exitFocusMode = () => {
    setFocusMode(false)
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {})
    }
  }

  /* ── Step 1: Handle Farmer Identification ── */
  const selectFarmer = (targetFarmer: (typeof FARMERS)[number]) => {
    setScanError('')
    startScan({ id: targetFarmer.id, name: targetFarmer.name })
    setScanFarmerId(targetFarmer.id)
    toast.success(`Farmer verified: ${targetFarmer.name}`)
    // Advance directly to Step 2
    setActiveStep(2)
  }

  const handleScanSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setScanError('')
    const query = (manualSearch || scanFarmerId).trim().toLowerCase()
    if (!query) {
      setScanError('Please scan or type a Farmer ID / Barcode.')
      return
    }

    const matched = FARMERS.find(
      (f) =>
        f.id.toLowerCase() === query ||
        f.name.toLowerCase().includes(query) ||
        f.village.toLowerCase().includes(query),
    )

    if (matched) {
      selectFarmer(matched)
      setManualSearch('')
    } else {
      setScanError(`No farmer found matching "${query}". Select from the list below.`)
    }
  }

  /* ── Step 2: Handle Weight Commitment ── */
  const handleProceedToApproval = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setFormError('')

    if (!active || !farmer) {
      setFormError('Farmer context is required. Please go back to Step 1.')
      setActiveStep(1)
      return
    }

    const numericWeight = Number(weightKg)
    if (!(numericWeight > 0)) {
      setFormError('Weight must be greater than 0 kg.')
      return
    }
    if (numericWeight > SCALE_CAPACITY_KG) {
      setFormError(`Weight exceeds scale capacity of ${SCALE_CAPACITY_KG} kg.`)
      return
    }

    const activeFarmerObj = FARMERS.find((f) => f.id === farmer.id)
    const payload: WeighingRecord = {
      id: editingId ?? String(Date.now()),
      farmerId: farmer.id,
      farmerName: farmer.name,
      farmerVillage: activeFarmerObj?.village ?? 'Dieng, Wonosobo',
      weightKg: Number(numericWeight.toFixed(3)),
      depositDate: today(),
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      status: 'PENDING',
    }

    if (editingId) {
      setRecords((current) => current.map((item) => (item.id === editingId ? payload : item)))
      setEditingId(null)
    } else {
      setRecords((current) => [payload, ...current])
    }

    setConfirmApprove(payload)
    setActiveStep(3)
  }

  /* ── Step 3: Handle Approval & Print ── */
  const handleApproveCommit = () => {
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
    setApprovedSuccessRecord(updatedRecord)
    setPrintModalRecord(updatedRecord)
  }

  /* Reset for next farmer weighing */
  const handleNextWeighing = () => {
    setWeightKg('')
    setFormError('')
    setScanError('')
    setManualSearch('')
    setScanFarmerId('')
    setConfirmApprove(null)
    setApprovedSuccessRecord(null)
    setPrintModalRecord(null)
    setActiveStep(1)
    toast.info('Ready for next farmer intake.')
  }

  /* Koreksi: return to Step 2 */
  const handleKoreksi = (record: WeighingRecord) => {
    setEditingId(record.id)
    setWeightKg(String(record.weightKg))
    setConfirmApprove(null)
    setApprovedSuccessRecord(null)
    setPrintModalRecord(null)
    setActiveStep(2)
    toast.warning('Record loaded back for re-weighing.')
  }

  /* ── Print Actions ── */
  const triggerPrintReceipt = () => {
    if (!printModalRecord) return
    setIsPrinting(true)
    setTimeout(() => {
      setIsPrinting(false)
      toast.success(`Receipt printed for ${printModalRecord.farmerName}`)
    }, 800)
  }

  const triggerPrintPalletLabel = () => {
    if (!printModalRecord) return
    setIsPrinting(true)
    setTimeout(() => {
      setIsPrinting(false)
      toast.success(`Pallet QR Label printed: ${printModalRecord.palletCode}`)
    }, 800)
  }

  const triggerPrintBoth = () => {
    if (!printModalRecord) return
    setIsPrinting(true)
    setTimeout(() => {
      setIsPrinting(false)
      toast.success(`Both printed: Receipt & Pallet Label ${printModalRecord.palletCode}`)
    }, 1100)
  }

  /* ── Columns for History Table ── */
  const columns: Column<WeighingRecord>[] = [
    {
      key: 'farmerName',
      label: 'Farmer',
      render: (row) => (
        <div>
          <span className="font-semibold block">{row.farmerName}</span>
          <span className="mono t-caption text-text-secondary">{row.farmerId}</span>
        </div>
      ),
    },
    {
      key: 'weightKg',
      label: 'Weight (kg)',
      align: 'right',
      render: (row) => <span className="mono font-bold text-base">{row.weightKg.toFixed(3)} kg</span>,
    },
    {
      key: 'depositDate',
      label: 'Deposit Date',
      render: (row) => (
        <div>
          <span className="mono t-small block">{row.depositDate}</span>
          <span className="t-caption text-text-light">{row.time}</span>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge tone={statusTone[row.status]} dot>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'palletCode',
      label: 'Pallet Code',
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
            <Button
              size="sm"
              variant="primary"
              icon="check"
              onClick={() => {
                setConfirmApprove(row)
                setActiveStep(3)
              }}
            >
              Approve
            </Button>
            <Button size="sm" variant="outline" icon="refresh" onClick={() => handleKoreksi(row)}>
              Koreksi
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            icon="print"
            onClick={() => {
              setPrintModalRecord(row)
              setApprovedSuccessRecord(row)
            }}
          >
            Print Label
          </Button>
        ),
    },
  ]

  const pendingCount = records.filter((item) => item.status === 'PENDING').length
  const approvedToday = records.filter((item) => item.status === 'APPROVED').length

  /* ═══════════════════════════════════════════════════════════════════
     RENDER: Focus Mode (Full Screen Sequential Workflow)
     ═══════════════════════════════════════════════════════════════════ */
  const renderFocusContent = () => (
    <div className="focus-content">
      {/* ── STEP 1: Farmer Identification ── */}
      {activeStep === 1 && (
        <div className="focus-card animate-fade-in">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <span className="t-caption text-text-secondary uppercase font-mono font-semibold tracking-wider">
                Step 1 of 3 · Intake Identification
              </span>
              <h2 className="t-h2 mt-0.5">Scan Farmer Card or Select Farmer</h2>
            </div>
            <Badge tone="accent" icon="scan">
              Awaiting Scan
            </Badge>
          </div>

          <form onSubmit={handleScanSubmit} className="stack-md">
            <div className="focus-scan-box is-focused">
              <Icon name="scan" size={36} className="text-accent mx-auto mb-2" />
              <p className="t-small font-semibold">Ready for Barcode Scanner</p>
              <p className="t-caption text-text-secondary mb-3">
                Scan barcode on the farmer ID card, or enter ID / name manually.
              </p>
              <div className="max-w-md mx-auto">
                <Input
                  ref={scanInputRef}
                  value={manualSearch}
                  onChange={(e) => {
                    setManualSearch(e.target.value)
                    setScanError('')
                  }}
                  placeholder="Scan barcode or type name (e.g. farmer-1, Ahmad)..."
                  className="input-lg text-center font-mono"
                  autoFocus
                />
              </div>
              {scanError && (
                <p className="t-caption text-danger mt-2 font-medium">
                  {scanError}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button type="submit" variant="primary" icon="search" touch>
                Find & Verify Farmer
              </Button>
            </div>
          </form>

          <div className="pt-2">
            <p className="t-caption text-text-secondary font-semibold uppercase mb-2">
              Or Select Registered Farmer
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-sm">
              {FARMERS.map((f) => {
                const isSelected = active && farmer?.id === f.id
                return (
                  <button
                    key={f.id}
                    type="button"
                    className={`card p-3 text-left transition-all cursor-pointer hover:border-accent ${
                      isSelected ? 'border-accent bg-accent-soft' : ''
                    }`}
                    onClick={() => selectFarmer(f)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="avatar avatar-sm">{f.name.charAt(0)}</span>
                      <div className="min-w-0">
                        <p className="t-small font-semibold text-truncate">{f.name}</p>
                        <p className="t-caption text-text-secondary text-truncate">{f.village}</p>
                        <span className="t-caption mono text-text-light">{f.id}</span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 2: Harvest Weighing ── */}
      {activeStep === 2 && (
        <div className="focus-card animate-fade-in">
          <div className="flex items-center justify-between border-b border-border pb-3 flex-wrap gap-2">
            <div>
              <span className="t-caption text-text-secondary uppercase font-mono font-semibold tracking-wider">
                Step 2 of 3 · Live Harvest Intake
              </span>
              <h2 className="t-h2 mt-0.5">Weigh Crop Platform</h2>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="success" dot>
                Farmer: {farmer?.name}
              </Badge>
              <Button size="sm" variant="ghost" icon="edit" onClick={() => setActiveStep(1)}>
                Change Farmer
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-md items-start">
            <div className="lg:col-span-2">
              <ScaleWeightInput
                id="focus-weighing-weight"
                label="Incoming Harvest Net Weight (kg)"
                hint="Auto-locks from live scale indicator or type manually."
                value={weightKg}
                onChange={(val) => {
                  setWeightKg(val)
                  setFormError('')
                }}
                capacityKg={SCALE_CAPACITY_KG}
              />
              {formError && (
                <div className="alert alert-danger mt-3" role="alert">
                  <Icon name="alert" size={16} />
                  <span>{formError}</span>
                </div>
              )}
            </div>

            <div className="p-4 bg-surface-2 border border-border rounded-lg stack-sm">
              <span className="t-caption text-text-secondary font-semibold uppercase flex items-center gap-1">
                <Icon name="info" size={14} /> Intake Metadata
              </span>
              <div className="stack-xs text-sm pt-1">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Farmer:</span>
                  <span className="font-semibold">{farmer?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Commodity:</span>
                  <span className="font-semibold">Kentang (Potatoes)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Deposit Date:</span>
                  <span className="font-mono font-semibold">
                    {today()} <Badge tone="accent">Auto</Badge>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Next Pallet:</span>
                  <span className="mono text-xs">{nextPalletCode(palletCounter)}</span>
                </div>
              </div>
              <p className="t-caption text-text-light pt-2 border-t border-border mt-2">
                Deposit date is assigned automatically by the system. Pallet ID is officially bound upon approval.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-4">
            <Button variant="outline" icon="arrow-up" onClick={() => setActiveStep(1)}>
              ← Back to Farmer
            </Button>
            <Button
              variant="primary"
              icon="arrow-down"
              touch
              disabled={!(Number(weightKg) > 0)}
              onClick={handleProceedToApproval}
            >
              Proceed to Approval & Print →
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Approve & Print Label ── */}
      {activeStep === 3 && (
        <div className="focus-card animate-fade-in">
          <div className="flex items-center justify-between border-b border-border pb-3 flex-wrap gap-2">
            <div>
              <span className="t-caption text-text-secondary uppercase font-mono font-semibold tracking-wider">
                Step 3 of 3 · Final Verification & Print
              </span>
              <h2 className="t-h2 mt-0.5">Approve & Print Intake Label</h2>
            </div>
            {approvedSuccessRecord ? (
              <Badge tone="success" dot>
                Status: APPROVED & LABELED
              </Badge>
            ) : (
              <Badge tone="warning" dot>
                Status: PENDING OPERATOR APPROVAL
              </Badge>
            )}
          </div>

          {/* Intake Verification Box */}
          <div className="p-4 bg-surface-2 border border-border rounded-lg grid grid-cols-1 sm:grid-cols-4 gap-md">
            <div>
              <span className="t-caption text-text-secondary block">Farmer</span>
              <span className="cell-strong text-base">{confirmApprove?.farmerName ?? farmer?.name}</span>
              <span className="t-caption mono text-text-light block">{confirmApprove?.farmerId ?? farmer?.id}</span>
            </div>
            <div>
              <span className="t-caption text-text-secondary block">Harvest Net Weight</span>
              <span className="focus-big-number block text-3xl font-black text-green-700">
                {confirmApprove?.weightKg.toFixed(3) ?? Number(weightKg).toFixed(3)}
                <span className="text-sm font-normal text-text-secondary ml-1">kg</span>
              </span>
            </div>
            <div>
              <span className="t-caption text-text-secondary block">Deposit Date</span>
              <span className="mono font-semibold">{today()}</span>
              <span className="t-caption text-text-light block">System timestamped</span>
            </div>
            <div>
              <span className="t-caption text-text-secondary block">Assigned Pallet ID</span>
              <span className="mono font-bold text-base text-accent">
                {approvedSuccessRecord?.palletCode ?? confirmApprove?.palletCode ?? nextPalletCode(palletCounter)}
              </span>
              <span className="t-caption text-text-light block">QR Pallet Label</span>
            </div>
          </div>

          {/* Print Previews */}
          <div className="stack-sm">
            <div className="radio-row" role="group" aria-label="Print view mode">
              <label className={`radio-card ${printTab === 'both' ? 'is-active' : ''}`}>
                <input
                  type="radio"
                  name="focusPrintTab"
                  value="both"
                  checked={printTab === 'both'}
                  onChange={() => setPrintTab('both')}
                />
                Both (Receipt + Label)
              </label>
              <label className={`radio-card ${printTab === 'receipt' ? 'is-active' : ''}`}>
                <input
                  type="radio"
                  name="focusPrintTab"
                  value="receipt"
                  checked={printTab === 'receipt'}
                  onChange={() => setPrintTab('receipt')}
                />
                Farmer Receipt Slip
              </label>
              <label className={`radio-card ${printTab === 'label' ? 'is-active' : ''}`}>
                <input
                  type="radio"
                  name="focusPrintTab"
                  value="label"
                  checked={printTab === 'label'}
                  onChange={() => setPrintTab('label')}
                />
                QR Pallet Box Label
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-md pt-2">
              {/* Receipt Preview */}
              {(printTab === 'both' || printTab === 'receipt') && (
                <div className="p-4 rounded-lg bg-white text-black border border-gray-300 font-mono shadow-sm">
                  <div className="text-center pb-2 border-b border-dashed border-gray-400">
                    <span className="text-[11px] font-bold tracking-wider uppercase block text-gray-800">
                      ENYX-SMART HUB · RECEIVING INTAKE SLIP
                    </span>
                    <span className="text-[10px] text-gray-500 block">
                      OFFICIAL WEIGHING RECEIPT (BUKTI TIMBANG RESMI)
                    </span>
                    <span className="text-xs font-semibold text-gray-700 block mt-1">
                      {today()} · {confirmApprove?.time ?? 'Live'}
                    </span>
                  </div>
                  <div className="py-2 border-b border-dashed border-gray-300 text-xs stack-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Farmer:</span>
                      <span className="font-bold">{confirmApprove?.farmerName ?? farmer?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Pallet Code:</span>
                      <span className="mono font-semibold">
                        {approvedSuccessRecord?.palletCode ?? confirmApprove?.palletCode ?? nextPalletCode(palletCounter)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Commodity:</span>
                      <span>Kentang (Potatoes)</span>
                    </div>
                  </div>
                  <div className="py-3 border-b border-dashed border-gray-400 text-center">
                    <span className="text-[10px] uppercase text-gray-500 block">OFFICIAL NET WEIGHT</span>
                    <span className="text-2xl font-black text-green-800 block">
                      {(confirmApprove?.weightKg ?? Number(weightKg)).toFixed(3)} kg
                    </span>
                    <span className="text-[10px] text-green-700 font-bold block uppercase">
                      {approvedSuccessRecord ? 'Status: APPROVED (VERIFIED)' : 'Ready for Approval'}
                    </span>
                  </div>
                  <div className="pt-2 text-[10px] text-gray-500 text-center italic">
                    * Simpan tanda terima ini sebagai bukti timbang resmi petani. *
                  </div>
                </div>
              )}

              {/* Pallet Label Preview */}
              {(printTab === 'both' || printTab === 'label') && (
                <div className="p-4 rounded-lg bg-white text-black border-2 border-dashed border-gray-400 font-mono shadow-sm">
                  <div className="text-center pb-2 border-b border-gray-300">
                    <span className="text-xs uppercase tracking-wider font-bold block text-gray-700">
                      E-Tani Smart Hub · Receiving Pallet
                    </span>
                    <span className="text-xl font-bold tracking-tight block text-gray-900 mt-1">
                      {approvedSuccessRecord?.palletCode ?? confirmApprove?.palletCode ?? nextPalletCode(palletCounter)}
                    </span>
                  </div>
                  <div className="flex items-center justify-center py-3 border-b border-gray-200">
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex gap-1 h-9 items-center justify-center px-4 bg-gray-100 rounded">
                        {[3, 1, 4, 2, 1, 3, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 2].map((w, idx) => (
                          <span key={idx} className="bg-black inline-block h-7" style={{ width: `${w * 2}px` }} />
                        ))}
                      </div>
                      <span className="text-[10px] tracking-widest text-gray-600">
                        *{approvedSuccessRecord?.palletCode ?? confirmApprove?.palletCode ?? nextPalletCode(palletCounter)}*
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs pt-2">
                    <div>
                      <span className="text-gray-500 block text-[10px]">Farmer</span>
                      <span className="font-semibold">{confirmApprove?.farmerName ?? farmer?.name}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-[10px]">Weight</span>
                      <span className="font-bold text-green-700">
                        {(confirmApprove?.weightKg ?? Number(weightKg)).toFixed(3)} kg
                      </span>
                    </div>
                  </div>
                  <div className="pt-2 text-[10px] text-gray-500 text-center border-t border-gray-200 mt-2">
                    Tempel label ini pada box/palet fisik intake sebelum sortir.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between border-t border-border pt-4 flex-wrap gap-2">
            {!approvedSuccessRecord ? (
              <>
                <Button
                  variant="outline"
                  icon="refresh"
                  onClick={() => confirmApprove && handleKoreksi(confirmApprove)}
                >
                  ← Koreksi Weight
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    icon="check"
                    touch
                    loading={isPrinting}
                    onClick={() => {
                      handleApproveCommit()
                      triggerPrintBoth()
                    }}
                  >
                    Approve & Print All (Receipt + Label)
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Button variant="outline" icon="print" loading={isPrinting} onClick={triggerPrintReceipt}>
                    Re-print Receipt
                  </Button>
                  <Button variant="outline" icon="print" loading={isPrinting} onClick={triggerPrintPalletLabel}>
                    Re-print Pallet Label
                  </Button>
                </div>
                <Button variant="primary" icon="check" touch onClick={handleNextWeighing}>
                  Next Weighing / Timbang Berikutnya ⏎
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════════════
         FULLSCREEN FOCUS MODE OVERLAY
         ═══════════════════════════════════════════════════════════════════ */}
      {focusMode && (
        <div className="focus-overlay" role="dialog" aria-modal="true" aria-label="Weighing Focus Mode">
          <header className="focus-header">
            <div className="flex items-center gap-3">
              <Logo className="h-6 w-auto" markOnly />
              <div>
                <span className="font-semibold text-sm block leading-none">Receiving Intake Station</span>
                <span className="text-[10px] text-text-light font-mono">Focus Mode · Distraction Free</span>
              </div>
            </div>

            {/* Stepper Progress */}
            <nav className="focus-stepper" aria-label="Weighing steps">
              <div className={`focus-step ${activeStep === 1 ? 'is-active' : activeStep > 1 ? 'is-done' : ''}`}>
                <span className="focus-step-num">{activeStep > 1 ? '✓' : '1'}</span>
                <span>Farmer ID</span>
              </div>
              <div className="focus-stepper-sep" />
              <div className={`focus-step ${activeStep === 2 ? 'is-active' : activeStep > 2 ? 'is-done' : ''}`}>
                <span className="focus-step-num">{activeStep > 2 ? '✓' : '2'}</span>
                <span>Weigh Harvest</span>
              </div>
              <div className="focus-stepper-sep" />
              <div className={`focus-step ${activeStep === 3 ? 'is-active' : approvedSuccessRecord ? 'is-done' : ''}`}>
                <span className="focus-step-num">{approvedSuccessRecord ? '✓' : '3'}</span>
                <span>Approve & Label</span>
              </div>
            </nav>

            {/* Controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                icon={isFullscreen ? 'compress' : 'expand'}
                onClick={toggleFullscreen}
                title="Toggle Fullscreen"
              >
                {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              </Button>
              <Button variant="outline" size="sm" icon="close" onClick={exitFocusMode}>
                Exit Focus (Esc)
              </Button>
            </div>
          </header>

          {renderFocusContent()}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
         STANDARD DASHBOARD VIEW (Non-focus mode)
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="stack stack-lg">
        <PageHeader
          title="Weighing Station"
          subtitle="Receiving area — identify farmer, weigh harvest intake (pure weighing), approve to generate pallet and print label."
          actions={
            <div className="flex items-center gap-2">
              <Button variant="primary" icon="expand" touch onClick={enterFocusMode}>
                Focus Mode (Full Screen)
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon="history"
                onClick={() => document.getElementById('weighing-records')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Today's records ({records.length})
              </Button>
            </div>
          }
        />

        {/* Quick Stats Grid */}
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
            <p className="stat-label">Scale Capacity</p>
            <p className="stat-value">{SCALE_CAPACITY_KG}</p>
            <p className="stat-sub">kg maximum load</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Workflow Mode</p>
            <p className="stat-value" style={{ fontSize: 20 }}>
              Sequential
            </p>
            <p className="stat-sub">Step 1 → Step 2 → Step 3</p>
          </div>
        </div>

        {/* Sequential Stepper in Standard View */}
        <div className="card p-4 border border-border stack-md">
          <div className="flex items-center justify-between border-b border-border pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-base">Sequential Intake Stepper</span>
              <Badge tone="accent">Step {activeStep} of 3</Badge>
            </div>
            <Button size="sm" variant="outline" icon="expand" onClick={enterFocusMode}>
              Open in Focus Mode (Full Screen)
            </Button>
          </div>

          {/* Embed the same sequential step logic */}
          {renderFocusContent()}
        </div>

        {/* ── Today's Harvest Weighing Records Ledger ── */}
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
      </div>
    </>
  )
}
