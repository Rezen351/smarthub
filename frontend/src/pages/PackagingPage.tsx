/**
 * Station 03: Packaging & Dispatch Console
 *
 * Implements the unified station layout with sequential 3-step workflow:
 *   Step 1: Spec & Grade (Choose Retail Pouch 1 kg vs Bulk Export Carton 10/50 kg, and potato grade)
 *   Step 2: Weigh & Check (Precision Scale 03 reading via Modbus TCP Port 502 with real-time tolerance check)
 *   Step 3: Label & Dispatch (GS1 Digital Link QR / ITF-14 barcode label printing & automated finished goods ledger update)
 */
import { useState, useEffect } from 'react'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import Icon from '../components/shared/Icon'
import Logo from '../components/shared/Logo'
import DataTable, { type Column } from '../components/shared/DataTable'
import PageHeader from '../components/shared/PageHeader'
import { useToast } from '../components/feedback/Toast'
import ScaleWeightInput from '../components/operator/ScaleWeightInput'
import LabelPreview from '../components/operator/LabelPreview'
import { formatWeight } from '../lib/utils'

type PackagingMode = 'RETAIL_POUCH' | 'BULK_EXPORT'

interface PackageRecord {
  id: string
  code: string
  mode: PackagingMode
  grade: 'A' | 'B' | 'C'
  weightKg: number
  targetKg: number
  time: string
  status: 'LABELLED' | 'WAREHOUSE_STORED'
}

const STEPS = [
  { id: 1, label: 'Package Spec' },
  { id: 2, label: 'Weigh & Check' },
  { id: 3, label: 'Label & Store' },
] as const

export default function PackagingPage() {
  const toast = useToast()

  /* ── Mode & Stepper State ── */
  const [focusMode, setFocusMode] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1)

  /* ── Step 1: Packaging Specifications ── */
  const [packagingMode, setPackagingMode] = useState<PackagingMode>('RETAIL_POUCH')
  const [selectedGrade, setSelectedGrade] = useState<'A' | 'B' | 'C'>('A')
  const [exportTargetKg, setExportTargetKg] = useState<10 | 50>(10)

  /* ── Step 2: Scale 03 Live Precision Weighing ── */
  const [currentWeight, setCurrentWeight] = useState('1.002')
  const [isPrinting, setIsPrinting] = useState(false)
  const [savedSuccessRecord, setSavedSuccessRecord] = useState<PackageRecord | null>(null)

  const targetKg = packagingMode === 'RETAIL_POUCH' ? 1.0 : exportTargetKg
  const toleranceKg = packagingMode === 'RETAIL_POUCH' ? 0.005 : 0.05
  const weightValue = Number(currentWeight) || 0
  const isWithinTolerance = Math.abs(weightValue - targetKg) <= toleranceKg

  /* ── Packaged Output Ledger ── */
  const [packages, setPackages] = useState<PackageRecord[]>([
    {
      id: '1',
      code: 'PCH-20261025-0001',
      mode: 'RETAIL_POUCH',
      grade: 'A',
      weightKg: 1.002,
      targetKg: 1.0,
      time: '11:05',
      status: 'WAREHOUSE_STORED',
    },
    {
      id: '2',
      code: 'EXP-20261025-0001',
      mode: 'BULK_EXPORT',
      grade: 'A',
      weightKg: 10.02,
      targetKg: 10.0,
      time: '11:15',
      status: 'WAREHOUSE_STORED',
    },
    {
      id: '3',
      code: 'PCH-20261025-0002',
      mode: 'RETAIL_POUCH',
      grade: 'B',
      weightKg: 0.998,
      targetKg: 1.0,
      time: '11:20',
      status: 'WAREHOUSE_STORED',
    },
  ])

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

  const nextCodePreview = `${packagingMode === 'RETAIL_POUCH' ? 'PCH' : 'EXP'}-${new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '')}-${String(packages.length + 1).padStart(4, '0')}`

  /* Step 3: Print & Dispatch Commitment */
  const handlePrintAndLabel = () => {
    if (!isWithinTolerance) {
      toast.warning(
        `Weight ${currentWeight} kg is outside tolerance for ${
          packagingMode === 'RETAIL_POUCH' ? '1 kg pouch' : `${targetKg} kg export carton`
        }.`,
      )
    }

    setIsPrinting(true)
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const seq = packages.length + 1
    const prefix = packagingMode === 'RETAIL_POUCH' ? 'PCH' : 'EXP'
    const newCode = `${prefix}-${dateStr}-${String(seq).padStart(4, '0')}`

    window.setTimeout(() => {
      setIsPrinting(false)
      const newRecord: PackageRecord = {
        id: String(Date.now()),
        code: newCode,
        mode: packagingMode,
        grade: selectedGrade,
        weightKg: weightValue,
        targetKg,
        time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        status: 'WAREHOUSE_STORED',
      }
      setPackages((curr) => [newRecord, ...curr])
      setSavedSuccessRecord(newRecord)
      toast.success(
        `Printed & recorded ${newCode} (${
          packagingMode === 'RETAIL_POUCH' ? '1 kg Pouch' : `${targetKg} kg Export Carton`
        }). Stored in warehouse.`,
      )
    }, 600)
  }

  const handleNextUnit = () => {
    setSavedSuccessRecord(null)
    if (packagingMode === 'RETAIL_POUCH') {
      setCurrentWeight('1.001')
    } else {
      setCurrentWeight(String(exportTargetKg))
    }
    setActiveStep(2)
  }

  /* Metric counts */
  const pouchCount = packages.filter((p) => p.mode === 'RETAIL_POUCH').length
  const exportCount = packages.filter((p) => p.mode === 'BULK_EXPORT').length

  const columns: Column<PackageRecord>[] = [
    {
      key: 'code',
      label: 'Unit Code',
      priority: true,
      render: (row) => <span className="font-mono font-bold text-foreground">{row.code}</span>,
    },
    {
      key: 'mode',
      label: 'Type',
      render: (row) => (
        <Badge tone={row.mode === 'RETAIL_POUCH' ? 'success' : 'accent'}>
          {row.mode === 'RETAIL_POUCH' ? '1 kg Pouch' : `${row.targetKg} kg Carton`}
        </Badge>
      ),
    },
    {
      key: 'grade',
      label: 'Grade',
      render: (row) => <Badge tone="neutral">Grade {row.grade}</Badge>,
    },
    {
      key: 'weightKg',
      label: 'Weight',
      align: 'right',
      priority: true,
      render: (row) => (
        <span className="font-mono font-bold text-emerald-800">
          {formatWeight(row.weightKg)} kg
        </span>
      ),
    },
    {
      key: 'time',
      label: 'Time',
      render: (row) => <span className="font-mono text-xs text-muted-foreground">{row.time}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: () => (
        <Badge tone="success" dot>
          Warehouse Ready
        </Badge>
      ),
    },
  ]

  /* ─────────────────────────────────────────────────────────────
     STEPPER PROGRESS BAR COMPONENT
  ───────────────────────────────────────────────────────────── */
  const renderStepperBar = () => (
    <nav className="flex items-center gap-1 sm:gap-3 bg-muted/40 p-2 sm:px-4 sm:py-2.5 border border-border overflow-x-auto" aria-label="Packaging steps">
      {STEPS.map((step, idx) => {
        const isCurrent = activeStep === step.id
        const isDone = activeStep > step.id || (step.id === 3 && savedSuccessRecord !== null)

        return (
          <div key={step.id} className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                if (step.id < activeStep || savedSuccessRecord) {
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

  /* ─────────────────────────────────────────────────────────────
     SEQUENTIAL WORKFLOW CONTENT (Used by both Focus & Standard Views)
  ───────────────────────────────────────────────────────────── */
  const renderSequentialContent = () => (
    <div className="space-y-6">
      {/* ── STEP 1: Package Spec ── */}
      {activeStep === 1 && (
        <div className="bg-card border border-border p-6 shadow-sm space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-2">
            <div>
              <span className="text-xs uppercase font-mono font-semibold tracking-wider text-muted-foreground">
                Step 1 of 3 · Package Spec
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                Select Package Type & Grade
              </h2>
            </div>
            <Badge tone="accent">
              Ready
            </Badge>
          </div>

          {/* Mode Selector Buttons */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Choose Package Type:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => {
                  setPackagingMode('RETAIL_POUCH')
                  setCurrentWeight('1.002')
                  setSavedSuccessRecord(null)
                }}
                className={`p-5 text-left border transition-all cursor-pointer ${
                  packagingMode === 'RETAIL_POUCH'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold shadow-sm'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon name="package" size={18} className="text-emerald-700" />
                    <span className="font-bold text-sm text-foreground">Retail 1 kg Pouch</span>
                  </div>
                  <Badge tone={packagingMode === 'RETAIL_POUCH' ? 'success' : 'neutral'}>
                    GS1 QR
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  1 kg consumer pouch with GS1 QR code. Target weight 1.000 kg (tolerance ±5 g).
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPackagingMode('BULK_EXPORT')
                  setCurrentWeight(String(exportTargetKg))
                  setSavedSuccessRecord(null)
                }}
                className={`p-5 text-left border transition-all cursor-pointer ${
                  packagingMode === 'BULK_EXPORT'
                    ? 'border-blue-600 bg-blue-50 text-blue-950 font-bold shadow-sm'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon name="truck" size={18} className="text-blue-700" />
                    <span className="font-bold text-sm text-foreground">Export Carton</span>
                  </div>
                  <Badge tone={packagingMode === 'BULK_EXPORT' ? 'accent' : 'neutral'}>
                    ITF-14
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Bulk master carton with GS1 ITF-14 barcode. Target weight 10 kg or 50 kg (±50 g).
                </p>
              </button>
            </div>
          </div>

          {/* Grade Selector */}
          <div className="space-y-2 pt-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Select Potato Grade:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { grade: 'A', name: 'Grade A (>55mm)', desc: 'Large' },
                { grade: 'B', name: 'Grade B (40-55mm)', desc: 'Medium' },
                { grade: 'C', name: 'Grade C (<40mm)', desc: 'Small' },
              ].map((g) => {
                const isSelected = selectedGrade === g.grade
                return (
                  <button
                    key={g.grade}
                    type="button"
                    onClick={() => {
                      setSelectedGrade(g.grade as 'A' | 'B' | 'C')
                      setSavedSuccessRecord(null)
                    }}
                    className={`p-4 border text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold'
                        : 'border-border bg-card text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-foreground">{g.name}</span>
                      <span
                        className={`text-xs font-mono font-bold px-1.5 py-0.5 border ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-border bg-muted text-muted-foreground'
                        }`}
                      >
                        {g.grade}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground mt-1 block">{g.desc}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Export Carton Size */}
          {packagingMode === 'BULK_EXPORT' && (
            <div className="p-4 bg-blue-50/50 border border-blue-200 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-900 block">
                Export Carton Size:
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={exportTargetKg === 10 ? 'primary' : 'outline'}
                  onClick={() => {
                    setExportTargetKg(10)
                    setCurrentWeight('10.02')
                  }}
                >
                  10 kg Carton
                </Button>
                <Button
                  size="sm"
                  variant={exportTargetKg === 50 ? 'primary' : 'outline'}
                  onClick={() => {
                    setExportTargetKg(50)
                    setCurrentWeight('50.05')
                  }}
                >
                  50 kg Carton
                </Button>
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex justify-end pt-4 border-t border-border">
            <Button
              variant="primary"
              icon="check"
              touch
              onClick={() => setActiveStep(2)}
            >
              Continue to Weighing
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Weigh & Check ── */}
      {activeStep === 2 && (
        <div className="bg-card border border-border p-6 shadow-sm space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-2">
            <div>
              <span className="text-xs uppercase font-mono font-semibold tracking-wider text-muted-foreground">
                Step 2 of 3 · Weigh & Check
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                Weigh Package
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="accent">Grade {selectedGrade}</Badge>
              <Badge tone="success" dot live>
                Port 502 · Online
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Scale 03 Live Terminal (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <ScaleWeightInput
                value={currentWeight}
                onChange={setCurrentWeight}
                capacityKg={packagingMode === 'RETAIL_POUCH' ? 5 : 60}
                label={`Scale 03 — Weight`}
              />

              {/* Target & Tolerance Metric Card */}
              <div className="p-4 bg-muted/20 border border-border flex items-center justify-between flex-wrap gap-3">
                <div>
                  <span className="text-xs text-muted-foreground block">Target</span>
                  <span className="text-base font-bold text-foreground">
                    {targetKg.toFixed(3)} kg (±{toleranceKg} kg)
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Deviation</span>
                  <span
                    className={`font-mono font-bold text-base ${
                      isWithinTolerance ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {(weightValue - targetKg > 0 ? '+' : '') + (weightValue - targetKg).toFixed(3)} kg
                  </span>
                </div>
                <div>
                  <Badge tone={isWithinTolerance ? 'success' : 'warning'} dot live={isWithinTolerance}>
                    {isWithinTolerance ? 'In Tolerance' : 'Outside Tolerance'}
                  </Badge>
                </div>
              </div>

              {/* Quick simulation buttons */}
              <div className="flex gap-2">
                <span className="text-xs text-muted-foreground self-center mr-1">Quick Test:</span>
                {(packagingMode === 'RETAIL_POUCH' ? ['0.998', '1.000', '1.002', '1.020'] : ['9.98', '10.00', '10.02', '10.20']).map((sw) => (
                  <button
                    key={sw}
                    type="button"
                    onClick={() => setCurrentWeight(sw)}
                    className="px-2 py-0.5 text-xs font-mono border border-border bg-card hover:bg-muted cursor-pointer"
                  >
                    {sw} kg
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Live Label Preview (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="border border-border p-4 bg-card space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground block">
                  {packagingMode === 'RETAIL_POUCH' ? 'Pouch Label Preview' : 'Carton Label Preview'}
                </span>

                {packagingMode === 'RETAIL_POUCH' ? (
                  <LabelPreview
                    type="pouch"
                    code={nextCodePreview}
                    grade={selectedGrade}
                    weightKg={weightValue}
                    stationName="Station 03 · Packaging"
                    compact
                  />
                ) : (
                  <LabelPreview
                    type="export"
                    code={nextCodePreview}
                    grade={selectedGrade}
                    weightKg={weightValue}
                    compact
                  />
                )}
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
              disabled={weightValue <= 0}
              onClick={() => setActiveStep(3)}
            >
              Continue to Label
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Label & Store ── */}
      {activeStep === 3 && (
        <div className="bg-card border border-border p-6 shadow-sm space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-2">
            <div>
              <span className="text-xs uppercase font-mono font-semibold tracking-wider text-muted-foreground">
                Step 3 of 3 · Label & Store
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                Print Label & Store
              </h2>
            </div>
            {savedSuccessRecord ? (
              <Badge tone="success" dot>
                Stored
              </Badge>
            ) : (
              <Badge tone="warning" dot>
                Ready to Print
              </Badge>
            )}
          </div>

          {/* Summary Details Grid */}
          <div className="p-4 bg-muted/30 border border-border grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <span className="text-xs text-muted-foreground block font-medium">Unit Code</span>
              <span className="font-mono font-bold text-base text-foreground block">
                {savedSuccessRecord?.code ?? nextCodePreview}
              </span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block font-medium">Grade</span>
              <span className="font-bold text-base text-foreground block">Grade {selectedGrade}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block font-medium">Net Weight</span>
              <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400 block font-mono">
                {formatWeight(weightValue)} <span className="text-xs font-normal text-muted-foreground">kg</span>
              </span>
              <span className="text-xs text-muted-foreground">Target: {targetKg.toFixed(3)} kg</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block font-medium">Format</span>
              <span className="font-semibold text-base text-foreground block">
                {packagingMode === 'RETAIL_POUCH' ? '1 kg Retail Pouch' : `${exportTargetKg} kg Export Carton`}
              </span>
            </div>
          </div>

          {/* Print Preview */}
          <div className="max-w-md mx-auto">
            {packagingMode === 'RETAIL_POUCH' ? (
              <LabelPreview
                type="pouch"
                code={savedSuccessRecord?.code ?? nextCodePreview}
                grade={selectedGrade}
                weightKg={weightValue}
                stationName="Station 03 · Packaging"
              />
            ) : (
              <LabelPreview
                type="export"
                code={savedSuccessRecord?.code ?? nextCodePreview}
                grade={selectedGrade}
                weightKg={weightValue}
              />
            )}
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between border-t border-border pt-4 flex-wrap gap-2">
            {!savedSuccessRecord ? (
              <>
                <Button variant="outline" onClick={() => setActiveStep(2)}>
                  Back
                </Button>
                <Button
                  variant="primary"
                  icon="check"
                  touch
                  loading={isPrinting}
                  disabled={!isWithinTolerance}
                  onClick={handlePrintAndLabel}
                >
                  Print Label & Store
                </Button>
              </>
            ) : (
              <>
                <div className="text-xs text-muted-foreground font-mono">
                  Stored: {savedSuccessRecord.code} ({savedSuccessRecord.time})
                </div>
                <Button variant="primary" icon="check" touch onClick={handleNextUnit}>
                  Package Next Unit
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
          aria-label="Packaging Focus Mode"
        >
          <header className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-card/95 backdrop-blur border-b border-border shadow-sm">
            <div className="flex items-center gap-3">
              <Logo className="h-7 w-auto" markOnly />
              <div>
                <div className="font-display text-lg leading-none tracking-wider text-foreground">
                  ENYX-ENTERPRISE
                </div>
                <div className="font-mono text-[9px] text-muted-foreground tracking-[0.2em] uppercase mt-0.5">
                  STATION 03 · PACKAGING · FOCUS MODE
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
          title="Station 03: Packaging"
          subtitle="Retail pouches, export cartons, and warehouse storage."
          actions={
            <div className="flex items-center gap-2">
              <Button variant="primary" icon="expand" touch onClick={enterFocusMode}>
                Focus Mode
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon="history"
                onClick={() => document.getElementById('packaging-ledger')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Records ({packages.length})
              </Button>
            </div>
          }
        />

        {/* Quick Stats Grid (4 Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-none p-4 shadow-sm space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Retail Pouches</p>
            <p className="text-2xl font-bold tracking-tight text-foreground">{pouchCount}</p>
            <p className="text-xs text-muted-foreground">1 kg units</p>
          </div>
          <div className="bg-card border border-border rounded-none p-4 shadow-sm space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Export Cartons</p>
            <p className="text-2xl font-bold tracking-tight text-foreground">{exportCount}</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              Master crates
            </p>
          </div>
          <div className="bg-card border border-border rounded-none p-4 shadow-sm space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Scale Capacity</p>
            <p className="text-2xl font-bold tracking-tight text-foreground">30 kg</p>
            <p className="text-xs text-muted-foreground">Scale 03</p>
          </div>
          <div className="bg-card border border-border rounded-none p-4 shadow-sm space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Workflow Mode</p>
            <p className="text-lg font-bold tracking-tight text-foreground">Sequential</p>
            <p className="text-xs text-muted-foreground">Step 1 to 3</p>
          </div>
        </div>

        {/* Sequential Stepper in Standard View */}
        <div id="packaging-stepper" className="bg-card border border-border rounded-none p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-base text-foreground">Packaging Stepper</span>
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

          {/* Main Sequential Step Content */}
          {renderSequentialContent()}
        </div>

        {/* Packaged Output Ledger Table */}
        <div id="packaging-ledger" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight text-foreground">Today's Packaging Records</h2>
            <span className="text-xs text-muted-foreground font-mono">
              {packages.length} units recorded
            </span>
          </div>

          <DataTable rowKey={(row) => row.id} columns={columns} data={packages} />
        </div>
      </div>
    </>
  )
}
