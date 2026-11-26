import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import Icon from '../components/shared/Icon'
import DataTable, { type Column } from '../components/shared/DataTable'
import PageHeader from '../components/shared/PageHeader'
import StatCard from '../components/shared/StatCard'
import { formatWeight } from '../lib/utils'
import { usePackhouseStore, type BufferWaringItem, type FinishedStockItem } from '../hooks/usePackhouseStore'
import { useAuth } from '../hooks/useAuth'
import CancelTransactionModal from '../components/admin/CancelTransactionModal'
import { DEFAULT_COMMODITIES } from '../services/api'

type WarehouseZone = 'buffer' | 'finished'

export default function WarehousePage() {
  const { user } = useAuth()
  const [cancelModalRecord, setCancelModalRecord] = useState<{ code: string; farmerName?: string } | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const initialZone = (searchParams.get('zone') as WarehouseZone) || 'buffer'
  const [activeZone, setActiveZone] = useState<WarehouseZone>(initialZone)
  const [commodityFilter, setCommodityFilter] = useState<string>('')
  const { waitingWarings, finishedStock } = usePackhouseStore()

  const bufferItems = commodityFilter
    ? waitingWarings.filter((i) => (i.commodityCode || '001') === commodityFilter)
    : waitingWarings
  const finishedItems = commodityFilter
    ? finishedStock.filter((i) => (i.commodityCode || '001') === commodityFilter)
    : finishedStock

  const commodityOptions = Array.from(
    new Map([
      ...DEFAULT_COMMODITIES.map((c) => [c.code, c.name] as [string, string]),
      ...[...waitingWarings, ...finishedStock].map((item) => [
        item.commodityCode || '001',
        item.commodityName || 'Kentang',
      ] as [string, string]),
    ]).entries()
  )

  useEffect(() => {
    const qZone = searchParams.get('zone')
    if (qZone === 'buffer' || qZone === 'finished') {
      setActiveZone(qZone)
    }
  }, [searchParams])

  const handleSwitchZone = (zone: WarehouseZone) => {
    setActiveZone(zone)
    setSearchParams({ zone })
  }

  /* Buffer Metrics */
  const bufferTotalKg = waitingWarings.reduce((sum, i) => sum + i.grossWeightKg, 0)
  const bufferCapacityKg = 3000
  const bufferPct = Math.round((bufferTotalKg / bufferCapacityKg) * 100)

  /* Finished Metrics */
  const finishedTotalUnits = finishedItems.reduce((sum, i) => sum + i.units, 0)
  const finishedTotalKg = finishedItems.reduce((sum, i) => sum + i.totalWeightKg, 0)
  const finishedCapacityUnits = 5000
  const finishedPct = Math.round((finishedTotalUnits / finishedCapacityUnits) * 100)

  const bufferColumns: Column<BufferWaringItem>[] = [
    {
      key: 'code',
      label: 'Kode Waring',
      priority: true,
      render: (row) => <span className="font-mono font-bold text-foreground">{row.code}</span>,
    },
    {
      key: 'farmerName',
      label: 'Petani',
      render: (row) => <span className="font-semibold text-foreground text-sm">{row.farmerName}</span>,
    },
    {
      key: 'commodityName',
      label: 'Komoditas',
      render: (row) => (
        <span className="text-xs text-foreground">
          <span className="font-mono font-bold mr-1">{row.commodityCode || '001'}</span>
          {row.commodityName || 'Kentang'}
        </span>
      ),
    },
    {
      key: 'grossWeightKg',
      label: 'Berat Kotor',
      align: 'right',
      priority: true,
      render: (row) => (
        <span className="font-mono font-bold text-emerald-800">
          {formatWeight(row.grossWeightKg)} kg
        </span>
      ),
    },
    {
      key: 'intakeTime',
      label: 'Waktu Masuk',
      render: (row) => (
        <div>
          <span className="font-mono text-xs text-foreground block">{row.intakeTime}</span>
          <span className="text-[10px] text-muted-foreground">{row.date || 'Hari ini'}</span>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status Antrean',
      render: () => (
        <Badge tone="warning" dot>
          Menunggu Sortasi
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Aksi',
      align: 'right',
      render: (row) => (
        <div className="flex items-center gap-1.5 justify-end">
          <Link to="/dashboard/sorting">
            <Button size="sm" variant="outline">
              Buka Sortasi
            </Button>
          </Link>
          {user?.role === 'ADMIN' && (
            <Button
              size="sm"
              variant="outline"
              icon="trash"
              className="text-destructive hover:bg-destructive/10 border-destructive/30"
              onClick={() => setCancelModalRecord({ code: row.code, farmerName: row.farmerName })}
            >
              Batalkan
            </Button>
          )}
        </div>
      ),
    },
  ]

  const finishedColumns: Column<FinishedStockItem>[] = [
    {
      key: 'code',
      label: 'Kode Batch',
      priority: true,
      render: (row) => <span className="font-mono font-bold text-foreground">{row.code}</span>,
    },
    {
      key: 'commodityName',
      label: 'Komoditas',
      render: (row) => (
        <span className="text-xs text-foreground">
          <span className="font-mono font-bold mr-1">{row.commodityCode || '001'}</span>
          {row.commodityName || 'Kentang'}
        </span>
      ),
    },
    {
      key: 'packageType',
      label: 'Jenis Kemasan',
      render: (row) => <span className="text-sm font-semibold text-foreground">{row.packageType}</span>,
    },
    {
      key: 'grade',
      label: 'Grade',
      render: (row) => <Badge tone="accent">Grade {row.grade}</Badge>,
    },
    {
      key: 'units',
      label: 'Jumlah Unit',
      align: 'right',
      priority: true,
      render: (row) => <span className="font-mono font-bold text-foreground">{row.units}</span>,
    },
    {
      key: 'totalWeightKg',
      label: 'Berat (kg)',
      align: 'right',
      render: (row) => (
        <span className="font-mono font-bold text-emerald-800">
          {formatWeight(row.totalWeightKg)} kg
        </span>
      ),
    },
    {
      key: 'storageLocation',
      label: 'Rak / Area',
      render: (row) => (
        <span className="font-mono text-xs bg-muted px-2 py-0.5 border border-border">
          {row.storageLocation}
        </span>
      ),
    },
    {
      key: 'packedTime',
      label: 'Waktu',
      render: (row) => <span className="font-mono text-xs text-muted-foreground">{row.packedTime}</span>,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventaris Gudang"
        subtitle="Penyimpanan buffer hasil panen dan stok barang jadi."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {commodityOptions.length > 0 && (
              <select
                aria-label="Filter berdasarkan komoditas"
                className="form-input text-xs py-1.5"
                value={commodityFilter}
                onChange={(e) => setCommodityFilter(e.target.value)}
              >
                <option value="">Semua Komoditas</option>
                {commodityOptions.map(([code, name]) => (
                  <option key={code} value={code}>
                    {code} — {name}
                  </option>
                ))}
              </select>
            )}
            <Badge tone="accent">2 Zona Aktif</Badge>
          </div>
        }
      />

      {/* Zone Switcher Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Zone 1 Card */}
        <button
          type="button"
          onClick={() => handleSwitchZone('buffer')}
          className={`p-5 border text-left rounded-none transition-all cursor-pointer flex items-start justify-between ${activeZone === 'buffer'
              ? 'border-emerald-600 bg-emerald-50/60 shadow-sm'
              : 'border-border bg-card hover:bg-muted/30'
            }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-muted-foreground">ZONA 01</span>
              <Badge tone={activeZone === 'buffer' ? 'success' : 'neutral'}>
                {bufferItems.length} Waring Antre
              </Badge>
            </div>
            <h3 className="font-bold text-lg text-foreground mt-1">
              Buffer Hasil Panen
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Antrean karung waring yang menunggu sortasi.
            </p>
            <div className="mt-3 flex items-center gap-3 text-xs font-mono">
              <span className="font-bold text-emerald-800">{formatWeight(bufferTotalKg)} kg antre</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">Kapasitas: {bufferPct}%</span>
            </div>
          </div>
          <div
            className={`w-9 h-9 border flex items-center justify-center shrink-0 ${activeZone === 'buffer'
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-border bg-muted text-muted-foreground'
              }`}
          >
            <Icon name="box" size={18} />
          </div>
        </button>

        {/* Zone 2 Card */}
        <button
          type="button"
          onClick={() => handleSwitchZone('finished')}
          className={`p-5 border text-left rounded-none transition-all cursor-pointer flex items-start justify-between ${activeZone === 'finished'
              ? 'border-blue-600 bg-blue-50/60 shadow-sm'
              : 'border-border bg-card hover:bg-muted/30'
            }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-muted-foreground">ZONA 02</span>
              <Badge tone={activeZone === 'finished' ? 'accent' : 'neutral'}>
                {finishedTotalUnits} Unit Tersedia
              </Badge>
            </div>
            <h3 className="font-bold text-lg text-foreground mt-1">
              Penyimpanan Barang Jadi
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Kemasan ritel dan karton ekspor siap kirim.
            </p>
            <div className="mt-3 flex items-center gap-3 text-xs font-mono">
              <span className="font-bold text-blue-800">{formatWeight(finishedTotalKg)} kg total</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">Terpakai: {finishedPct}%</span>
            </div>
          </div>
          <div
            className={`w-9 h-9 border flex items-center justify-center shrink-0 ${activeZone === 'finished'
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-border bg-muted text-muted-foreground'
              }`}
          >
            <Icon name="stack" size={18} />
          </div>
        </button>
      </div>

      {/* ── ZONE 1 CONTENT: RAW BUFFER ── */}
      {activeZone === 'buffer' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Waring Menunggu"
              value={`${bufferItems.length}`}
              sub="Karung belum disortasi"
              trend="neutral"
              icon={<Icon name="box" size={16} />}
            />
            <StatCard
              label="Berat Buffer"
              value={`${formatWeight(bufferTotalKg)} kg`}
              sub="Berat kotor penerimaan"
              trend="up"
              icon={<Icon name="scale" size={16} />}
            />
            <StatCard
              label="Utilisasi Buffer"
              value={`${bufferPct}%`}
              sub={`Sisa ruang ${bufferCapacityKg - bufferTotalKg} kg`}
              trend={bufferPct > 80 ? 'up' : 'neutral'}
              icon={<Icon name="stack" size={16} />}
            />
            <StatCard
              label="Antrean"
              value="Aktif"
              sub={bufferItems.length ? `Terlama: ${bufferItems[bufferItems.length - 1].intakeTime}` : 'Tidak ada waring menunggu'}
              trend="neutral"
              icon={<Icon name="clock" size={16} />}
            />
          </div>

          <div className="bg-card border border-border p-6 rounded-none shadow-sm space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-bold text-base text-foreground">
                  Antrean Buffer Hasil Panen
                </h3>
                <p className="text-xs text-muted-foreground">
                  Waring dari penerimaan yang menunggu sortasi dan penautan palet.
                </p>
              </div>
              <Link to="/dashboard/sorting">
                <Button variant="primary" icon="check">
                  Buka Stasiun Sortasi
                </Button>
              </Link>
            </div>

            <DataTable rowKey={(row) => row.id} columns={bufferColumns} data={bufferItems} />
          </div>
        </div>
      )}

      {/* ── ZONE 2 CONTENT: FINISHED GOODS ── */}
      {activeZone === 'finished' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Unit Siap Kirim"
              value={`${finishedTotalUnits}`}
              sub="Kemasan ritel & karton ekspor"
              trend="up"
              icon={<Icon name="package" size={16} />}
            />
            <StatCard
              label="Berat Bersih Barang Jadi"
              value={`${formatWeight(finishedTotalKg)} kg`}
              sub="Stok hasil pengemasan"
              trend="up"
              icon={<Icon name="scale" size={16} />}
            />
            <StatCard
              label="Stok Grade A"
              value={`${formatWeight(finishedItems.filter((item) => item.grade === 'A').reduce((sum, item) => sum + item.totalWeightKg, 0))} kg`}
              sub="Kemasan ritel & peti 10 kg"
              trend="neutral"
              icon={<Icon name="leaf" size={16} />}
            />
            <StatCard
              label="Utilisasi Rak Gudang"
              value={`${finishedPct}%`}
              sub="Area Gudang A-C"
              trend="neutral"
              icon={<Icon name="box" size={16} />}
            />
          </div>

          <div className="bg-card border border-border p-6 rounded-none shadow-sm space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-bold text-base text-foreground">
                  Buku Stok Barang Jadi
                </h3>
                <p className="text-xs text-muted-foreground">
                  Produk terkemas yang siap dipindai dan dimuat untuk pengiriman.
                </p>
              </div>
              <Link to="/dashboard/deliveries">
                <Button variant="primary" icon="truck">
                  Buka Pengiriman
                </Button>
              </Link>
            </div>

            <DataTable rowKey={(row) => row.id} columns={finishedColumns} data={finishedItems} />
          </div>
        </div>
      )}

      {/* Admin Transaction Cancellation Modal */}
      <CancelTransactionModal
        open={!!cancelModalRecord}
        waringCode={cancelModalRecord?.code}
        farmerName={cancelModalRecord?.farmerName}
        onClose={() => setCancelModalRecord(null)}
        onSuccess={() => {
          setCancelModalRecord(null)
          window.location.reload()
        }}
      />
    </div>
  )
}
