/**
 * Weighing — Receiving Intake Station.
 *
 * Implements the revised pure intake weighing workflow with Focus Mode (Full Screen):
 *   Sequential 3-step workflow:
 *     1. Step 1: Farmer Identification (Scan barcode or select from directory)
 *     2. Step 2: Harvest Weighing (Live gross scale reading via Modbus TCP RS485 indicator)
 *     3. Step 3: Approve & Bag into Waring (WRG-... generation, thermal receipt & waring QR label)
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
import LabelPreview from '../components/operator/LabelPreview'
import { useSessionContext } from '../hooks/useSessionContext'
import { formatWeight } from '../lib/utils'

type WeighingStatus = 'PENDING' | 'BUFFER_WAITING'

type WeighingRecord = {
  id: string
  farmerId: string
  farmerName: string
  farmerVillage?: string
  weightKg: number
  depositDate: string
  time: string
  status: WeighingStatus
  waringCode?: string
}

const FARMERS = [
  { id: 'farmer-1', name: 'Ahmad Santoso', village: 'Dieng, Wonosobo' },
  { id: 'farmer-2', name: 'Budi Prasetyo', village: 'Berastagi, Karo' },
  { id: 'farmer-3', name: 'Siti Rahayu', village: 'Pangalengan, Bandung' },
]

const SCALE_CAPACITY_KG = 150

const nextWaringCode = (index: number) => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `WRG-${date}-${String(index).padStart(4, '0')}`
}

const today = () => new Date().toISOString().slice(0, 10)

const statusTone: Record<WeighingStatus, 'success' | 'warning'> = {
  BUFFER_WAITING: 'success',
  PENDING: 'warning',
}

const STEPS = [
  { id: 1, label: 'Farmer ID' },
  { id: 2, label: 'Weigh Harvest' },
  { id: 3, label: 'Approve & Label' },
] as const

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
      status: 'BUFFER_WAITING',
      waringCode: 'WRG-20261025-0001',
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
  const [waringCounter, setWaringCounter] = useState(2)

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
    setActiveStep(2)
  }

  const handleScanSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setScanError('')
    const query = (manualSearch || scanFarmerId).trim()
    if (!query) {
      setScanError('Please scan or type a Farmer ID / Barcode / Name.')
      return
    }

    const matched = FARMERS.find(
      (f) =>
        f.id.toLowerCase() === query.toLowerCase() ||
        f.name.toLowerCase().includes(query.toLowerCase()) ||
        f.village.toLowerCase().includes(query.toLowerCase()),
    )

    if (matched) {
      selectFarmer(matched)
      setManualSearch('')
    } else {
      const customFarmer = {
        id: `FRM-${String(Math.floor(Math.random() * 9000) + 1000)}`,
        name: query,
        village: 'Dieng, Wonosobo',
      }
      selectFarmer(customFarmer)
      setManualSearch('')
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
  const handleApproveCommit = (): WeighingRecord | null => {
    if (!confirmApprove) return null
    const assignedCode = confirmApprove.waringCode || nextWaringCode(waringCounter)
    if (!confirmApprove.waringCode) {
      setWaringCounter((value) => value + 1)
    }

    const updatedRecord: WeighingRecord = {
      ...confirmApprove,
      status: 'BUFFER_WAITING',
      waringCode: assignedCode,
    }

    setRecords((current) =>
      current.map((item) => (item.id === confirmApprove.id ? updatedRecord : item)),
    )

    toast.success(`Weight approved. Waring ${assignedCode} queued for Buffer Warehouse.`)
    setConfirmApprove(updatedRecord)
    setApprovedSuccessRecord(updatedRecord)
    setPrintModalRecord(updatedRecord)
    return updatedRecord
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
    toast.info('Ready for the next farmer.')
  }

  /* Correction: return to Step 2 with the recorded weight */
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
  const simulatePrint = (message: string, durationMs: number) => {
    setIsPrinting(true)
    window.setTimeout(() => {
      setIsPrinting(false)
      toast.success(message)
    }, durationMs)
  }

  const triggerPrintReceipt = () => {
    if (!printModalRecord) return
    simulatePrint(`Receipt printed for ${printModalRecord.farmerName}`, 800)
  }

  const triggerPrintWaringLabel = () => {
    if (!printModalRecord) return
    simulatePrint(`Waring QR label printed: ${printModalRecord.waringCode}`, 800)
  }

  const triggerPrintBoth = (record: WeighingRecord | null = printModalRecord) => {
    if (!record) return
    simulatePrint(`Receipt and waring label ${record.waringCode} printed`, 1100)
  }

  /* ── Columns for History Table ── */
  const columns: Column<WeighingRecord>[] = [
    {
      key: 'farmerName',
      label: 'Farmer',
      render: (row) => (
        <div>
          <span className="font-semibold block text-foreground">{row.farmerName}</span>
          <span className="font-mono text-xs text-muted-foreground">{row.farmerId}</span>
        </div>
      ),
    },
    {
      key: 'weightKg',
      label: 'Weight kg',
      align: 'right',
      render: (row) => (
        <span className="font-mono font-bold text-base text-foreground">
          {formatWeight(row.weightKg)} kg
        </span>
      ),
    },
    {
      key: 'depositDate',
      label: 'Deposit Date',
      render: (row) => (
        <div>
          <span className="font-mono text-xs block text-foreground">{row.depositDate}</span>
          <span className="text-xs text-muted-foreground">{row.time}</span>
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
      key: 'waringCode',
      label: 'Waring Code',
      render: (row) =>
        row.waringCode ? (
          <span className="font-mono font-medium tabular-nums text-foreground">{row.waringCode}</span>
        ) : (
          <span className="text-xs text-muted-foreground italic">Assigned on approval</span>
        ),
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (row) =>
        row.status === 'PENDING' ? (
          <div className="flex items-center gap-1.5 justify-end">
            <Button
              size="sm"
              variant="primary"
              icon="check"
              onClick={() => {
                setConfirmApprove(row)
                setApprovedSuccessRecord(null)
                setActiveStep(3)
                document.getElementById('weighing-stepper')?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              Approve
            </Button>
            <Button size="sm" variant="outline" icon="refresh" onClick={() => handleKoreksi(row)}>
              Correct
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            icon="print"
            onClick={() => {
              setConfirmApprove(row)
              setPrintModalRecord(row)
              setApprovedSuccessRecord(row)
              setActiveStep(3)
              document.getElementById('weighing-stepper')?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            Reprint
          </Button>
        ),
    },
  ]

  const pendingCount = records.filter((item) => item.status === 'PENDING').length
  const approvedToday = records.filter((item) => item.status === 'BUFFER_WAITING').length

  /* ─────────────────────────────────────────────────────────────
     STEPPER PROGRESS BAR COMPONENT
  ───────────────────────────────────────────────────────────── */
  const renderStepperBar = () => (
    <nav className="flex items-center gap-1 sm:gap-3 bg-muted/40 p-2 sm:px-4 sm:py-2.5 border border-border overflow-x-auto" aria-label="Weighing steps">
      {STEPS.map((step, idx) => {
        const isCurrent = activeStep === step.id
        const isDone = activeStep > step.id || (step.id === 3 && approvedSuccessRecord !== null)

        return (
          <div key={step.id} className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                if (step.id < activeStep || approvedSuccessRecord) {
                  setActiveStep(step.id as 1 | 2 | 3)
                }
              }}
              className={`flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                isCurrent
                  ? 'text-primary'
                  : isDone
                  ? 'text-emerald-700 dark:text-emerald-400 hover:text-emerald-900'
                  : 'text-muted-foreground'
              }`}
            >
              <span
                className={`w-5 h-5 flex items-center justify-center text-[11px] font-mono font-bold ${
                  isCurrent
                    ? 'bg-primary text-primary-foreground'
                    : isDone
                    ? 'bg-emerald-600 text-white'
                    : 'bg-muted border border-border text-muted-foreground'
                }`}
              >
                {isDone ? '✓' : step.id}
              </span>
              <span className="hidden sm:inline">{step.label}</span>
            </button>
            {idx < STEPS.length - 1 && <span className="text-muted-foreground/40 text-xs mx-1">/</span>}
          </div>
        )
      })}
    </nav>
  )

  /* ═══════════════════════════════════════════════════════════════════
     RENDER: Focus Mode & Sequential Stepper Content
     ═══════════════════════════════════════════════════════════════════ */
  const renderFocusContent = () => (
    <div className="space-y-6">
      {/* ── STEP 1: Farmer Identification ── */}
      {activeStep === 1 && (
        <div className="bg-card border border-border rounded-none p-6 shadow-sm space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <span className="text-xs uppercase font-mono font-semibold tracking-wider text-muted-foreground">
                Step 1 of 3 · Intake Identification
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                Scan Farmer Card or Select Farmer
              </h2>
            </div>
            <Badge tone="accent" icon="scan">
              Awaiting Scan
            </Badge>
          </div>

          <form onSubmit={handleScanSubmit} className="space-y-4">
            <div className="p-8 border-2 border-dashed border-primary/30 rounded-none bg-primary/5 text-center space-y-3">
              <Icon name="scan" size={36} className="text-primary mx-auto" />
              <p className="text-sm font-semibold text-foreground">Ready for Barcode Scanner</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
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
                  placeholder="Scan barcode or type name, e.g. farmer-1, Ahmad..."
                  className="text-center font-mono text-base py-3"
                  autoFocus
                />
              </div>
              {scanError && (
                <p className="text-xs text-destructive font-medium mt-2">
                  {scanError}
                </p>
              )}
            </div>

            <div className="flex justify-end">
              <Button type="submit" variant="primary" icon="search" touch>
                Find & Verify Farmer
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ── STEP 2: Harvest Weighing ── */}
      {activeStep === 2 && (
        <div className="bg-card border border-border rounded-none p-6 shadow-sm space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-2">
            <div>
              <span className="text-xs uppercase font-mono font-semibold tracking-wider text-muted-foreground">
                Step 2 of 3 · Live Harvest Intake
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                Weigh Crop Platform
              </h2>
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2 space-y-4">
              <ScaleWeightInput
                id="focus-weighing-weight"
                label="Incoming Harvest Net Weight kg"
                hint="Auto-locks from live scale indicator or type manually."
                value={weightKg}
                onChange={(val) => {
                  setWeightKg(val)
                  setFormError('')
                }}
                capacityKg={SCALE_CAPACITY_KG}
              />
              {formError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-none flex items-center gap-2 font-medium">
                  <Icon name="alert" size={16} />
                  <span>{formError}</span>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-muted/30 border border-border rounded-none space-y-3">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  <Icon name="info" size={14} /> Intake Metadata
                </span>
                <div className="space-y-2 text-sm pt-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Farmer:</span>
                    <span className="font-semibold text-foreground">{farmer?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Commodity:</span>
                    <span className="font-semibold text-foreground">Kentang (Potatoes)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Deposit Date:</span>
                    <span className="font-mono font-semibold text-foreground flex items-center gap-1">
                      {today()} <Badge tone="accent">Auto</Badge>
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Next Waring:</span>
                    <span className="font-mono text-xs font-semibold text-foreground">
                      {nextWaringCode(waringCounter)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Real-time Waring Label Preview */}
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                  Live Waring QR Preview
                </span>
                <LabelPreview
                  type="waring"
                  code={nextWaringCode(waringCounter)}
                  farmerName={farmer?.name}
                  farmerId={farmer?.id}
                  weightKg={Number(weightKg) > 0 ? Number(weightKg) : undefined}
                  compact
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-4">
            <Button variant="outline" onClick={() => setActiveStep(1)}>
              Back to Farmer
            </Button>
            <Button
              variant="primary"
              icon="check"
              touch
              disabled={!(Number(weightKg) > 0)}
              onClick={handleProceedToApproval}
            >
              Approve & Print
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Approve & Print Label ── */}
      {activeStep === 3 && (
        <div className="bg-card border border-border rounded-none p-6 shadow-sm space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-2">
            <div>
              <span className="text-xs uppercase font-mono font-semibold tracking-wider text-muted-foreground">
                Step 3 of 3 · Final Verification & Print
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                Approve & Print Intake Label
              </h2>
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
          <div className="p-4 bg-muted/30 border border-border rounded-none grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <span className="text-xs text-muted-foreground block font-medium">Farmer</span>
              <span className="font-semibold text-base text-foreground block">
                {confirmApprove?.farmerName ?? farmer?.name}
              </span>
              <span className="font-mono text-xs text-muted-foreground block">
                {confirmApprove?.farmerId ?? farmer?.id}
              </span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block font-medium">Harvest Net Weight</span>
              <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 block tracking-tight">
                {formatWeight(confirmApprove?.weightKg ?? weightKg)}
                <span className="text-sm font-normal text-muted-foreground ml-1">kg</span>
              </span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block font-medium">Deposit Date</span>
              <span className="font-mono font-semibold text-foreground block">{today()}</span>
              <span className="text-xs text-muted-foreground block">System timestamped</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block font-medium">Assigned Waring ID</span>
              <span className="font-mono font-bold text-base text-primary block">
                {approvedSuccessRecord?.waringCode ?? confirmApprove?.waringCode ?? nextWaringCode(waringCounter)}
              </span>
              <span className="text-xs text-muted-foreground block">QR Waring Label</span>
            </div>
          </div>

          {/* Print Previews */}
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Print view mode">
              <button
                type="button"
                onClick={() => setPrintTab('both')}
                className={`px-3 py-1.5 rounded-none border text-xs font-medium transition-colors cursor-pointer ${
                  printTab === 'both'
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted'
                }`}
              >
                Both (Receipt + Label)
              </button>
              <button
                type="button"
                onClick={() => setPrintTab('receipt')}
                className={`px-3 py-1.5 rounded-none border text-xs font-medium transition-colors cursor-pointer ${
                  printTab === 'receipt'
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted'
                }`}
              >
                Farmer Receipt Slip
              </button>
              <button
                type="button"
                onClick={() => setPrintTab('label')}
                className={`px-3 py-1.5 rounded-none border text-xs font-medium transition-colors cursor-pointer ${
                  printTab === 'label'
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted'
                }`}
              >
                QR Waring Label
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {/* Receipt Preview */}
              {(printTab === 'both' || printTab === 'receipt') && (
                <LabelPreview
                  type="receipt"
                  code={approvedSuccessRecord?.waringCode ?? confirmApprove?.waringCode ?? nextWaringCode(waringCounter)}
                  farmerName={confirmApprove?.farmerName ?? farmer?.name}
                  farmerId={confirmApprove?.farmerId ?? farmer?.id}
                  weightKg={confirmApprove?.weightKg ?? Number(weightKg)}
                  time={confirmApprove?.time ?? 'Live'}
                  date={today()}
                />
              )}

              {/* Waring Label Preview */}
              {(printTab === 'both' || printTab === 'label') && (
                <LabelPreview
                  type="waring"
                  code={approvedSuccessRecord?.waringCode ?? confirmApprove?.waringCode ?? nextWaringCode(waringCounter)}
                  farmerName={confirmApprove?.farmerName ?? farmer?.name}
                  farmerId={confirmApprove?.farmerId ?? farmer?.id}
                  weightKg={confirmApprove?.weightKg ?? Number(weightKg)}
                  date={today()}
                />
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
                  Correct Weight
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
                    Approve & Print All
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Button variant="outline" icon="print" loading={isPrinting} onClick={triggerPrintReceipt}>
                    Re-print Receipt
                  </Button>
                  <Button variant="outline" icon="print" loading={isPrinting} onClick={triggerPrintWaringLabel}>
                    Re-print Waring Label
                  </Button>
                </div>
                <Button variant="primary" icon="check" touch onClick={handleNextWeighing}>
                  Next Weighing
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
        <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-y-auto" role="dialog" aria-modal="true" aria-label="Weighing Focus Mode">
          <header className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-card/95 backdrop-blur border-b border-border shadow-sm">
            <div className="flex items-center gap-3">
              <Logo className="h-7 w-auto" markOnly />
              <div>
                <div className="font-display text-lg leading-none tracking-wider text-foreground">
                  ENYX-ENTERPRISE
                </div>
                <div className="font-mono text-[9px] text-muted-foreground tracking-[0.2em] uppercase mt-0.5">
                  STATION 01 · RECEPTION · FOCUS MODE
                </div>
              </div>
            </div>

            {/* Stepper Progress */}
            <div className="hidden md:flex">
              {renderStepperBar()}
            </div>

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
                Exit Focus
              </Button>
            </div>
          </header>

          <main className="flex-1 p-4 md:p-8 max-w-5xl w-full mx-auto space-y-6">
            <div className="md:hidden">
              {renderStepperBar()}
            </div>
            {renderFocusContent()}
          </main>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
         STANDARD DASHBOARD VIEW (Non-focus mode)
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="space-y-6">
        <PageHeader
          title="Station 01: Reception"
          subtitle="Farmer verification, intake weighing, and buffer queue."
          actions={
            <div className="flex items-center gap-2">
              <Button variant="primary" icon="expand" touch onClick={enterFocusMode}>
                Focus Mode
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon="history"
                onClick={() => document.getElementById('weighing-records')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Records ({records.length})
              </Button>
            </div>
          }
        />

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-none p-4 shadow-sm space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Pending approval</p>
            <p className="text-2xl font-bold tracking-tight text-foreground">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">Awaiting verification</p>
          </div>
          <div className="bg-card border border-border rounded-none p-4 shadow-sm space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Approved today</p>
            <p className="text-2xl font-bold tracking-tight text-foreground">{approvedToday}</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              Approved warings
            </p>
          </div>
          <div className="bg-card border border-border rounded-none p-4 shadow-sm space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Scale Capacity</p>
            <p className="text-2xl font-bold tracking-tight text-foreground">{SCALE_CAPACITY_KG} kg</p>
            <p className="text-xs text-muted-foreground">Scale 01</p>
          </div>
          <div className="bg-card border border-border rounded-none p-4 shadow-sm space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Workflow Mode</p>
            <p className="text-lg font-bold tracking-tight text-foreground">Sequential</p>
            <p className="text-xs text-muted-foreground">Step 1 to 3</p>
          </div>
        </div>

        {/* Sequential Stepper in Standard View */}
        <div id="weighing-stepper" className="bg-card border border-border rounded-none p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-base text-foreground">Reception Stepper</span>
              <Badge tone="accent">Step {activeStep} of 3</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="success" dot live>
                Port 502 · Online
              </Badge>
              <Button size="sm" variant="outline" icon="expand" onClick={enterFocusMode}>
                Open Focus Mode
              </Button>
            </div>
          </div>

          {/* Stepper Navigation Bar */}
          {renderStepperBar()}

          {/* Embed the same sequential step logic */}
          {renderFocusContent()}
        </div>

        {/* ── Today's Harvest Weighing Records Ledger ── */}
        <div id="weighing-records" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight text-foreground">Today's Reception Records</h2>
            <span className="text-xs text-muted-foreground font-mono">
              {pendingCount} pending · {approvedToday} approved
            </span>
          </div>
          <DataTable
            columns={columns}
            data={records}
            rowKey={(row) => row.id}
            emptyTitle="No harvest records today."
            emptyDescription="Select a farmer and record the first intake weighing."
          />
        </div>
      </div>
    </>
  )
}
