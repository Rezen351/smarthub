import { useEffect, useState } from 'react'
import Card from '../components/shared/Card'
import Badge from '../components/shared/Badge'
import Icon from '../components/shared/Icon'
import DataTable, { type Column } from '../components/shared/DataTable'
import PageHeader from '../components/shared/PageHeader'
import { myDeliveries as mockDeliveries } from '../mock/deliveries'

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
        const res = await fetch('/api/deliveries')
        if (res.ok) {
          const result = await res.json()
          if (result.success && Array.isArray(result.data)) {
            setDeliveries(result.data)
            return
          }
        }
        setDeliveries(mockDeliveries)
      } catch {
        setDeliveries(mockDeliveries)
      } finally {
        setLoading(false)
      }
    }

    fetchDeliveries()
  }, [])

  const columns: Column<Delivery>[] = [
    { key: 'date', label: 'Date', priority: true, render: (row) => <span className="mono t-small">{row.date}</span> },
    { key: 'truckPlate', label: 'Truck plate', priority: true, render: (row) => <span className="mono cell-strong">{row.truckPlate}</span> },
    { key: 'destination', label: 'Destination', priority: true, render: (row) => <span className="t-small">{row.destination}</span> },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge tone={row.status === 'Delivered' ? 'success' : 'accent'} dot>
          {row.status}
        </Badge>
      ),
    },
  ]

  return (
    <div className="stack stack-lg">
      <PageHeader
        title="My Deposits"
        subtitle="Trace every delivery made from your harvest deposits."
        actions={<Badge tone="neutral">{deliveries.length} deliveries</Badge>}
      />

      <div className="grid-stats">
        <div className="stat-card">
          <p className="stat-label">Total deliveries</p>
          <p className="stat-value">{loading ? '—' : deliveries.length}</p>
          <p className="stat-sub">From your deposits</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">In transit</p>
          <p className="stat-value">{loading ? '—' : deliveries.filter((item) => item.status === 'In Transit').length}</p>
          <p className="stat-sub">On the road</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Delivered</p>
          <p className="stat-value">{loading ? '—' : deliveries.filter((item) => item.status === 'Delivered').length}</p>
          <p className="stat-sub">Completed</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Latest destination</p>
          <p className="stat-value" style={{ fontSize: 20 }}>
            {loading ? '—' : deliveries[0]?.destination ?? '—'}
          </p>
          <p className="stat-sub">{loading ? 'Loading' : deliveries[0]?.date ?? 'No records'}</p>
        </div>
      </div>

      <Card title="Delivery history" subtitle="Each record links back to the weighing at the receiving area.">
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
            emptyTitle="No deliveries recorded."
            emptyDescription="Your deliveries appear here once your deposit leaves the warehouse."
          />
        )}
      </Card>

      <div className="alert alert-info">
        <Icon name="info" size={16} />
        <span>
          Consumers can trace the same journey publicly from the pouch QR — no account needed.
        </span>
      </div>
    </div>
  )
}
