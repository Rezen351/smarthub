/**
 * Station 02: Sorting, Sizing & Grading Console
 *
 * Implements the sequential 5-step workflow matching Station 01:
 *   Step 1: Scan Waring (Scan WRG-... QR barcode or pull from buffer queue)
 *   Step 2: Feed into Sizer Machine (Pour waring into stand-alone mechanical grading machine)
 *   Step 3: Washing Decision (Post-sizer: WASHED vs UNWASHED traceability toggle)
 *   Step 4: Weigh Each Grade & Scan Pallet QR (Scale 02 live reading for Grade A, B, C; link pre-attached Pallet QR; rejects excluded)
 *   Step 5: Review Shrinkage & Finalize to Packaging (Summary of net commercial yields, automated shrinkage formula, dispatch to packaging)
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

interface GradingBatch {
  id: string
  palletCode: string
  waringCode: string
  farmerName: string
  farmerVillage?: string
  grossIntakeKg: number
  washingRecord: 'WASHED' | 'UNWASHED'
  gradeAKg: number
  gradeAPalletQr: string
  gradeBKg: number
  gradeBPalletQr: string
  gradeCKg: number
  gradeCPalletQr: string
  totalGradedKg: number
  shrinkageKg: number
  shrinkagePct: number
  timestamp: string
}

interface BufferWaring {
  code: string
  kg: number
  farmer: string
  village: string
}

const BUFFER_WARINGS: BufferWaring[] = [
  { code: 'WRG-20261025-0001', kg: 45.5, farmer: 'Ahmad Santoso', village: 'Dieng, Wonosobo' },
  { code: 'WRG-20261025-0002', kg: 48.0, farmer: 'Ahmad Santoso', village: 'Dieng, Wonosobo' },
  { code: 'WRG-20261025-0003', kg: 52.2, farmer: 'Budi Prasetyo', village: 'Berastagi, Karo' },
]

const STEPS = [
  { id: 1, label: 'Scan Waring' },
  { id: 2, label: 'Sizing & Wash' },
  { id: 3, label: 'Weigh Grades' },
  { id: 4, label: 'Review & Save' },
] as const

export default function GradingPage() {
  const toast = useToast()

  /* ── Mode & Stepper State ── */
  const [focusMode, setFocusMode] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1)

  /* ── Step 1: Inflow Waring & Context ── */
  const [waringCode, setWaringCode] = useState('WRG-20261025-0001')
  const [manualWaringSearch, setManualWaringSearch] = useState('')
  const [waringScanError, setWaringScanError] = useState('')
  const [farmerName, setFarmerName] = useState('Ahmad Santoso')
  const [farmerVillage, setFarmerVillage] = useState('Dieng, Wonosobo')
  const [grossIntakeKg, setGrossIntakeKg] = useState('45.5')
  const [palletCode, setPalletCode] = useState('PLT-20261025-0001')
  const scanInputRef = useRef<HTMLInputElement>(null)

  /* ── Step 2: Feed Machine (Stand-alone physical sizing machine) ── */
  const [sizerFedConfirmed, setSizerFedConfirmed] = useState(true)

  /* ── Step 3: Washing Decision (Post-Sizer) ── */
  const [washingRecord, setWashingRecord] = useState<'WASHED' | 'UNWASHED'>('WASHED')

  /* ── Step 3: Scale 02 Live Weighing & Pallet QRs (Grade A, B, C) ── */
  const [activeGradeTab, setActiveGradeTab] = useState<'A' | 'B' | 'C'>('A')
  const [liveScaleWeight, setLiveScaleWeight] = useState('21.0')

  /* Grade A */
  const [gradeAKg, setGradeAKg] = useState('21.0')
  const [gradeAPalletQr, setGradeAPalletQr] = useState('PLT-GRD-A-01')

  /* Grade B */
  const [gradeBKg, setGradeBKg] = useState('15.2')
  const [gradeBPalletQr, setGradeBPalletQr] = useState('PLT-GRD-B-01')

  /* Grade C */
  const [gradeCKg, setGradeCKg] = useState('5.5')
  const [gradeCPalletQr, setGradeCPalletQr] = useState('PLT-GRD-C-01')

  /* ── Pallet QR Scanner & Camera State ── */
  const [scannerTargetGrade, setScannerTargetGrade] = useState<'A' | 'B' | 'C' | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [manualPalletInput, setManualPalletInput] = useState('')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const palletScanInputRef = useRef<HTMLInputElement>(null)

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setCameraActive(false)
  }, [])

  const openScannerFor = (grade: 'A' | 'B' | 'C') => {
    setActiveGradeTab(grade)
    setScannerTargetGrade(grade)
    setManualPalletInput('')
    setCameraError(null)
    setTimeout(() => palletScanInputRef.current?.focus(), 150)
  }

  const startCamera = async () => {
    setCameraError(null)
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by your browser.')
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      setCameraActive(true)
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unable to access camera.'
      setCameraError(errMsg)
      setCameraActive(false)
    }
  }

  const handleAssignScannedPallet = (scannedCode: string, targetGrade: 'A' | 'B' | 'C') => {
    const code = scannedCode.trim().toUpperCase()
    if (!code) return
    if (targetGrade === 'A') setGradeAPalletQr(code)
    if (targetGrade === 'B') setGradeBPalletQr(code)
    if (targetGrade === 'C') setGradeCPalletQr(code)
    toast.success(`Pallet ${code} scanned & linked to Grade ${targetGrade}`)
    stopCamera()
    setScannerTargetGrade(null)
    setManualPalletInput('')
  }

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  /* ── Step 5: Save State ── */
  const [savedSuccessBatch, setSavedSuccessBatch] = useState<GradingBatch | null>(null)

  /* ── Grading Batches Ledger ── */
  const [records, setRecords] = useState<GradingBatch[]>([
    {
      id: '1',
      palletCode: 'PLT-20261025-0001',
      waringCode: 'WRG-20261025-0001',
      farmerName: 'Ahmad Santoso',
      farmerVillage: 'Dieng, Wonosobo',
      grossIntakeKg: 45.5,
      washingRecord: 'WASHED',
      gradeAKg: 21.0,
      gradeAPalletQr: 'PLT-GRD-A-01',
      gradeBKg: 15.2,
      gradeBPalletQr: 'PLT-GRD-B-01',
      gradeCKg: 5.5,
      gradeCPalletQr: 'PLT-GRD-C-01',
      totalGradedKg: 41.7,
      shrinkageKg: 3.8,
      shrinkagePct: 8.4,
      timestamp: '10:45',
    },
    {
      id: '2',
      palletCode: 'PLT-20261024-0008',
      waringCode: 'WRG-20261024-0008',
      farmerName: 'Siti Rahayu',
      farmerVillage: 'Pangalengan, Bandung',
      grossIntakeKg: 50.0,
      washingRecord: 'UNWASHED',
      gradeAKg: 24.5,
      gradeAPalletQr: 'PLT-GRD-A-02',
      gradeBKg: 16.0,
      gradeBPalletQr: 'PLT-GRD-B-02',
      gradeCKg: 5.0,
      gradeCPalletQr: 'PLT-GRD-C-02',
      totalGradedKg: 45.5,
      shrinkageKg: 4.5,
      shrinkagePct: 9.0,
      timestamp: '09:30',
    },
  ])

  /* Auto-focus scanner in Step 1 */
  useEffect(() => {
    if (activeStep === 1) {
      const timer = window.setTimeout(() => {
        scanInputRef.current?.focus()
      }, 100)
      return () => window.clearTimeout(timer)
    }
  }, [activeStep, focusMode])

  /* Fullscreen & Esc Listener */
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

  /* Calculations (Grade A, B, C only; Rejects directly absorbed into Shrinkage) */
  const gGross = Number(grossIntakeKg) || 0
  const gA = Number(gradeAKg) || 0
  const gB = Number(gradeBKg) || 0
  const gC = Number(gradeCKg) || 0

  const totalGraded = gA + gB + gC
  const shrinkageKg = Math.max(0, gGross - totalGraded)
  const shrinkagePct = gGross > 0 ? (shrinkageKg / gGross) * 100 : 0
  const yieldPct = gGross > 0 ? (totalGraded / gGross) * 100 : 0

  /* Step 1: Select waring from buffer */
  const selectBufferWaring = (w: BufferWaring) => {
    setWaringCode(w.code)
    setGrossIntakeKg(String(w.kg))
    setFarmerName(w.farmer)
    setFarmerVillage(w.village)
    setWaringScanError('')
    setSavedSuccessBatch(null)
    toast.success(`Loaded ${w.code} (${w.kg} kg) from buffer`)
  }

  const handleWaringScanSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const query = manualWaringSearch.trim().toUpperCase()
    if (!query) {
      setWaringScanError('Enter or scan a valid Waring Code')
      return
    }

    const matched = BUFFER_WARINGS.find((w) => w.code.toUpperCase() === query)
    if (matched) {
      selectBufferWaring(matched)
      setManualWaringSearch('')
    } else {
      setWaringCode(query)
      setSavedSuccessBatch(null)
      toast.success(`Custom waring ${query} loaded`)
      setManualWaringSearch('')
    }
  }


  /* Step 3: Assign live reading to active grade */
  const handleAssignLiveWeight = () => {
    const val = liveScaleWeight
    if (activeGradeTab === 'A') setGradeAKg(val)
    if (activeGradeTab === 'B') setGradeBKg(val)
    if (activeGradeTab === 'C') setGradeCKg(val)
    toast.success(`Assigned ${val} kg to Grade ${activeGradeTab}`)
  }

  /* Step 4: Save Grading Batch & Proceed to Packaging */
  const handleSaveGradingRun = () => {
    if (totalGraded <= 0) {
      toast.error('Record valid weights for at least one grade (A, B, or C).')
      return
    }

    const newBatch: GradingBatch = {
      id: String(Date.now()),
      palletCode: palletCode.trim(),
      waringCode: waringCode.trim(),
      farmerName: farmerName.trim(),
      farmerVillage: farmerVillage.trim(),
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
    }

    setRecords((curr) => [newBatch, ...curr])
    setSavedSuccessBatch(newBatch)
    toast.success(
      `Grading saved. Pallets linked: A (${gradeAPalletQr}), B (${gradeBPalletQr}), C (${gradeCPalletQr}). Ready for Packaging.`,
    )
  }

  /* Reset for next waring grading */
  const handleStartNextWaring = () => {
    const nextIndex = records.length + 1
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    setPalletCode(`PLT-${dateStr}-${String(nextIndex).padStart(4, '0')}`)
    setGradeAKg('')
    setGradeBKg('')
    setGradeCKg('')
    setSavedSuccessBatch(null)
    setActiveStep(1)
  }

  const columns: Column<GradingBatch>[] = [
    {
      key: 'palletCode',
      label: 'Pallet / Waring',
      priority: true,
      render: (row) => (
        <div>
          <span className="font-mono font-bold text-foreground block">{row.palletCode}</span>
          <span className="text-xs text-muted-foreground font-mono">{row.waringCode}</span>
        </div>
      ),
    },
    {
      key: 'farmerName',
      label: 'Farmer',
      render: (row) => (
        <div>
          <span className="font-semibold text-foreground block text-sm">{row.farmerName}</span>
          <span className="text-xs text-muted-foreground">{row.farmerVillage ?? 'Dieng, Wonosobo'}</span>
        </div>
      ),
    },
    {
      key: 'washingRecord',
      label: 'Washing',
      render: (row) => (
        <span
          className={`text-[11px] font-mono font-semibold px-2 py-0.5 border ${
            row.washingRecord === 'WASHED'
              ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
              : 'border-border bg-muted/40 text-muted-foreground'
          }`}
        >
          {row.washingRecord}
        </span>
      ),
    },
    {
      key: 'gradeAKg',
      label: 'Grade A',
      align: 'right',
      render: (row) => (
        <div>
          <span className="font-mono font-bold text-emerald-800 block">{formatWeight(row.gradeAKg)} kg</span>
          <span className="font-mono text-[10px] text-muted-foreground">{row.gradeAPalletQr}</span>
        </div>
      ),
    },
    {
      key: 'gradeBKg',
      label: 'Grade B',
      align: 'right',
      render: (row) => (
        <div>
          <span className="font-mono font-bold text-blue-800 block">{formatWeight(row.gradeBKg)} kg</span>
          <span className="font-mono text-[10px] text-muted-foreground">{row.gradeBPalletQr}</span>
        </div>
      ),
    },
    {
      key: 'gradeCKg',
      label: 'Grade C',
      align: 'right',
      render: (row) => (
        <div>
          <span className="font-mono font-bold text-amber-800 block">{formatWeight(row.gradeCKg)} kg</span>
          <span className="font-mono text-[10px] text-muted-foreground">{row.gradeCPalletQr}</span>
        </div>
      ),
    },
    {
      key: 'shrinkageKg',
      label: 'Shrinkage',
      align: 'right',
      priority: true,
      render: (row) => (
        <div>
          <span className="font-mono font-bold text-red-700 block">-{formatWeight(row.shrinkageKg)} kg</span>
          <span className="text-[11px] text-muted-foreground font-mono">{row.shrinkagePct}%</span>
        </div>
      ),
    },
    {
      key: 'timestamp',
      label: 'Time',
      render: (row) => <span className="font-mono text-xs text-muted-foreground">{row.timestamp}</span>,
    },
  ]

  /* ─────────────────────────────────────────────────────────────
     STEPPER PROGRESS BAR COMPONENT
  ───────────────────────────────────────────────────────────── */
  const renderStepperBar = () => (
    <nav className="flex items-center gap-1 sm:gap-3 bg-muted/40 p-2 sm:px-4 sm:py-2.5 border border-border overflow-x-auto" aria-label="Grading steps">
      {STEPS.map((step, idx) => {
        const isCurrent = activeStep === step.id
        const isDone = activeStep > step.id || (step.id === 4 && savedSuccessBatch !== null)

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
              <span className="hidden sm:inline">{step.label}</span>
            </button>
            {idx < STEPS.length - 1 && <span className="text-muted-foreground/40 text-xs mx-1">/</span>}
          </div>
        )
      })}
    </nav>
  )

  /* ─────────────────────────────────────────────────────────────
     SEQUENTIAL WORKFLOW CONTENT (Used by both Focus & Standard Views)
  ───────────────────────────────────────────────────────────── */
  const renderSequentialContent = () => (
    <div className="space-y-6">
      {/* ── STEP 1: Scan Waring ── */}
      {activeStep === 1 && (
        <div className="bg-card border border-border p-6 shadow-sm space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-2">
            <div>
              <span className="text-xs uppercase font-mono font-semibold tracking-wider text-muted-foreground">
                Step 1 of 4 · Scan Waring
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                Scan Intake Waring
              </h2>
            </div>
            <Badge tone="accent" icon="scan">
              Awaiting Scan
            </Badge>
          </div>

          {/* Scanner Input Box */}
          <form onSubmit={handleWaringScanSubmit} className="space-y-4">
            <div className="p-8 border-2 border-dashed border-primary/30 bg-primary/5 text-center space-y-3">
              <Icon name="scan" size={36} className="text-primary mx-auto" />
              <p className="text-sm font-semibold text-foreground">Scan Waring Barcode</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Scan the barcode on the waring bag or select from the queue below.
              </p>
              <div className="max-w-md mx-auto">
                <Input
                  ref={scanInputRef}
                  value={manualWaringSearch}
                  onChange={(e) => {
                    setManualWaringSearch(e.target.value)
                    setWaringScanError('')
                  }}
                  placeholder="Scan or enter waring code, e.g. WRG-20261025-0001"
                  className="text-center font-mono text-base py-3 uppercase"
                  autoFocus
                />
              </div>
              {waringScanError && (
                <p className="text-xs text-destructive font-medium mt-2">{waringScanError}</p>
              )}
            </div>

            {/* Quick Buffer Selectors */}
            <div className="space-y-2 pt-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Intake Buffer Queue:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {BUFFER_WARINGS.map((bw) => {
                  const isSelected = waringCode === bw.code
                  return (
                    <button
                      key={bw.code}
                      type="button"
                      onClick={() => selectBufferWaring(bw)}
                      className={`p-3 text-left border transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold'
                          : 'border-border bg-card text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-xs font-bold text-foreground">{bw.code}</span>
                        <span className="font-mono text-xs font-bold text-emerald-800">{bw.kg} kg</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 truncate">
                        {bw.farmer} · {bw.village}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Active Waring Summary Card */}
            <div className="p-4 bg-muted/30 border border-border grid grid-cols-1 sm:grid-cols-4 gap-4 pt-4">
              <div>
                <span className="text-xs text-muted-foreground block font-medium">Selected Waring</span>
                <span className="font-mono font-bold text-base text-foreground block">{waringCode}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block font-medium">Farmer Origin</span>
                <span className="font-semibold text-base text-foreground block">{farmerName}</span>
                <span className="text-xs text-muted-foreground">{farmerVillage}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block font-medium">Intake Weight</span>
                <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400 block font-mono">
                  {grossIntakeKg} <span className="text-xs font-normal text-muted-foreground">kg</span>
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block font-medium">Target Pallet</span>
                <span className="font-mono font-bold text-base text-primary block">{palletCode}</span>
              </div>
            </div>

            {/* Action Footer */}
            <div className="flex justify-end pt-4 border-t border-border">
              <Button
                variant="primary"
                icon="check"
                touch
                onClick={() => {
                  setSavedSuccessBatch(null)
                  setActiveStep(2)
                }}
              >
                Continue to Machine
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ── STEP 2: Sizing & Wash Protocol ── */}
      {activeStep === 2 && (
        <div className="bg-card border border-border p-6 shadow-sm space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-2">
            <div>
              <span className="text-xs uppercase font-mono font-semibold tracking-wider text-muted-foreground">
                Step 2 of 4 · Sizing & Wash
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                Feed Sizing Machine & Record Washing
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="success" dot live>
                Machine Ready
              </Badge>
              <span className="text-xs font-mono text-muted-foreground">Waring: {waringCode}</span>
            </div>
          </div>

          <div className="space-y-6">
            {/* Top: Sizing Machine Feeding & Channels */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div className="lg:col-span-2 p-5 bg-muted/20 border border-border space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground block">
                  Grade Sizing Channels
                </span>
                <p className="text-sm text-foreground">
                  Feed potatoes from {waringCode} ({grossIntakeKg} kg) into the sizing hopper.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200">
                    <span className="font-mono font-bold text-xs text-emerald-950 block">Grade A</span>
                    <span className="text-xs text-emerald-800">&gt; 55 mm (Large)</span>
                  </div>
                  <div className="p-3 bg-blue-50/70 border border-blue-200">
                    <span className="font-mono font-bold text-xs text-blue-950 block">Grade B</span>
                    <span className="text-xs text-blue-800">40 - 55 mm (Medium)</span>
                  </div>
                  <div className="p-3 bg-amber-50/70 border border-amber-200">
                    <span className="font-mono font-bold text-xs text-amber-950 block">Grade C</span>
                    <span className="text-xs text-amber-800">&lt; 40 mm (Small)</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-card border border-border space-y-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                  Checklist
                </span>
                <label className="flex items-start gap-2.5 text-xs text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sizerFedConfirmed}
                    onChange={(e) => setSizerFedConfirmed(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>All tubers from {waringCode} ({grossIntakeKg} kg) fed into hopper.</span>
                </label>
                <div className="pt-2 border-t border-border text-xs text-muted-foreground">
                  Target Pallet: <strong className="font-mono text-foreground">{palletCode}</strong>
                </div>
              </div>
            </div>

            {/* Bottom: Washing Protocol Selection */}
            <div className="space-y-3 pt-2 border-t border-border">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground block">
                Post-Sizer Washing Protocol
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Option 1: WASHED */}
                <button
                  type="button"
                  onClick={() => {
                    setWashingRecord('WASHED')
                    toast.success('Set to WASHED')
                  }}
                  className={`p-5 text-left border transition-all cursor-pointer ${
                    washingRecord === 'WASHED'
                      ? 'border-emerald-600 bg-emerald-50/70 shadow-sm'
                      : 'border-border bg-card hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold text-foreground">WASHED</span>
                    <span
                      className={`text-xs font-mono font-bold px-2 py-0.5 border ${
                        washingRecord === 'WASHED'
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-border bg-muted text-muted-foreground'
                      }`}
                    >
                      {washingRecord === 'WASHED' ? 'SELECTED' : 'SELECT'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                    Clean water wash and drying line. For retail supermarkets and consumer pouches.
                  </p>
                </button>

                {/* Option 2: UNWASHED */}
                <button
                  type="button"
                  onClick={() => {
                    setWashingRecord('UNWASHED')
                    toast.success('Set to UNWASHED')
                  }}
                  className={`p-5 text-left border transition-all cursor-pointer ${
                    washingRecord === 'UNWASHED'
                      ? 'border-amber-600 bg-amber-50/70 shadow-sm'
                      : 'border-border bg-card hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold text-foreground">UNWASHED</span>
                    <span
                      className={`text-xs font-mono font-bold px-2 py-0.5 border ${
                        washingRecord === 'UNWASHED'
                          ? 'border-amber-600 bg-amber-600 text-white'
                          : 'border-border bg-muted text-muted-foreground'
                      }`}
                    >
                      {washingRecord === 'UNWASHED' ? 'SELECTED' : 'SELECT'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                    Dry brushed only. Retains natural protective layer for storage.
                  </p>
                </button>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between border-t border-border pt-4">
            <Button variant="outline" onClick={() => setActiveStep(1)}>
              Back
            </Button>
            <Button
              variant="primary"
              icon="check"
              touch
              disabled={!sizerFedConfirmed}
              onClick={() => setActiveStep(3)}
            >
              Continue to Weighing
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Weigh Each Grade & Scan Pallet QR ── */}
      {activeStep === 3 && (
        <div className="bg-card border border-border p-6 shadow-sm space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-2">
            <div>
              <span className="text-xs uppercase font-mono font-semibold tracking-wider text-muted-foreground">
                Step 3 of 4 · Weigh Grades
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                Weigh Grades & Assign Pallets
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="accent">Scale 02 · 100 kg</Badge>
              <Badge tone="success" dot live>
                Port 502 · Online
              </Badge>
            </div>
          </div>

          {/* Workstation 2 Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Live Scale Weight Terminal (5 cols) with Auto & Manual modes (no 'Scale 02 — Grade A' title) */}
            <div className="lg:col-span-5 border border-border p-5 bg-card space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Select Grade Channel:
                </span>
                <span className="font-mono text-xs font-bold text-emerald-800">
                  Grade {activeGradeTab}
                </span>
              </div>

              {/* Channel Tabs */}
              <div className="grid grid-cols-3 gap-2">
                {(['A', 'B', 'C'] as const).map((grade) => (
                  <button
                    key={grade}
                    type="button"
                    onClick={() => setActiveGradeTab(grade)}
                    className={`p-3 border text-left transition-colors cursor-pointer ${
                      activeGradeTab === grade
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold'
                        : 'border-border bg-card text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <span className="block font-bold">Grade {grade}</span>
                    <span className="text-[11px] font-mono text-muted-foreground block mt-0.5">
                      {grade === 'A' ? `${gradeAKg || '0.0'} kg` : grade === 'B' ? `${gradeBKg || '0.0'} kg` : `${gradeCKg || '0.0'} kg`}
                    </span>
                  </button>
                ))}
              </div>

              {/* Live Scale Reading with Auto & Manual modes (label omitted to remove 'Scale 02 — Grade A' title) */}
              <div className="pt-2">
                <ScaleWeightInput
                  value={liveScaleWeight}
                  onChange={setLiveScaleWeight}
                  capacityKg={100}
                  label=""
                />
              </div>

              {/* Quick weight buttons */}
              <div className="flex justify-center gap-2 pt-1">
                {['18.5', '21.0', '15.2', '5.5'].map((sw) => (
                  <button
                    key={sw}
                    type="button"
                    onClick={() => setLiveScaleWeight(sw)}
                    className="px-2 py-0.5 text-xs font-mono border border-border bg-card hover:bg-muted cursor-pointer"
                  >
                    {sw} kg
                  </button>
                ))}
              </div>

              {/* Assign Live Weight Button */}
              <Button variant="primary" icon="check" block onClick={handleAssignLiveWeight}>
                Assign {liveScaleWeight} kg to Grade {activeGradeTab}
              </Button>
            </div>

            {/* Right: Commercial Grades & Pallet QR Assignment (7 cols) */}
            <div className="lg:col-span-7 border border-border p-5 bg-card space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3 flex-wrap gap-2">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground block">
                    Grade Pallet Assignment
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Record weights and scan permanent pallet QR codes for each grade.
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-foreground">
                  Sum: {formatWeight(totalGraded)} kg / Gross {grossIntakeKg} kg
                </span>
              </div>

              <div className="space-y-3">
                {/* Grade A */}
                <div
                  className={`p-3 border transition-colors cursor-pointer ${
                    activeGradeTab === 'A' ? 'border-emerald-500 bg-emerald-50/40' : 'border-border bg-card'
                  }`}
                  onClick={() => setActiveGradeTab('A')}
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 flex items-center justify-center font-bold font-mono bg-emerald-100 text-emerald-900 border border-emerald-300">
                        A
                      </span>
                      <div>
                        <span className="font-bold text-sm text-foreground block">Grade A (&gt;55mm)</span>
                        <span className="text-xs text-muted-foreground">Large</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground font-mono">Weight:</span>
                        <input
                          type="number"
                          step="0.1"
                          value={gradeAKg}
                          onChange={(e) => setGradeAKg(e.target.value)}
                          className="w-20 px-2 py-1 text-right font-mono font-bold text-emerald-900 border border-border bg-background text-sm"
                        />
                        <span className="text-xs font-bold text-muted-foreground">kg</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground font-mono">Pallet:</span>
                        {gradeAPalletQr ? (
                          <div className="flex items-center gap-1.5">
                            <Badge tone="success" dot className="font-mono text-xs">
                              {gradeAPalletQr}
                            </Badge>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                openScannerFor('A')
                              }}
                              className="text-xs text-primary hover:underline flex items-center gap-0.5 font-semibold cursor-pointer"
                              title="Re-scan Pallet QR"
                            >
                              <Icon name="scan" size={13} />
                              Scan
                            </button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="primary"
                            icon="scan"
                            onClick={(e) => {
                              e.stopPropagation()
                              openScannerFor('A')
                            }}
                          >
                            Scan Pallet
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Grade B */}
                <div
                  className={`p-3 border transition-colors cursor-pointer ${
                    activeGradeTab === 'B' ? 'border-blue-500 bg-blue-50/40' : 'border-border bg-card'
                  }`}
                  onClick={() => setActiveGradeTab('B')}
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 flex items-center justify-center font-bold font-mono bg-blue-100 text-blue-900 border border-blue-300">
                        B
                      </span>
                      <div>
                        <span className="font-bold text-sm text-foreground block">Grade B (40-55mm)</span>
                        <span className="text-xs text-muted-foreground">Medium</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground font-mono">Weight:</span>
                        <input
                          type="number"
                          step="0.1"
                          value={gradeBKg}
                          onChange={(e) => setGradeBKg(e.target.value)}
                          className="w-20 px-2 py-1 text-right font-mono font-bold text-blue-900 border border-border bg-background text-sm"
                        />
                        <span className="text-xs font-bold text-muted-foreground">kg</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground font-mono">Pallet:</span>
                        {gradeBPalletQr ? (
                          <div className="flex items-center gap-1.5">
                            <Badge tone="success" dot className="font-mono text-xs">
                              {gradeBPalletQr}
                            </Badge>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                openScannerFor('B')
                              }}
                              className="text-xs text-primary hover:underline flex items-center gap-0.5 font-semibold cursor-pointer"
                              title="Re-scan Pallet QR"
                            >
                              <Icon name="scan" size={13} />
                              Scan
                            </button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="primary"
                            icon="scan"
                            onClick={(e) => {
                              e.stopPropagation()
                              openScannerFor('B')
                            }}
                          >
                            Scan Pallet
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Grade C */}
                <div
                  className={`p-3 border transition-colors cursor-pointer ${
                    activeGradeTab === 'C' ? 'border-amber-500 bg-amber-50/40' : 'border-border bg-card'
                  }`}
                  onClick={() => setActiveGradeTab('C')}
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 flex items-center justify-center font-bold font-mono bg-amber-100 text-amber-900 border border-amber-300">
                        C
                      </span>
                      <div>
                        <span className="font-bold text-sm text-foreground block">Grade C (&lt;40mm)</span>
                        <span className="text-xs text-muted-foreground">Small</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground font-mono">Weight:</span>
                        <input
                          type="number"
                          step="0.1"
                          value={gradeCKg}
                          onChange={(e) => setGradeCKg(e.target.value)}
                          className="w-20 px-2 py-1 text-right font-mono font-bold text-amber-900 border border-border bg-background text-sm"
                        />
                        <span className="text-xs font-bold text-muted-foreground">kg</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground font-mono">Pallet:</span>
                        {gradeCPalletQr ? (
                          <div className="flex items-center gap-1.5">
                            <Badge tone="success" dot className="font-mono text-xs">
                              {gradeCPalletQr}
                            </Badge>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                openScannerFor('C')
                              }}
                              className="text-xs text-primary hover:underline flex items-center gap-0.5 font-semibold cursor-pointer"
                              title="Re-scan Pallet QR"
                            >
                              <Icon name="scan" size={13} />
                              Scan
                            </button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="primary"
                            icon="scan"
                            onClick={(e) => {
                              e.stopPropagation()
                              openScannerFor('C')
                            }}
                          >
                            Scan Pallet
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dynamic Shrinkage Preview Bar */}
              <div className="p-3 bg-red-50/70 border border-red-200 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-red-900 block">
                    Shrinkage Loss:
                  </span>
                  <span className="text-xs text-red-800">
                    Gross ({formatWeight(gGross)} kg) - Graded ({formatWeight(totalGraded)} kg)
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black font-mono text-red-700 block">
                    -{formatWeight(shrinkageKg)} kg
                  </span>
                  <span className="text-xs font-mono font-bold text-red-800">
                    {shrinkagePct.toFixed(1)}% Deficit
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between border-t border-border pt-4">
            <Button variant="outline" onClick={() => setActiveStep(2)}>
              Back
            </Button>
            <Button
              variant="primary"
              icon="check"
              touch
              disabled={totalGraded <= 0}
              onClick={() => setActiveStep(4)}
            >
              Continue to Review
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Review & Save ── */}
      {activeStep === 4 && (
        <div className="bg-card border border-border p-6 shadow-sm space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-2">
            <div>
              <span className="text-xs uppercase font-mono font-semibold tracking-wider text-muted-foreground">
                Step 4 of 4 · Review & Save
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                Review Shrinkage & Save Batch
              </h2>
            </div>
            {savedSuccessBatch ? (
              <Badge tone="success" dot>
                Saved & Linked
              </Badge>
            ) : (
              <Badge tone="warning" dot>
                Pending Save
              </Badge>
            )}
          </div>

          {/* Verification Metrics Grid */}
          <div className="p-4 bg-muted/30 border border-border grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <span className="text-xs text-muted-foreground block font-medium">Origin Waring</span>
              <span className="font-mono font-bold text-base text-foreground block">{waringCode}</span>
              <span className="text-xs text-muted-foreground">{farmerName}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block font-medium">Intake Weight</span>
              <span className="text-2xl font-black text-foreground block font-mono">
                {formatWeight(gGross)} <span className="text-xs font-normal text-muted-foreground">kg</span>
              </span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block font-medium">Commercial Graded</span>
              <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400 block font-mono">
                {formatWeight(totalGraded)} <span className="text-xs font-normal text-muted-foreground">kg</span>
              </span>
              <span className="text-xs text-emerald-800 font-mono font-bold">{yieldPct.toFixed(1)}% Yield</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block font-medium">Shrinkage Loss</span>
              <span className="text-2xl font-black text-red-700 block font-mono">
                -{formatWeight(shrinkageKg)} <span className="text-xs font-normal text-muted-foreground">kg</span>
              </span>
              <span className="text-xs text-red-800 font-mono font-bold">{shrinkagePct.toFixed(1)}%</span>
            </div>
          </div>

          {/* Commercial Grade Pallets Breakdown */}
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground block">
              Assigned Pallets for Packaging:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Grade A Card */}
              <div className="p-4 border border-emerald-300 bg-emerald-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-emerald-950">Grade A</span>
                  <span className="text-xs font-mono font-bold text-emerald-800">&gt; 55 mm</span>
                </div>
                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-2xl font-black font-mono text-emerald-900">{formatWeight(gA)} kg</span>
                  <span className="text-xs font-mono text-muted-foreground">
                    {gGross > 0 ? ((gA / gGross) * 100).toFixed(0) : 0}% of gross
                  </span>
                </div>
                <div className="pt-2 border-t border-emerald-200 flex justify-between text-xs">
                  <span className="text-muted-foreground font-mono">Pallet QR:</span>
                  <strong className="font-mono text-emerald-950">{gradeAPalletQr || 'Not Assigned'}</strong>
                </div>
              </div>

              {/* Grade B Card */}
              <div className="p-4 border border-blue-300 bg-blue-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-blue-950">Grade B</span>
                  <span className="text-xs font-mono font-bold text-blue-800">40 - 55 mm</span>
                </div>
                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-2xl font-black font-mono text-blue-900">{formatWeight(gB)} kg</span>
                  <span className="text-xs font-mono text-muted-foreground">
                    {gGross > 0 ? ((gB / gGross) * 100).toFixed(0) : 0}% of gross
                  </span>
                </div>
                <div className="pt-2 border-t border-blue-200 flex justify-between text-xs">
                  <span className="text-muted-foreground font-mono">Pallet QR:</span>
                  <strong className="font-mono text-blue-950">{gradeBPalletQr || 'Not Assigned'}</strong>
                </div>
              </div>

              {/* Grade C Card */}
              <div className="p-4 border border-amber-300 bg-amber-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-amber-950">Grade C</span>
                  <span className="text-xs font-mono font-bold text-amber-800">&lt; 40 mm</span>
                </div>
                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-2xl font-black font-mono text-amber-900">{formatWeight(gC)} kg</span>
                  <span className="text-xs font-mono text-muted-foreground">
                    {gGross > 0 ? ((gC / gGross) * 100).toFixed(0) : 0}% of gross
                  </span>
                </div>
                <div className="pt-2 border-t border-amber-200 flex justify-between text-xs">
                  <span className="text-muted-foreground font-mono">Pallet QR:</span>
                  <strong className="font-mono text-amber-950">{gradeCPalletQr || 'Not Assigned'}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Visual Yield Distribution Bar */}
          <div className="space-y-3 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold uppercase tracking-wider text-foreground block">
                Yield Breakdown:
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                Total Graded: {formatWeight(totalGraded)} kg / Gross: {formatWeight(gGross)} kg
              </span>
            </div>
            <div className="h-11 w-full flex bg-muted overflow-hidden border-2 border-border shadow-sm">
              <div
                style={{ width: `${gGross > 0 ? (gA / gGross) * 100 : 0}%` }}
                className="bg-emerald-600 flex items-center justify-center text-sm sm:text-base text-white font-mono font-black transition-all"
                title={`Grade A: ${formatWeight(gA)} kg`}
              >
                {gGross > 0 && (gA / gGross) > 0.06 ? `${((gA / gGross) * 100).toFixed(0)}%` : ''}
              </div>
              <div
                style={{ width: `${gGross > 0 ? (gB / gGross) * 100 : 0}%` }}
                className="bg-blue-600 flex items-center justify-center text-sm sm:text-base text-white font-mono font-black transition-all"
                title={`Grade B: ${formatWeight(gB)} kg`}
              >
                {gGross > 0 && (gB / gGross) > 0.06 ? `${((gB / gGross) * 100).toFixed(0)}%` : ''}
              </div>
              <div
                style={{ width: `${gGross > 0 ? (gC / gGross) * 100 : 0}%` }}
                className="bg-amber-500 flex items-center justify-center text-sm sm:text-base text-white font-mono font-black transition-all"
                title={`Grade C: ${formatWeight(gC)} kg`}
              >
                {gGross > 0 && (gC / gGross) > 0.06 ? `${((gC / gGross) * 100).toFixed(0)}%` : ''}
              </div>
              <div
                style={{ width: `${gGross > 0 ? (shrinkageKg / gGross) * 100 : 0}%` }}
                className="bg-red-500 flex items-center justify-center text-sm sm:text-base text-white font-mono font-black transition-all"
                title={`Shrinkage: ${formatWeight(shrinkageKg)} kg`}
              >
                {gGross > 0 && (shrinkageKg / gGross) > 0.06 ? `${shrinkagePct.toFixed(0)}%` : ''}
              </div>
            </div>
            <div className="flex justify-between items-center text-xs sm:text-sm font-mono flex-wrap gap-2 pt-1">
              <span className="flex items-center gap-1.5 text-foreground font-semibold">
                <span className="w-3.5 h-3.5 bg-emerald-600 inline-block border border-emerald-700"></span>
                <span>Grade A: <strong className="text-emerald-800 font-bold">{gGross > 0 ? ((gA / gGross) * 100).toFixed(0) : 0}%</strong></span>
              </span>
              <span className="flex items-center gap-1.5 text-foreground font-semibold">
                <span className="w-3.5 h-3.5 bg-blue-600 inline-block border border-blue-700"></span>
                <span>Grade B: <strong className="text-blue-800 font-bold">{gGross > 0 ? ((gB / gGross) * 100).toFixed(0) : 0}%</strong></span>
              </span>
              <span className="flex items-center gap-1.5 text-foreground font-semibold">
                <span className="w-3.5 h-3.5 bg-amber-500 inline-block border border-amber-600"></span>
                <span>Grade C: <strong className="text-amber-800 font-bold">{gGross > 0 ? ((gC / gGross) * 100).toFixed(0) : 0}%</strong></span>
              </span>
              <span className="flex items-center gap-1.5 text-foreground font-semibold">
                <span className="w-3.5 h-3.5 bg-red-500 inline-block border border-red-600"></span>
                <span>Shrinkage: <strong className="text-red-600 font-bold">{shrinkagePct.toFixed(0)}%</strong></span>
              </span>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between border-t border-border pt-4 flex-wrap gap-2">
            {!savedSuccessBatch ? (
              <>
                <Button variant="outline" onClick={() => setActiveStep(3)}>
                  Back
                </Button>
                <Button
                  variant="primary"
                  icon="check"
                  touch
                  disabled={totalGraded <= 0}
                  onClick={handleSaveGradingRun}
                >
                  Save Batch
                </Button>
              </>
            ) : (
              <>
                <div className="text-xs text-muted-foreground font-mono">
                  Batch saved: {savedSuccessBatch.palletCode} ({savedSuccessBatch.timestamp})
                </div>
                <Button variant="primary" icon="check" touch onClick={handleStartNextWaring}>
                  Next Waring
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
      {/* ── FOCUS MODE OVERLAY (FULL SCREEN) ── */}
      {focusMode && (
        <div
          className="fixed inset-0 z-50 bg-background flex flex-col overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Grading Focus Mode"
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

            {/* Stepper Progress Bar in Focus Header */}
            <div className="hidden md:flex">
              {renderStepperBar()}
            </div>

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
              <Button variant="outline" size="sm" icon="close" onClick={() => setFocusMode(false)}>
                Exit Focus
              </Button>
            </div>
          </header>

          <main className="flex-1 p-4 md:p-8 max-w-5xl w-full mx-auto space-y-6">
            <div className="md:hidden">
              {renderStepperBar()}
            </div>
            {renderSequentialContent()}
          </main>
        </div>
      )}

      {/* ── NORMAL DASHBOARD PAGE VIEW ── */}
      <div className="space-y-6">
        <PageHeader
          title="Station 02: Sorting"
          subtitle="Waring intake, sizing, washing, grade weighing, and pallet linkage."
          actions={
            <div className="flex items-center gap-2">
              <Button variant="primary" icon="expand" touch onClick={enterFocusMode}>
                Focus Mode
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon="history"
                onClick={() => document.getElementById('grading-ledger')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Records ({records.length})
              </Button>
            </div>
          }
        />

        {/* Quick Stats Grid (4 Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-none p-4 shadow-sm space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Buffer Queue</p>
            <p className="text-2xl font-bold tracking-tight text-foreground">{BUFFER_WARINGS.length}</p>
            <p className="text-xs text-muted-foreground">Waiting warings</p>
          </div>
          <div className="bg-card border border-border rounded-none p-4 shadow-sm space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Batches Sorted</p>
            <p className="text-2xl font-bold tracking-tight text-foreground">{records.length}</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              Pallets ready
            </p>
          </div>
          <div className="bg-card border border-border rounded-none p-4 shadow-sm space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Scale Capacity</p>
            <p className="text-2xl font-bold tracking-tight text-foreground">100 kg</p>
            <p className="text-xs text-muted-foreground">Scale 02</p>
          </div>
          <div className="bg-card border border-border rounded-none p-4 shadow-sm space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Workflow Mode</p>
            <p className="text-lg font-bold tracking-tight text-foreground">Sequential</p>
            <p className="text-xs text-muted-foreground">Step 1 to 4</p>
          </div>
        </div>

        {/* Sequential Stepper in Standard View */}
        <div id="grading-stepper" className="bg-card border border-border rounded-none p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-base text-foreground">Sorting Stepper</span>
              <Badge tone="accent">Step {activeStep} of 4</Badge>
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

          {/* Main Sequential Step Content */}
          {renderSequentialContent()}
        </div>

        {/* Grading Ledger Table */}
        <div id="grading-ledger" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight text-foreground">Today's Sorting Records</h2>
            <span className="text-xs text-muted-foreground font-mono">
              {records.length} batches recorded
            </span>
          </div>

          <DataTable rowKey={(row) => row.id} columns={columns} data={records} />
        </div>
      </div>

      {/* ── Camera Scanner Viewfinder Modal for Pallet QR ── */}
      {scannerTargetGrade && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card rounded-none max-w-md w-full overflow-hidden shadow-2xl border border-border">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name="scan" size={18} className="text-primary" />
                <span className="font-bold text-sm text-foreground">
                  Scan Pallet QR · Grade {scannerTargetGrade}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  stopCamera()
                  setScannerTargetGrade(null)
                }}
                className="text-muted-foreground hover:text-foreground p-1 cursor-pointer"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {cameraActive ? (
                <div className="relative rounded-none overflow-hidden aspect-square bg-black flex items-center justify-center">
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    playsInline
                    muted
                    autoPlay
                  />
                  {/* Viewfinder Reticle & Laser */}
                  <div className="absolute inset-8 border-2 border-emerald-500 rounded-none pointer-events-none">
                    <div className="w-full h-0.5 bg-emerald-500 shadow-[0_0_8px_#10b981] animate-bounce" />
                  </div>
                </div>
              ) : (
                <div className="bg-muted/30 border border-dashed border-border p-6 text-center space-y-3">
                  <div className="w-12 h-12 bg-primary/10 text-primary flex items-center justify-center mx-auto">
                    <Icon name="scan" size={24} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      Ready to Scan Pallet QR
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Scan the permanent QR barcode attached to the physical Grade {scannerTargetGrade} pallet.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    icon="scan"
                    onClick={startCamera}
                  >
                    Activate Camera
                  </Button>
                  {cameraError && (
                    <p className="text-xs text-destructive">{cameraError}</p>
                  )}
                </div>
              )}

              {/* USB 2D Scanner Wedge Input in Modal */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-mono uppercase block">
                  Or USB 2D Scanner Input:
                </label>
                <div className="flex gap-2">
                  <input
                    ref={palletScanInputRef}
                    type="text"
                    placeholder={`e.g. PLT-GRD-${scannerTargetGrade}-01`}
                    value={manualPalletInput}
                    onChange={(e) => setManualPalletInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAssignScannedPallet(manualPalletInput, scannerTargetGrade)
                      }
                    }}
                    className="flex-1 px-3 py-1.5 text-xs font-mono font-bold uppercase border border-border bg-background"
                    autoFocus
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    icon="check"
                    onClick={() => handleAssignScannedPallet(manualPalletInput, scannerTargetGrade)}
                  >
                    Assign
                  </Button>
                </div>
              </div>

              {/* Quick Simulation Chips */}
              <div className="space-y-1.5 pt-2 border-t border-border">
                <p className="text-xs font-mono text-muted-foreground uppercase text-center">
                  Simulate Pallet Scan:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAssignScannedPallet(`PLT-GRD-${scannerTargetGrade}-01`, scannerTargetGrade)}
                    className="text-xs justify-center font-mono"
                  >
                    PLT-GRD-{scannerTargetGrade}-01
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAssignScannedPallet(`PLT-GRD-${scannerTargetGrade}-02`, scannerTargetGrade)}
                    className="text-xs justify-center font-mono"
                  >
                    PLT-GRD-{scannerTargetGrade}-02
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-3 bg-muted/30 border-t border-border text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  stopCamera()
                  setScannerTargetGrade(null)
                }}
                className="text-xs"
              >
                Close Scanner
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
