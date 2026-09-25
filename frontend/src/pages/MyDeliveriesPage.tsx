import Card from '../components/shared/Card'
import { useEffect, useState } from 'react'
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">My Deliveries</h1>
        <p className="text-text-secondary mt-1">Track your delivery history</p>
      </div>

      <Card>
        {loading ? (
          <div className="text-center text-text-secondary py-4">Loading...</div>
        ) : deliveries.length === 0 ? (
          <div className="text-center text-text-secondary py-4">No deliveries yet</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Truck Plate</th>
                  <th>Destination</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((d) => (
                  <tr key={d.id}>
                    <td>{d.date}</td>
                    <td>{d.truckPlate}</td>
                    <td>{d.destination}</td>
                    <td>
                      <span className={`badge ${d.status === 'Delivered' ? 'badge-success' : 'badge-info'}`}>
                        {d.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
