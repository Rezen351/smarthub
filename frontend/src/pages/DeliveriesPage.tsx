import { useState } from 'react'
import Card from '../components/shared/Card'

export default function DeliveriesPage() {
  const [form, setForm] = useState({ truckPlate: '', destination: '', driverName: '' })
  const [deliveries, setDeliveries] = useState([
    { id: '1', truckPlate: 'B1234XYZ', destination: 'Jakarta', driver: 'Ahmad', status: 'In Transit', time: '08:00' },
    { id: '2', truckPlate: 'B5678ABC', destination: 'Surabaya', driver: 'Budi', status: 'Pending', time: '09:30' },
  ])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setDeliveries([
      ...deliveries,
      {
        id: String(deliveries.length + 1),
        truckPlate: form.truckPlate,
        destination: form.destination,
        driver: form.driverName,
        status: 'Pending',
        time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      },
    ])
    setForm({ truckPlate: '', destination: '', driverName: '' })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Deliveries</h1>
        <p className="text-text-secondary mt-1">Manage delivery trucks and shipments</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Truck Plate</label>
            <input
              className="w-full px-3 py-2 border border-border rounded-sm text-sm text-text bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              value={form.truckPlate}
              onChange={(e) => setForm({ ...form, truckPlate: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Destination</label>
            <input
              className="w-full px-3 py-2 border border-border rounded-sm text-sm text-text bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              value={form.destination}
              onChange={(e) => setForm({ ...form, destination: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Driver Name</label>
            <input
              className="w-full px-3 py-2 border border-border rounded-sm text-sm text-text bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              value={form.driverName}
              onChange={(e) => setForm({ ...form, driverName: e.target.value })}
              required
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full bg-primary text-white py-2 rounded-sm text-sm font-medium hover:bg-primary-hover transition-colors"
            >
              Create Delivery
            </button>
          </div>
        </form>
      </Card>

      <Card title="Active Deliveries">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Truck Plate</th>
                <th>Destination</th>
                <th>Driver</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((d) => (
                <tr key={d.id}>
                  <td>{d.time}</td>
                  <td>{d.truckPlate}</td>
                  <td>{d.destination}</td>
                  <td>{d.driver}</td>
                  <td>
                    <span className={`badge ${d.status === 'In Transit' ? 'badge-info' : 'badge-warning'}`}>
                      {d.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
