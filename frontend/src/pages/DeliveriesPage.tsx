import { useCallback, useEffect, useState } from 'react'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import Card from '../components/shared/Card'
import DataTable, { type Column } from '../components/shared/DataTable'
import ConfirmDialog from '../components/feedback/ConfirmDialog'
import { Field, Input } from '../components/shared/Form'
import PageHeader from '../components/shared/PageHeader'
import { useToast } from '../components/feedback/Toast'
import { usePackhouseStore } from '../hooks/usePackhouseStore'
import { api, type Commodity, DEFAULT_COMMODITIES } from '../services/api'
import { translateStatus } from '@/lib/i18n'

interface Delivery {
  id: string
  code: string
  truckPlate: string
  destination: string
  driverName: string
  commodityCode?: string
  commodityName?: string
  status: 'LOADING' | 'READY' | 'DEPARTED'
  units: number
  verifiedUnits: number
  packageCodes: string[]
  createdAt: string
}

export default function DeliveriesPage() {
  const toast = useToast()
  const { syncWithBackend } = usePackhouseStore()
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [commodities, setCommodities] = useState<Commodity[]>(DEFAULT_COMMODITIES)
  const [selectedId, setSelectedId] = useState('')
  const [form, setForm] = useState({ truckPlate: '', destination: '', driverName: '', commodityCode: '001', grade: 'A' as 'A' | 'B' | 'C', units: '' })
  const [scanCode, setScanCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDepart, setConfirmDepart] = useState<Delivery | null>(null)

  const refresh = useCallback(async () => {
    try {
      const data = await api.deliveries.list()
      setDeliveries(Array.isArray(data) ? data : [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memuat data pengiriman.')
    }
  }, [toast])

  useEffect(() => {
    void refresh()
    api.commodities.list().then((list) => {
      if (Array.isArray(list) && list.length > 0) {
        setCommodities(list)
      }
    }).catch(() => {})
  }, [refresh])

  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    const units = Number(form.units)
    if (!Number.isInteger(units) || units < 1) { toast.error('Masukkan jumlah unit yang valid.'); return }
    setBusy(true)
    try {
      const saved = await api.deliveries.create({ ...form, units })
      setSelectedId(saved.id)
      setForm((prev) => ({ truckPlate: '', destination: '', driverName: '', commodityCode: prev.commodityCode, grade: 'A', units: '' }))
      await refresh()
      toast.success(`Pengiriman ${saved.code} berhasil dibuat. Pindai setiap kemasan yang dialokasikan.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal membuat pengiriman.')
    } finally { setBusy(false) }
  }

  const verify = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedId) { toast.error('Pilih pengiriman terlebih dahulu.'); return }
    if (!scanCode.trim()) { toast.error('Pindai kode kemasan atau barcode.'); return }
    setBusy(true)
    try {
      const result = await api.deliveries.verify(selectedId, scanCode.trim())
      setScanCode('')
      await refresh()
      toast.success(`${result.code} terverifikasi. Sisa ${result.remainingUnits} kemasan.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Verifikasi kemasan gagal.')
    } finally { setBusy(false) }
  }

  const depart = async () => {
    if (!confirmDepart) return
    setBusy(true)
    try {
      await api.deliveries.depart(confirmDepart.id)
      await Promise.all([refresh(), syncWithBackend()])
      toast.success(`Truk ${confirmDepart.truckPlate} telah berangkat.`)
      setConfirmDepart(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mencatat keberangkatan.')
    } finally { setBusy(false) }
  }

  const selected = deliveries.find((delivery) => delivery.id === selectedId)
  const columns: Column<Delivery>[] = [
    { key: 'code', label: 'Pengiriman', priority: true, render: (row) => <span className="font-mono">{row.code}</span> },
    {
      key: 'commodityName',
      label: 'Komoditas',
      render: (row) => row.commodityCode ? (
        <span className="text-xs font-medium text-foreground">
          <span className="font-mono font-bold mr-1">{row.commodityCode}</span>
          {row.commodityName}
        </span>
      ) : '—',
    },
    { key: 'truckPlate', label: 'Truk', priority: true },
    { key: 'destination', label: 'Tujuan', priority: true },
    { key: 'units', label: 'Kemasan', render: (row) => `${row.verifiedUnits}/${row.units} terverifikasi` },
    { key: 'status', label: 'Status', render: (row) => <Badge tone={row.status === 'DEPARTED' ? 'success' : row.status === 'READY' ? 'accent' : 'warning'}>{translateStatus(row.status)}</Badge> },
    { key: 'actions', label: 'Aksi', render: (row) => row.status === 'DEPARTED' ? null : <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setSelectedId(row.id)}>Pilih</Button><Button size="sm" variant="primary" disabled={row.status !== 'READY' || busy} onClick={() => setConfirmDepart(row)}>Berangkat</Button></div> },
  ]

  return <div className="stack stack-lg">
    <PageHeader title="Pengiriman" subtitle="Alokasikan kemasan, pindai setiap label, dan catat keberangkatan truk." />
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-md">
      <Card title="Buat Pengiriman" subtitle="Alokasikan kemasan tersimpan berdasarkan grade.">
        <form className="stack-md" onSubmit={create}>
          <Field label="Plat nomor truk" htmlFor="delivery-plate" required><Input id="delivery-plate" value={form.truckPlate} onChange={(e) => setForm({ ...form, truckPlate: e.target.value })} required /></Field>
          <Field label="Tujuan" htmlFor="delivery-destination" required><Input id="delivery-destination" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} required /></Field>
          <Field label="Nama pengemudi" htmlFor="delivery-driver"><Input id="delivery-driver" value={form.driverName} onChange={(e) => setForm({ ...form, driverName: e.target.value })} /></Field>
          <Field label="Komoditas" htmlFor="delivery-commodity" required>
            <select
              id="delivery-commodity"
              className="form-input"
              value={form.commodityCode}
              onChange={(e) => setForm({ ...form, commodityCode: e.target.value })}
            >
              {(commodities.length > 0 ? commodities : DEFAULT_COMMODITIES).map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.exportName || c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Grade" htmlFor="delivery-grade" required><select id="delivery-grade" className="form-input" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value as 'A' | 'B' | 'C' })}><option value="A">Grade A</option><option value="B">Grade B</option><option value="C">Grade C</option></select></Field>
          <Field label="Jumlah unit kemasan" htmlFor="delivery-units" required><Input id="delivery-units" type="number" min="1" step="1" value={form.units} onChange={(e) => setForm({ ...form, units: e.target.value })} required /></Field>
          <Button type="submit" variant="primary" disabled={busy}>Buat Pengiriman</Button>
        </form>
      </Card>
      <Card title="Verifikasi Muatan" subtitle={selected ? `${selected.code} · ${selected.verifiedUnits}/${selected.units} kemasan terverifikasi` : 'Pilih pengiriman dari tabel di bawah.'}>
        <form className="stack-md" onSubmit={verify}>
          {selected && <p className="text-xs text-muted-foreground">Label teralokasi: {selected.packageCodes.join(', ')}</p>}
          <Field label="Kode kemasan atau barcode" htmlFor="delivery-scan" required><Input id="delivery-scan" mono value={scanCode} onChange={(e) => setScanCode(e.target.value)} placeholder="Pindai label kemasan" required /></Field>
          <Button type="submit" variant="primary" disabled={busy || !selected || selected.status === 'DEPARTED'}>Pindai & Verifikasi</Button>
        </form>
      </Card>
    </div>
    <Card title="Daftar Pengiriman" subtitle="Pantau kemasan yang dimuat dan konfirmasi keberangkatan.">
      <DataTable rowKey={(row) => row.id} columns={columns} data={deliveries} />
    </Card>
    <ConfirmDialog
      open={confirmDepart !== null}
      title="Konfirmasi Keberangkatan Truk"
      description={`Tandai pengiriman ${confirmDepart?.code ?? ''} (${confirmDepart?.truckPlate ?? ''}) sebagai telah berangkat?`}
      confirmLabel="Konfirmasi Berangkat"
      onConfirm={depart}
      onCancel={() => setConfirmDepart(null)}
    />
  </div>
}
