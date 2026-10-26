/**
 * Station 03: Packaging & Dispatch Console
 *
 * Implements the unified station layout with sequential 3-step workflow:
 *   Step 1: Spec & Grade (Choose Retail Pouch 1 kg vs Bulk Export Carton 10/50 kg, and potato grade)
 *   Step 2: Weigh & Check (Precision Scale 03 reading via Modbus TCP Port 502 with real-time tolerance check)
 *   Step 3: Label & Dispatch (GS1 Digital Link QR / ITF-14 barcode label printing & automated finished goods ledger update)
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
import LabelPreview from '../components/operator/LabelPreview'
import { printThermal } from '../lib/thermalPrint'
import { formatWeight } from '../lib/utils'
import { usePackhouseStore } from '../hooks/usePackhouseStore'

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
  farmerName: string
  farmerVillage?: string
  waringCode: string
}

export default function PackagingPage() {
  const toast = useToast()
  const { addFinishedPackage, sortedBatches } = usePackhouseStore()

  /* ── Mode & Stepper State ── */
  const [focusMode, setFocusMode] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1)

  /* ── Step 1: Source Pallet QR & Packaging Specifications ── */
  const [sourcePalletCode, setSourcePalletCode] = useState('')
  const [sourceFarmer, setSourceFarmer] = useState('')
  const [sourceWaring, setSourceWaring] = useState('')
  const [palletSearch, setPalletSearch] = useState('')
  const [palletScanError, setPalletScanError] = useState<string | null>(null)

  /* Camera Scanner State */
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([])
  const [selectedCameraId, setSelectedCameraId] = useState<string>('')
  const [modalScannerInput, setModalScannerInput] = useState('')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const modalInputRef = useRef<HTMLInputElement | null>(null)

  const [packagingMode, setPackagingMode] = useState<PackagingMode>('RETAIL_POUCH')
  const [selectedGrade, setSelectedGrade] = useState<'A' | 'B' | 'C'>('A')
  const [exportTargetKg, setExportTargetKg] = useState<10 | 50>(10)

  /* ── Step 2: Scale 03 Live Precision Weighing ── */
  const [currentWeight, setCurrentWeight] = useState('1.002')
  const [isPrinting, setIsPrinting] = useState(false)
  const [savedSuccessRecord, setSavedSuccessRecord] = useState<PackageRecord | null>(null)

  /* Pallet Grade Filter Tab */
  const [palletGradeFilter, setPalletGradeFilter] = useState<'ALL' | 'A' | 'B' | 'C'>('ALL')

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
        farmerName: b.farmerName,
        farmerVillage: b.farmerVillage,
        waringCode: b.waringCode,
      })
    }
  })


  // Filtered pallets by grade tab
  const displayedPallets = availablePallets.filter((p) => {
    if (palletGradeFilter === 'ALL') return true
    return p.grade === palletGradeFilter
  })

  const handleSelectPallet = (p: AvailablePallet) => {
    setSourcePalletCode(p.code)
    setSelectedGrade(p.grade)
    setSourceFarmer(p.farmerName)
    setSourceWaring(p.waringCode)
    setPalletScanError(null)
    setSavedSuccessRecord(null)
    toast.success(`Pallet ${p.code} selected (Grade ${p.grade})`)
  }

  const handlePalletScanSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const query = palletSearch.trim()
    if (!query) return

    const matched = availablePallets.find(
      (p) => p.code.toLowerCase() === query.toLowerCase() || p.code.toLowerCase().includes(query.toLowerCase()),
    )

    if (matched) {
      handleSelectPallet(matched)
      setPalletSearch('')
      setPalletScanError(null)
    } else {
      let inferredGrade: 'A' | 'B' | 'C' = selectedGrade
      const upper = query.toUpperCase()
      if (upper.includes('-A') || upper.includes('GRADE-A') || upper.endsWith('A')) {
        inferredGrade = 'A'
      } else if (upper.includes('-B') || upper.includes('GRADE-B') || upper.endsWith('B')) {
        inferredGrade = 'B'
      } else if (upper.includes('-C') || upper.includes('GRADE-C') || upper.endsWith('C')) {
        inferredGrade = 'C'
      }

      setSourcePalletCode(upper)
      setSelectedGrade(inferredGrade)
      setPalletSearch('')
      setPalletScanError(null)
      toast.success(`Pallet ${upper} linked (Grade ${inferredGrade})`)
    }
  }

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setCameraStream(null)
    setIsCameraOpen(false)
    setCameraError(null)
  }, [])

  const startCamera = async (deviceId?: string) => {
    setCameraError(null)
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by your browser.')
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }

      let stream: MediaStream
      const constraints: MediaStreamConstraints = deviceId
        ? { video: { deviceId: { exact: deviceId } } }
        : {
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          }

      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints)
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true })
      }

      streamRef.current = stream
      setCameraStream(stream)

      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const videoDevices = devices.filter((d) => d.kind === 'videoinput')
        setAvailableCameras(videoDevices)
        if (deviceId) {
          setSelectedCameraId(deviceId)
        } else if (videoDevices.length > 0) {
          setSelectedCameraId(videoDevices[0].deviceId)
        }
      } catch {
        // Enumerate not permitted
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Camera access denied or unavailable.'
      setCameraError(errMsg)
    }
  }

  const openCameraModal = () => {
    setIsCameraOpen(true)
    setCameraError(null)
    setModalScannerInput('')
    startCamera()
    setTimeout(() => modalInputRef.current?.focus(), 150)
  }

  const closeCameraModal = useCallback(() => {
    stopCamera()
  }, [stopCamera])

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  // Bind camera stream to video element on mount or update
  useEffect(() => {
    if (isCameraOpen && cameraStream && videoRef.current) {
      if (videoRef.current.srcObject !== cameraStream) {
        videoRef.current.srcObject = cameraStream
        videoRef.current.play().catch(() => {})
      }
    }
  }, [isCameraOpen, cameraStream])

  const handleVerifyModalScan = useCallback(
    (scannedVal: string) => {
      const val = scannedVal.trim()
      if (!val) return
      const matched = availablePallets.find(
        (p) => p.code.toLowerCase() === val.toLowerCase(),
      )
      if (matched) {
        handleSelectPallet(matched)
        closeCameraModal()
      } else {
        setPalletSearch(val)
        handlePalletScanSubmit()
        closeCameraModal()
      }
    },
    [availablePallets, handleSelectPallet, handlePalletScanSubmit, closeCameraModal],
  )

  // Real-time Barcode/QR scanning loop for Pallet tags
  useEffect(() => {
    if (!isCameraOpen || !cameraStream) return
    let isCancelled = false
    let animationId: number

    const scanLoop = async () => {
      if (isCancelled) return
      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        try {
          const detector = new (window as any).BarcodeDetector({
            formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8'],
          })
          const video = videoRef.current
          if (video && video.readyState >= 2 && !video.paused && !video.ended) {
            const barcodes = await detector.detect(video)
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              const code = barcodes[0].rawValue.trim()
              if (code) {
                try {
                  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
                  const osc = ctx.createOscillator()
                  const gain = ctx.createGain()
                  osc.frequency.setValueAtTime(1200, ctx.currentTime)
                  gain.gain.setValueAtTime(0.1, ctx.currentTime)
                  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1)
                  osc.connect(gain)
                  gain.connect(ctx.destination)
                  osc.start()
                  osc.stop(ctx.currentTime + 0.1)
                } catch {}
                toast.success(`Scanned: ${code}`)
                handleVerifyModalScan(code)
                return
              }
            }
          }
        } catch {
          // Frame read exception
        }
      }
      animationId = requestAnimationFrame(scanLoop)
    }

    animationId = requestAnimationFrame(scanLoop)

    return () => {
      isCancelled = true
      if (animationId) cancelAnimationFrame(animationId)
    }
  }, [isCameraOpen, cameraStream, handleVerifyModalScan])

  const targetKg = packagingMode === 'RETAIL_POUCH' ? 1.0 : exportTargetKg
  const toleranceKg = packagingMode === 'RETAIL_POUCH' ? 0.005 : 0.05
  const weightValue = Number(currentWeight) || 0
  const isWithinTolerance = Math.abs(weightValue - targetKg) <= toleranceKg

  /* ── Packaged Output Ledger ── */
  const [packages, setPackages] = useState<PackageRecord[]>([])

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
      {/* ── STEP 1: Package Spec & Source Pallet ── */}
      {activeStep === 1 && (
        <div className="bg-card border border-border p-6 shadow-sm space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-2">
            <div>
              <span className="text-xs uppercase font-mono font-semibold tracking-wider text-muted-foreground">
                Step 1 of 3 · Source Pallet & Package Spec
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
              <h3 className="text-base font-bold text-foreground">2D Scanner and Camera</h3>
              <p className="text-xs text-muted-foreground max-w-md">
                Scan pre-attached Pallet QR (<code className="font-mono text-primary font-bold">PLT-GRD-...</code>) from Station 02 Sorting staging to verify grade & lot lineage.
              </p>
            </div>

            {/* Manual Scan Input Form */}
            <form onSubmit={handlePalletScanSubmit} className="flex max-w-md mx-auto items-center gap-2">
              <Input
                type="text"
                value={palletSearch}
                onChange={(e) => {
                  setPalletSearch(e.target.value)
                  setPalletScanError(null)
                }}
                placeholder="Scan or enter Pallet QR (e.g. PLT-GRD-A-01)..."
                className="font-mono text-xs uppercase"
              />
              <Button type="submit" variant="primary" icon="check">
                Verify
              </Button>
              <Button type="button" variant="outline" icon="scan" onClick={openCameraModal}>
                Camera
              </Button>
            </form>
            {palletScanError && <p className="text-xs text-destructive font-mono">{palletScanError}</p>}

            {/* Quick Available Pallets Select Chips */}
            <div className="pt-2 border-t border-border/60 max-w-2xl mx-auto space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground">
                  Available Sorted Pallets from Station 02:
                </p>
                {/* Grade Filter Pills */}
                <div className="flex items-center gap-1">
                  {(['ALL', 'A', 'B', 'C'] as const).map((g) => {
                    const count = g === 'ALL' ? availablePallets.length : availablePallets.filter((p) => p.grade === g).length
                    const isActive = palletGradeFilter === g
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setPalletGradeFilter(g)}
                        className={`px-2 py-0.5 text-[11px] font-mono border transition-colors cursor-pointer ${
                          isActive
                            ? 'border-primary bg-primary text-primary-foreground font-bold'
                            : 'border-border bg-card text-muted-foreground hover:bg-muted/30'
                        }`}
                      >
                        {g === 'ALL' ? 'All' : `Grade ${g}`} ({count})
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                {displayedPallets.map((p) => {
                  const isSelected = p.code === sourcePalletCode
                  return (
                    <button
                      key={p.code}
                      type="button"
                      onClick={() => handleSelectPallet(p)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary font-bold ring-1 ring-primary shadow-xs'
                          : 'border-border bg-card hover:bg-muted/30 hover:border-primary text-foreground'
                      }`}
                    >
                      <Icon name="scan" size={13} className="text-muted-foreground" />
                      <span className="font-bold">{p.code}</span>
                      <span
                        className={`px-1.5 py-0.2 text-[10px] font-bold ${
                          p.grade === 'A'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : p.grade === 'B'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        Grade {p.grade}
                      </span>
                      <span className="text-muted-foreground text-[11px]">
                        ({formatWeight(p.weightKg)} kg · {p.farmerName})
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Active Verified Pallet Confirmation Strip */}
          <div className="p-4 bg-card border border-border flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-0.5">
              <span className="text-xs text-muted-foreground uppercase font-mono block">Verified Source Pallet</span>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg font-bold font-mono text-primary">{sourcePalletCode}</span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 border ${
                    selectedGrade === 'A'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300'
                      : selectedGrade === 'B'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300'
                  }`}
                >
                  Grade {selectedGrade}
                </span>
                <span className="text-xs text-muted-foreground">({sourceFarmer} · Origin: {sourceWaring})</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="success" dot live>
                Lineage Locked
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
                    ITF-14
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Bulk master carton with GS1 ITF-14 barcode. Target weight 10 kg or 50 kg (±50 g).
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
              <span className="text-xs text-muted-foreground block font-medium">Unit Code</span>
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
      {isCameraOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-label="Pallet QR Camera Scanner"
        >
          <div className="bg-card border border-border max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Icon name="scan" size={20} className="text-primary" />
                <h3 className="font-bold text-base">Scan Pallet QR Code</h3>
              </div>
              <button
                type="button"
                onClick={closeCameraModal}
                className="text-muted-foreground hover:text-foreground text-sm font-bold px-2 py-1 cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            {/* Video Viewfinder Area */}
            {!cameraError ? (
              <div className="relative aspect-square bg-black flex items-center justify-center overflow-hidden border border-border">
                <video
                  ref={(el) => {
                    videoRef.current = el
                    if (el && cameraStream && el.srcObject !== cameraStream) {
                      el.srcObject = cameraStream
                      el.play().catch(() => {})
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {/* Laser scan animation & reticle */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-emerald-500 rounded-none relative">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-500" />
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-500" />
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-500" />
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-500" />
                    <div className="w-full h-0.5 bg-emerald-500 shadow-[0_0_8px_#10b981] animate-bounce mt-24" />
                  </div>
                </div>
                {/* Live Scanner Status Badge */}
                <div className="absolute bottom-3 left-3 bg-black/80 px-2 py-1 text-[11px] font-mono text-emerald-400 flex items-center gap-1.5 backdrop-blur-xs border border-emerald-500/40">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Live Scanner Active</span>
                </div>
                {/* Multi-camera switcher */}
                {availableCameras.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const idx = availableCameras.findIndex((c) => c.deviceId === selectedCameraId)
                      const next = availableCameras[(idx + 1) % availableCameras.length]
                      startCamera(next.deviceId)
                    }}
                    className="absolute top-3 right-3 bg-black/80 hover:bg-black text-white px-2.5 py-1 text-xs font-mono flex items-center gap-1 border border-border cursor-pointer backdrop-blur-xs"
                  >
                    <Icon name="scan" size={13} />
                    Switch Camera
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-muted/30 border border-dashed border-border p-6 text-center space-y-3">
                <div className="w-12 h-12 bg-primary/10 text-primary flex items-center justify-center mx-auto">
                  <Icon name="scan" size={24} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Ready to Scan Pallet QR</p>
                  <p className="text-xs text-muted-foreground">
                    Align the QR code on the physical Grade Pallet within the viewfinder, or use direct input below.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  icon="scan"
                  onClick={() => startCamera()}
                >
                  Activate Camera
                </Button>
                {cameraError && <p className="text-xs text-destructive">{cameraError}</p>}
              </div>
            )}

            {/* USB 2D Scanner Input in Modal */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-mono uppercase block">
                Or USB 2D Scanner / Keyboard Wedge:
              </label>
              <div className="flex gap-2">
                <input
                  ref={modalInputRef}
                  type="text"
                  placeholder="Scan pallet QR (e.g. PLT-GRD-A-01)..."
                  value={modalScannerInput}
                  onChange={(e) => setModalScannerInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleVerifyModalScan(modalScannerInput)
                    }
                  }}
                  className="flex-1 px-3 py-1.5 text-xs font-mono font-bold uppercase border border-border bg-background"
                  autoFocus
                />
                <Button
                  variant="primary"
                  size="sm"
                  icon="check"
                  onClick={() => handleVerifyModalScan(modalScannerInput)}
                >
                  Verify
                </Button>
              </div>
            </div>

            {/* Active Pallet Shortcuts */}
            <div className="pt-2 border-t border-border space-y-1.5">
              <p className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider">
                Active Staged Pallets:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {availablePallets.map((p) => (
                  <button
                    key={p.code}
                    type="button"
                    onClick={() => {
                      handleSelectPallet(p)
                      closeCameraModal()
                    }}
                    className="px-2.5 py-1 text-xs font-mono border border-border bg-muted hover:bg-primary/10 hover:border-primary cursor-pointer text-left"
                  >
                    <span className="font-bold">{p.code}</span> · Grade {p.grade} ({formatWeight(p.weightKg)} kg)
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
