import { useState, useRef, useEffect } from 'react'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import Icon from '../components/shared/Icon'
import Logo from '../components/shared/Logo'
import { Input } from '../components/shared/Form'
import DataTable, { type Column } from '../components/shared/DataTable'
import PageHeader from '../components/shared/PageHeader'
import { useToast } from '../components/feedback/Toast'
import LabelPreview from '../components/operator/LabelPreview'
import { formatWeight } from '../lib/utils'

interface PairedWaring {
  waringCode: string
  grossWeightKg: number
  farmerName: string
  intakeTime: string
}

interface SortedPallet {
  id: string
  palletCode: string
  warings: PairedWaring[]
  totalIntakeKg: number
  washingOption: 'WASH' | 'SKIP'
  machineStatus: 'IDLE' | 'SIZING' | 'DONE'
  status: 'SORTING' | 'READY_FOR_GRADING' | 'TRANSFERRED'
  updatedAt: string
}

const BUFFER_WARINGS: PairedWaring[] = [
  {
    waringCode: 'WRG-20261025-0001',
    grossWeightKg: 45.5,
    farmerName: 'Ahmad Santoso',
    intakeTime: '10:15',
  },
  {
    waringCode: 'WRG-20261025-0002',
    grossWeightKg: 48.0,
    farmerName: 'Ahmad Santoso',
    intakeTime: '10:20',
  },
  {
    waringCode: 'WRG-20261025-0003',
    grossWeightKg: 52.2,
    farmerName: 'Budi Prasetyo',
    intakeTime: '10:35',
  },
]

export default function SortingPage() {
  const toast = useToast()

  /* ── Mode State ── */
  const [focusMode, setFocusMode] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  /* ── Active Pallet Under Sorting ── */
  const [currentPalletCode, setCurrentPalletCode] = useState('PLT-20261025-0001')
  const [activeWarings, setActiveWarings] = useState<PairedWaring[]>([BUFFER_WARINGS[0]])
  const [scanWaringInput, setScanWaringInput] = useState('')
  const [scanPalletInput, setScanPalletInput] = useState('')
  const [washingOption, setWashingOption] = useState<'WASH' | 'SKIP'>('WASH')
  const [sizerActive, setSizerActive] = useState(true)
  const [dirtRemovedKg, setDirtRemovedKg] = useState('1.5')

  /* ── Pallet Ledger ── */
  const [pallets, setPallets] = useState<SortedPallet[]>([
    {
      id: '1',
      palletCode: 'PLT-20261025-0001',
      warings: [BUFFER_WARINGS[0]],
      totalIntakeKg: 45.5,
      washingOption: 'WASH',
      machineStatus: 'SIZING',
      status: 'SORTING',
      updatedAt: '10:40',
    },
    {
      id: '2',
      palletCode: 'PLT-20261024-0008',
      warings: [
        {
          waringCode: 'WRG-20261024-0012',
          grossWeightKg: 50.0,
          farmerName: 'Siti Rahayu',
          intakeTime: '09:15',
        },
      ],
      totalIntakeKg: 50.0,
      washingOption: 'SKIP',
      machineStatus: 'DONE',
      status: 'READY_FOR_GRADING',
      updatedAt: '09:55',
    },
  ])

  const waringInputRef = useRef<HTMLInputElement>(null)

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

  /* Scan & Pairing Handler */
  const handlePairWaring = (code: string) => {
    const clean = code.trim().toUpperCase()
    if (!clean) return

    if (activeWarings.some((w) => w.waringCode === clean)) {
      toast.warning(`Waring ${clean} is already paired to pallet ${currentPalletCode}.`)
      setScanWaringInput('')
      return
    }

    const matched = BUFFER_WARINGS.find((w) => w.waringCode === clean)
    const newWaring: PairedWaring = matched ?? {
      waringCode: clean,
      grossWeightKg: 46.0,
      farmerName: 'Registered Farmer',
      intakeTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    }

    setActiveWarings((curr) => [...curr, newWaring])
    setScanWaringInput('')
    toast.success(`Paired ${clean} to Pallet ${currentPalletCode} (${newWaring.grossWeightKg} kg)`)
  }

  const handleUnpairWaring = (waringCode: string) => {
    setActiveWarings((curr) => curr.filter((w) => w.waringCode !== waringCode))
    toast.info(`Unpaired waring ${waringCode}`)
  }

  const handleAssignNewPallet = (code: string) => {
    const clean = code.trim().toUpperCase()
    if (!clean) return
    setCurrentPalletCode(clean)
    setScanPalletInput('')
    toast.success(`Active pallet set to ${clean}`)
  }

  const handleCompleteSorting = () => {
    if (activeWarings.length === 0) {
      toast.error('Pair at least one intake waring before dispatching to grading.')
      return
    }

    const totalIntake = activeWarings.reduce((sum, w) => sum + w.grossWeightKg, 0)
    const updated: SortedPallet = {
      id: String(Date.now()),
      palletCode: currentPalletCode,
      warings: activeWarings,
      totalIntakeKg: totalIntake,
      washingOption,
      machineStatus: 'DONE',
      status: 'READY_FOR_GRADING',
      updatedAt: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    }

    setPallets((curr) => [updated, ...curr.filter((p) => p.palletCode !== currentPalletCode)])
    toast.success(
      `Sorting completed! Pallet ${currentPalletCode} transferred to Grading Station.`,
    )

    // Prepare next pallet
    const nextSeq = parseInt(currentPalletCode.slice(-4), 10) + 1
    const nextCode = `PLT-20261025-${String(nextSeq).padStart(4, '0')}`
    setCurrentPalletCode(nextCode)
    setActiveWarings([])
  }

  const totalIntakeWeight = activeWarings.reduce((sum, w) => sum + w.grossWeightKg, 0)

  const columns: Column<SortedPallet>[] = [
    {
      key: 'palletCode',
      label: 'Pallet Code',
      priority: true,
      render: (row) => <span className="font-mono font-bold text-foreground">{row.palletCode}</span>,
    },
    {
      key: 'warings',
      label: 'Paired Warings',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.warings.map((w) => (
            <span
              key={w.waringCode}
              className="font-mono text-[11px] bg-muted px-1.5 py-0.5 border border-border"
            >
              {w.waringCode}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'totalIntakeKg',
      label: 'Intake Gross kg',
      align: 'right',
      render: (row) => (
        <span className="font-mono font-bold text-foreground">{formatWeight(row.totalIntakeKg)} kg</span>
      ),
    },
    {
      key: 'washingOption',
      label: 'Washing',
      render: (row) => (
        <Badge tone={row.washingOption === 'WASH' ? 'accent' : 'neutral'}>
          {row.washingOption === 'WASH' ? 'WASHED' : 'DRY SIZED'}
        </Badge>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      priority: true,
      render: (row) => (
        <Badge tone={row.status === 'READY_FOR_GRADING' ? 'success' : 'warning'} dot>
          {row.status === 'READY_FOR_GRADING' ? 'Ready for Grading' : 'Sorting in Progress'}
        </Badge>
      ),
    },
    {
      key: 'updatedAt',
      label: 'Time',
      render: (row) => <span className="font-mono text-xs text-muted-foreground">{row.updatedAt}</span>,
    },
  ]

  const renderContent = () => (
    <div className="space-y-6">
      {/* ── Active Pairing & Sorting Station Console ── */}
      <div className="bg-card border border-border p-6 rounded-none shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-2">
          <div>
            <span className="text-xs uppercase font-mono font-semibold tracking-wider text-muted-foreground">
              Station 03 · Manual Sorting, Pallet Pairing & Mechanical Sizer
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
              Active Pallet: <span className="font-mono text-emerald-800">{currentPalletCode}</span>
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="accent">STEP 3 OF 7</Badge>
            <Badge tone={sizerActive ? 'success' : 'neutral'} dot live={sizerActive}>
              {sizerActive ? 'SIZER RUNNING 50 Hz' : 'SIZER STANDBY'}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1: Scan & Pairing Input */}
          <div className="space-y-4">
            <div className="border border-border p-4 bg-muted/20 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground block flex items-center gap-2">
                <Icon name="qr" size={16} />
                Scan Waring QR Code (WRG-...)
              </span>
              <p className="text-xs text-muted-foreground">
                Scan the intake waring sack from buffer storage to pair with this pallet.
              </p>
              <div className="flex gap-2">
                <Input
                  ref={waringInputRef}
                  placeholder="e.g. WRG-20261025-0002"
                  value={scanWaringInput}
                  onChange={(e) => setScanWaringInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handlePairWaring(scanWaringInput)
                  }}
                  className="font-mono text-sm"
                />
                <Button variant="primary" icon="check" onClick={() => handlePairWaring(scanWaringInput)}>
                  Pair
                </Button>
              </div>

              {/* Quick buffer picks */}
              <div className="pt-2 border-t border-dashed border-border space-y-1.5">
                <span className="text-[10px] font-mono uppercase text-muted-foreground block">
                  Quick Pick from Buffer Queue:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {BUFFER_WARINGS.map((bw) => (
                    <button
                      key={bw.waringCode}
                      type="button"
                      onClick={() => handlePairWaring(bw.waringCode)}
                      className="text-[11px] font-mono px-2 py-0.5 border border-border bg-card hover:bg-emerald-50 hover:border-emerald-500 cursor-pointer"
                    >
                      +{bw.waringCode} ({bw.grossWeightKg} kg)
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Set / Change Target Pallet */}
            <div className="border border-border p-4 bg-muted/20 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground block">
                Target Pallet ID
              </span>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. PLT-20261025-0002"
                  value={scanPalletInput}
                  onChange={(e) => setScanPalletInput(e.target.value)}
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  onClick={() => handleAssignNewPallet(scanPalletInput || currentPalletCode)}
                >
                  Set Pallet
                </Button>
              </div>
            </div>
          </div>

          {/* Column 2: Paired Warings in this Pallet */}
          <div className="space-y-4">
            <div className="border border-border p-4 bg-card h-full flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Paired Warings ({activeWarings.length})
                  </span>
                  <span className="font-mono text-xs font-bold text-emerald-800">
                    Gross: {formatWeight(totalIntakeWeight)} kg
                  </span>
                </div>

                <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                  {activeWarings.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-6 text-center">
                      No waring sacks paired yet. Scan a waring QR code on the left.
                    </p>
                  ) : (
                    activeWarings.map((w) => (
                      <div
                        key={w.waringCode}
                        className="flex items-center justify-between p-2 bg-muted/30 border border-border text-xs"
                      >
                        <div>
                          <span className="font-mono font-bold text-foreground block">{w.waringCode}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {w.farmerName} · {w.intakeTime}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-emerald-800">
                            {formatWeight(w.grossWeightKg)} kg
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUnpairWaring(w.waringCode)}
                            className="text-red-600 hover:text-red-800 p-1 cursor-pointer"
                            title="Unpair"
                          >
                            <Icon name="close" size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Rough Sorting Soil/Debris Culled */}
              <div className="pt-3 border-t border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Estimated dirt culled:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.1"
                      value={dirtRemovedKg}
                      onChange={(e) => setDirtRemovedKg(e.target.value)}
                      className="w-16 px-1.5 py-0.5 text-xs font-mono border border-border bg-background text-right"
                    />
                    <span className="text-xs text-muted-foreground">kg</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Column 3: Mechanical Sizer & Post-Sizer Washing Protocol */}
          <div className="space-y-4">
            <div className="border border-border p-4 bg-muted/20 space-y-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-foreground block">
                  Post-Sorting Processing Line
                </span>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Potatoes pass through mechanical sizer, followed by optional washing.
                </p>
              </div>

              {/* Machine Step 1: Mechanical Sizer */}
              <div className="p-3 bg-card border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold block text-foreground uppercase tracking-wider">
                      1. Mechanical Sizer Machine
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Roller sizing separator for potato diameter
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant={sizerActive ? 'primary' : 'outline'}
                    onClick={() => setSizerActive(!sizerActive)}
                  >
                    {sizerActive ? 'RUNNING' : 'STOPPED'}
                  </Button>
                </div>
              </div>

              {/* Machine Step 2: Post-Sizer Washing Protocol */}
              <div className="p-3 bg-card border border-border space-y-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                      2. Post-Sizer Washing Decision
                    </span>
                    <Badge tone="accent">Setelah Alat Sortir</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Select whether sized potatoes exiting the machine require washing before grading.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setWashingOption('WASH')}
                    className={`p-2.5 text-left border rounded-none text-xs transition-colors cursor-pointer ${
                      washingOption === 'WASH'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold'
                        : 'border-border bg-card text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <span className="block font-bold">Wash & Dry</span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      Rotary drum wash and dryer
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWashingOption('SKIP')}
                    className={`p-2.5 text-left border rounded-none text-xs transition-colors cursor-pointer ${
                      washingOption === 'SKIP'
                        ? 'border-amber-600 bg-amber-50 text-amber-900 font-bold'
                        : 'border-border bg-card text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <span className="block font-bold">Skip Washing</span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      Direct dry route to grading
                    </span>
                  </button>
                </div>

                <div className="pt-2 text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                  <span>Routing:</span>
                  <span className="text-foreground font-semibold">
                    Alat Sortir ➔ {washingOption === 'WASH' ? 'Washer & Dryer Unit' : 'Bypass Direct'} ➔ Grading Scale
                  </span>
                </div>
              </div>

              {/* Pallet QR Label Preview */}
              <div className="pt-2 border-t border-border">
                <LabelPreview
                  type="pallet"
                  code={currentPalletCode}
                  farmerId={activeWarings.map((w) => w.waringCode).join(', ') || 'WRG-QUEUE'}
                  compact
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between border-t border-border pt-4 flex-wrap gap-2">
          <div className="text-xs text-muted-foreground">
            Upstream Traceability: <span className="font-mono font-semibold text-foreground">{activeWarings.length}</span> waring sacks linked to pallet.
          </div>
          <Button
            variant="primary"
            icon="check"
            touch
            disabled={activeWarings.length === 0}
            onClick={handleCompleteSorting}
          >
            Complete Sorting & Send to Grading Station
          </Button>
        </div>
      </div>

      {/* ── Pallets in Sorting Ledger ── */}
      <div className="bg-card border border-border p-6 rounded-none shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-foreground">Active Sorted Pallets Ledger</h3>
            <p className="text-xs text-muted-foreground">
              Pallets processed through manual sorting, pairing, and sizing machine.
            </p>
          </div>
          <Badge tone="neutral">{pallets.length} Pallets Recorded</Badge>
        </div>

        <DataTable rowKey={(row) => row.id} columns={columns} data={pallets} />
      </div>
    </div>
  )

  return (
    <>
      {/* ── FOCUS MODE OVERLAY ── */}
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
                <span className="text-xs uppercase font-mono font-semibold tracking-wider text-muted-foreground block">
                  Station 03 · Manual Sorting & Pairing
                </span>
                <span className="text-lg font-bold text-foreground">
                  Focus Mode · {currentPalletCode}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" icon="expand" onClick={toggleFullscreen}>
                {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              </Button>
              <Button variant="outline" size="sm" icon="close" onClick={() => setFocusMode(false)}>
                Exit Focus
              </Button>
            </div>
          </header>
          <div className="p-6 max-w-7xl mx-auto w-full">{renderContent()}</div>
        </div>
      )}

      {/* ── NORMAL PAGE VIEW ── */}
      <div className="space-y-6">
        <PageHeader
          title="Manual Sorting & Pallet Pairing Station"
          subtitle="Inspect raw potatoes, pair harvest waring sacks to pallet QR, and feed through mechanical sizer & washer."
          actions={
            <Button variant="primary" icon="expand" onClick={enterFocusMode}>
              Launch Focus Mode
            </Button>
          }
        />
        {renderContent()}
      </div>
    </>
  )
}
