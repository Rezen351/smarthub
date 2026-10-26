/**
 * Station 02: Sorting Console
 *
 * Implements the 4-step sequential workflow:
 *   Step 1: Scan Waring (Select intake waring from buffer queue or scan WRG-... QR)
 *   Step 2: Sizing & Wash (Prepare sizing machine & select washed vs unwashed protocol)
 *   Step 3: Weigh Grades (Weigh Grade A, B, C on Scale 02 and link pre-attached Pallet QRs)
 *   Step 4: Review & Save (Review yield breakdown bar, automated loss calculation, and commit batch)
 *
 * Fully unified with Station 01 Stepper architecture and 100% sequential in Focus Mode.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import Icon from '../components/shared/Icon'
import Logo from '../components/shared/Logo'
import { Input } from '../components/shared/Form'
import DataTable, { type Column } from '../components/shared/DataTable'
import PageHeader from '../components/shared/PageHeader'
import { useToast } from '../components/feedback/Toast'
import ScaleWeightInput from '../components/operator/ScaleWeightInput'
import { formatWeight } from '../lib/utils'
import { usePackhouseStore, type GradedBatchRecord, type BufferWaringItem } from '../hooks/usePackhouseStore'
import CameraScannerModal from '../components/shared/CameraScannerModal'

const STEPS = [
  { id: 1, label: 'Scan Waring' },
  { id: 2, label: 'Sizing & Wash' },
  { id: 3, label: 'Weigh Grades' },
  { id: 4, label: 'Review & Save' },
] as const

export default function SortingPage() {
  const toast = useToast()
  const { waitingWarings, sortedBatches, addSortedBatch } = usePackhouseStore()

  /* ── Mode & Stepper State ── */
  const [focusMode, setFocusMode] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1)

  /* ── Step 1: Inflow Waring & Context ── */
  const initialWaring = waitingWarings[0] || {
    code: '',
    grossWeightKg: 0,
    farmerName: '',
    farmerVillage: '',
  }
  const [waringCode, setWaringCode] = useState(initialWaring.code)
  const [manualWaringSearch, setManualWaringSearch] = useState('')
  const [waringScanError, setWaringScanError] = useState<string | null>(null)
  const [farmerName, setFarmerName] = useState(initialWaring.farmerName)
  const [farmerVillage, setFarmerVillage] = useState(initialWaring.farmerVillage || '')
  const [grossIntakeKg, setGrossIntakeKg] = useState(initialWaring.grossWeightKg ? String(initialWaring.grossWeightKg) : '')
  const nextSeq = String(sortedBatches.length + 1).padStart(2, '0')
  const [palletCode, setPalletCode] = useState(`PLT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(sortedBatches.length + 1).padStart(4, '0')}`)
  const scanInputRef = useRef<HTMLInputElement>(null)

  /* ── Step 2: Sizing & Wash ── */
  const [sizerFedConfirmed, setSizerFedConfirmed] = useState(true)
  const [washingRecord, setWashingRecord] = useState<'WASHED' | 'UNWASHED'>('WASHED')

  /* ── Step 3: Scale 02 Live Weighing & Pallet QRs (Grade A, B, C) ── */
  const [activeGradeTab, setActiveGradeTab] = useState<'A' | 'B' | 'C'>('A')
  const [liveScaleWeight, setLiveScaleWeight] = useState('0.0')

  /* Grade A */
  const [gradeAKg, setGradeAKg] = useState('0.0')
  const [gradeAPalletQr, setGradeAPalletQr] = useState(`PLT-GRD-A-${nextSeq}`)

  /* Grade B */
  const [gradeBKg, setGradeBKg] = useState('0.0')
  const [gradeBPalletQr, setGradeBPalletQr] = useState(`PLT-GRD-B-${nextSeq}`)

  /* Grade C */
  const [gradeCKg, setGradeCKg] = useState('0.0')
  const [gradeCPalletQr, setGradeCPalletQr] = useState(`PLT-GRD-C-${nextSeq}`)

  /* ── Camera Scanner State ── */
  const [cameraModalMode, setCameraModalMode] = useState<'WARING' | 'PALLET' | null>(null)
  const openWaringCameraModal = () => setCameraModalMode('WARING')
  const openPalletCameraModal = (grade: 'A' | 'B' | 'C') => {
    setActiveGradeTab(grade)
    setCameraModalMode('PALLET')
  }
  const closeCameraModal = useCallback(() => setCameraModalMode(null), [])

  /* ── Step 4: Batch Summary & Local Ledger ── */
  const [savedSuccessBatch, setSavedSuccessBatch] = useState<GradedBatchRecord | null>(null)

  /* Fullscreen & Esc Listener */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (cameraModalMode) {
          closeCameraModal()
        } else if (focusMode) {
          exitFocusMode()
        }
      }
    }
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [focusMode, cameraModalMode])

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

  /* Calculations: Grade A, B, C only; rejects absorbed into shrinkage loss */
  const gGross = Number(grossIntakeKg) || 0
  const gA = Number(gradeAKg) || 0
  const gB = Number(gradeBKg) || 0
  const gC = Number(gradeCKg) || 0

  const totalGraded = gA + gB + gC
  const shrinkageKg = Math.max(0, gGross - totalGraded)
  const shrinkagePct = gGross > 0 ? (shrinkageKg / gGross) * 100 : 0
  const yieldPct = gGross > 0 ? (totalGraded / gGross) * 100 : 0

  /* Select Waring Handler */
  const handleSelectWaring = (item: BufferWaringItem) => {
    setWaringCode(item.code)
    setFarmerName(item.farmerName)
    setFarmerVillage(item.farmerVillage || 'Dieng, Wonosobo')
    setGrossIntakeKg(String(item.grossWeightKg))
    setWaringScanError(null)

    // Suggest balanced initial allocations
    const a = (item.grossWeightKg * 0.48).toFixed(1)
    const b = (item.grossWeightKg * 0.33).toFixed(1)
    const c = (item.grossWeightKg * 0.12).toFixed(1)
    setGradeAKg(a)
    setGradeBKg(b)
    setGradeCKg(c)
    setLiveScaleWeight(a)
    toast.success(`Waring ${item.code} loaded from buffer`)
  }

  /* Manual Waring Scan Submit */
  const handleWaringScanSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const query = manualWaringSearch.trim()
    if (!query) return

    const matched = waitingWarings.find(
      (w) => w.code.toLowerCase() === query.toLowerCase() || w.farmerName.toLowerCase().includes(query.toLowerCase()),
    )

    if (matched) {
      handleSelectWaring(matched)
      setManualWaringSearch('')
      setWaringScanError(null)
    } else {
      setWaringScanError(`Waring "${query}" not found in buffer queue.`)
    }
  }

  /* Assign Live Weight from Scale 02 */
  const handleAssignLiveWeight = () => {
    const val = liveScaleWeight.trim()
    if (!val || Number(val) <= 0) {
      toast.error('Place potatoes on Scale 02 first.')
      return
    }

    if (activeGradeTab === 'A') {
      setGradeAKg(val)
      toast.success(`Grade A weight set to ${val} kg`)
      setActiveGradeTab('B')
      setLiveScaleWeight(gradeBKg || '15.0')
    } else if (activeGradeTab === 'B') {
      setGradeBKg(val)
      toast.success(`Grade B weight set to ${val} kg`)
      setActiveGradeTab('C')
      setLiveScaleWeight(gradeCKg || '5.0')
    } else {
      setGradeCKg(val)
      toast.success(`Grade C weight set to ${val} kg`)
    }
  }

  /* Pallet QR Assignment */
  const handleAssignScannedPallet = (scannedCode: string, targetGrade: 'A' | 'B' | 'C') => {
    const code = scannedCode.trim().toUpperCase()
    if (!code) return
    if (targetGrade === 'A') setGradeAPalletQr(code)
    if (targetGrade === 'B') setGradeBPalletQr(code)
    if (targetGrade === 'C') setGradeCPalletQr(code)
    toast.success(`Pallet ${code} linked to Grade ${targetGrade}`)
    closeCameraModal()
  }

  const handleVerifyModalScan = useCallback(
    (scannedVal: string) => {
      const val = scannedVal.trim()
      if (!val) return
      if (cameraModalMode === 'WARING') {
        const matched = waitingWarings.find(
          (w) => w.code.toLowerCase() === val.toLowerCase(),
        )
        if (matched) {
          handleSelectWaring(matched)
          closeCameraModal()
        } else {
          toast.error(`Waring "${val}" not in queue.`)
        }
      } else if (cameraModalMode === 'PALLET') {
        handleAssignScannedPallet(val, activeGradeTab)
      }
    },
    [cameraModalMode, waitingWarings, handleSelectWaring, closeCameraModal, activeGradeTab],
  )


  /* Commit Batch & Save */
  const handleSaveSortingRun = () => {
    if (totalGraded <= 0) {
      toast.error('Cannot save batch with zero graded weight.')
      return
    }

    const newBatch = addSortedBatch({
      waringCode,
      farmerName,
      farmerVillage,
      palletCode,
      grossIntakeKg: gGross,
      washingRecord,
      gradeAKg: gA,
      gradeAPalletQr: gradeAPalletQr.trim(),
      gradeBKg: gB,
      gradeBPalletQr: gradeBPalletQr.trim(),
      gradeCKg: gC,
      gradeCPalletQr: gradeCPalletQr.trim(),
      totalGradedKg: totalGraded,
      shrinkageKg,
      shrinkagePct: Number(shrinkagePct.toFixed(1)),
      timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    })

    setSavedSuccessBatch(newBatch)
    toast.success(`Batch saved. Yield: ${yieldPct.toFixed(1)}%. Pallets ready for packaging.`)
  }

  /* Reset for next waring */
  const handleStartNextWaring = () => {
    const nextIndex = sortedBatches.length + 1
    const nextIdx = String(nextIndex).padStart(2, '0')
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    setPalletCode(`PLT-${dateStr}-${String(nextIndex).padStart(4, '0')}`)
    setGradeAPalletQr(`PLT-GRD-A-${nextIdx}`)
    setGradeBPalletQr(`PLT-GRD-B-${nextIdx}`)
    setGradeCPalletQr(`PLT-GRD-C-${nextIdx}`)
    setGradeAKg('')
    setGradeBKg('')
    setGradeCKg('')
    setSavedSuccessBatch(null)
    setActiveStep(1)
  }

  /* ─────────────────────────────────────────────────────────────
     DATA TABLE COLUMNS
  ───────────────────────────────────────────────────────────── */
  const columns: Column<GradedBatchRecord>[] = [
    {
      key: 'palletCode',
      label: 'Pallet ID',
      priority: true,
      render: (r) => <span className="font-mono font-bold text-xs">{r.palletCode}</span>,
    },
    {
      key: 'waringCode',
      label: 'Waring Origin',
      priority: true,
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-mono text-xs">{r.waringCode}</span>
          <span className="text-[11px] text-muted-foreground">{r.farmerName}</span>
        </div>
      ),
    },
    {
      key: 'grossIntakeKg',
      label: 'Gross (kg)',
      render: (r) => <span className="font-mono text-xs">{formatWeight(r.grossIntakeKg)}</span>,
    },
    {
      key: 'gradeAKg',
      label: 'Grade A',
      render: (r) => (
        <span className="font-mono text-xs font-semibold text-emerald-700">
          {r.gradeAKg > 0 ? `${formatWeight(r.gradeAKg)} kg` : '—'}
        </span>
      ),
    },
    {
      key: 'gradeBKg',
      label: 'Grade B',
      render: (r) => (
        <span className="font-mono text-xs font-semibold text-blue-700">
          {r.gradeBKg > 0 ? `${formatWeight(r.gradeBKg)} kg` : '—'}
        </span>
      ),
    },
    {
      key: 'gradeCKg',
      label: 'Grade C',
      render: (r) => (
        <span className="font-mono text-xs font-semibold text-amber-700">
          {r.gradeCKg > 0 ? `${formatWeight(r.gradeCKg)} kg` : '—'}
        </span>
      ),
    },
    {
      key: 'shrinkageKg',
      label: 'Loss / Susut',
      render: (r) => (
        <span className="font-mono text-xs text-red-600">
          {formatWeight(r.shrinkageKg)} kg ({r.shrinkagePct}%)
        </span>
      ),
    },
    {
      key: 'washing',
      label: 'Wash',
      render: (r) => (
        <Badge tone={r.washingRecord === 'WASHED' ? 'accent' : 'neutral'}>
          {r.washingRecord}
        </Badge>
      ),
    },
    {
      key: 'timestamp',
      label: 'Time',
      align: 'right',
      render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.timestamp}</span>,
    },
  ]

  /* ─────────────────────────────────────────────────────────────
     STEPPER PROGRESS BAR COMPONENT (Identical to Station 01)
  ───────────────────────────────────────────────────────────── */
  const renderStepperBar = () => (
    <nav
      className="flex items-center gap-1 sm:gap-3 bg-muted/40 p-2 sm:px-4 sm:py-2.5 border border-border overflow-x-auto"
      aria-label="Sorting steps"
    >
      {STEPS.map((step, idx) => {
        const isCurrent = activeStep === step.id
        const isDone = activeStep > step.id || (step.id === 4 && savedSuccessBatch !== null)
        const compactLabel = step.id === 1 ? 'Waring' : step.id === 2 ? 'Sizer' : step.id === 3 ? 'Grades' : 'Done'

        return (
          <div key={step.id} className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                if (step.id < activeStep || savedSuccessBatch) {
                  setActiveStep(step.id as 1 | 2 | 3 | 4)
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
              <span className="sm:hidden">{compactLabel}</span>
              <span className="hidden sm:inline">{step.label}</span>
            </button>
            {idx < STEPS.length - 1 && <span className="text-muted-foreground/40 text-xs mx-0.5 sm:mx-1">/</span>}
          </div>
        )
      })}
    </nav>
  )

  /* ═══════════════════════════════════════════════════════════════════
     RENDER: Sequential Stepper Content (Used in Both Views & Focus Mode)
     ═══════════════════════════════════════════════════════════════════ */
  const renderFocusContent = () => (
    <div className="space-y-6">
      {/* ── STEP 1: Scan Waring ── */}
      {activeStep === 1 && (
        <div className="bg-card border border-border rounded-none p-6 shadow-sm space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-2">
            <div>
              <span className="text-xs uppercase font-mono font-semibold tracking-wider text-muted-foreground">
                Step 1 of 4 · Intake Identification
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                Scan Waring Sack or Select from Buffer
              </h2>
            </div>
            <Badge tone="accent" icon="scan">
              Awaiting Scan
            </Badge>
          </div>

          {/* Centered Dashed Scanner Box (Matching User Screenshot Pattern) */}
          <div className="border-2 border-dashed border-border p-8 text-center space-y-5 bg-card">
            <div className="inline-flex p-3 bg-muted border border-border text-muted-foreground">
              <Icon name="scan" size={28} />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">
                2D Scanner and Camera
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Scan QR code on the intake waring sack with USB 2D hardware scanner, use device camera, or select from buffer queue.
              </p>
            </div>

            {/* Direct Barcode / QR Input Field */}
            <form onSubmit={handleWaringScanSubmit} className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
              <Input
                ref={scanInputRef}
                value={manualWaringSearch}
                onChange={(e) => {
                  setManualWaringSearch(e.target.value)
                  setWaringScanError(null)
                }}
                placeholder="Scan 2D barcode or enter waring code..."
                className="font-mono text-sm flex-1 min-w-0"
              />
              <div className="flex gap-2">
                <Button type="submit" variant="primary" icon="check" className="flex-1 sm:flex-initial">
                  Verify
                </Button>
                <Button type="button" variant="outline" icon="scan" onClick={openWaringCameraModal} className="flex-1 sm:flex-initial">
                  Camera
                </Button>
              </div>
            </form>
            {waringScanError && <p className="text-xs text-destructive font-mono">{waringScanError}</p>}

            {/* Quick Select Chips */}
            <div className="pt-2 border-t border-border/60 max-w-2xl mx-auto space-y-2">
              <p className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground">
                Quick Waring Select / Buffer Queue:
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {waitingWarings.map((w) => {
                  const isSelected = w.code === waringCode
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => handleSelectWaring(w)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary font-bold ring-1 ring-primary'
                          : 'border-border bg-card hover:bg-muted/30 hover:border-primary text-foreground'
                      }`}
                    >
                      <Icon name="scan" size={13} className="text-muted-foreground" />
                      <span>{w.code}</span>
                      <span className="text-muted-foreground text-[11px]">({formatWeight(w.grossWeightKg)} kg · {w.farmerName})</span>
                    </button>
                  )
                })}
                {waitingWarings.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Buffer queue is currently empty.</p>
                )}
              </div>
            </div>
          </div>

          {/* Active Selected Waring Confirmation Strip */}
          <div className="p-3 sm:p-4 bg-card border border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-xs text-muted-foreground uppercase font-mono block">Selected Intake Waring</span>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base sm:text-lg font-bold font-mono">{waringCode}</span>
                <span className="text-xs text-muted-foreground">({farmerName} · {farmerVillage})</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-mono font-bold text-emerald-700 bg-card px-2 py-1 border border-emerald-300 dark:border-emerald-800">
                {formatWeight(Number(grossIntakeKg))} kg Gross
              </span>
              <Button variant="primary" icon="check" touch onClick={() => setActiveStep(2)} className="flex-1 sm:flex-initial">
                Proceed to Sizing
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 2: Sizing & Wash ── */}
      {activeStep === 2 && (
        <div className="bg-card border border-border rounded-none p-6 shadow-sm space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-2">
            <div>
              <span className="text-xs uppercase font-mono font-semibold tracking-wider text-muted-foreground">
                Step 2 of 4 · Sizing & Washing Protocol
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                Mechanical Sizer & Post-Sizer Wash Decision
              </h2>
            </div>
            <Badge tone="accent">
              Waring: {waringCode}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Sizing Machine Confirmation */}
            <div className="border border-border p-5 bg-card space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold">1. Feeding into Roller Sizer</h4>
                <Badge tone={sizerFedConfirmed ? 'success' : 'neutral'}>
                  {sizerFedConfirmed ? 'Feeding Confirmed' : 'Pending'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Pour waring <strong className="font-mono text-foreground">{waringCode}</strong> ({grossIntakeKg} kg)
                into the sizer hopper. Tubers separate mechanically into Grade A (&gt;55mm), Grade B (40–55mm), and
                Grade C (&lt;40mm).
              </p>
              <Button
                variant={sizerFedConfirmed ? 'outline' : 'primary'}
                icon="check"
                onClick={() => setSizerFedConfirmed(!sizerFedConfirmed)}
              >
                {sizerFedConfirmed ? 'Feeding Completed' : 'Confirm Feeding'}
              </Button>
            </div>

            {/* Washing Decision */}
            <div className="border border-border p-5 bg-card space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold">2. Post-Sizer Washing Protocol</h4>
                <Badge tone={washingRecord === 'WASHED' ? 'accent' : 'neutral'}>
                  {washingRecord}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Choose whether this sorted batch passes through the water washing line or bypasses dry directly to weighing.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setWashingRecord('WASHED')}
                  className={`p-3 text-center border text-xs font-semibold transition-all cursor-pointer ${
                    washingRecord === 'WASHED'
                      ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                      : 'border-border text-muted-foreground hover:bg-muted/20'
                  }`}
                >
                  Washed (Wet Line)
                </button>
                <button
                  type="button"
                  onClick={() => setWashingRecord('UNWASHED')}
                  className={`p-3 text-center border text-xs font-semibold transition-all cursor-pointer ${
                    washingRecord === 'UNWASHED'
                      ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                      : 'border-border text-muted-foreground hover:bg-muted/20'
                  }`}
                >
                  Unwashed (Direct)
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-border">
            <Button variant="ghost" onClick={() => setActiveStep(1)}>
              Back to Waring
            </Button>
            <Button variant="primary" icon="check" touch onClick={() => setActiveStep(3)}>
              Proceed to Weigh Grades
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Weigh Grades & Link Pallets ── */}
      {activeStep === 3 && (
        <div className="bg-card border border-border rounded-none p-6 shadow-sm space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-2">
            <div>
              <span className="text-xs uppercase font-mono font-semibold tracking-wider text-muted-foreground">
                Step 3 of 4 · Multi-Grade Weighing & Pallet Linkage
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                Weigh Commercial Grades on Scale 02 & Link Pallet QRs
              </h2>
            </div>
            <Badge tone="success" dot live>
              Scale 02 · Ready
            </Badge>
          </div>

          {/* Grade Switcher Tabs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(['A', 'B', 'C'] as const).map((grade) => {
              const isActive = activeGradeTab === grade
              const weight = grade === 'A' ? gradeAKg : grade === 'B' ? gradeBKg : gradeCKg
              const qr = grade === 'A' ? gradeAPalletQr : grade === 'B' ? gradeBPalletQr : gradeCPalletQr
              return (
                <button
                  key={grade}
                  type="button"
                  onClick={() => setActiveGradeTab(grade)}
                  className={`p-3 text-left border rounded-none transition-all cursor-pointer ${
                    isActive
                      ? 'border-primary bg-primary/10 ring-1 ring-primary'
                      : 'border-border bg-card hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">Grade {grade}</span>
                    <span className="font-mono text-xs font-semibold">
                      {weight ? `${formatWeight(Number(weight))} kg` : '0 kg'}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground mt-1 truncate">
                    Pallet: {qr || 'Not linked'}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Live Scale Input & Pallet Link Area */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Left Column: Scale 02 Input */}
            <div className="border border-border p-4 bg-card space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Scale 02 Reading (Grade {activeGradeTab})</h4>
                <Badge tone="accent">
                  Floor Scale · 100 kg
                </Badge>
              </div>
              <ScaleWeightInput
                stationId="02"
                value={liveScaleWeight}
                onChange={setLiveScaleWeight}
                capacityKg={100}
              />
              <Button
                variant="primary"
                className="w-full"
                icon="check"
                onClick={handleAssignLiveWeight}
              >
                Assign {liveScaleWeight} kg to Grade {activeGradeTab}
              </Button>
            </div>

            {/* Right Column: Pre-attached Pallet QR Linkage */}
            <div className="border border-border p-4 bg-card space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Pallet QR Linkage (Grade {activeGradeTab})</h4>
                <Badge tone="neutral">
                  Pre-attached QR
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Scan the permanent QR code sticker attached to the Grade {activeGradeTab} physical pallet.
              </p>

              <div className="p-3 bg-muted/20 border border-border flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-muted-foreground uppercase font-mono block">Linked Pallet QR</span>
                  <span className="font-mono font-bold text-sm">
                    {activeGradeTab === 'A'
                      ? gradeAPalletQr
                      : activeGradeTab === 'B'
                      ? gradeBPalletQr
                      : gradeCPalletQr}
                  </span>
                </div>
                <Button
                  variant="outline"
                  icon="scan"
                  onClick={() => openPalletCameraModal(activeGradeTab)}
                >
                  Scan Pallet QR
                </Button>
              </div>

              {/* Active Pallet Shortcuts */}
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-mono text-muted-foreground">Active Staged Pallets</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    `PLT-GRD-${activeGradeTab}-01`,
                    `PLT-GRD-${activeGradeTab}-02`,
                    `PLT-GRD-${activeGradeTab}-03`,
                  ].map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => handleAssignScannedPallet(code, activeGradeTab)}
                      className="px-2 py-1 text-xs font-mono bg-muted border border-border hover:bg-primary/10 hover:border-primary cursor-pointer"
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Stepper Navigation */}
          <div className="flex justify-between items-center pt-4 border-t border-border">
            <Button variant="ghost" onClick={() => setActiveStep(2)}>
              Back to Sizing
            </Button>
            <Button variant="primary" icon="check" touch onClick={() => setActiveStep(4)}>
              Proceed to Review & Save
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Review & Save ── */}
      {activeStep === 4 && (
        <div className="bg-card border border-border rounded-none p-6 shadow-sm space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-2">
            <div>
              <span className="text-xs uppercase font-mono font-semibold tracking-wider text-muted-foreground">
                Step 4 of 4 · Yield Audit & Batch Commitment
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                Commercial Yield Distribution & Batch Commitment
              </h2>
            </div>
            <Badge tone="accent">
              Pallet: {palletCode}
            </Badge>
          </div>

          {/* Yield Distribution Bar */}
          <div className="border border-border p-4 bg-card space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase font-mono">Yield Distribution</span>
              <span className="text-xs font-mono font-semibold">
                Total Graded: {formatWeight(totalGraded)} kg / {formatWeight(gGross)} kg Gross
              </span>
            </div>

            {/* Progress Track */}
            <div className="h-10 w-full flex border-2 border-border overflow-hidden shadow-xs">
              {gGross > 0 ? (
                <>
                  <div
                    style={{ width: `${(gA / gGross) * 100}%` }}
                    className="bg-emerald-600 flex items-center justify-center text-xs font-bold font-mono text-white"
                    title={`Grade A: ${gA} kg (${((gA / gGross) * 100).toFixed(1)}%)`}
                  >
                    {gA > 0 && `A: ${formatWeight(gA)} kg`}
                  </div>
                  <div
                    style={{ width: `${(gB / gGross) * 100}%` }}
                    className="bg-blue-600 flex items-center justify-center text-xs font-bold font-mono text-white"
                    title={`Grade B: ${gB} kg (${((gB / gGross) * 100).toFixed(1)}%)`}
                  >
                    {gB > 0 && `B: ${formatWeight(gB)} kg`}
                  </div>
                  <div
                    style={{ width: `${(gC / gGross) * 100}%` }}
                    className="bg-amber-500 flex items-center justify-center text-xs font-bold font-mono text-white"
                    title={`Grade C: ${gC} kg (${((gC / gGross) * 100).toFixed(1)}%)`}
                  >
                    {gC > 0 && `C: ${formatWeight(gC)} kg`}
                  </div>
                  <div
                    style={{ width: `${(shrinkageKg / gGross) * 100}%` }}
                    className="bg-red-600 flex items-center justify-center text-xs font-bold font-mono text-white"
                    title={`Loss/Susut: ${shrinkageKg.toFixed(1)} kg (${shrinkagePct.toFixed(1)}%)`}
                  >
                    {shrinkageKg > 0 && `Loss: ${formatWeight(shrinkageKg)} kg`}
                  </div>
                </>
              ) : (
                <div className="w-full bg-muted flex items-center justify-center text-xs text-muted-foreground font-mono">
                  No weight entered
                </div>
              )}
            </div>

            {/* Legend Swatches */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 bg-emerald-600 shrink-0" />
                <span>Grade A: {gGross > 0 ? ((gA / gGross) * 100).toFixed(1) : 0}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 bg-blue-600 shrink-0" />
                <span>Grade B: {gGross > 0 ? ((gB / gGross) * 100).toFixed(1) : 0}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 bg-amber-500 shrink-0" />
                <span>Grade C: {gGross > 0 ? ((gC / gGross) * 100).toFixed(1) : 0}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 bg-red-600 shrink-0" />
                <span>Loss: {shrinkagePct.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          {/* Detailed Batch Matrix Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="border border-border p-3.5 bg-card">
              <span className="text-[10px] uppercase font-mono text-muted-foreground block">Gross Waring</span>
              <span className="text-xl font-black font-mono mt-0.5 block">{formatWeight(gGross)} kg</span>
              <span className="text-xs text-muted-foreground">{waringCode}</span>
            </div>
            <div className="border border-border p-3.5 bg-card">
              <span className="text-[10px] uppercase font-mono text-muted-foreground block">Commercial Yield</span>
              <span className="text-xl font-black font-mono text-emerald-700 mt-0.5 block">
                {yieldPct.toFixed(1)}%
              </span>
              <span className="text-xs text-muted-foreground">{formatWeight(totalGraded)} kg net</span>
            </div>
            <div className="border border-border p-3.5 bg-card">
              <span className="text-[10px] uppercase font-mono text-muted-foreground block">Shrinkage Deficit</span>
              <span className="text-xl font-black font-mono text-red-600 mt-0.5 block">
                {formatWeight(shrinkageKg)} kg
              </span>
              <span className="text-xs text-muted-foreground">{shrinkagePct.toFixed(1)}% loss</span>
            </div>
            <div className="border border-border p-3.5 bg-card">
              <span className="text-[10px] uppercase font-mono text-muted-foreground block">Wash Decision</span>
              <span className="text-xl font-bold font-mono mt-0.5 block">{washingRecord}</span>
              <span className="text-xs text-muted-foreground">Sizer Separated</span>
            </div>
          </div>

          {/* Commit & Inventory Update Action */}
          <div className="flex items-center justify-between pt-4 border-t border-border flex-wrap gap-3">
            <Button variant="ghost" onClick={() => setActiveStep(3)}>
              Back to Weigh Grades
            </Button>

            {!savedSuccessBatch ? (
              <Button
                variant="primary"
                touch
                icon="check"
                onClick={handleSaveSortingRun}
              >
                Commit Batch & Update Inventory
              </Button>
            ) : (
              <Button variant="primary" icon="check" touch onClick={handleStartNextWaring}>
                Sort Next Waring
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════════════
         FULLSCREEN FOCUS MODE OVERLAY (100% Sequential Navigation)
         ═══════════════════════════════════════════════════════════════════ */}
      {focusMode && (
        <div
          className="fixed inset-0 z-50 bg-background flex flex-col overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Sorting Focus Mode"
        >
          <header className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-card/95 backdrop-blur border-b border-border shadow-sm">
            <div className="flex items-center gap-3">
              <Logo className="h-7 w-auto" markOnly />
              <div>
                <div className="font-display text-lg leading-none tracking-wider text-foreground">
                  ENYX-ENTERPRISE
                </div>
                <div className="font-mono text-[9px] text-muted-foreground tracking-[0.2em] uppercase mt-0.5">
                  STATION 02 · SORTING · FOCUS MODE
                </div>
              </div>
            </div>

            {/* Stepper Progress inside Focus Mode! */}
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
        {/* Page Header */}
        <PageHeader
          title="Station 02: Sorting Console"
          subtitle="Sort potato fractions, check yield, and link grade pallets."
          actions={
            <div className="flex items-center gap-2">
              <Button variant="primary" icon="expand" touch onClick={enterFocusMode}>
                Focus Mode
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon="history"
                onClick={() => document.getElementById('sorting-records')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Records ({sortedBatches.length})
              </Button>
            </div>
          }
        />

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-none p-4 shadow-sm space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Buffer Queue</p>
            <p className="text-2xl font-bold tracking-tight text-foreground">{waitingWarings.length}</p>
            <p className="text-xs text-muted-foreground">Ready for sorting</p>
          </div>
          <div className="bg-card border border-border rounded-none p-4 shadow-sm space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Scale 02 Status</p>
            <p className="text-2xl font-bold tracking-tight text-emerald-600">Online</p>
            <p className="text-xs text-muted-foreground">100 kg Floor Scale</p>
          </div>
          <div className="bg-card border border-border rounded-none p-4 shadow-sm space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Commercial Yield</p>
            <p className="text-2xl font-bold tracking-tight text-emerald-600">
              {gGross > 0 ? `${yieldPct.toFixed(1)}%` : '91.4%'}
            </p>
            <p className="text-xs text-muted-foreground">Grade A+B+C ratio</p>
          </div>
          <div className="bg-card border border-border rounded-none p-4 shadow-sm space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Shrinkage Loss</p>
            <p className="text-2xl font-bold tracking-tight text-red-600">
              {gGross > 0 ? `${shrinkagePct.toFixed(1)}%` : '8.6%'}
            </p>
            <p className="text-xs text-muted-foreground">Rejects & soil tare</p>
          </div>
        </div>

        {/* ── Main Sequential Stepper Card (Consistent with Screenshot) ── */}
        <div id="sorting-stepper" className="bg-card border border-border rounded-none p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-base text-foreground">Sorting Stepper</span>
              <Badge tone="accent">Step {activeStep} of 4</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="success" dot live>
                Scale 02 · Ready
              </Badge>
              <Button size="sm" variant="outline" icon="expand" onClick={enterFocusMode}>
                Open Focus Mode
              </Button>
            </div>
          </div>

          {/* Stepper Navigation Bar */}
          {renderStepperBar()}

          {/* Embed the sequential step logic */}
          {renderFocusContent()}
        </div>

        {/* ── Sorting Batch Records Ledger ── */}
        <div id="sorting-records" className="space-y-3 pt-6 border-t border-border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold">Sorting History Ledger</h3>
              <p className="text-xs text-muted-foreground">Log of all completed sorting batches and commercial yield ratios</p>
            </div>
            <Badge tone="neutral">
              {sortedBatches.length} Batches
            </Badge>
          </div>
          <DataTable
            columns={columns}
            data={sortedBatches}
            rowKey={(r) => r.id}
            emptyTitle="No sorting runs recorded yet."
            emptyDescription="Select a waring from buffer queue to begin sorting."
          />
        </div>
      </div>

      {/* ── Universal Camera Scanner Viewfinder Modal ── */}
      {/* ── Universal Camera Barcode/QR Scanner Modal ── */}
      <CameraScannerModal
        isOpen={cameraModalMode !== null}
        onClose={closeCameraModal}
        onScan={handleVerifyModalScan}
        title={
          cameraModalMode === 'WARING'
            ? 'Scan Waring Sack QR Code · Station 02'
            : `Scan Pallet QR for Grade ${activeGradeTab}`
        }
        subtitle={
          cameraModalMode === 'WARING'
            ? 'Align the WRG QR code within the camera frame.'
            : `Align the pre-attached PLT QR code for Grade ${activeGradeTab}.`
        }
        manualPlaceholder={
          cameraModalMode === 'WARING' ? 'Enter Waring Code (WRG-...)' : `Enter Pallet Tag (PLT-GRD-${activeGradeTab}-01)`
        }
        quickOptions={
          cameraModalMode === 'WARING'
            ? waitingWarings.map((w) => ({ label: `${w.code} (${w.farmerName})`, value: w.code }))
            : [
                { label: `PLT-GRD-${activeGradeTab}-01`, value: `PLT-GRD-${activeGradeTab}-01` },
                { label: `PLT-GRD-${activeGradeTab}-02`, value: `PLT-GRD-${activeGradeTab}-02` },
              ]
        }
      />
    </>
  )
}
