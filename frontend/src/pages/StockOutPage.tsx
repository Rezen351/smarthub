import { useState } from 'react'
import Card from '../components/shared/Card'

export default function StockOutPage() {
  const [form, setForm] = useState({ packagingId: '', destination: '', driverName: '', quantity: '' })
  const [records, setRecords] = useState([
    { id: '1', packagingId: 'PKG-001', destination: 'Jakarta', driver: 'Ahmad', quantity: 50, time: '08:00' },
  ])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setRecords([
      ...records,
      {
        id: String(records.length + 1),
        packagingId: form.packagingId,
        destination: form.destination,
        driver: form.driverName,
        quantity: parseInt(form.quantity),
        time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      },
    ])
    setForm({ packagingId: '', destination: '', driverName: '', quantity: '' })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Stock Out</h1>
        <p className="text-text-secondary mt-1">Record outgoing stock from warehouse</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Packaging ID</label>
            <input
              className="w-full px-3 py-2 border border-border rounded-sm text-sm text-text bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              value={form.packagingId}
              onChange={(e) => setForm({ ...form, packagingId: e.target.value })}
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
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Driver</label>
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
              Stock Out
            </button>
          </div>
        </form>
      </Card>

      <Card title="Stock Out History">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Packaging ID</th>
                <th>Destination</th>
                <th>Driver</th>
                <th>Quantity</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{r.time}</td>
                  <td>{r.packagingId}</td>
                  <td>{r.destination}</td>
                  <td>{r.driver}</td>
                  <td>{r.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
