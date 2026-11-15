import { idText } from '@/lib/indonesian'
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
    { key: 'date', label: 'Date', priority: true, render: (row) => <span className="mono t-small">{idText(row.date)}</span> },
    { key: 'truckPlate', label: 'Truck plate', priority: true, render: (row) => <span className="mono cell-strong">{idText(row.truckPlate)}</span> },
    { key: 'destination', label: 'Destination', priority: true, render: (row) => <span className="t-small">{idText(row.destination)}</span> },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge tone={row.status === 'Delivered' ? 'success' : 'accent'} dot>
          {idText(row.status)}
        </Badge>
      ),
    },
  ]

  return (
    <div className="stack stack-lg">
      <PageHeader
        title={idText("My Deposits")}
        subtitle="Trace every delivery made from your harvest deposits."
        actions={<Badge tone="neutral">{idText(deliveries.length)} {idText("deliveries")}</Badge>}
      />

      <div className="grid-stats">
        <div className="stat-card">
          <p className="stat-label">{idText("Total deliveries")}</p>
          <p className="stat-value">{idText(loading ? '—' : deliveries.length)}</p>
          <p className="stat-sub">{idText("From your deposits")}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">{idText("In transit")}</p>
          <p className="stat-value">{idText(loading ? '—' : deliveries.filter((item) => item.status === 'In Transit').length)}</p>
          <p className="stat-sub">{idText("On the road")}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">{idText("Delivered")}</p>
          <p className="stat-value">{idText(loading ? '—' : deliveries.filter((item) => item.status === 'Delivered').length)}</p>
          <p className="stat-sub">{idText("Completed")}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">{idText("Latest destination")}</p>
          <p className="stat-value" style={{ fontSize: 20 }}>
            {idText(loading ? '—' : deliveries[0]?.destination ?? '—')}
          </p>
          <p className="stat-sub">{idText(loading ? 'Loading' : deliveries[0]?.date ?? 'No records')}</p>
        </div>
      </div>

      <Card title={idText("Delivery history")} subtitle="Each record links back to the weighing at the receiving area.">
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
            emptyTitle={idText("No deliveries recorded.")}
            emptyDescription={idText("Your deliveries appear here once your deposit leaves the warehouse.")}
          />
        )}
      </Card>

      <div className="alert alert-info">
        <Icon name="info" size={16} />
        <span>
          {idText("Consumers can trace the same journey publicly from the pouch QR — no account needed.")}
        </span>
      </div>
    </div>
  )
}
