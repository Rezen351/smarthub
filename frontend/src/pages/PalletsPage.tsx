import { useState, useEffect, useMemo } from 'react'
import Card from '../components/shared/Card'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import Icon from '../components/shared/Icon'
import { Field, Input } from '../components/shared/Form'
import DataTable, { type Column } from '../components/shared/DataTable'
import PageHeader from '../components/shared/PageHeader'
import StatCard from '../components/shared/StatCard'
import ConfirmDialog from '../components/feedback/ConfirmDialog'
import { useToast } from '../components/feedback/Toast'
import LabelPreview from '../components/operator/LabelPreview'
import PalletCloseoutModal from '../components/shared/PalletCloseoutModal'
import { api, type Pallet, type PalletCloseout, type CloseoutDisposition } from '../services/api'
import { formatWeight } from '../lib/utils'

interface PalletsPageProps {
  embedded?: boolean
}

export default function PalletsPage({ embedded = false }: PalletsPageProps) {
  const toast = useToast()
  const [pallets, setPallets] = useState<Pallet[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'AVAILABLE' | 'IN_USE'>('ALL')

  // Register Modal State
  const [registerOpen, setRegisterOpen] = useState(false)
  const [formCode, setFormCode] = useState('')
  const [formTareKg, setFormTareKg] = useState('15.0')
  const [formNotes, setFormNotes] = useState('Standard wood pallet')
  const [printImmediately, setPrintImmediately] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // QR Preview Modal State
  const [previewPallet, setPreviewPallet] = useState<Pallet | null>(null)

  // Delete Confirm State
  const [confirmDelete, setConfirmDelete] = useState<Pallet | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Print Action Loading State
  const [printingCode, setPrintingCode] = useState<string | null>(null)

  // Pallet Thermal Printer Configuration
  const [printerModalOpen, setPrinterModalOpen] = useState(false)
  const [palletPrinter, setPalletPrinter] = useState<{
    station: string
    model: string
    paperWidthMm: string
    connection: string
    ip: string
    port: string
    status: 'ONLINE' | 'OFFLINE'
  }>({
    station: 'PALLET',
    model: 'IW-J300H',
    paperWidthMm: '80',
    connection: 'Ethernet',
    ip: '',
    port: '9100',
    status: 'OFFLINE',
  })
  const [testingPrinter, setTestingPrinter] = useState(false)
  const [savingPrinter, setSavingPrinter] = useState(false)

  // Release & Closeout Audit State
  const [releaseTarget, setReleaseTarget] = useState<Pallet | null>(null)
  const [closeouts, setCloseouts] = useState<PalletCloseout[]>([])

  const fetchPallets = async () => {
    try {
      const [palletsRes, closeoutsRes] = await Promise.allSettled([
        api.pallets.list(),
        api.pallets.closeouts(),
      ])
      if (palletsRes.status === 'fulfilled' && Array.isArray(palletsRes.value)) {
        setPallets(palletsRes.value)
      }
      if (closeoutsRes.status === 'fulfilled' && Array.isArray(closeoutsRes.value)) {
        setCloseouts(closeoutsRes.value)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load pallets')
    }
  }

  const fetchPalletPrinter = async () => {
    try {
      const printers = await api.printers.get()
      if (Array.isArray(printers)) {
        const p = printers.find((item: any) => item.station?.toLowerCase() === 'pallet')
        if (p) {
          setPalletPrinter((prev) => ({
            ...prev,
            station: p.station || 'PALLET',
            model: p.model || 'IW-J300H',
            paperWidthMm: String(p.paperWidthMm || '80'),
            connection: p.connection || 'Ethernet',
            ip: p.ip || '',
            port: String(p.port || '9100'),
          }))
          if (p.ip) {
            api.printers.test('pallet')
              .then((res: any) => {
                setPalletPrinter((prev) => ({ ...prev, status: res?.online ? 'ONLINE' : 'OFFLINE' }))
              })
              .catch(() => {
                setPalletPrinter((prev) => ({ ...prev, status: 'OFFLINE' }))
              })
          }
        }
      }
    } catch {
      // Ignore silent error
    }
  }

  useEffect(() => {
    fetchPallets()
    fetchPalletPrinter()
  }, [])

  // Auto-suggest next pallet code (e.g., PLT-011)
  const nextSuggestedCode = useMemo(() => {
    let maxNum = 0
    pallets.forEach((p) => {
      const match = p.code.match(/^PLT-(\d+)$/i)
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > maxNum) maxNum = num
      }
    })
    return `PLT-${String(maxNum + 1).padStart(3, '0')}`
  }, [pallets])

  const handleOpenRegister = () => {
    setFormCode(nextSuggestedCode)
    setFormTareKg('15.0')
    setFormNotes('Standard wood pallet')
    setPrintImmediately(false)
    setRegisterOpen(true)
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedCode = formCode.trim().toUpperCase()
    if (!trimmedCode) {
      toast.warning('Please enter a pallet code.')
      return
    }

    const tare = parseFloat(formTareKg) || 15.0
    setSubmitting(true)

    try {
      await api.pallets.create({
        code: trimmedCode,
        tareKg: tare,
        notes: formNotes.trim(),
      })

      toast.success(`Pallet ${trimmedCode} registered successfully.`)
      setRegisterOpen(false)
      await fetchPallets()

      if (printImmediately) {
        handlePrint(trimmedCode)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to register pallet')
    } finally {
      setSubmitting(false)
    }
  }

  const handleTestPrinter = async () => {
    const ip = (palletPrinter.ip || '').trim()
    const port = Number(palletPrinter.port) || 9100
    if (!ip) {
      toast.warning('Please enter a printer IP address before testing.')
      return
    }
    setTestingPrinter(true)
    try {
      const res = await api.printers.test('pallet', { ip, port })
      const isOnline = Boolean(res?.online)
      setPalletPrinter((prev) => ({ ...prev, status: isOnline ? 'ONLINE' : 'OFFLINE' }))
      if (isOnline) {
        toast.success(`Pallet printer is online at ${ip}:${port}.`)
      } else {
        toast.warning(`Pallet printer is offline at ${ip}:${port}.`)
      }
    } catch (err: any) {
      setPalletPrinter((prev) => ({ ...prev, status: 'OFFLINE' }))
      toast.error(`Printer test failed: ${err?.message || 'Connection timeout'}`)
    } finally {
      setTestingPrinter(false)
    }
  }

  const handleSavePrinter = async (e: React.FormEvent) => {
    e.preventDefault()
    const ip = (palletPrinter.ip || '').trim()
    const port = Number(palletPrinter.port) || 9100
    setSavingPrinter(true)
    try {
      await api.printers.update('pallet', ip, port)
      toast.success('Pallet printer settings saved.')
      setPrinterModalOpen(false)
      if (ip) {
        void handleTestPrinter()
      }
    } catch (err: any) {
      toast.error(`Failed to save printer settings: ${err?.message || 'Error'}`)
    } finally {
      setSavingPrinter(false)
    }
  }

  const handlePrint = async (code: string) => {
    if (!palletPrinter.ip) {
      toast.warning('Pallet printer is not configured. Please set the printer IP in Printer Settings.')
      setPrinterModalOpen(true)
      return
    }
    setPrintingCode(code)
    try {
      const res = await api.pallets.print(code)
      toast.success(res?.message || `Print job for pallet ${code} dispatched to Pallet Printer.`)
    } catch (err: any) {
      toast.error(err?.message || `Failed to print label for ${code}`)
    } finally {
      setPrintingCode(null)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      await api.pallets.delete(confirmDelete.id || confirmDelete.code)
      toast.success(`Pallet ${confirmDelete.code} removed.`)
      setConfirmDelete(null)
      await fetchPallets()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete pallet')
    } finally {
      setDeleting(false)
    }
  }

  // Filtered pallets
  const filteredPallets = useMemo(() => {
    const q = search.trim().toLowerCase()
    return pallets.filter((p) => {
      const matchesSearch =
        !q ||
        p.code.toLowerCase().includes(q) ||
        (p.notes && p.notes.toLowerCase().includes(q)) ||
        (p.farmerName && p.farmerName.toLowerCase().includes(q)) ||
        (p.grade && p.grade.toLowerCase().includes(q))

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'AVAILABLE' && p.status === 'AVAILABLE') ||
        (statusFilter === 'IN_USE' && p.status !== 'AVAILABLE')

      return matchesSearch && matchesStatus
    })
  }, [pallets, search, statusFilter])

  // Aggregate Metrics
  const totalPallets = pallets.length
  const availablePallets = pallets.filter((p) => p.status === 'AVAILABLE').length
  const inUsePallets = pallets.filter((p) => p.status !== 'AVAILABLE').length
  const totalStockKg = pallets.reduce((sum, p) => sum + (p.remainingKg || p.weightKg || 0), 0)

  const DISPOSITION_LABELS: Record<CloseoutDisposition, string> = {
    SHRINKAGE_LOSS: 'Shrinkage Loss',
    LOOSE_RESERVE: 'Loose Crate',
    CULL_REJECT: 'Quality Reject',
    SAMPLE_USE: 'Sample / QC',
  }

  const renderActions = (row: Pallet) => {
    const isPrinting = printingCode === row.code
    const canRelease = row.status === 'IN_USE' || (row.remainingKg ?? 0) > 0
    const canDelete = row.status === 'AVAILABLE' && (row.weightKg || 0) === 0
    return (
      <div className="flex items-center justify-end gap-1.5 flex-wrap">
        {canRelease && (
          <Button
            variant="outline"
            size="sm"
            icon="check"
            onClick={() => setReleaseTarget(row)}
            title="Settle remaining stock and release pallet for Sorting reuse"
          >
            Release
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          icon="print"
          disabled={isPrinting}
          onClick={() => handlePrint(row.code)}
          title="Send ESC/POS QR label print job to Pallet Printer"
        >
          {isPrinting ? 'Printing…' : 'Print QR'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon="eye"
          onClick={() => setPreviewPallet(row)}
          title="Preview QR Code & Label"
        >
          Preview
        </Button>
        {canDelete && (
          <Button
            variant="ghost"
            size="sm"
            icon="trash"
            className="text-destructive hover:bg-destructive/10"
            onClick={() => setConfirmDelete(row)}
            title="Remove empty physical pallet"
          />
        )}
      </div>
    )
  }

  const columns: Column<Pallet>[] = [
    {
      key: 'code',
      label: 'Pallet Code',
      priority: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <Icon name="pallet" size={18} className="text-muted-foreground shrink-0" />
          <span className="font-mono font-bold text-sm tracking-wide text-foreground">{row.code}</span>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      priority: true,
      render: (row) => {
        const isAvail = row.status === 'AVAILABLE'
        const isDepleted = row.status === 'DEPLETED'
        return (
          <Badge
            tone={isAvail ? 'success' : isDepleted ? 'neutral' : 'accent'}
            dot={isAvail}
          >
            {row.status.replace(/_/g, ' ')}
          </Badge>
        )
      },
    },
    {
      key: 'tareKg',
      label: 'Tare Weight',
      align: 'right',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-muted-foreground">
          {formatWeight(row.tareKg ?? 15.0)} kg
        </span>
      ),
    },
    {
      key: 'grade',
      label: 'Stored Grade',
      render: (row) => (
        <span className="font-mono text-xs">
          {row.grade ? (
            <Badge tone="accent">Grade {row.grade}</Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </span>
      ),
    },
    {
      key: 'weightKg',
      label: 'Net Produce',
      align: 'right',
      render: (row) => {
        const net = row.remainingKg || row.weightKg || 0
        return (
          <span className={`font-mono text-xs font-bold ${net > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
            {net > 0 ? `${formatWeight(net)} kg` : '0 kg'}
          </span>
        )
      },
    },
    {
      key: 'notes',
      label: 'Notes & Specification',
      render: (row) => (
        <span className="text-xs text-muted-foreground truncate max-w-xs block">
          {row.notes || '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: renderActions,
    },
  ]

  return (
    <div className="space-y-6">
      {embedded ? (
        <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-foreground">Pallet Registry</h2>
              <Badge tone={palletPrinter.status === 'ONLINE' ? 'success' : 'warning'} dot>
                {palletPrinter.status === 'ONLINE' ? `Printer Online (${palletPrinter.ip})` : 'Printer Offline'}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Register pallets, set tare weights, and print QR labels.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              icon="settings"
              touch
              onClick={() => setPrinterModalOpen(true)}
              title="Configure dedicated Pallet thermal printer"
            >
              Printer Settings
            </Button>
            <Button variant="primary" icon="plus" touch onClick={handleOpenRegister}>
              Register Pallet
            </Button>
          </div>
        </div>
      ) : (
        <PageHeader
          title="Pallet Registry"
          subtitle="Register pallets, set tare weights, and print QR labels."
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                icon="settings"
                touch
                onClick={() => setPrinterModalOpen(true)}
                title="Configure dedicated Pallet thermal printer"
              >
                Printer Settings
              </Button>
              <Button variant="primary" icon="plus" touch onClick={handleOpenRegister}>
                Register Pallet
              </Button>
            </div>
          }
        />
      )}

      {/* Aggregate KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Pallets"
          value={totalPallets}
          sub="Registered physical units"
          icon={<Icon name="pallet" size={18} />}
        />
        <StatCard
          label="Available"
          value={availablePallets}
          sub="Ready for sorting"
          icon={<Icon name="check-circle" size={18} />}
        />
        <StatCard
          label="In Use / Staged"
          value={inUsePallets}
          sub="Loaded with sorted grades"
          icon={<Icon name="box" size={18} />}
        />
        <StatCard
          label="Total Produce on Pallets"
          value={`${formatWeight(totalStockKg)} kg`}
          sub="Commercial potato yield"
          icon={<Icon name="scale" size={18} />}
        />
      </div>

      {/* Filter and Search Bar */}
      <Card padding="none">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search pallets by code, notes, grade..."
              className="text-sm"
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span className="text-xs text-muted-foreground uppercase font-mono">Filter:</span>
            <div className="flex border border-border divide-x divide-border text-xs">
              {(['ALL', 'AVAILABLE', 'IN_USE'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setStatusFilter(mode)}
                  className={`px-3 py-1.5 font-medium transition-colors cursor-pointer ${
                    statusFilter === mode
                      ? 'bg-primary text-primary-foreground font-semibold'
                      : 'bg-card text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  {mode === 'ALL' ? 'All' : mode === 'AVAILABLE' ? 'Available' : 'In Use'}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" icon="refresh" onClick={fetchPallets}>
              Refresh
            </Button>
          </div>
        </div>

        {/* Pallets Data Table */}
        <DataTable<Pallet>
          columns={columns}
          data={filteredPallets}
          rowKey={(p) => p.id || p.code}
          mobileActions={renderActions}
          emptyTitle="No Pallets Found"
          emptyDescription="Register physical pallets to make them selectable at Station 2: Sorting."
          emptyAction={
            <Button variant="primary" icon="plus" size="sm" onClick={handleOpenRegister}>
              Register First Pallet
            </Button>
          }
        />
      </Card>

      {/* Recent Pallet Remainder Closeouts */}
      {closeouts.length > 0 && (
        <Card padding="none">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">Recent Remainder Closeouts</h3>
              <p className="text-xs text-muted-foreground">Audited pallet releases returning stock to Available.</p>
            </div>
            <Badge tone="neutral">{closeouts.length} records</Badge>
          </div>
          <DataTable<PalletCloseout>
            rowKey={(row) => row.id}
            data={closeouts.slice(0, 15)}
            columns={[
              {
                key: 'palletCode',
                label: 'Pallet',
                priority: true,
                render: (row) => <span className="font-mono font-bold text-foreground">{row.palletCode}</span>,
              },
              {
                key: 'grade',
                label: 'Grade',
                render: (row) => (row.grade ? <Badge tone="accent">Grade {row.grade}</Badge> : <span className="text-muted-foreground">—</span>),
              },
              {
                key: 'leftoverKg',
                label: 'Settled Weight',
                align: 'right',
                priority: true,
                render: (row) => <span className="font-mono font-bold text-amber-700 dark:text-amber-400">{formatWeight(row.leftoverKg)} kg</span>,
              },
              {
                key: 'disposition',
                label: 'Disposition',
                render: (row) => <Badge tone="neutral">{DISPOSITION_LABELS[row.disposition] || row.disposition}</Badge>,
              },
              {
                key: 'operatorName',
                label: 'Released By',
                render: (row) => <span className="text-xs text-muted-foreground">{row.operatorName || 'System'}</span>,
              },
              {
                key: 'notes',
                label: 'Notes',
                render: (row) => <span className="text-xs text-muted-foreground truncate max-w-xs block">{row.notes || '—'}</span>,
              },
              {
                key: 'createdAt',
                label: 'Time',
                render: (row) => (
                  <span className="font-mono text-xs text-muted-foreground">
                    {new Date(row.createdAt).toLocaleString('en-GB', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                ),
              },
            ]}
          />
        </Card>
      )}

      {/* ── REGISTER PALLET MODAL ── */}
      {registerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-card border border-border p-6 shadow-xl max-w-md w-full space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-lg font-bold text-foreground">Register Physical Pallet</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Assign a unique, static ID code for physical barcode / QR tagging.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRegisterOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 cursor-pointer"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <Field label="Pallet Identifier Code" hint="Unique static identifier attached to the pallet">
                <Input
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  placeholder="e.g. PLT-011"
                  required
                  className="font-mono text-base font-bold uppercase tracking-wider"
                />
              </Field>

              <Field label="Tare Weight (kg)" hint="Weight of the empty wooden/plastic pallet">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={formTareKg}
                  onChange={(e) => setFormTareKg(e.target.value)}
                  placeholder="15.0"
                  required
                  className="font-mono"
                />
              </Field>

              <Field label="Specification & Material Notes" hint="Optional notes (e.g. Euro wood, plastic, bay area)">
                <Input
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Standard wood pallet"
                />
              </Field>

              <label className="flex items-center gap-2.5 p-3 bg-muted/20 border border-border cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={printImmediately}
                  onChange={(e) => setPrintImmediately(e.target.checked)}
                  className="rounded-none border-border"
                />
                <span className="text-xs font-semibold text-foreground">
                  Print QR label on Pallet Printer immediately upon registration
                </span>
              </label>

              <div className="flex justify-end items-center gap-2 pt-3 border-t border-border">
                <Button type="button" variant="ghost" onClick={() => setRegisterOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" icon="check" disabled={submitting}>
                  {submitting ? 'Registering…' : 'Register Pallet'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── QR LABEL PREVIEW & REPRINT MODAL ── */}
      {previewPallet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-card border border-border p-6 shadow-xl max-w-sm w-full space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">Pallet Label Preview</h3>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">{previewPallet.code}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPallet(null)}
                className="text-muted-foreground hover:text-foreground p-1 cursor-pointer"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            {/* ESC/POS Thermal Label Preview */}
            <div className="flex justify-center">
              <LabelPreview
                type="pallet"
                code={previewPallet.code}
                grade={previewPallet.grade as 'A' | 'B' | 'C' | undefined}
                weightKg={previewPallet.weightKg > 0 ? previewPallet.weightKg : undefined}
                farmerName={previewPallet.farmerName || undefined}
                stationName="Pallet Management"
                date={previewPallet.createdAt ? previewPallet.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10)}
                time={previewPallet.createdAt ? previewPallet.createdAt.slice(11, 16) : 'Live'}
                screenFit
                className="w-full"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col gap-2 pt-2">
              <Button
                variant="primary"
                icon="print"
                className="w-full"
                disabled={printingCode === previewPallet.code}
                onClick={() => handlePrint(previewPallet.code)}
              >
                {printingCode === previewPallet.code ? 'Printing Label…' : 'Print ESC/POS Label (Pallet Printer)'}
              </Button>
              <Button variant="ghost" onClick={() => setPreviewPallet(null)} className="w-full">
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── PALLET PRINTER CONFIGURATION MODAL ── */}
      {printerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-card border border-border p-6 shadow-xl max-w-md w-full space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">Pallet Printer Settings</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Dedicated thermal printer for Pallet QR labels</p>
              </div>
              <button
                type="button"
                onClick={() => setPrinterModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 cursor-pointer"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/20 border border-border">
              <div>
                <div className="text-xs font-semibold text-foreground">Connection Status</div>
                <div className="text-xs text-muted-foreground font-mono">
                  {palletPrinter.ip ? `${palletPrinter.ip}:${palletPrinter.port}` : 'Not configured'}
                </div>
              </div>
              <Badge tone={palletPrinter.status === 'ONLINE' ? 'success' : 'warning'} dot>
                {palletPrinter.status === 'ONLINE' ? 'Online' : 'Offline'}
              </Badge>
            </div>

            <form onSubmit={handleSavePrinter} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Model">
                  <Input value={palletPrinter.model} readOnly className="font-mono bg-muted/30" />
                </Field>
                <Field label="Paper Width">
                  <Input value={`${palletPrinter.paperWidthMm} mm`} readOnly className="font-mono bg-muted/30" />
                </Field>
              </div>

              <Field label="Connection Protocol">
                <Input value={`${palletPrinter.connection} (RAW TCP)`} readOnly className="font-mono bg-muted/30" />
              </Field>

              <Field label="Printer IP Address" required hint="e.g. 192.168.8.115">
                <Input
                  value={palletPrinter.ip}
                  onChange={(e) => setPalletPrinter((prev) => ({ ...prev, ip: e.target.value }))}
                  placeholder="192.168.8.115"
                  required
                  className="font-mono"
                />
              </Field>

              <Field label="TCP Port" required hint="Default raw thermal port is 9100">
                <Input
                  type="number"
                  min="1"
                  max="65535"
                  value={palletPrinter.port}
                  onChange={(e) => setPalletPrinter((prev) => ({ ...prev, port: e.target.value }))}
                  placeholder="9100"
                  required
                  className="font-mono"
                />
              </Field>

              <div className="flex items-center justify-between pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  icon="refresh"
                  disabled={testingPrinter || !palletPrinter.ip}
                  onClick={handleTestPrinter}
                >
                  {testingPrinter ? 'Testing…' : 'Test Connection'}
                </Button>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" onClick={() => setPrinterModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" icon="check" disabled={savingPrinter}>
                    {savingPrinter ? 'Saving…' : 'Save Settings'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION ── */}
      <ConfirmDialog
        open={confirmDelete !== null}
        title="Remove Pallet"
        description={`Are you sure you want to remove pallet "${confirmDelete?.code}" from the registry?`}
        confirmLabel={deleting ? 'Removing…' : 'Remove Pallet'}
        tone="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* ── RELEASE / CLOSEOUT MODAL ── */}
      <PalletCloseoutModal
        open={releaseTarget !== null}
        palletCode={releaseTarget?.code || ''}
        grade={releaseTarget?.grade}
        farmerName={releaseTarget?.farmerName}
        remainingKg={releaseTarget?.remainingKg ?? releaseTarget?.weightKg ?? 0}
        onClose={() => setReleaseTarget(null)}
        onReleased={() => {
          setReleaseTarget(null)
          void fetchPallets()
        }}
      />
    </div>
  )
}
