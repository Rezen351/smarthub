import { useState, useEffect, useRef } from 'react'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import Logo from '../components/shared/Logo'
import { Input } from '../components/shared/Form'
import DataTable, { type Column } from '../components/shared/DataTable'
import PageHeader from '../components/shared/PageHeader'
import { useToast } from '../components/feedback/Toast'

type GradeRecord = {
  id: string
  palletCode: string
  farmer: string
  grade: 'A' | 'B' | 'C'
  labelCode: string
  time: string
  printedCount: number
}

const GRADES: Array<'A' | 'B' | 'C'> = ['A', 'B', 'C']

const GRADE_TONE: Record<GradeRecord['grade'], 'success' | 'accent' | 'warning'> = {
  A: 'success',
  B: 'accent',
  C: 'warning',
}

export default function GradingPage() {
  const toast = useToast()

  /* ── Mode & Stepper State ── */
  const [focusMode, setFocusMode] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  /* ── Form State ── */
  const [palletCode, setPalletCode] = useState('PLT-20261010-0001')
  const [farmerName, setFarmerName] = useState('Ahmad Santoso')
  const [selectedGrade, setSelectedGrade] = useState<'A' | 'B' | 'C'>('A')
  const [isPrinting, setIsPrinting] = useState(false)
  const scanInputRef = useRef<HTMLInputElement>(null)

  const [records, setRecords] = useState<GradeRecord[]>([
    {
      id: '1',
      palletCode: 'PLT-20261010-0001',
      farmer: 'Ahmad Santoso',
      grade: 'A',
      labelCode: 'GRD-PLT-20261010-0001-A',
      time: '10:25',
      printedCount: 1,
    },
    {
      id: '2',
      palletCode: 'PLT-20261010-0001',
      farmer: 'Ahmad Santoso',
      grade: 'B',
      labelCode: 'GRD-PLT-20261010-0001-B',
      time: '10:30',
      printedCount: 1,
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

  const exitFocusMode = () => {
    setFocusMode(false)
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {})
    }
  }

  const handlePrintGradeLabel = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!palletCode.trim()) {
      toast.error('Pallet Code is required.')
      return
    }

    const labelCode = `GRD-${palletCode.trim()}-${selectedGrade}`
    setIsPrinting(true)

    window.setTimeout(() => {
      setIsPrinting(false)
      const newRecord: GradeRecord = {
        id: String(Date.now()),
        palletCode: palletCode.trim(),
        farmer: farmerName || 'Intake Farmer',
        grade: selectedGrade,
        labelCode,
        time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        printedCount: 1,
      }
      setRecords((current) => [newRecord, ...current])
      toast.success(`Grade ${selectedGrade} pallet label printed: ${labelCode}`)
    }, 600)
  }

  const rePrintGradeLabel = (record: GradeRecord) => {
    toast.warning(`Sending label ${record.labelCode} to printer…`)
    window.setTimeout(() => {
      setRecords((current) =>
        current.map((item) =>
          item.id === record.id ? { ...item, printedCount: item.printedCount + 1 } : item,
        ),
      )
      toast.success(`Label ${record.labelCode} re-printed successfully.`)
    }, 600)
  }

  const columns: Column<GradeRecord>[] = [
    {
      key: 'palletCode',
      label: 'Intake Pallet',
      priority: true,
      render: (row) => (
        <div>
          <span className="font-mono font-bold text-foreground block">{row.palletCode}</span>
          <span className="text-xs text-muted-foreground">{row.farmer}</span>
        </div>
      ),
    },
    {
      key: 'grade',
      label: 'Assigned Grade',
      priority: true,
      render: (row) => (
        <Badge tone={GRADE_TONE[row.grade]}>
          Grade {row.grade}
        </Badge>
      ),
    },
    {
      key: 'labelCode',
      label: 'Grade Label Code',
      render: (row) => <span className="font-mono text-xs text-foreground font-semibold">{row.labelCode}</span>,
    },
    {
      key: 'time',
      label: 'Printed Time',
      render: (row) => (
        <div>
          <span className="font-mono text-xs block text-foreground">{row.time}</span>
          <span className="text-xs text-muted-foreground">Copies: {row.printedCount}</span>
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Action',
      align: 'right',
      render: (row) => (
        <Button size="sm" variant="outline" icon="print" onClick={() => rePrintGradeLabel(row)}>
          Re-print
        </Button>
      ),
    },
  ]

  /* ═══════════════════════════════════════════════════════════════════
     RENDER: Form Content
     ═══════════════════════════════════════════════════════════════════ */
  const renderGradingForm = () => (
    <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Scan Pallet & Classify Grade</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Scan intake pallet label, select crop grade, and print sorted pallet label.
          </p>
        </div>
        <Badge tone="accent" icon="scan">
          Scan Ready
        </Badge>
      </div>

      <form onSubmit={handlePrintGradeLabel} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="grading-pallet" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
              1. Intake Pallet Code (Scan / Type)
            </label>
            <Input
              id="grading-pallet"
              ref={scanInputRef}
              mono
              value={palletCode}
              onChange={(e) => setPalletCode(e.target.value)}
              placeholder="Scan barcode or type PLT-..."
              className="py-3 text-base"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="grading-farmer" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
              Farmer / Source Lot
            </label>
            <Input
              id="grading-farmer"
              value={farmerName}
              onChange={(e) => setFarmerName(e.target.value)}
              placeholder="Farmer name"
              className="py-3 text-base"
            />
          </div>
        </div>

        {/* Grade Selector Buttons */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
            2. Select Commodity Grade
          </label>
          <div className="grid grid-cols-3 gap-3">
            {GRADES.map((g) => {
              const isSelected = selectedGrade === g
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => setSelectedGrade(g)}
                  className={`p-4 rounded-xl border text-center transition-all cursor-pointer ${
                    isSelected
                      ? 'border-primary bg-primary/10 ring-2 ring-primary text-foreground font-bold shadow-sm'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <span className="text-2xl font-black block">Grade {g}</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    {g === 'A' ? 'Premium Large' : g === 'B' ? 'Medium Standard' : 'Small / Industrial'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Generated Label Preview */}
        <div className="p-4 bg-muted/30 border border-border rounded-xl flex items-center justify-between flex-wrap gap-2">
          <div>
            <span className="text-xs text-muted-foreground block font-medium">Generated Sorted Pallet Code</span>
            <span className="font-mono font-bold text-lg text-primary block">
              GRD-{palletCode.trim() || 'PLT-...'}-{selectedGrade}
            </span>
          </div>
          <Button
            type="submit"
            variant="primary"
            icon="print"
            touch
            loading={isPrinting}
          >
            Print Grade {selectedGrade} Label
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
        <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-y-auto" role="dialog" aria-modal="true" aria-label="Sorting Focus Mode">
          <header className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-card/95 backdrop-blur border-b border-border shadow-sm">
            <div className="flex items-center gap-3">
              <Logo className="h-6 w-auto" markOnly />
              <div>
                <span className="font-semibold text-sm block leading-none text-foreground">Sorting Station</span>
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
            {renderGradingForm()}
          </main>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
         STANDARD DASHBOARD VIEW
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="space-y-6">
        <PageHeader
          title="Sorting"
          subtitle="Scan intake pallet label, classify harvest into Grade A/B/C, and print sorted pallet label."
          actions={
            <Button variant="primary" icon="expand" touch onClick={enterFocusMode}>
              Focus Mode
            </Button>
          }
        />

        {/* Render Main Form */}
        {renderGradingForm()}

        {/* Printed Records Table */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight text-foreground">Today's Printed Grade Labels</h2>
            <span className="text-xs text-muted-foreground font-mono">
              Total {records.length} sorted pallets
            </span>
          </div>
          <DataTable
            columns={columns}
            data={records}
            rowKey={(row) => row.id}
            emptyTitle="No grade labels printed today."
            emptyDescription="Scan an intake pallet and assign its commodity grade to print."
          />
        </section>
      </div>
    </>
  )
}
