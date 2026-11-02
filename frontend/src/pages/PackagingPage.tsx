/**
 * Station 03: Packaging & Dispatch Console
 *
 * Implements the unified station layout with sequential 3-step workflow:
 *   Step 1: Spec & Grade (Choose Retail Pouch 1 kg vs Bulk Export Carton 10/50 kg, and potato grade)
 *   Step 2: Weigh & Check (Precision Scale 03 reading via Modbus TCP Port 502 with real-time tolerance check)
 *   Step 3: Label & Dispatch (GS1 Digital Link QR / ITF-14 barcode label printing & automated finished goods ledger update)
 */
import { useState, useEffect, useCallback } from 'react'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import Icon from '../components/shared/Icon'
import { Input } from '../components/shared/Form'
import DataTable, { type Column } from '../components/shared/DataTable'
import PageHeader from '../components/shared/PageHeader'
import { useToast } from '../components/feedback/Toast'
import ScaleWeightInput from '../components/operator/ScaleWeightInput'
import LabelPreview from '../components/operator/LabelPreview'
import { printThermal } from '../lib/thermalPrint'
import { formatWeight } from '../lib/utils'
import { usePackhouseStore } from '../hooks/usePackhouseStore'
import CameraScannerModal from '../components/shared/CameraScannerModal'
import { api } from '../services/api'

type PackagingMode = 'RETAIL_POUCH' | 'BULK_EXPORT'

interface PackageRecord {
  id: string
  code: string
  sourcePallet?: string
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

interface AvailablePallet {
  code: string
  grade: 'A' | 'B' | 'C'
  weightKg: number
  remainingKg: number
  farmerName: string
  farmerVillage?: string
  waringCode: string
}

export default function PackagingPage() {
  const toast = useToast()
  const { addFinishedPackage, sortedBatches } = usePackhouseStore()

  /* ── Mode & Stepper State ── */
  const [focusMode, setFocusMode] = useState(false)
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1)

  /* ── Step 1: Source Pallet QR & Packaging Specifications ── */
  const [sourcePalletCode, setSourcePalletCode] = useState('')
  const [sourceFarmer, setSourceFarmer] = useState('')
  const [sourceWaring, setSourceWaring] = useState('')
  const [sourcePalletRemainingKg, setSourcePalletRemainingKg] = useState<number | null>(null)
  const [palletSearch, setPalletSearch] = useState('')
  const [palletScanError, setPalletScanError] = useState<string | null>(null)

  /* Camera Scanner State */
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const openCameraModal = () => setIsCameraOpen(true)
  const closeCameraModal = useCallback(() => setIsCameraOpen(false), [])

  const [packagingMode, setPackagingMode] = useState<PackagingMode>('RETAIL_POUCH')
  const [selectedGrade, setSelectedGrade] = useState<'A' | 'B' | 'C'>('A')
  const [exportTargetKg, setExportTargetKg] = useState<10 | 50>(10)

  /* ── Step 2: Scale 03 Live Precision Weighing ── */
  const [currentWeight, setCurrentWeight] = useState('1.002')
  const [isPrinting, setIsPrinting] = useState(false)
  const [savedSuccessRecord, setSavedSuccessRecord] = useState<PackageRecord | null>(null)
  const [palletsFromApi, setPalletsFromApi] = useState<AvailablePallet[] | null>(null)

  useEffect(() => {
    let cancelled = false

    api.pallets
      .list()
      .then((pallets) => {
        if (cancelled) return
        const mapped = pallets
          .map((p: any): AvailablePallet => ({
            code: String(p.code || '').trim().toUpperCase(),
            grade: p.grade === 'B' || p.grade === 'C' ? p.grade : 'A',
            weightKg: Number(p.weightKg || 0),
            remainingKg: Number(p.remainingKg || 0),
            farmerName: p.farmerName || 'Farmer',
            farmerVillage: p.farmerVillage,
            waringCode: p.waringCode || '',
          }))
          .filter((p) => p.code && p.remainingKg > 0)
        setPalletsFromApi(mapped)
      })
      .catch(() => {
        if (!cancelled) setPalletsFromApi(null)
      })

    return () => {
      cancelled = true
    }
  }, [])

  /* Available sorted pallets list from store (guaranteed 100% unique pallet codes) */
  const seenPalletCodes = new Set<string>()
  const availablePallets: AvailablePallet[] = []

  sortedBatches.forEach((b, batchIdx) => {
    const seqStr = String(batchIdx + 1).padStart(2, '0')

    const getUniquePalletCode = (rawCode: string, grade: 'A' | 'B' | 'C') => {
      let code = (rawCode || `PLT-GRD-${grade}-${seqStr}`).trim()
      // If code was already seen (e.g. duplicate default 'PLT-GRD-A-01' across batches)
      if (seenPalletCodes.has(code)) {
        let seq = batchIdx + 1
        code = `PLT-GRD-${grade}-${String(seq).padStart(2, '0')}`
        while (seenPalletCodes.has(code)) {
          seq++
          code = `PLT-GRD-${grade}-${String(seq).padStart(2, '0')}`
        }
      }
      seenPalletCodes.add(code)
      return code
    }

    if (b.gradeAKg > 0) {
      availablePallets.push({
        code: getUniquePalletCode(b.gradeAPalletQr, 'A'),
        grade: 'A',
        weightKg: b.gradeAKg,
        remainingKg: b.gradeAKg,
        farmerName: b.farmerName,
        farmerVillage: b.farmerVillage,
        waringCode: b.waringCode,
      })
    }
    if (b.gradeBKg > 0) {
      availablePallets.push({
        code: getUniquePalletCode(b.gradeBPalletQr, 'B'),
        grade: 'B',
        weightKg: b.gradeBKg,
        remainingKg: b.gradeBKg,
        farmerName: b.farmerName,
        farmerVillage: b.farmerVillage,
        waringCode: b.waringCode,
      })
    }
    if (b.gradeCKg > 0) {
      availablePallets.push({
        code: getUniquePalletCode(b.gradeCPalletQr, 'C'),
        grade: 'C',
        weightKg: b.gradeCKg,
        remainingKg: b.gradeCKg,
        farmerName: b.farmerName,
        farmerVillage: b.farmerVillage,
        waringCode: b.waringCode,
      })
    }
  })
  const effectivePallets = palletsFromApi ?? availablePallets

  const handleSelectPallet = (p: AvailablePallet) => {
    setSourcePalletCode(p.code)
    setSelectedGrade(p.grade)
    setSourceFarmer(p.farmerName)
    setSourceWaring(p.waringCode)
    setSourcePalletRemainingKg(p.remainingKg)
    setPalletScanError(null)
    setSavedSuccessRecord(null)
    toast.success(`Pallet ${p.code} selected (Grade ${p.grade})`)
  }

  const handlePalletScanSubmit = async (e?: React.FormEvent, scannedCode?: string) => {
    if (e) e.preventDefault()
    const query = (scannedCode ?? palletSearch).trim()
    if (!query) return

    const matched = effectivePallets.find(
      (p) => p.code.toLowerCase() === query.toLowerCase(),
    )

    if (matched) {
      handleSelectPallet(matched)
      setPalletSearch('')
      setPalletScanError(null)
    } else {
      try {
        const pallet = await api.pallets.get(query)
        const remainingKg = Number(pallet.remainingKg)
        if (!Number.isFinite(remainingKg) || remainingKg <= 0) {
          throw new Error(`Pallet ${query.toUpperCase()} has no remaining weight`)
        }

        handleSelectPallet({
          code: String(pallet.code).toUpperCase(),
          grade: pallet.grade === 'B' || pallet.grade === 'C' ? pallet.grade : 'A',
          weightKg: Number(pallet.weightKg || remainingKg),
          remainingKg,
          farmerName: pallet.farmerName || 'Farmer',
          farmerVillage: pallet.farmerVillage,
          waringCode: pallet.waringCode || '',
        })
        setPalletSearch('')
        setPalletScanError(null)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Pallet could not be verified'
        setPalletScanError(message)
        toast.error(message)
      }
    }
  }



  const handleVerifyModalScan = useCallback(
    (scannedVal: string) => {
      const val = scannedVal.trim()
      if (!val) return
      const matched = effectivePallets.find(
        (p) => p.code.toLowerCase() === val.toLowerCase(),
      )
      if (matched) {
        handleSelectPallet(matched)
        closeCameraModal()
      } else {
        void handlePalletScanSubmit(undefined, val)
        closeCameraModal()
      }
    },
    [effectivePallets, handleSelectPallet, handlePalletScanSubmit, closeCameraModal],
  )


  const targetKg = packagingMode === 'RETAIL_POUCH' ? 1.0 : exportTargetKg
  const toleranceKg = packagingMode === 'RETAIL_POUCH' ? 0.005 : 0.05
  const weightValue = Number(currentWeight) || 0
  const isWithinTolerance = Math.abs(weightValue - targetKg) <= toleranceKg

  /* ── Packaged Output Ledger ── */
  const [packages, setPackages] = useState<PackageRecord[]>([])
  const packagedWeightForSelectedPallet = packages
    .filter((record) => record.sourcePallet?.toLowerCase() === sourcePalletCode.toLowerCase())
    .reduce((total, record) => total + record.weightKg, 0)
  const remainingPalletKg = sourcePalletRemainingKg === null
    ? 0
    : Math.max(0, Number((sourcePalletRemainingKg - packagedWeightForSelectedPallet).toFixed(3)))

  const exitFocusMode = () => {
    setFocusMode(false)
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {})
    }
  }

  /* Fullscreen & Esc Listener */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && focusMode) {
        exitFocusMode()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [focusMode])

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
    if (!sourcePalletCode || sourcePalletRemainingKg === null) {
      toast.error('Select and verify a source pallet before packaging')
      return
    }

    if (weightValue > remainingPalletKg + 0.0005) {
      toast.error(
        `Package weight ${weightValue.toFixed(3)} kg exceeds pallet ${sourcePalletCode} remaining weight of ${remainingPalletKg.toFixed(3)} kg`,
      )
      return
    }

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
        sourcePallet: sourcePalletCode,
        mode: packagingMode,
        grade: selectedGrade,
        weightKg: weightValue,
        targetKg,
        time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        status: 'WAREHOUSE_STORED',
      }
      setPackages((curr) => [newRecord, ...curr])
      setSavedSuccessRecord(newRecord)

      // Synchronize to warehouse finished goods store
      addFinishedPackage({
        code: newCode,
        sourcePalletCode,
        packageType:
          packagingMode === 'RETAIL_POUCH'
            ? '1 kg Pouch'
            : targetKg === 50
            ? '50 kg Export Carton'
            : '10 kg Export Carton',
        mode: packagingMode,
        grade: selectedGrade,
        units: 1,
        weightKg: weightValue,
        totalWeightKg: weightValue,
        packedTime: newRecord.time,
        storageLocation: packagingMode === 'RETAIL_POUCH' ? 'Rack A-01' : 'Pallet Bay 03',
      })

      printThermal(
        packagingMode === 'RETAIL_POUCH' ? (
          <LabelPreview
            type="pouch"
            code={newCode}
            farmerName={sourceFarmer}
            farmerId={sourcePalletCode}
            grade={selectedGrade}
            weightKg={weightValue}
            stationName="Station 03 · Packaging"
          />
        ) : (
          <LabelPreview
            type="export"
            code={newCode}
            farmerName={sourceFarmer}
            farmerId={sourcePalletCode}
            grade={selectedGrade}
            weightKg={weightValue}
          />
        ),
        () => {
          setIsPrinting(false)
        }
      )

      toast.success(
        `Printed & recorded ${newCode} (${
          packagingMode === 'RETAIL_POUCH' ? '1 kg Pouch' : `${targetKg} kg Export Carton`
        }). Stored in warehouse.`,
      )
    }, 400)
  }

  const handleNextUnit = () => {
    setSavedSuccessRecord(null)
    if (remainingPalletKg <= 0.0005) {
      setSourcePalletCode('')
      setSourceFarmer('')
      setSourceWaring('')
      setSourcePalletRemainingKg(null)
      setActiveStep(1)
      toast.info('Source pallet is depleted. Select another pallet.')
      return
    }

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
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-mono font-bold text-foreground">{row.code}</span>
          {row.sourcePallet && (
            <span className="text-[11px] font-mono text-muted-foreground">Pallet: {row.sourcePallet}</span>
          )}
        </div>
      ),
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
        const compactLabel = step.id === 1 ? 'Pallet' : step.id === 2 ? 'Weigh' : 'Pack'

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
              <span className="sm:hidden">{compactLabel}</span>
              <span className="hidden sm:inline">{step.label}</span>
            </button>
            {idx < STEPS.length - 1 && <span className="text-muted-foreground/40 text-xs mx-0.5 sm:mx-1">/</span>}
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
      {/* ── STEP 1: Package Type & Source Pallet ── */}
      {activeStep === 1 && (
        <div className="bg-card border border-border p-6 shadow-sm space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-2">
            <div>
              <span className="text-xs uppercase font-mono font-semibold tracking-wider text-muted-foreground">
                Step 1 of 3 · Source Pallet & Package Type
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                Scan Source Pallet & Select Packaging Format
              </h2>
            </div>
            <Badge tone="accent" icon="scan">
              Awaiting Scan
            </Badge>
          </div>

          {/* Centered Pallet Scanner Box */}
          <div className="border-2 border-dashed border-border p-6 sm:p-8 bg-card text-center space-y-4">
            <div className="flex flex-col items-center gap-1.5">
              <div className="inline-flex p-3 bg-muted border border-border text-muted-foreground mb-1">
                <Icon name="scan" size={28} />
              </div>
              <h3 className="text-base font-bold text-foreground">QR Scanner and Camera</h3>
              <p className="text-xs text-muted-foreground max-w-md">
                Scan the pallet QR from Station 02 Sorting to confirm the grade and source.
              </p>
            </div>

            {/* Manual Scan Input Form */}
            <form onSubmit={handlePalletScanSubmit} className="flex flex-col sm:flex-row max-w-md mx-auto items-stretch sm:items-center gap-2">
              <Input
                type="text"
                value={palletSearch}
                onChange={(e) => {
                  setPalletSearch(e.target.value)
                  setPalletScanError(null)
                }}
                placeholder="Scan or enter Pallet QR (e.g. PLT-GRD-A-01)..."
                className="font-mono text-xs uppercase flex-1 min-w-0"
              />
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Button type="submit" variant="primary" icon="check" className="w-full sm:w-auto">
                  Verify
                </Button>
                <Button type="button" variant="outline" icon="scan" onClick={openCameraModal} className="w-full sm:w-auto">
                  Camera
                </Button>
              </div>
            </form>
            {palletScanError && <p className="text-xs text-destructive font-mono">{palletScanError}</p>}

          </div>

          {/* Active Verified Pallet Confirmation Strip */}
          <div className="p-4 bg-card border border-border flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-0.5">
              <span className="text-xs text-muted-foreground uppercase font-mono block">Source Pallet</span>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg font-bold font-mono text-primary">{sourcePalletCode || 'Not selected'}</span>
                {sourcePalletCode && <span
                  className={`text-xs font-semibold px-2 py-0.5 border ${
                    selectedGrade === 'A'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300'
                      : selectedGrade === 'B'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300'
                  }`}
                >
                  Grade {selectedGrade}
                </span>}
                {sourcePalletCode && <span className="text-xs text-muted-foreground">({sourceFarmer} · Origin: {sourceWaring})</span>}
              </div>
              {sourcePalletCode && sourcePalletRemainingKg !== null && (
                <span className="text-xs font-mono text-muted-foreground block">
                  Remaining: {remainingPalletKg.toFixed(3)} kg
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={sourcePalletCode ? 'success' : 'warning'} dot live={Boolean(sourcePalletCode)}>
                {sourcePalletCode ? 'Source Confirmed' : 'Source Required'}
              </Badge>
            </div>
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
                className={`p-5 text-left border transition-all cursor-pointer bg-card ${
                  packagingMode === 'RETAIL_POUCH'
                    ? 'border-primary ring-1 ring-primary text-foreground font-bold shadow-xs'
                    : 'border-border text-muted-foreground hover:bg-muted/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon name="package" size={18} className="text-primary" />
                    <span className="font-bold text-sm text-foreground">Retail 1 kg Pouch</span>
                  </div>
                  <Badge tone={packagingMode === 'RETAIL_POUCH' ? 'success' : 'neutral'}>
                    Product QR
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  1 kg consumer pouch with a product QR code. Target weight 1.000 kg (allowed range ±5 g).
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPackagingMode('BULK_EXPORT')
                  setCurrentWeight(String(exportTargetKg))
                  setSavedSuccessRecord(null)
                }}
                className={`p-5 text-left border transition-all cursor-pointer bg-card ${
                  packagingMode === 'BULK_EXPORT'
                    ? 'border-primary ring-1 ring-primary text-foreground font-bold shadow-xs'
                    : 'border-border text-muted-foreground hover:bg-muted/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon name="truck" size={18} className="text-primary" />
                    <span className="font-bold text-sm text-foreground">Export Carton</span>
                  </div>
                  <Badge tone={packagingMode === 'BULK_EXPORT' ? 'accent' : 'neutral'}>
                    Barcode
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Bulk master carton with a barcode. Target weight 10 kg or 50 kg (allowed range ±50 g).
                </p>
              </button>
            </div>
          </div>

          {/* Export Carton Size */}
          {packagingMode === 'BULK_EXPORT' && (
            <div className="p-4 bg-card border border-border space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground block">
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
              disabled={!sourcePalletCode || sourcePalletRemainingKg === null || remainingPalletKg <= 0}
              onClick={() => setActiveStep(2)}
            >
              Continue to Weighing
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Weigh Package ── */}
      {activeStep === 2 && (
        <div className="bg-card border border-border p-6 shadow-sm space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-2">
            <div>
              <span className="text-xs uppercase font-mono font-semibold tracking-wider text-muted-foreground">
                Step 2 of 3 · Weigh Package
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                Weigh Package
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="accent">Pallet: {sourcePalletCode}</Badge>
              <Badge tone="accent">Grade {selectedGrade}</Badge>
              <Badge tone="success" dot live>
                Scale 03 · Ready
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Scale 03 Live Terminal (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <ScaleWeightInput
                stationId="03"
                value={currentWeight}
                onChange={setCurrentWeight}
                capacityKg={packagingMode === 'RETAIL_POUCH' ? 5 : 60}
                label="Package Weight"
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
                  <span className="text-xs text-muted-foreground block">Difference</span>
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
                    {isWithinTolerance ? 'Within Range' : 'Outside Range'}
                  </Badge>
                </div>
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
                    farmerName={sourceFarmer}
                    farmerId={sourcePalletCode}
                    grade={selectedGrade}
                    weightKg={weightValue}
                    stationName="Station 03 · Packaging"
                    compact
                  />
                ) : (
                  <LabelPreview
                    type="export"
                    code={nextCodePreview}
                    farmerName={sourceFarmer}
                    farmerId={sourcePalletCode}
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
              disabled={weightValue <= 0 || !sourcePalletCode || sourcePalletRemainingKg === null || weightValue > remainingPalletKg + 0.0005}
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
          <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-2 no-print">
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
          <div className="p-4 bg-muted/30 border border-border grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 no-print">
            <div>
              <span className="text-xs text-muted-foreground block font-medium">Package Code</span>
              <span className="font-mono font-bold text-base text-foreground block">
                {savedSuccessRecord?.code ?? nextCodePreview}
              </span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block font-medium">Source Pallet</span>
              <span className="font-mono font-bold text-base text-primary block truncate">
                {sourcePalletCode}
              </span>
              <span className="text-[11px] text-muted-foreground truncate block">{sourceFarmer}</span>
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
              <span className="text-xs text-muted-foreground block font-medium">Package Type</span>
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
                farmerName={sourceFarmer}
                farmerId={sourcePalletCode}
                grade={selectedGrade}
                weightKg={weightValue}
                stationName="Station 03 · Packaging"
              />
            ) : (
              <LabelPreview
                type="export"
                code={savedSuccessRecord?.code ?? nextCodePreview}
                farmerName={sourceFarmer}
                farmerId={sourcePalletCode}
                grade={selectedGrade}
                weightKg={weightValue}
              />
            )}
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between border-t border-border pt-4 flex-wrap gap-2 no-print">
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
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground font-mono">
                    Stored: {savedSuccessRecord.code} ({savedSuccessRecord.time})
                  </span>
                  <Button
                    variant="outline"
                    icon="print"
                    loading={isPrinting}
                    onClick={() => {
                      if (!savedSuccessRecord) return
                      setIsPrinting(true)
                      printThermal(
                        packagingMode === 'RETAIL_POUCH' ? (
                          <LabelPreview
                            type="pouch"
                            code={savedSuccessRecord.code}
                            farmerName={sourceFarmer}
                            farmerId={sourcePalletCode}
                            grade={selectedGrade}
                            weightKg={savedSuccessRecord.weightKg}
                            stationName="Station 03 · Packaging"
                          />
                        ) : (
                          <LabelPreview
                            type="export"
                            code={savedSuccessRecord.code}
                            farmerName={sourceFarmer}
                            farmerId={sourcePalletCode}
                            grade={selectedGrade}
                            weightKg={savedSuccessRecord.weightKg}
                          />
                        ),
                        () => setIsPrinting(false)
                      )
                    }}
                  >
                    Reprint Label
                  </Button>
                </div>
                <div>
                  <Button variant="primary" icon="check" touch onClick={handleNextUnit}>
                    Package Next Unit
                  </Button>
                </div>
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
          <header className="sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-3 sm:px-6 sm:py-4 bg-card/95 backdrop-blur border-b border-border shadow-sm">
            <div className="min-w-0 max-w-[48%] font-mono text-[9px] sm:text-[10px] leading-tight text-muted-foreground tracking-[0.16em] sm:tracking-[0.2em] uppercase">
              STATION 03 · PACKAGING · FOCUS MODE
            </div>

            {/* Stepper Progress Bar in Focus Header */}
            <div className="hidden md:flex">
              {renderStepperBar()}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm" icon="close" onClick={exitFocusMode} className="whitespace-nowrap">
                Exit Focus Mode
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
        <div className="no-print">
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
        </div>

        {/* Quick Stats Grid (4 Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
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
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Scale Status</p>
            <p className="text-2xl font-bold tracking-tight text-emerald-600">Online</p>
            <p className="text-xs text-muted-foreground">Scale 03</p>
          </div>
          <div className="bg-card border border-border rounded-none p-4 shadow-sm space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Pallets Available</p>
            <p className="text-2xl font-bold tracking-tight text-foreground">{effectivePallets.length}</p>
            <p className="text-xs text-muted-foreground">From Station 02</p>
          </div>
        </div>

        {/* Sequential Stepper in Standard View */}
        <div id="packaging-stepper" className="bg-card border border-border rounded-none p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-2 no-print">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-base text-foreground">Packaging Stepper</span>
              <Badge tone="accent">Step {activeStep} of 3</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="success" dot live>
                Scale 03 · Ready
              </Badge>
              <Button size="sm" variant="outline" icon="expand" onClick={enterFocusMode}>
                Open Focus Mode
              </Button>
            </div>
          </div>

          {/* Stepper Navigation Bar */}
          <div className="no-print">
            {renderStepperBar()}
          </div>

          {/* Main Sequential Step Content */}
          {renderSequentialContent()}
        </div>

        {/* Packaged Output Ledger Table */}
        <div id="packaging-ledger" className="space-y-3 no-print">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight text-foreground">Today's Packaging Records</h2>
            <span className="text-xs text-muted-foreground font-mono">
              {packages.length} units recorded
            </span>
          </div>

          <DataTable rowKey={(row) => row.id} columns={columns} data={packages} />
        </div>
      </div>

      {/* ── CAMERA SCANNER MODAL ── */}
      {/* ── Universal Camera Barcode/QR Scanner Modal ── */}
      <CameraScannerModal
        isOpen={isCameraOpen}
        onClose={closeCameraModal}
        onScan={handleVerifyModalScan}
        title="Scan Pallet QR Code · Station 03 Packaging"
        subtitle="Align the QR code on the staged pallet within the camera view."
        manualPlaceholder="Scan or enter pallet code..."
      />
    </>
  )
}
