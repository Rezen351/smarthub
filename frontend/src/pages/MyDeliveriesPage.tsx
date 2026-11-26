import { useEffect, useState } from 'react'
import Card from '../components/shared/Card'
import Badge from '../components/shared/Badge'
import Icon from '../components/shared/Icon'
import DataTable, { type Column } from '../components/shared/DataTable'
import PageHeader from '../components/shared/PageHeader'
import { api } from '../services/api'
import { formatSafeDate } from '../lib/utils'

interface Delivery {
  id: string
  date: string
  truckPlate: string
  destination: string
  status: 'In Transit' | 'Delivered'
}

export default function MyDeliveriesPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDeliveries = async () => {
      try {
        const data = await api.deliveries.list()
        if (Array.isArray(data)) {
          setDeliveries(
            data.map((d: any) => ({
              id: d.id,
              date: formatSafeDate(d.createdAt || d.departedAt),
              truckPlate: d.truckPlate,
              destination: d.destination,
              status: d.status === 'DELIVERED' ? 'Delivered' : 'In Transit',
            }))
          )
          return
        }
        setDeliveries([])
      } catch {
        setDeliveries([])
      } finally {
        setLoading(false)
      }
    }

    fetchDeliveries()
  }, [])

  const columns: Column<Delivery>[] = [
    { key: 'date', label: 'Tanggal', priority: true, render: (row) => <span className="mono t-small">{row.date}</span> },
    { key: 'truckPlate', label: 'Pelat Truk', priority: true, render: (row) => <span className="mono cell-strong">{row.truckPlate}</span> },
    { key: 'destination', label: 'Tujuan', priority: true, render: (row) => <span className="t-small">{row.destination}</span> },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge tone={row.status === 'Delivered' ? 'success' : 'accent'} dot>
          {row.status === 'Delivered' ? 'Terkirim' : 'Dalam Pengiriman'}
        </Badge>
      ),
    },
  ]

  return (
    <div className="stack stack-lg">
      <PageHeader
        title="Setoran Saya"
        subtitle="Lacak setiap pengiriman dari setoran hasil panen Anda."
        actions={<Badge tone="neutral">{deliveries.length} pengiriman</Badge>}
      />

      <div className="grid-stats">
        <div className="stat-card">
          <p className="stat-label">Total Pengiriman</p>
          <p className="stat-value">{loading ? '—' : deliveries.length}</p>
          <p className="stat-sub">Dari setoran Anda</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Dalam Pengiriman</p>
          <p className="stat-value">{loading ? '—' : deliveries.filter((item) => item.status === 'In Transit').length}</p>
          <p className="stat-sub">Sedang dalam perjalanan</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Terkirim</p>
          <p className="stat-value">{loading ? '—' : deliveries.filter((item) => item.status === 'Delivered').length}</p>
          <p className="stat-sub">Selesai</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Tujuan Terakhir</p>
          <p className="stat-value" style={{ fontSize: 20 }}>
            {loading ? '—' : deliveries[0]?.destination ?? '—'}
          </p>
          <p className="stat-sub">{loading ? 'Memuat' : deliveries[0]?.date ?? 'Belum ada catatan'}</p>
        </div>
      </div>

      <Card title="Riwayat Pengiriman" subtitle="Setiap catatan terhubung ke penimbangan di area penerimaan.">
        {loading ? (
          <div className="stack-sm">
            <div className="skeleton skeleton-block" />
            <div className="skeleton skeleton-block" />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={deliveries}
            rowKey={(row) => row.id}
            emptyTitle="Belum ada pengiriman tercatat."
            emptyDescription="Pengiriman Anda akan muncul di sini setelah setoran keluar dari gudang."
          />
        )}
      </Card>

      <div className="alert alert-info">
        <Icon name="info" size={16} />
        <span>
          Konsumen dapat melacak perjalanan yang sama secara publik melalui QR pada pouch — tanpa perlu akun.
        </span>
      </div>
    </div>
  )
}
