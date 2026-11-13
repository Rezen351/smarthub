/**
 * Station 03: Packaging & Dispatch Console
 *
 * Implements the unified station layout with sequential 3-step workflow:
 *   Step 1: Spec & Grade (Choose Retail Pouch 1 kg vs Bulk Export Carton 10/50 kg, and potato grade)
 *   Step 2: Weigh & Check (Precision Scale 03 reading via Modbus TCP Port 502 with real-time tolerance check)
 *   Step 3: Label & Dispatch (GS1 Digital Link QR / ITF-14 barcode label printing & automated finished goods ledger update)
 */
import { useState, useEffect, useCallback, useRef } from 'react'
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
import { formatWeight, formatSafeDate, formatSafeTime } from '../lib/utils'
import { usePackhouseStore } from '../hooks/usePackhouseStore'
import CameraScannerModal from '../components/shared/CameraScannerModal'
import PalletCloseoutModal from '../components/shared/PalletCloseoutModal'
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
  date?: string
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
  const { syncWithBackend } = usePackhouseStore()

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
  const [scaleCapacityKg, setScaleCapacityKg] = useState<number | null>(null)
  const [scaleOnline, setScaleOnline] = useState(false)
  const [scaleEndpoint, setScaleEndpoint] = useState('Not configured')
  const [printerOnline, setPrinterOnline] = useState(false)
  const [printerEndpoint, setPrinterEndpoint] = useState('Not configured')

  useEffect(() => {
    let active = true
    const pollScale = () => {
      api.scales
        .getWeight('03')
        .then((scale) => {
          if (!active) return
          setScaleCapacityKg(Number(scale?.capacityKg) || null)
          setScaleOnline(scale?.online === true)
          setScaleEndpoint(scale?.ip && scale?.port ? `${scale.ip}:${scale.port}` : 'Not configured')
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

  useEffect(() => {
    api.printers
      .get()
      .then((printers) => {
        const printer = Array.isArray(printers) ? printers.find((item: any) => item.station === 'PACKAGING') : null
        if (printer?.ip && printer?.port) setPrinterEndpoint(`${printer.ip}:${printer.port}`)
      })
      .catch(() => setPrinterEndpoint('Not configured'))
  }, [])

  useEffect(() => {
    let active = true
    let consecutiveFails = 0
    const checkPrinter = () => {
      api.printers
        .test('packaging')
        .then((result) => {
          if (!active) return
          if (result?.online === true) {
            consecutiveFails = 0
            setPrinterOnline(true)
          } else {
            consecutiveFails++
            if (consecutiveFails >= 2) {
              setPrinterOnline(false)
            }
          }
        })
        .catch(() => {
          if (!active) return
          consecutiveFails++
          if (consecutiveFails >= 2) {
            setPrinterOnline(false)
          }
        })
    }
    checkPrinter()
    const timer = window.setInterval(checkPrinter, 5000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  /* ── Step 2: Scale 03 Live Precision Weighing ── */
  const [currentWeight, setCurrentWeight] = useState('')
  const [isPrinting, setIsPrinting] = useState(false)
  const [closeoutOpen, setCloseoutOpen] = useState(false)
  const [savedSuccessRecord, setSavedSuccessRecord] = useState<PackageRecord | null>(null)
  const [palletsFromApi, setPalletsFromApi] = useState<AvailablePallet[] | null>(null)
  const palletInputRef = useRef<HTMLInputElement>(null)

  const refreshPallets = useCallback(async () => {
    try {
      const pallets = await api.pallets.list()
      const mapped = (Array.isArray(pallets) ? pallets : [])
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
      return mapped
    } catch {
      setPalletsFromApi(null)
      return []
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    api.pallets
      .list()
      .then((pallets) => {
        if (cancelled) return
        const mapped = (Array.isArray(pallets) ? pallets : [])
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

  useEffect(() => {
    if (activeStep === 1) {
      palletInputRef.current?.focus()
    }
  }, [activeStep])

  const effectivePallets: AvailablePallet[] = palletsFromApi ?? []

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
          farmerVillage: pallet.farmerVillage || undefined,
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
  const [reprintingId, setReprintingId] = useState<string | null>(null)
  const [previewPackage, setPreviewPackage] = useState<PackageRecord | null>(null)

  const handleReprintPackage = (row: PackageRecord) => {
    setReprintingId(row.id)
    const now = new Date()
    const printDate = row.date || formatSafeDate(now)
    const printTime = row.time && row.time !== '—' ? (row.time.includes(':') ? row.time : formatSafeTime(now)) : formatSafeTime(now)
    printThermal(
      {
        type: row.mode === 'RETAIL_POUCH' ? 'pouch' : 'export',
        code: row.code,
        farmerName: sourceFarmer,
        farmerId: row.sourcePallet,
        grade: row.grade,
        weightKg: row.weightKg,
        date: printDate,
        time: printTime,
        stationName: 'Station 03 · Packaging',
      },
      'packaging',
      (err) => {
        setReprintingId(null)
        if (err) {
          toast.error(
            `Failed to reprint label for ${row.code}: ${
              err instanceof Error ? err.message : 'Check the Packaging printer.'
            }`,
          )
        } else {
          toast.success(`Reprinted label for ${row.code}.`)
        }
      },
    )
  }

  const loadPackagingRecords = useCallback(async () => {
    try {
      const list = await api.packaging.records()
      if (Array.isArray(list)) {
        setPackages(
          list.map((p: any): PackageRecord => {
            const isExport = p.format?.includes('Carton') || p.format === 'EXPORT_CARTON'
            const mode: PackagingMode = isExport ? 'BULK_EXPORT' : 'RETAIL_POUCH'
            const w = Number(p.weightKg || p.netWeightKg || 1)
            const datePart = p.createdAt ? formatSafeDate(p.createdAt) : formatSafeDate(new Date())
            const timePart = p.createdAt ? formatSafeTime(p.createdAt) : formatSafeTime(new Date())
            return {
              id: p.id || p.code || String(Math.random()),
              code: p.code || p.unitCode || '—',
              sourcePallet: p.sourcePalletCode || p.sourcePallet || undefined,
              mode,
              grade: (p.grade === 'B' || p.grade === 'C' ? p.grade : 'A') as 'A' | 'B' | 'C',
              weightKg: w,
              targetKg: mode === 'RETAIL_POUCH' ? 1.0 : (w >= 30 ? 50 : 10),
              date: datePart,
              time: timePart,
              status: p.status === 'LABELLED' ? 'LABELLED' : 'WAREHOUSE_STORED',
            }
          })
        )
      }
    } catch {
      // Ignore network errors on initial mount
    }
  }, [])

  useEffect(() => {
    void loadPackagingRecords()
  }, [loadPackagingRecords])
  const remainingPalletKg = sourcePalletRemainingKg === null
    ? 0
    : Math.max(0, Number(sourcePalletRemainingKg.toFixed(3)))
  const minTargetKg = targetKg - toleranceKg
  const isBelowCurrentSpec = Boolean(sourcePalletCode && remainingPalletKg > 0.05 && remainingPalletKg < minTargetKg)
  const isBelowMinSku = Boolean(sourcePalletCode && remainingPalletKg > 0.05 && remainingPalletKg < 0.995)
  const canSwitchTo10Kg = packagingMode === 'BULK_EXPORT' && exportTargetKg === 50 && remainingPalletKg >= 9.95
  const canSwitchTo1Kg = (packagingMode === 'BULK_EXPORT' || targetKg > 1) && remainingPalletKg >= 0.995 && remainingPalletKg < minTargetKg

  const renderRemainderGuidance = () => {
    if (!isBelowCurrentSpec) return null
    return (
      <div className="p-4 bg-amber-500/10 border border-amber-500/35 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-300">
          <Icon name="alert-triangle" size={16} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div className="space-y-0.5">
            <div className="font-bold">
              {isBelowMinSku
                ? `Sub-Minimum Remainder (${remainingPalletKg.toFixed(3)} kg < 1.000 kg)`
                : `Remaining Stock (${remainingPalletKg.toFixed(3)} kg) Below ${targetKg} kg Spec`}
            </div>
            <p className="text-amber-800/90 dark:text-amber-300/90">
              {isBelowMinSku
                ? `Cannot form a 1 kg pouch from ${sourcePalletCode}. Close and release the pallet to return it to Sorting.`
                : `Switch to a smaller standard package or close and release ${sourcePalletCode} with an audited disposition.`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canSwitchTo10Kg && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setPackagingMode('BULK_EXPORT')
                setExportTargetKg(10)
                setSavedSuccessRecord(null)
                setCurrentWeight('')
                setActiveStep(2)
              }}
            >
              Use 10 kg Carton
            </Button>
          )}
          {canSwitchTo1Kg && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setPackagingMode('RETAIL_POUCH')
                setSavedSuccessRecord(null)
                setCurrentWeight('')
                setActiveStep(2)
              }}
            >
              Use 1 kg Pouch
            </Button>
          )}
          <Button
            size="sm"
            variant={isBelowMinSku ? 'primary' : 'outline'}
            icon="check"
            onClick={() => setCloseoutOpen(true)}
          >
            Close &amp; Release Pallet
          </Button>
        </div>
      </div>
    )
  }

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

  const nextCodePreview = 'Assigned on save'

  const handleScanNextPallet = useCallback((openCamera = false) => {
    const prevPallet = sourcePalletCode
    setSavedSuccessRecord(null)
    setSourcePalletCode('')
    setSourceFarmer('')
    setSourceWaring('')
    setSourcePalletRemainingKg(null)
    setPalletSearch('')
    setPalletScanError(null)
    setCurrentWeight('')
    setActiveStep(1)
    void refreshPallets()
    if (prevPallet) {
      toast.info(`Pallet ${prevPallet} completed. Ready to scan next pallet.`)
    }
    if (openCamera) {
      openCameraModal()
    } else {
      window.setTimeout(() => palletInputRef.current?.focus(), 150)
    }
  }, [sourcePalletCode, refreshPallets, openCameraModal, toast])

  /* Step 3: Print & Dispatch Commitment */
  const handlePrintAndLabel = async () => {
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
    try {
      const saved = await api.packaging.pack({
        palletCode: sourcePalletCode,
        packageTypeCode: packagingMode === 'RETAIL_POUCH' ? 'RETAIL_POUCH' : 'EXPORT_CARTON',
        quantity: 1,
        totalNetWeightKg: weightValue,
        storageLocation: packagingMode === 'RETAIL_POUCH' ? 'Rack A-01' : 'Pallet Bay 03',
      })
      if (!saved?.packageCode) throw new Error('The server did not confirm the package code.')
      const newCode = saved.packageCode
      const now = new Date()
      const printDate = formatSafeDate(now)
      const printTime = formatSafeTime(now)
      const newRecord: PackageRecord = {
        id: String(Date.now()),
        code: newCode,
        sourcePallet: sourcePalletCode,
        mode: packagingMode,
        grade: selectedGrade,
        weightKg: weightValue,
        targetKg,
        date: printDate,
        time: printTime,
        status: 'WAREHOUSE_STORED',
      }
      setPackages((curr) => [newRecord, ...curr])
      setSavedSuccessRecord(newRecord)
      setSourcePalletRemainingKg(saved.remainingKg)
      if (saved.palletReleased) toast.success(`Pallet ${sourcePalletCode} is available again.`)
      void refreshPallets()
      void syncWithBackend()
      void loadPackagingRecords()

      printThermal(
        {
          type: packagingMode === 'RETAIL_POUCH' ? 'pouch' : 'export',
          code: newCode,
          farmerName: sourceFarmer,
          farmerId: sourcePalletCode,
          grade: selectedGrade,
          weightKg: weightValue,
          date: printDate,
          time: printTime,
          stationName: 'Station 03 · Packaging',
        },
        'packaging',
        (error) => {
          setIsPrinting(false)
          if (error)
            toast.error(
              `Packaging label print failed: ${
                error instanceof Error ? error.message : 'Check the Packaging printer.'
              }`,
            )
        },
      )

      toast.success(
        `Recorded ${newCode} (${
          packagingMode === 'RETAIL_POUCH' ? '1 kg Pouch' : `${targetKg} kg Export Carton`
        }). Stored in warehouse.`,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the package.')
    } finally {
      setIsPrinting(false)
    }
  }

  const handleNextUnit = () => {
    setSavedSuccessRecord(null)
    if (remainingPalletKg <= 0.0005) {
      handleScanNextPallet()
      return
    }
    setCurrentWeight('')
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
    {
      key: 'actions',
      label: 'Action',
      align: 'right',
      priority: true,
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="outline"
            size="sm"
            icon="print"
            disabled={reprintingId === row.id}
            onClick={() => handleReprintPackage(row)}
            title={`Reprint label for ${row.code}`}
          >
            {reprintingId === row.id ? 'Printing…' : 'Reprint'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon="eye"
            onClick={() => setPreviewPackage(row)}
            title="Preview label"
          >
            Preview
          </Button>
        </div>
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
    <div className="station-workflow space-y-6">
      {/* ── STEP 1: Package Type & Source Pallet ── */}
      {activeStep === 1 && (
        <div className="station-step bg-card border border-border p-6 shadow-sm space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-2">
            <div>
              <span className="text-xs uppercase font-mono font-semibold tracking-wider text-muted-foreground">
                Step 1 of 3
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                Scan Pallet & Select Package
              </h2>
            </div>
            <Badge tone="accent" icon="scan">
              Awaiting Scan
            </Badge>
          </div>

          {/* Centered Pallet Scanner Box */}
          <div className="station-scan-box border-2 border-dashed border-border p-6 sm:p-8 bg-card text-center space-y-4">
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
                ref={palletInputRef}
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
                <span className={`text-xs font-mono block ${remainingPalletKg <= 0 ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                  Remaining: {remainingPalletKg.toFixed(3)} kg {remainingPalletKg <= 0 && '(Depleted)'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {sourcePalletCode && remainingPalletKg <= 0 ? (
                <>
                  <Badge tone="danger" dot>
                    Pallet Depleted
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    icon="scan"
                    onClick={() => handleScanNextPallet()}
                  >
                    Scan Next Pallet
                  </Button>
                </>
              ) : (
                <>
                  <Badge tone={sourcePalletCode ? 'success' : 'warning'} dot live={Boolean(sourcePalletCode)}>
                    {sourcePalletCode ? 'Source Confirmed' : 'Source Required'}
                  </Badge>
                  {sourcePalletCode && remainingPalletKg > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCloseoutOpen(true)}
                    >
                      Close &amp; Release
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {renderRemainderGuidance()}

          {/* Mode Selector Buttons */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Choose Package Type:
            </span>
            <div className="station-mode-grid grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => {
                  setPackagingMode('RETAIL_POUCH')
                  setCurrentWeight('')
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
                <p className="station-secondary-copy text-xs text-muted-foreground mt-2 leading-relaxed">
                  1 kg consumer pouch with a product QR code. Target weight 1.000 kg (allowed range ±5 g).
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPackagingMode('BULK_EXPORT')
                  setCurrentWeight('')
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
                <p className="station-secondary-copy text-xs text-muted-foreground mt-2 leading-relaxed">
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
                    setCurrentWeight('')
                  }}
                >
                  10 kg Carton
                </Button>
                <Button
                  size="sm"
                  variant={exportTargetKg === 50 ? 'primary' : 'outline'}
                  disabled={scaleCapacityKg === null || scaleCapacityKg < 50}
                  onClick={() => {
                    setExportTargetKg(50)
                    setCurrentWeight('')
                  }}
                >
                  50 kg Carton
                </Button>
              </div>
              {scaleCapacityKg !== null && scaleCapacityKg < 50 && <p className="text-xs text-muted-foreground">50 kg requires a scale with at least 50 kg capacity.</p>}
            </div>
          )}

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            {sourcePalletCode && remainingPalletKg <= 0 ? (
              <Button
                variant="outline"
                icon="scan"
                onClick={() => handleScanNextPallet()}
              >
                Scan Another Pallet
              </Button>
            ) : <div />}
            <Button
              variant="primary"
              icon="check"
              touch
              disabled={!sourcePalletCode || sourcePalletRemainingKg === null || remainingPalletKg <= 0}
              onClick={() => {
                setCurrentWeight('')
                setActiveStep(2)
              }}
            >
              Continue to Weighing
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Weigh Package ── */}
      {activeStep === 2 && (
        <div className="station-step bg-card border border-border p-6 shadow-sm space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-2">
            <div>
              <span className="text-xs uppercase font-mono font-semibold tracking-wider text-muted-foreground">
                Step 2 of 3
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                Weigh Package
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="accent">Pallet: {sourcePalletCode}</Badge>
              <Badge tone="accent">Grade {selectedGrade}</Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Scale 03 Live Terminal (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <ScaleWeightInput
                stationId="03"
                value={currentWeight}
                onChange={setCurrentWeight}
                capacityKg={scaleCapacityKg ?? 0}
                maxAllowedWeightKg={remainingPalletKg}
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
            <div className="station-step-preview lg:col-span-5 space-y-4">
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
                    date={formatSafeDate(new Date())}
                    time={formatSafeTime(new Date())}
                    compact
                    screenFit
                  />
                ) : (
                  <LabelPreview
                    type="export"
                    code={nextCodePreview}
                    farmerName={sourceFarmer}
                    farmerId={sourcePalletCode}
                    grade={selectedGrade}
                    weightKg={weightValue}
                    date={formatSafeDate(new Date())}
                    time={formatSafeTime(new Date())}
                    compact
                    screenFit
                  />
                )}
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="space-y-3 pt-4 border-t border-border">
            {renderRemainderGuidance()}
            {remainingPalletKg <= 0.0005 && (
              <div className="p-4 bg-amber-500/15 border-2 border-amber-500/30 rounded flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-400">
                  <Icon name="alert-triangle" size={16} />
                  <span>
                    Pallet {sourcePalletCode} is fully depleted (0.000 kg). Cannot package further units.
                  </span>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  icon="scan"
                  onClick={() => handleScanNextPallet()}
                >
                  Scan Next Pallet
                </Button>
              </div>
            )}
            {weightValue > remainingPalletKg + 0.0005 && remainingPalletKg > 0.0005 && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded flex items-center justify-between text-xs text-destructive flex-wrap gap-2">
                <span>
                  Package weight ({weightValue.toFixed(3)} kg) exceeds remaining pallet stock ({remainingPalletKg.toFixed(3)} kg).
                </span>
              </div>
            )}
            {weightValue <= 0 && remainingPalletKg > 0.0005 && (
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-700 dark:text-amber-400">
                Please lock the reading from Scale 03 or enter a valid package weight.
              </div>
            )}
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setActiveStep(1)}>
                Back
              </Button>
              <Button
                variant="primary"
                icon="check"
                touch
                disabled={weightValue <= 0 || !sourcePalletCode || sourcePalletRemainingKg === null || weightValue > remainingPalletKg + 0.0005 || remainingPalletKg <= 0}
                onClick={() => setActiveStep(3)}
              >
                Continue to Label
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 3: Label & Store ── */}
      {activeStep === 3 && (
        <div className="station-step bg-card border border-border p-6 shadow-sm space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-2 no-print">
            <div>
              <span className="text-xs uppercase font-mono font-semibold tracking-wider text-muted-foreground">
                Step 3 of 3
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
          <div className="station-final-preview max-w-md mx-auto">
            {packagingMode === 'RETAIL_POUCH' ? (
              <LabelPreview
                type="pouch"
                code={savedSuccessRecord?.code ?? nextCodePreview}
                farmerName={sourceFarmer}
                farmerId={sourcePalletCode}
                grade={selectedGrade}
                weightKg={weightValue}
                stationName="Station 03 · Packaging"
                date={savedSuccessRecord?.date ?? formatSafeDate(new Date())}
                time={savedSuccessRecord?.time ?? formatSafeTime(new Date())}
                screenFit
              />
            ) : (
              <LabelPreview
                type="export"
                code={savedSuccessRecord?.code ?? nextCodePreview}
                farmerName={sourceFarmer}
                farmerId={sourcePalletCode}
                grade={selectedGrade}
                weightKg={weightValue}
                date={savedSuccessRecord?.date ?? formatSafeDate(new Date())}
                time={savedSuccessRecord?.time ?? formatSafeTime(new Date())}
                screenFit
              />
            )}
          </div>

          {/* Action Footer */}
          <div className="flex flex-col gap-3 border-t border-border pt-4 no-print">
            {savedSuccessRecord && remainingPalletKg <= 0.0005 && (
              <div className="p-4 bg-emerald-500/10 border-2 border-emerald-500/30 rounded flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded">
                    <Icon name="check-circle" size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground">Pallet Depleted</h4>
                    <p className="text-xs text-muted-foreground">
                      Pallet <span className="font-mono font-bold text-foreground">{sourcePalletCode || savedSuccessRecord.sourcePallet}</span> is fully packaged (0.000 kg remaining). Continue by scanning the next pallet.
                    </p>
                  </div>
                </div>
                <Button
                  variant="primary"
                  icon="scan"
                  touch
                  onClick={() => handleScanNextPallet()}
                  className="w-full sm:w-auto"
                >
                  Scan Next Pallet
                </Button>
              </div>
            )}
            {savedSuccessRecord && renderRemainderGuidance()}
            {weightValue > remainingPalletKg + 0.0005 && !savedSuccessRecord && (
              <div className="p-3 bg-destructive/15 border-2 border-destructive/40 rounded text-xs text-destructive font-semibold flex items-center gap-2">
                <Icon name="alert-triangle" size={16} />
                <span>
                  Cannot print: package weight ({weightValue.toFixed(3)} kg) exceeds remaining pallet stock ({remainingPalletKg.toFixed(3)} kg). Please go back to Step 2 and adjust.
                </span>
              </div>
            )}
            <div className="flex items-center justify-between flex-wrap gap-2">
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
                    disabled={
                      !isWithinTolerance ||
                      isPrinting ||
                      weightValue <= 0 ||
                      weightValue > remainingPalletKg + 0.0005
                    }
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
                        const now = new Date()
                        printThermal(
                          {
                            type: savedSuccessRecord.mode === 'RETAIL_POUCH' ? 'pouch' : 'export',
                            code: savedSuccessRecord.code,
                            farmerName: sourceFarmer,
                            farmerId: savedSuccessRecord.sourcePallet,
                            grade: savedSuccessRecord.grade,
                            weightKg: savedSuccessRecord.weightKg,
                            date: savedSuccessRecord.date || formatSafeDate(now),
                            time: savedSuccessRecord.time || formatSafeTime(now),
                            stationName: 'Station 03 · Packaging',
                          },
                          'packaging',
                          (error) => {
                            setIsPrinting(false)
                            if (error) toast.error(`Packaging label print failed: ${error instanceof Error ? error.message : 'Check the Packaging printer.'}`)
                          }
                        )
                      }}
                    >
                      Reprint Label
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {remainingPalletKg <= 0.0005 ? (
                      <Button
                        variant="primary"
                        icon="scan"
                        touch
                        onClick={() => handleScanNextPallet()}
                      >
                        Pallet Depleted · Scan Next Pallet
                      </Button>
                    ) : isBelowMinSku ? (
                      <Button
                        variant="primary"
                        icon="check"
                        touch
                        onClick={() => setCloseoutOpen(true)}
                      >
                        Close &amp; Release Pallet ({remainingPalletKg.toFixed(3)} kg)
                      </Button>
                    ) : (
                      <>
                        {remainingPalletKg > 0.05 && (
                          <Button variant="outline" onClick={() => setCloseoutOpen(true)}>
                            Close &amp; Release
                          </Button>
                        )}
                        <Button variant="primary" icon="check" touch onClick={handleNextUnit}>
                          Package Next Unit
                        </Button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
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
              STATION 03 · PACKAGING
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

          <main className="station-focus-main flex-1 p-4 md:p-8 max-w-5xl w-full mx-auto space-y-6">
            <div className="md:hidden">
              {renderStepperBar()}
            </div>
            {renderSequentialContent()}
          </main>
        </div>
      )}

      {/* ── NORMAL DASHBOARD PAGE VIEW ── */}
      <div className="station-page space-y-6">
        <div className="no-print">
          <PageHeader
            title="Station 03: Packaging"
            subtitle="Retail pouches, export cartons, and warehouse storage."
            actions={
              <Button
                variant="outline"
                size="sm"
                icon="history"
                onClick={() => document.getElementById('packaging-ledger')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Records ({packages.length})
              </Button>
            }
          />
        </div>

        {/* Quick Stats Grid (4 Cards) */}
        <div className="station-quick-stats grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
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
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Scale</p>
            <p className={`text-2xl font-bold tracking-tight ${scaleOnline ? 'text-emerald-600' : 'text-amber-600'}`}>{scaleOnline ? 'Online' : 'Offline'}</p>
            <p className="text-xs text-muted-foreground font-mono">{scaleEndpoint}</p>
          </div>
          <div className="bg-card border border-border rounded-none p-4 shadow-sm space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Printer</p>
            <p className={`text-2xl font-bold tracking-tight ${printerOnline ? 'text-emerald-600' : 'text-amber-600'}`}>{printerOnline ? 'Online' : 'Offline'}</p>
            <p className="text-xs text-muted-foreground font-mono">{printerEndpoint}</p>
          </div>
        </div>

        {/* Sequential Stepper in Standard View */}
        <div id="packaging-stepper" className="station-stepper-shell bg-card border border-border rounded-none p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-2 no-print">
            <span className="font-semibold text-base text-foreground">Packaging Stepper</span>
            <Button size="sm" variant="outline" icon="expand" onClick={enterFocusMode}>
              Focus Mode
            </Button>
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

      <PalletCloseoutModal
        open={closeoutOpen}
        palletCode={sourcePalletCode}
        grade={selectedGrade}
        farmerName={sourceFarmer}
        remainingKg={remainingPalletKg}
        onClose={() => setCloseoutOpen(false)}
        onReleased={() => {
          setCloseoutOpen(false)
          void syncWithBackend()
          handleScanNextPallet()
        }}
      />

      {/* ── PACKAGE LABEL PREVIEW & REPRINT MODAL ── */}
      {previewPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-card border border-border p-6 shadow-xl max-w-sm w-full space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">Package Label Preview</h3>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">{previewPackage.code}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPackage(null)}
                className="text-muted-foreground hover:text-foreground p-1 cursor-pointer"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="flex justify-center">
              <LabelPreview
                type={previewPackage.mode === 'RETAIL_POUCH' ? 'pouch' : 'export'}
                code={previewPackage.code}
                grade={previewPackage.grade}
                weightKg={previewPackage.weightKg}
                farmerName={sourceFarmer}
                farmerId={previewPackage.sourcePallet}
                stationName="Station 03 · Packaging"
                date={previewPackage.date || formatSafeDate(new Date())}
                time={previewPackage.time || formatSafeTime(new Date())}
                screenFit
                className="w-full"
              />
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button
                variant="primary"
                icon="print"
                className="w-full"
                disabled={reprintingId === previewPackage.id}
                onClick={() => handleReprintPackage(previewPackage)}
              >
                {reprintingId === previewPackage.id ? 'Printing Label…' : 'Reprint Label'}
              </Button>
              <Button variant="ghost" onClick={() => setPreviewPackage(null)} className="w-full">
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
