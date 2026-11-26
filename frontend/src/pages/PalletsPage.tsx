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
  const [formNotes, setFormNotes] = useState('Palet kayu standar')
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
      toast.error(err?.message || 'Gagal memuat data palet.')
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
    setFormNotes('Palet kayu standar')
    setPrintImmediately(false)
    setRegisterOpen(true)
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedCode = formCode.trim().toUpperCase()
    if (!trimmedCode) {
      toast.warning('Masukkan kode palet.')
      return
    }

    setSubmitting(true)

    try {
      await api.pallets.create({
        code: trimmedCode,
        tareKg: 0,
        notes: formNotes.trim(),
      })

      toast.success(`Palet ${trimmedCode} berhasil didaftarkan.`)
      setRegisterOpen(false)
      await fetchPallets()

      if (printImmediately) {
        handlePrint(trimmedCode)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Gagal mendaftarkan palet.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleTestPrinter = async () => {
    const ip = (palletPrinter.ip || '').trim()
    const port = Number(palletPrinter.port) || 9100
    if (!ip) {
      toast.warning('Masukkan alamat IP printer sebelum pengujian.')
      return
    }
    setTestingPrinter(true)
    try {
      const res = await api.printers.test('pallet', { ip, port })
      const isOnline = Boolean(res?.online)
      setPalletPrinter((prev) => ({ ...prev, status: isOnline ? 'ONLINE' : 'OFFLINE' }))
      if (isOnline) {
        toast.success(`Printer palet terhubung di ${ip}:${port}.`)
      } else {
        toast.warning(`Printer palet terputus di ${ip}:${port}.`)
      }
    } catch (err: any) {
      setPalletPrinter((prev) => ({ ...prev, status: 'OFFLINE' }))
      toast.error(`Pengujian printer gagal: ${err?.message || 'Koneksi habis waktu'}`)
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
      toast.success('Pengaturan printer palet berhasil disimpan.')
      setPrinterModalOpen(false)
      if (ip) {
        void handleTestPrinter()
      }
    } catch (err: any) {
      toast.error(`Gagal menyimpan pengaturan printer: ${err?.message || 'Terjadi kesalahan'}`)
    } finally {
      setSavingPrinter(false)
    }
  }

  const handlePrint = async (code: string) => {
    if (!palletPrinter.ip) {
      toast.warning('Printer palet belum dikonfigurasi. Atur alamat IP di Pengaturan Printer.')
      setPrinterModalOpen(true)
      return
    }
    setPrintingCode(code)
    try {
      const res = await api.pallets.print(code)
      toast.success(res?.message || `Cetak label palet ${code} dikirim ke Printer Palet.`)
    } catch (err: any) {
      toast.error(err?.message || `Gagal mencetak label untuk ${code}`)
    } finally {
      setPrintingCode(null)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      await api.pallets.delete(confirmDelete.id || confirmDelete.code)
      toast.success(`Palet ${confirmDelete.code} dihapus.`)
      setConfirmDelete(null)
      await fetchPallets()
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menghapus palet.')
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
    SHRINKAGE_LOSS: 'Susut Berat',
    LOOSE_RESERVE: 'Peti Cadangan',
    CULL_REJECT: 'Afkir Kualitas',
    SAMPLE_USE: 'Sampel / QC',
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
            title="Lepas palet kembali ke status Tersedia"
          >
            Lepas Palet
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          icon="print"
          disabled={isPrinting}
          onClick={() => handlePrint(row.code)}
          title="Kirim cetak label QR ke printer palet"
        >
          {isPrinting ? 'Mencetak…' : 'Cetak QR'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon="eye"
          onClick={() => setPreviewPallet(row)}
          title="Pratinjau QR Code & Label"
        >
          Pratinjau
        </Button>
        {canDelete && (
          <Button
            variant="ghost"
            size="sm"
            icon="trash"
            className="text-destructive hover:bg-destructive/10"
            onClick={() => setConfirmDelete(row)}
            title="Hapus palet fisik kosong"
          />
        )}
      </div>
    )
  }

  const columns: Column<Pallet>[] = [
    {
      key: 'code',
      label: 'Kode Palet',
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
            {row.status === 'AVAILABLE' ? 'TERSEDIA' : row.status === 'IN_USE' ? 'DIGUNAKAN' : 'HABIS'}
          </Badge>
        )
      },
    },
    {
      key: 'grade',
      label: 'Grade Tersimpan',
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
      label: 'Bobot Bersih',
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
      label: 'Catatan',
      render: (row) => (
        <span className="text-xs text-muted-foreground truncate max-w-xs block">
          {row.notes || '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Aksi',
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
              <h2 className="text-lg font-semibold text-foreground">Daftar Palet</h2>
              <Badge tone={palletPrinter.status === 'ONLINE' ? 'success' : 'warning'} dot>
                {palletPrinter.status === 'ONLINE' ? `Printer Terhubung (${palletPrinter.ip})` : 'Printer Terputus'}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Registrasi palet fisik, atur tara, dan cetak label QR.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              icon="settings"
              touch
              onClick={() => setPrinterModalOpen(true)}
              title="Konfigurasi printer termal palet"
            >
              Pengaturan Printer
            </Button>
            <Button variant="primary" icon="plus" touch onClick={handleOpenRegister}>
              Daftar Palet Baru
            </Button>
          </div>
        </div>
      ) : (
        <PageHeader
          title="Daftar Palet"
          subtitle="Registrasi palet fisik, atur tara, dan cetak label QR."
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                icon="settings"
                touch
                onClick={() => setPrinterModalOpen(true)}
                title="Konfigurasi printer termal palet"
              >
                Pengaturan Printer
              </Button>
              <Button variant="primary" icon="plus" touch onClick={handleOpenRegister}>
                Daftar Palet Baru
              </Button>
            </div>
          }
        />
      )}

      {/* Aggregate KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Palet"
          value={totalPallets}
          sub="Unit fisik terdaftar"
          icon={<Icon name="pallet" size={18} />}
        />
        <StatCard
          label="Tersedia"
          value={availablePallets}
          sub="Siap untuk sortasi"
          icon={<Icon name="check-circle" size={18} />}
        />
        <StatCard
          label="Digunakan"
          value={inUsePallets}
          sub="Memuat hasil sortasi"
          icon={<Icon name="box" size={18} />}
        />
        <StatCard
          label="Total Bobot di Palet"
          value={`${formatWeight(totalStockKg)} kg`}
          sub="Hasil sortasi komersial"
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
              placeholder="Cari palet berdasarkan kode, catatan, grade..."
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
                  {mode === 'ALL' ? 'Semua' : mode === 'AVAILABLE' ? 'Tersedia' : 'Digunakan'}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" icon="refresh" onClick={fetchPallets}>
              Muat Ulang
            </Button>
          </div>
        </div>

        {/* Pallets Data Table */}
        <DataTable<Pallet>
          columns={columns}
          data={filteredPallets}
          rowKey={(p) => p.id || p.code}
          mobileActions={renderActions}
          emptyTitle="Palet Tidak Ditemukan"
          emptyDescription="Daftarkan palet fisik agar dapat dipilih di Stasiun 02: Sortasi."
          emptyAction={
            <Button variant="primary" icon="plus" size="sm" onClick={handleOpenRegister}>
              Daftarkan Palet Pertama
            </Button>
          }
        />
      </Card>

      {/* Recent Pallet Remainder Closeouts */}
      {closeouts.length > 0 && (
        <Card padding="none">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">Riwayat Penyelesaian Sisa Palet</h3>
              <p className="text-xs text-muted-foreground">Pelepasan palet teraudit yang dikembalikan ke status Tersedia.</p>
            </div>
            <Badge tone="neutral">{closeouts.length} data</Badge>
          </div>
          <DataTable<PalletCloseout>
            rowKey={(row) => row.id}
            data={closeouts.slice(0, 15)}
            columns={[
              {
                key: 'palletCode',
                label: 'Palet',
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
                label: 'Berat Sisa',
                align: 'right',
                priority: true,
                render: (row) => <span className="font-mono font-bold text-amber-700 dark:text-amber-400">{formatWeight(row.leftoverKg)} kg</span>,
              },
              {
                key: 'disposition',
                label: 'Disposisi',
                render: (row) => <Badge tone="neutral">{DISPOSITION_LABELS[row.disposition] || row.disposition}</Badge>,
              },
              {
                key: 'operatorName',
                label: 'Dilepas Oleh',
                render: (row) => <span className="text-xs text-muted-foreground">{row.operatorName || 'Sistem'}</span>,
              },
              {
                key: 'notes',
                label: 'Catatan',
                render: (row) => <span className="text-xs text-muted-foreground truncate max-w-xs block">{row.notes || '—'}</span>,
              },
              {
                key: 'createdAt',
                label: 'Waktu',
                render: (row) => (
                  <span className="font-mono text-xs text-muted-foreground">
                    {new Date(row.createdAt).toLocaleString('id-ID', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
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
                <h3 className="text-lg font-bold text-foreground">Daftar Palet Fisik</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tetapkan kode ID unik untuk penandaan barcode / QR fisik.
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
              <Field label="Kode Identitas Palet" hint="Kode statis unik yang ditempel pada palet">
                <Input
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  placeholder="Contoh: PLT-011"
                  required
                  className="font-mono text-base font-bold uppercase tracking-wider"
                />
              </Field>

              <Field label="Catatan Spesifikasi & Material" hint="Catatan opsional (mis. kayu standar, plastik, area rak)">
                <Input
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Palet kayu standar"
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
                  Langsung cetak label QR di Printer Palet setelah pendaftaran
                </span>
              </label>

              <div className="flex justify-end items-center gap-2 pt-3 border-t border-border">
                <Button type="button" variant="ghost" onClick={() => setRegisterOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" variant="primary" icon="check" disabled={submitting}>
                  {submitting ? 'Mendaftarkan…' : 'Daftar Palet'}
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
                <h3 className="text-base font-bold text-foreground">Pratinjau Label Palet</h3>
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
                stationName="Manajemen Palet"
                date={previewPallet.createdAt ? previewPallet.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10)}
                time={previewPallet.createdAt ? previewPallet.createdAt.slice(11, 16) : 'Aktif'}
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
                {printingCode === previewPallet.code ? 'Mencetak Label…' : 'Cetak Label ESC/POS (Printer Palet)'}
              </Button>
              <Button variant="ghost" onClick={() => setPreviewPallet(null)} className="w-full">
                Tutup Pratinjau
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
                <h3 className="text-base font-bold text-foreground">Pengaturan Printer Palet</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Printer termal khusus untuk label QR Palet</p>
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
                <div className="text-xs font-semibold text-foreground">Status Koneksi</div>
                <div className="text-xs text-muted-foreground font-mono">
                  {palletPrinter.ip ? `${palletPrinter.ip}:${palletPrinter.port}` : 'Belum dikonfigurasi'}
                </div>
              </div>
              <Badge tone={palletPrinter.status === 'ONLINE' ? 'success' : 'warning'} dot>
                {palletPrinter.status === 'ONLINE' ? 'Terhubung' : 'Terputus'}
              </Badge>
            </div>

            <form onSubmit={handleSavePrinter} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Model">
                  <Input value={palletPrinter.model} readOnly className="font-mono bg-muted/30" />
                </Field>
                <Field label="Lebar Kertas">
                  <Input value={`${palletPrinter.paperWidthMm} mm`} readOnly className="font-mono bg-muted/30" />
                </Field>
              </div>

              <Field label="Protokol Koneksi">
                <Input value={`${palletPrinter.connection} (RAW TCP)`} readOnly className="font-mono bg-muted/30" />
              </Field>

              <Field label="Alamat IP Printer" required hint="Contoh: 192.168.8.115">
                <Input
                  value={palletPrinter.ip}
                  onChange={(e) => setPalletPrinter((prev) => ({ ...prev, ip: e.target.value }))}
                  placeholder="192.168.8.115"
                  required
                  className="font-mono"
                />
              </Field>

              <Field label="Port TCP" required hint="Port default printer termal adalah 9100">
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
                  {testingPrinter ? 'Menguji…' : 'Uji Koneksi'}
                </Button>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" onClick={() => setPrinterModalOpen(false)}>
                    Batal
                  </Button>
                  <Button type="submit" variant="primary" icon="check" disabled={savingPrinter}>
                    {savingPrinter ? 'Menyimpan…' : 'Simpan Pengaturan'}
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
        title="Hapus Palet"
        description={`Yakin ingin menghapus palet "${confirmDelete?.code}" dari daftar?`}
        confirmLabel={deleting ? 'Menghapus…' : 'Hapus Palet'}
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
