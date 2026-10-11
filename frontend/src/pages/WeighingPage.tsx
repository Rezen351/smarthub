/**
 * Weighing — Receiving Intake Station.
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
import LabelPreview from '../components/operator/LabelPreview'
import { useSessionContext } from '../hooks/useSessionContext'
import { formatWeight } from '../lib/utils'

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

    toast.success(`Weight approved. Pallet ${assignedCode} created.`)
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

  const triggerPrintPalletLabel = () => {
    if (!printModalRecord) return
    simulatePrint(`Pallet label printed: ${printModalRecord.palletCode}`, 800)
  }

  const triggerPrintBoth = (record: WeighingRecord | null = printModalRecord) => {
    if (!record) return
    simulatePrint(`Receipt and pallet label ${record.palletCode} printed`, 1100)
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
      label: 'Weight (kg)',
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
      key: 'palletCode',
      label: 'Pallet Code',
      render: (row) =>
        row.palletCode ? (
          <span className="font-mono font-medium tabular-nums text-foreground">{row.palletCode}</span>
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
  const approvedToday = records.filter((item) => item.status === 'APPROVED').length

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
                  placeholder="Scan barcode or type name (e.g. farmer-1, Ahmad)..."
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
                    <span className="text-muted-foreground">Next Pallet:</span>
                    <span className="font-mono text-xs font-semibold text-foreground">
                      {nextPalletCode(palletCounter)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Real-time Pallet Label Preview */}
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                  Live Pallet Label Preview
                </span>
                <LabelPreview
                  type="pallet"
                  code={nextPalletCode(palletCounter)}
                  farmerName={farmer?.name}
                  farmerId={farmer?.id}
                  weightKg={Number(weightKg) > 0 ? Number(weightKg) : undefined}
                  compact
                />
              </div>
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
              Approve & Print →
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
              <span className="text-xs text-muted-foreground block font-medium">Assigned Pallet ID</span>
              <span className="font-mono font-bold text-base text-primary block">
                {approvedSuccessRecord?.palletCode ?? confirmApprove?.palletCode ?? nextPalletCode(palletCounter)}
              </span>
              <span className="text-xs text-muted-foreground block">QR Pallet Label</span>
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
                QR Pallet Box Label
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {/* Receipt Preview */}
              {(printTab === 'both' || printTab === 'receipt') && (
                <LabelPreview
                  type="receipt"
                  code={approvedSuccessRecord?.palletCode ?? confirmApprove?.palletCode ?? nextPalletCode(palletCounter)}
                  farmerName={confirmApprove?.farmerName ?? farmer?.name}
                  farmerId={confirmApprove?.farmerId ?? farmer?.id}
                  weightKg={confirmApprove?.weightKg ?? Number(weightKg)}
                  time={confirmApprove?.time ?? 'Live'}
                  date={today()}
                />
              )}

              {/* Pallet Label Preview */}
              {(printTab === 'both' || printTab === 'label') && (
                <LabelPreview
                  type="pallet"
                  code={approvedSuccessRecord?.palletCode ?? confirmApprove?.palletCode ?? nextPalletCode(palletCounter)}
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
                  ← Correct Weight
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
                  <Button variant="outline" icon="print" loading={isPrinting} onClick={triggerPrintPalletLabel}>
                    Re-print Pallet Label
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
                  RECEIVING INTAKE · FOCUS MODE
                </div>
              </div>
            </div>

            {/* Stepper Progress */}
            <nav className="hidden md:flex items-center gap-3 bg-muted/50 px-4 py-2 rounded-none border border-border" aria-label="Weighing steps">
              <div className={`flex items-center gap-2 text-xs font-semibold ${
                activeStep === 1 ? 'text-primary' : activeStep > 1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
              }`}>
                <span className={`w-5 h-5 rounded-none flex items-center justify-center text-[11px] font-mono font-bold ${
                  activeStep === 1 ? 'bg-primary text-primary-foreground' : activeStep > 1 ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground'
                }`}>{activeStep > 1 ? '✓' : '1'}</span>
                <span>Farmer ID</span>
              </div>

              <span className="text-muted-foreground/40 text-xs">/</span>

              <div className={`flex items-center gap-2 text-xs font-semibold ${
                activeStep === 2 ? 'text-primary' : activeStep > 2 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
              }`}>
                <span className={`w-5 h-5 rounded-none flex items-center justify-center text-[11px] font-mono font-bold ${
                  activeStep === 2 ? 'bg-primary text-primary-foreground' : activeStep > 2 ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground'
                }`}>{activeStep > 2 ? '✓' : '2'}</span>
                <span>Weigh Harvest</span>
              </div>

              <span className="text-muted-foreground/40 text-xs">/</span>

              <div className={`flex items-center gap-2 text-xs font-semibold ${
                activeStep === 3 ? 'text-primary' : approvedSuccessRecord ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
              }`}>
                <span className={`w-5 h-5 rounded-none flex items-center justify-center text-[11px] font-mono font-bold ${
                  activeStep === 3 && !approvedSuccessRecord ? 'bg-primary text-primary-foreground' : approvedSuccessRecord ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground'
                }`}>{approvedSuccessRecord ? '✓' : '3'}</span>
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
                Exit Focus
              </Button>
            </div>
          </header>

          <main className="flex-1 p-4 md:p-8 max-w-5xl w-full mx-auto">
            {renderFocusContent()}
          </main>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
         STANDARD DASHBOARD VIEW (Non-focus mode)
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="space-y-6">
        <PageHeader
          title="Weighing Station"
          subtitle="Receiving intake station — farmer verification, harvest weighing, pallet labeling."
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
            <p className="text-xs text-muted-foreground">Waiting for verification</p>
          </div>
          <div className="bg-card border border-border rounded-none p-4 shadow-sm space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Approved today</p>
            <p className="text-2xl font-bold tracking-tight text-foreground">{approvedToday}</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
              <Icon name="arrow-up" size={12} /> Pallets ready for sorting
            </p>
          </div>
          <div className="bg-card border border-border rounded-none p-4 shadow-sm space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Scale Capacity</p>
            <p className="text-2xl font-bold tracking-tight text-foreground">{SCALE_CAPACITY_KG}</p>
            <p className="text-xs text-muted-foreground">kg maximum load</p>
          </div>
          <div className="bg-card border border-border rounded-none p-4 shadow-sm space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Workflow Mode</p>
            <p className="text-lg font-bold tracking-tight text-foreground">Sequential</p>
            <p className="text-xs text-muted-foreground">Step 1 → Step 2 → Step 3</p>
          </div>
        </div>

        {/* Sequential Stepper in Standard View */}
        <div id="weighing-stepper" className="bg-card border border-border rounded-none p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-base text-foreground">Sequential Intake Stepper</span>
              <Badge tone="accent">Step {activeStep} of 3</Badge>
            </div>
            <Button size="sm" variant="outline" icon="expand" onClick={enterFocusMode}>
              Open Focus Mode
            </Button>
          </div>

          {/* Embed the same sequential step logic */}
          {renderFocusContent()}
        </div>

        {/* ── Today's Harvest Weighing Records Ledger ── */}
        <div id="weighing-records" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight text-foreground">Today's Harvest Weighing Records</h2>
            <span className="text-xs text-muted-foreground font-mono">
              {pendingCount} pending · {approvedToday} approved
            </span>
          </div>
          <DataTable
            columns={columns}
            data={records}
            rowKey={(row) => row.id}
            emptyTitle="No harvest weighing records today."
            emptyDescription="Select a farmer and record the first harvest weighing."
            caption="Approve commits the weight and generates a Pallet ID for label printing; Correct reloads the weight into the scale form."
          />
        </div>
      </div>
    </>
  )
}
