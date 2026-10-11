import { useState, useEffect } from 'react'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import Logo from '../components/shared/Logo'
import DataTable, { type Column } from '../components/shared/DataTable'
import PageHeader from '../components/shared/PageHeader'
import { useToast } from '../components/feedback/Toast'
import ScaleWeightInput from '../components/operator/ScaleWeightInput'
import LabelPreview from '../components/operator/LabelPreview'
import { formatWeight } from '../lib/utils'

type PouchRecord = {
  id: string
  code: string
  stationId: string
  grade: 'A' | 'B' | 'C'
  weightKg: number
  time: string
  status: 'LABELLED'
}

type StationConfig = {
  id: string
  name: string
  grade: 'A' | 'B' | 'C'
  ip: string
  port: number
}

const STATIONS: StationConfig[] = [
  { id: 'st-1', name: 'Station 1 (Scale A)', grade: 'A', ip: '192.168.1.101', port: 502 },
  { id: 'st-2', name: 'Station 2 (Scale B)', grade: 'B', ip: '192.168.1.102', port: 502 },
  { id: 'st-3', name: 'Station 3 (Scale C)', grade: 'C', ip: '192.168.1.103', port: 502 },
]

const TARGET_KG = 1.000
const TOLERANCE_KG = 0.005

export default function PackagingPage() {
  const toast = useToast()

  /* ── Mode State ── */
  const [focusMode, setFocusMode] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  /* ── Active Scale Station State ── */
  const [activeStationId, setActiveStationId] = useState<string>('st-1')
  const activeStation = STATIONS.find((s) => s.id === activeStationId) ?? STATIONS[0]

  /* ── Live Pouch Weight State ── */
  const [pouchWeight, setPouchWeight] = useState('1.002')
  const [isPrinting, setIsPrinting] = useState(false)

  const [pouches, setPouches] = useState<PouchRecord[]>([
    {
      id: '1',
      code: 'PCH-20261010-001',
      stationId: 'st-1',
      grade: 'A',
      weightKg: 1.002,
      time: '11:05',
      status: 'LABELLED',
    },
    {
      id: '2',
      code: 'PCH-20261010-002',
      stationId: 'st-2',
      grade: 'B',
      weightKg: 0.998,
      time: '11:08',
      status: 'LABELLED',
    },
  ])

  const weightValue = Number(pouchWeight)
  const isWithinTolerance = Math.abs(weightValue - TARGET_KG) <= TOLERANCE_KG

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

  const exitFocusMode = () => {
    setFocusMode(false)
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {})
    }
  }

  const handleApprovePouch = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!(weightValue > 0)) {
      toast.error('Pouch weight must be greater than 0 kg.')
      return
    }

    const seq = String(pouches.length + 1).padStart(3, '0')
    const code = `PCH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${seq}`
    setIsPrinting(true)

    window.setTimeout(() => {
      setIsPrinting(false)
      const newPouch: PouchRecord = {
        id: String(Date.now()),
        code,
        stationId: activeStation.id,
        grade: activeStation.grade,
        weightKg: Number(weightValue.toFixed(3)),
        time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        status: 'LABELLED',
      }
      setPouches((current) => [newPouch, ...current])
      toast.success(`Pouch ${code} (${formatWeight(weightValue)} kg) approved & printed!`)
    }, 600)
  }

  const rePrintPouchLabel = (pouch: PouchRecord) => {
    toast.warning(`Re-printing barcode label for ${pouch.code}…`)
    window.setTimeout(() => {
      toast.success(`Pouch label ${pouch.code} printed successfully.`)
    }, 600)
  }

  const columns: Column<PouchRecord>[] = [
    {
      key: 'code',
      label: 'Pouch Code',
      priority: true,
      render: (row) => <span className="font-mono font-bold text-foreground">{row.code}</span>,
    },
    {
      key: 'grade',
      label: 'Grade',
      priority: true,
      render: (row) => (
        <Badge tone={row.grade === 'A' ? 'success' : row.grade === 'B' ? 'accent' : 'warning'}>
          Grade {row.grade}
        </Badge>
      ),
    },
    {
      key: 'weightKg',
      label: 'Pouch Net Weight (kg)',
      align: 'right',
      render: (row) => (
        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
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
      render: (row) => (
        <Badge tone="success" dot>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Action',
      align: 'right',
      render: (row) => (
        <Button size="sm" variant="outline" icon="print" onClick={() => rePrintPouchLabel(row)}>
          Re-print Label
        </Button>
      ),
    },
  ]

  /* ═══════════════════════════════════════════════════════════════════
     RENDER: Packaging Station Form
     ═══════════════════════════════════════════════════════════════════ */
  const renderPackagingForm = () => (
    <div className="bg-card border border-border rounded-none p-6 shadow-sm space-y-6">
      {/* Station Selector Bar */}
      <div className="space-y-2 border-b border-border pb-4">
        <span className="text-xs uppercase font-mono font-semibold tracking-wider text-muted-foreground">
          Select Active Packaging Scale Station
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {STATIONS.map((st) => {
            const isSelected = activeStationId === st.id
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => setActiveStationId(st.id)}
                className={`p-3 rounded-none border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#229856] bg-[#f0fdf4] ring-2 ring-[#229856] text-[#0E5030] font-bold shadow-xs'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted hover:border-[#229856]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm font-heading">{st.name}</span>
                  <Badge tone={st.grade === 'A' ? 'success' : st.grade === 'B' ? 'accent' : 'warning'}>
                    Grade {st.grade}
                  </Badge>
                </div>
                <span className="text-[11px] font-mono text-muted-foreground block mt-1">
                  Modbus IP: {st.ip}:{st.port}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Live Scale & Weighing Controls */}
      <form onSubmit={handleApprovePouch} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 space-y-4">
            <ScaleWeightInput
              id="pouch-live-weight"
              label={`1 kg Pouch Live Scale (${activeStation.name})`}
              hint="Target: 1.000 kg (±5 g tolerance). Auto-locks or type weight."
              value={pouchWeight}
              onChange={setPouchWeight}
              capacityKg={5}
            />

            {/* Target Status Indicator */}
            <div className="flex items-center justify-between p-3 rounded-none border border-border bg-muted/30">
              <span className="text-xs text-muted-foreground font-medium">Target Compliance Status</span>
              {isWithinTolerance ? (
                <Badge tone="success" icon="check">
                  Target Match (1.000 kg ±5g)
                </Badge>
              ) : (
                <Badge tone="warning" icon="alert">
                  Outside Target Range
                </Badge>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                Live Label Preview
              </span>
              <Badge tone="accent">PCH Serial Next</Badge>
            </div>
            <LabelPreview
              type="pouch"
              code={`PCH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(pouches.length + 1).padStart(3, '0')}`}
              grade={activeStation.grade}
              weightKg={weightValue > 0 ? weightValue : 1.000}
              commodity="Kentang Dieng"
              stationName={activeStation.name}
            />
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between border-t border-border pt-4">
          <span className="text-xs text-muted-foreground font-mono">
            Active: {activeStation.name} · Grade {activeStation.grade}
          </span>
          <Button
            type="submit"
            variant="primary"
            icon="print"
            touch
            loading={isPrinting}
            disabled={!(weightValue > 0)}
          >
            Approve & Print Pouch Label
          </Button>
        </div>
      </form>
    </div>
  )

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════════════
         FULLSCREEN FOCUS MODE OVERLAY
         ═══════════════════════════════════════════════════════════════════ */}
      {focusMode && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-y-auto" role="dialog" aria-modal="true" aria-label="Packaging Focus Mode">
          <header className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-card/95 backdrop-blur border-b border-border shadow-sm">
            <div className="flex items-center gap-3">
              <Logo className="h-6 w-auto" markOnly />
              <div>
                <span className="font-semibold text-sm block leading-none text-foreground">1 kg Pouch Packaging Station</span>
                <span className="text-[10px] text-muted-foreground font-mono">Focus Mode</span>
              </div>
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
              <Button variant="outline" size="sm" icon="close" onClick={exitFocusMode}>
                Exit Focus
              </Button>
            </div>
          </header>

          <main className="flex-1 p-4 md:p-8 max-w-5xl w-full mx-auto">
            {renderPackagingForm()}
          </main>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
         STANDARD DASHBOARD VIEW
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="space-y-6">
        <PageHeader
          title="Pouch Packaging"
          subtitle="1 kg pouch weighing and GS1 Digital Link label printing across 3 scale stations."
          actions={
            <Button variant="primary" icon="expand" touch onClick={enterFocusMode}>
              Focus Mode
            </Button>
          }
        />

        {/* Render Main Form */}
        {renderPackagingForm()}

        {/* Labeled Pouches History Table */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight text-foreground">Labeled Pouches Ledger</h2>
            <span className="text-xs text-muted-foreground font-mono">
              Total {pouches.length} pouches labeled today
            </span>
          </div>
          <DataTable
            columns={columns}
            data={pouches}
            rowKey={(row) => row.id}
            emptyTitle="No pouches labeled today."
            emptyDescription="Weigh 1 kg pouch and approve to generate barcode label."
          />
        </section>
      </div>
    </>
  )
}
