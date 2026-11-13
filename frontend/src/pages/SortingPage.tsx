/**
 * Station 02: Sorting Console
 *
 * Implements the 4-step sequential workflow:
 *   Step 1: Scan Waring (Scan WRG-... QR)
 *   Step 2: Sizing & Wash (Prepare sizing machine & select washed vs unwashed protocol)
 *   Step 3: Weigh Grades (Weigh Grade A, B, C on Scale 02 and link pre-attached Pallet QRs)
 *   Step 4: Review & Save (Review yield breakdown bar, automated loss calculation, and commit batch)
 *
 * Fully unified with Station 01 Stepper architecture and 100% sequential in Focus Mode.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import Icon from '../components/shared/Icon'
import { Input } from '../components/shared/Form'
import DataTable, { type Column } from '../components/shared/DataTable'
import PageHeader from '../components/shared/PageHeader'
import { useToast } from '../components/feedback/Toast'
import ScaleWeightInput from '../components/operator/ScaleWeightInput'
import { formatWeight } from '../lib/utils'
import { usePackhouseStore, type GradedBatchRecord, type BufferWaringItem } from '../hooks/usePackhouseStore'
import CameraScannerModal from '../components/shared/CameraScannerModal'
import { api, type Pallet } from '../services/api'

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
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1)

  /* ── Step 1: Inflow Waring & Context ── */
  const initialWaring = {
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
  const [palletCode, setPalletCode] = useState('')
  const scanInputRef = useRef<HTMLInputElement>(null)

  /* ── Step 2: Sizing & Wash ── */
  const [sizerFedConfirmed, setSizerFedConfirmed] = useState(true)
  const [washingRecord, setWashingRecord] = useState<'WASHED' | 'UNWASHED'>('WASHED')

  /* ── Step 3: Scale 02 Live Weighing & Pallet QRs (Grade A, B, C) ── */
  const [activeGradeTab, setActiveGradeTab] = useState<'A' | 'B' | 'C'>('A')
  const [liveScaleWeight, setLiveScaleWeight] = useState('0.0')
  const [scaleCapacityKg, setScaleCapacityKg] = useState<number | null>(null)
  const [scaleOnline, setScaleOnline] = useState(false)

  useEffect(() => {
    let active = true
    const pollScale = () => {
      api.scales
        .getWeight('02')
        .then((scale) => {
          if (!active) return
          setScaleCapacityKg(Number(scale?.capacityKg) || null)
          setScaleOnline(scale?.online === true)
        })
        .catch(() => active && setScaleOnline(false))
    }
    pollScale()
    const timer = window.setInterval(pollScale, 2000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  /* Physical Pallet Registry */
  const [registeredPallets, setRegisteredPallets] = useState<Pallet[]>([])

  useEffect(() => {
    let active = true
    api.pallets
      .list()
      .then((data) => {
        if (!active || !Array.isArray(data)) return
        setRegisteredPallets(data)
        const available = data.filter(
          (p) => p.status === 'AVAILABLE' || (!p.status && (p.remainingKg ?? 0) <= 0),
        )
        if (available.length >= 1) {
          setGradeAPalletQr(available[0].code)
          setPalletCode(available[0].code)
        }
        if (available.length >= 2) {
          setGradeBPalletQr(available[1].code)
        }
        if (available.length >= 3) {
          setGradeCPalletQr(available[2].code)
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  /* Grade A */
  const [gradeAKg, setGradeAKg] = useState('')
  const [gradeAPalletQr, setGradeAPalletQr] = useState('')

  /* Grade B */
  const [gradeBKg, setGradeBKg] = useState('')
  const [gradeBPalletQr, setGradeBPalletQr] = useState('')

  /* Grade C */
  const [gradeCKg, setGradeCKg] = useState('')
  const [gradeCPalletQr, setGradeCPalletQr] = useState('')

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
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [focusMode, cameraModalMode])

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
  const allGradesRecorded = [gradeAKg, gradeBKg, gradeCKg].every((value) => value !== '')

  const totalGraded = gA + gB + gC
  const shrinkageKg = Math.max(0, gGross - totalGraded)
  const shrinkagePct = gGross > 0 ? (shrinkageKg / gGross) * 100 : 0
  const yieldPct = gGross > 0 ? (totalGraded / gGross) * 100 : 0

  const otherGradesWeight = activeGradeTab === 'A'
    ? gB + gC
    : activeGradeTab === 'B'
    ? gA + gC
    : gA + gB
  const maxAllowedForActiveGrade = Math.max(0, Number((gGross - otherGradesWeight).toFixed(3)))

  /* Select Waring Handler */
  const handleSelectWaring = (item: BufferWaringItem) => {
    setWaringCode(item.code)
    setFarmerName(item.farmerName)
    setFarmerVillage(item.farmerVillage || 'Dieng, Wonosobo')
    setGrossIntakeKg(String(item.grossWeightKg))
    setWaringScanError(null)

    setGradeAKg('')
    setGradeBKg('')
    setGradeCKg('')
    setLiveScaleWeight('')
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
  const handleAssignLiveWeight = (explicitVal?: string) => {
    const rawVal = explicitVal !== undefined ? explicitVal : liveScaleWeight
    const val = rawVal.trim()
    const numVal = Number(val)
    if (val === '' || isNaN(numVal) || numVal < 0) {
      toast.error('Enter a valid weight (0 or higher).')
      return
    }

    if (numVal > maxAllowedForActiveGrade + 0.005) {
      toast.error(
        `Weight ${numVal.toFixed(3)} kg exceeds remaining intake capacity of ${maxAllowedForActiveGrade.toFixed(3)} kg for this waring.`,
      )
      return
    }

    if (activeGradeTab === 'A') {
      setGradeAKg(val)
      toast.success(numVal === 0 ? 'Grade A set to 0 kg (None)' : `Grade A weight set to ${val} kg`)
      setActiveGradeTab('B')
      setLiveScaleWeight(gradeBKg || '0')
    } else if (activeGradeTab === 'B') {
      setGradeBKg(val)
      toast.success(numVal === 0 ? 'Grade B set to 0 kg (None)' : `Grade B weight set to ${val} kg`)
      setActiveGradeTab('C')
      setLiveScaleWeight(gradeCKg || '0')
    } else {
      setGradeCKg(val)
      toast.success(numVal === 0 ? 'Grade C set to 0 kg (None)' : `Grade C weight set to ${val} kg`)
    }
  }

  /* Pallet QR Assignment */
  const handleAssignScannedPallet = (scannedCode: string, targetGrade: 'A' | 'B' | 'C') => {
    const code = scannedCode.trim().toUpperCase()
    if (!code) return

    // Prevent re-assigning pallet that is currently IN_USE with existing inventory
    const matched = registeredPallets.find((p) => p.code.toUpperCase() === code)
    if (matched && matched.status === 'IN_USE' && (matched.remainingKg ?? 0) > 0) {
      toast.error(
        `Pallet "${code}" is currently IN USE with Grade ${matched.grade || 'unspecified'} (${matched.remainingKg} kg). Cannot reuse until Station 03 finishes packaging.`,
      )
      return
    }

    // Check if already assigned to another grade in this active run
    if (
      (targetGrade !== 'A' && gradeAPalletQr === code) ||
      (targetGrade !== 'B' && gradeBPalletQr === code) ||
      (targetGrade !== 'C' && gradeCPalletQr === code)
    ) {
      toast.error(`Pallet "${code}" is already assigned to another grade in this run.`)
      return
    }

    if (targetGrade === 'A') {
      setGradeAPalletQr(code)
      setPalletCode(code)
    }
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
  const handleSaveSortingRun = async () => {
    if (!allGradesRecorded) {
      toast.error('Record a weight or 0 kg for each grade.')
      return
    }
    if (totalGraded <= 0) {
      toast.error('Cannot save batch with zero graded weight.')
      return
    }

    if (totalGraded > gGross + 0.005) {
      toast.error(
        `Total graded weight (${totalGraded.toFixed(3)} kg) exceeds waring intake (${gGross.toFixed(3)} kg).`,
      )
      return
    }
    if ((gA > 0 && !gradeAPalletQr.trim()) || (gB > 0 && !gradeBPalletQr.trim()) || (gC > 0 && !gradeCPalletQr.trim())) {
      toast.error('Assign a registered pallet to every grade with weight.')
      return
    }

    const activePalletCodes: string[] = []
    if (gA > 0 && gradeAPalletQr.trim()) activePalletCodes.push(gradeAPalletQr.trim())
    if (gB > 0 && gradeBPalletQr.trim()) activePalletCodes.push(gradeBPalletQr.trim())
    if (gC > 0 && gradeCPalletQr.trim()) activePalletCodes.push(gradeCPalletQr.trim())

    const combinedPalletCode = activePalletCodes.length > 0 ? activePalletCodes.join(', ') : (palletCode || 'PLT-001')

    try {
    const newBatch = await addSortedBatch({
      waringCode,
      farmerName,
      farmerVillage,
      palletCode: combinedPalletCode,
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the sorting batch.')
    }
  }

  /* Reset for next waring */
  const handleStartNextWaring = () => {
    api.pallets
      .list()
      .then((data) => {
        if (!Array.isArray(data)) return
        setRegisteredPallets(data)
        const available = data.filter(
          (p) => p.status === 'AVAILABLE' || (!p.status && (p.remainingKg ?? 0) <= 0),
        )
        const pA = available[0]?.code || ''
        const pB = available[1]?.code || ''
        const pC = available[2]?.code || ''
        setPalletCode(pA)
        setGradeAPalletQr(pA)
        setGradeBPalletQr(pB)
        setGradeCPalletQr(pC)
      })
      .catch(() => {})

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
      render: (r) => {
        const badges: { grade: string; code: string; tone: string }[] = []
        if (r.gradeAKg > 0 && r.gradeAPalletQr) {
          badges.push({ grade: 'A', code: r.gradeAPalletQr, tone: 'text-white bg-emerald-600 dark:bg-emerald-700 border-emerald-500' })
        }
        if (r.gradeBKg > 0 && r.gradeBPalletQr) {
          badges.push({ grade: 'B', code: r.gradeBPalletQr, tone: 'text-white bg-blue-600 dark:bg-blue-700 border-blue-500' })
        }
        if (r.gradeCKg > 0 && r.gradeCPalletQr) {
          badges.push({ grade: 'C', code: r.gradeCPalletQr, tone: 'text-white bg-amber-600 dark:bg-amber-700 border-amber-500' })
        }

        if (badges.length === 0) {
          const codes = (r.palletCode || '').split(',').map((c) => c.trim()).filter(Boolean)
          if (codes.length === 0) {
            return <span className="font-mono text-xs text-muted-foreground">-</span>
          }
          return (
            <div className="flex flex-wrap items-center gap-1">
              {codes.map((c, i) => (
                <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded border text-[11px] font-mono font-bold text-white bg-zinc-700 border-zinc-600">
                  {c}
                </span>
              ))}
            </div>
          )
        }

        return (
          <div className="flex flex-wrap items-center gap-1">
            {badges.map((p) => (
              <span key={p.grade} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] font-mono font-bold text-white ${p.tone}`}>
                <span className="text-white font-extrabold">{p.grade}:</span>
                <span className="text-white font-bold">{p.code}</span>
              </span>
            ))}
          </div>
        )
      },
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
        <div className="flex flex-col">
          <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {r.gradeAKg > 0 ? `${formatWeight(r.gradeAKg)} kg` : '—'}
          </span>
          {r.gradeAKg > 0 && r.gradeAPalletQr && (
            <span className="font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400">{r.gradeAPalletQr}</span>
          )}
        </div>
      ),
    },
    {
      key: 'gradeBKg',
      label: 'Grade B',
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
            {r.gradeBKg > 0 ? `${formatWeight(r.gradeBKg)} kg` : '—'}
          </span>
          {r.gradeBKg > 0 && r.gradeBPalletQr && (
            <span className="font-mono text-[10px] font-bold text-blue-600 dark:text-blue-400">{r.gradeBPalletQr}</span>
          )}
        </div>
      ),
    },
    {
      key: 'gradeCKg',
      label: 'Grade C',
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-mono text-xs font-semibold text-amber-600 dark:text-amber-400">
            {r.gradeCKg > 0 ? `${formatWeight(r.gradeCKg)} kg` : '—'}
          </span>
          {r.gradeCKg > 0 && r.gradeCPalletQr && (
            <span className="font-mono text-[10px] font-bold text-amber-600 dark:text-amber-400">{r.gradeCPalletQr}</span>
          )}
        </div>
      ),
    },
    {
      key: 'shrinkageKg',
      label: 'Shrinkage / Loss',
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
    <div className="station-workflow space-y-6">
      {/* ── STEP 1: Scan Waring ── */}
      {activeStep === 1 && (
        <div className="station-step bg-card border border-border rounded-none p-6 shadow-sm space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-2">
            <div>
              <span className="text-xs uppercase font-mono font-semibold tracking-wider text-muted-foreground">
                Step 1 of 4
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                Scan Waring
              </h2>
            </div>
            <Badge tone="accent" icon="scan">
              Awaiting Scan
            </Badge>
          </div>

          {/* Centered Dashed Scanner Box (Matching User Screenshot Pattern) */}
          <div className="station-scan-box border-2 border-dashed border-border p-8 text-center space-y-5 bg-card">
            <div className="inline-flex p-3 bg-muted border border-border text-muted-foreground">
              <Icon name="scan" size={28} />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">
                2D Scanner and Camera
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Scan the QR code on the intake waring sack with a USB 2D hardware scanner or device camera.
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
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Button type="submit" variant="primary" icon="check" className="w-full sm:w-auto">
                  Verify
                </Button>
                <Button type="button" variant="outline" icon="scan" onClick={openWaringCameraModal} className="w-full sm:w-auto">
                  Camera
                </Button>
              </div>
            </form>
            {waringScanError && <p className="text-xs text-destructive font-mono">{waringScanError}</p>}

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
        <div className="station-step bg-card border border-border rounded-none p-6 shadow-sm space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-2">
            <div>
              <span className="text-xs uppercase font-mono font-semibold tracking-wider text-muted-foreground">
                Step 2 of 4
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                Size & Wash
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
              <p className="station-secondary-copy text-xs text-muted-foreground leading-relaxed">
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
                <h4 className="text-sm font-bold">2. Washing Decision</h4>
                <Badge tone={washingRecord === 'WASHED' ? 'accent' : 'neutral'}>
                  {washingRecord}
                </Badge>
              </div>
              <p className="station-secondary-copy text-xs text-muted-foreground leading-relaxed">
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
        <div className="station-step bg-card border border-border rounded-none p-6 shadow-sm space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-2">
            <div>
              <span className="text-xs uppercase font-mono font-semibold tracking-wider text-muted-foreground">
                Step 3 of 4
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                Weigh Grades
              </h2>
            </div>
          </div>

          {/* Grade Switcher Tabs */}
          <div className="station-grade-tabs grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(['A', 'B', 'C'] as const).map((grade) => {
              const isActive = activeGradeTab === grade
              const weight = grade === 'A' ? gradeAKg : grade === 'B' ? gradeBKg : gradeCKg
              const qr = grade === 'A' ? gradeAPalletQr : grade === 'B' ? gradeBPalletQr : gradeCPalletQr
              return (
                <button
                  key={grade}
                  type="button"
                  onClick={() => {
                    setActiveGradeTab(grade)
                    const currentVal = grade === 'A' ? gradeAKg : grade === 'B' ? gradeBKg : gradeCKg
                    setLiveScaleWeight(currentVal || '0')
                  }}
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
                <h4 className="text-sm font-semibold">Weight Reading (Grade {activeGradeTab})</h4>
                <span className="text-xs font-mono text-muted-foreground">
                  Max: {formatWeight(maxAllowedForActiveGrade)} kg
                </span>
              </div>
              <ScaleWeightInput
                stationId="02"
                value={liveScaleWeight}
                onChange={setLiveScaleWeight}
                capacityKg={scaleCapacityKg ?? 0}
                maxAllowedWeightKg={maxAllowedForActiveGrade}
                allowZero
                label={`Grade ${activeGradeTab} Weight`}
              />
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  className="flex-1"
                  icon="check"
                  disabled={
                    liveScaleWeight === '' ||
                    Number(liveScaleWeight) < 0 ||
                    Number(liveScaleWeight) > maxAllowedForActiveGrade + 0.005
                  }
                  onClick={() => handleAssignLiveWeight()}
                >
                  Assign {liveScaleWeight || '0'} kg to Grade {activeGradeTab}
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  title="Mark this grade as 0 kg (no harvest for this grade)"
                  onClick={() => {
                    setLiveScaleWeight('0')
                    handleAssignLiveWeight('0')
                  }}
                >
                  Set 0 kg
                </Button>
              </div>
            </div>

            {/* Right Column: Pre-attached Pallet QR Linkage */}
            <div className="border border-border p-4 bg-card space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Pallet Link (Grade {activeGradeTab})</h4>
                <Badge tone="neutral">
                  Pre-attached QR
                </Badge>
              </div>
              <p className="station-secondary-copy text-xs text-muted-foreground">
                Scan the permanent QR code sticker attached to the Grade {activeGradeTab} physical pallet.
              </p>

              <div className="p-3 bg-muted/20 border border-border flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-muted-foreground uppercase font-mono block">Linked Pallet</span>
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
              <div className="station-secondary-panel space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-mono text-muted-foreground">Select Physical Pallet</span>
                  <Link
                    to="/dashboard/pallets"
                    target="_blank"
                    className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium"
                  >
                    <Icon name="pallet" size={13} />
                    Pallet Registry / Reprint
                  </Link>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1.5 bg-muted/20 border border-border">
                  {registeredPallets.length === 0 ? (
                    <span className="text-xs text-muted-foreground p-1">No physical pallets loaded.</span>
                  ) : (
                    registeredPallets.map((p) => {
                      const isCurrentGrade =
                        (activeGradeTab === 'A' && gradeAPalletQr === p.code) ||
                        (activeGradeTab === 'B' && gradeBPalletQr === p.code) ||
                        (activeGradeTab === 'C' && gradeCPalletQr === p.code)
                      const isAssignedOther =
                        (activeGradeTab !== 'A' && gradeAPalletQr === p.code) ||
                        (activeGradeTab !== 'B' && gradeBPalletQr === p.code) ||
                        (activeGradeTab !== 'C' && gradeCPalletQr === p.code)
                      const isInUse = p.status === 'IN_USE' && (p.remainingKg ?? 0) > 0

                      return (
                        <button
                          key={p.code}
                          type="button"
                          disabled={isInUse}
                          onClick={() => !isInUse && handleAssignScannedPallet(p.code, activeGradeTab)}
                          title={isInUse ? `In use: Grade ${p.grade || 'A'} (${p.remainingKg} kg remaining)` : undefined}
                          className={`px-2 py-1 text-xs font-mono border transition-all flex items-center gap-1.5 ${
                            isCurrentGrade
                              ? 'bg-primary text-primary-foreground border-primary font-bold shadow-xs'
                              : isInUse
                              ? 'bg-destructive/10 text-destructive/80 border-destructive/30 cursor-not-allowed opacity-60'
                              : isAssignedOther
                              ? 'bg-muted/40 text-muted-foreground border-border/50 line-through opacity-60 cursor-not-allowed'
                              : 'bg-card text-foreground border-border hover:border-primary/60 hover:bg-primary/5 cursor-pointer'
                          }`}
                        >
                          <span>{p.code}</span>
                          {isInUse ? (
                            <span className="text-[10px] font-sans font-semibold text-destructive">
                              (In Use · Grd {p.grade || 'A'})
                            </span>
                          ) : (
                            <span className="text-[10px] opacity-75 font-sans">({p.tareKg}kg)</span>
                          )}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Stepper Navigation */}
          <div className="space-y-3 pt-4 border-t border-border">
            {totalGraded > gGross + 0.005 && (
              <div className="p-3 bg-destructive/15 border-2 border-destructive/40 rounded text-xs text-destructive font-semibold flex items-center gap-2">
                <Icon name="alert-triangle" size={16} />
                <span>
                  Total graded weight ({formatWeight(totalGraded)} kg) exceeds waring intake weight ({formatWeight(gGross)} kg). Please adjust grade weights before proceeding.
                </span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <Button variant="ghost" onClick={() => setActiveStep(2)}>
                Back to Sizing
              </Button>
              <Button
                variant="primary"
                icon="check"
                touch
                disabled={!allGradesRecorded || totalGraded <= 0 || totalGraded > gGross + 0.005}
                onClick={() => setActiveStep(4)}
              >
                Proceed to Review & Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 4: Review & Save ── */}
      {activeStep === 4 && (
        <div className="station-step bg-card border border-border rounded-none p-6 shadow-sm space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-2">
            <div>
              <span className="text-xs uppercase font-mono font-semibold tracking-wider text-muted-foreground">
                Step 4 of 4
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                Review & Save
              </h2>
            </div>
            <div className="flex flex-wrap gap-1 items-center">
              {gA > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800">
                  A: {gradeAPalletQr || 'PLT-001'}
                </span>
              )}
              {gB > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-mono font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800">
                  B: {gradeBPalletQr || 'PLT-002'}
                </span>
              )}
              {gC > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-mono font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800">
                  C: {gradeCPalletQr || 'PLT-003'}
                </span>
              )}
            </div>
          </div>

          {/* Yield Distribution Bar */}
          <div className="border border-border p-4 bg-card space-y-3">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <span className="text-xs font-bold uppercase font-mono">Yield Distribution</span>
              <span
                className={`text-xs font-mono font-semibold ${
                  totalGraded > gGross + 0.005 ? 'text-destructive font-bold' : ''
                }`}
              >
                Total Graded: {formatWeight(totalGraded)} kg / {formatWeight(gGross)} kg Gross
                {totalGraded > gGross + 0.005 && ` (Exceeds by +${formatWeight(totalGraded - gGross)} kg)`}
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
                    title={`Shrinkage: ${shrinkageKg.toFixed(1)} kg (${shrinkagePct.toFixed(1)}%)`}
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
          <div className="space-y-3 pt-4 border-t border-border">
            {totalGraded > gGross + 0.005 && (
              <div className="p-4 bg-destructive/15 border-2 border-destructive/40 rounded text-xs text-destructive font-semibold flex items-center gap-2">
                <Icon name="alert-triangle" size={16} />
                <span>
                  Cannot commit batch: Total graded weight ({formatWeight(totalGraded)} kg) exceeds waring intake weight ({formatWeight(gGross)} kg).
                </span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1 flex-wrap gap-3">
              <Button variant="ghost" onClick={() => setActiveStep(3)}>
                Back to Weigh Grades
              </Button>

              {!savedSuccessBatch ? (
                <Button
                  variant="primary"
                  touch
                  icon="check"
                  disabled={!allGradesRecorded || totalGraded <= 0 || totalGraded > gGross + 0.005}
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
          <header className="sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-3 sm:px-6 sm:py-4 bg-card/95 backdrop-blur border-b border-border shadow-sm">
            <div className="min-w-0 max-w-[48%] font-mono text-[9px] sm:text-[10px] leading-tight text-muted-foreground tracking-[0.16em] sm:tracking-[0.2em] uppercase">
              STATION 02 · SORTING
            </div>

            {/* Stepper Progress inside Focus Mode! */}
            <div className="hidden md:flex">
              {renderStepperBar()}
            </div>

            {/* Controls */}
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm" icon="close" onClick={exitFocusMode} className="whitespace-nowrap">
                Exit Focus Mode
              </Button>
            </div>
          </header>

          <main className="station-focus-main flex-1 p-4 md:p-8 max-w-5xl w-full mx-auto space-y-6">
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
      <div className="station-page space-y-6">
        {/* Page Header */}
        <PageHeader
          title="Station 02: Sorting Console"
          subtitle="Sort potato fractions, check yield, and link grade pallets."
          actions={
            <Button
              variant="outline"
              size="sm"
              icon="history"
              onClick={() => document.getElementById('sorting-records')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Records ({sortedBatches.length})
            </Button>
          }
        />

        {/* Quick Stats Grid */}
        <div className="station-quick-stats grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-none p-4 shadow-sm space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Buffer Queue</p>
            <p className="text-2xl font-bold tracking-tight text-foreground">{waitingWarings.length}</p>
            <p className="text-xs text-muted-foreground">Ready for sorting</p>
          </div>
          <div className="bg-card border border-border rounded-none p-4 shadow-sm space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Scale 02 Status</p>
            <p className={`text-2xl font-bold tracking-tight ${scaleOnline ? 'text-emerald-600' : 'text-amber-600'}`}>{scaleOnline ? 'Online' : 'Offline'}</p>
            <p className="text-xs text-muted-foreground">{scaleCapacityKg ? `${scaleCapacityKg} kg Scale` : 'Scale capacity unavailable'}</p>
          </div>
          <div className="bg-card border border-border rounded-none p-4 shadow-sm space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Commercial Yield</p>
            <p className="text-2xl font-bold tracking-tight text-emerald-600">
              {gGross > 0 ? `${yieldPct.toFixed(1)}%` : '0.0%'}
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
        <div id="sorting-stepper" className="station-stepper-shell bg-card border border-border rounded-none p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-2">
            <span className="font-semibold text-base text-foreground">Sorting Stepper</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" icon="expand" onClick={enterFocusMode}>
                Focus Mode
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
              <p className="text-xs text-muted-foreground">Completed sorting batches and yield results</p>
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
          cameraModalMode === 'PALLET'
            ? [
                { label: `PLT-GRD-${activeGradeTab}-01`, value: `PLT-GRD-${activeGradeTab}-01` },
                { label: `PLT-GRD-${activeGradeTab}-02`, value: `PLT-GRD-${activeGradeTab}-02` },
              ]
            : []
        }
      />
    </>
  )
}
