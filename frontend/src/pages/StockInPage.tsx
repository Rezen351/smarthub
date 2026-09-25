import { useState } from 'react'
import Card from '../components/shared/Card'

export default function StockInPage() {
  const [form, setForm] = useState({ pouchId: '', grade: '', quantity: '', warehouseId: '' })
  const [records, setRecords] = useState([
    { id: '1', pouchId: 'PCH-PLT-20260914-0001-001', grade: 'A', quantity: 10, warehouse: 'WH-01', time: '09:30' },
  ])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setRecords([
      ...records,
      {
        id: String(records.length + 1),
        pouchId: form.pouchId,
        grade: form.grade,
        quantity: parseInt(form.quantity),
        warehouse: form.warehouseId,
        time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      },
    ])
    setForm({ pouchId: '', grade: '', quantity: '', warehouseId: '' })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Stock In</h1>
        <p className="text-text-secondary mt-1">Record incoming stock to warehouse</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Pouch/Pallet ID</label>
            <input
              className="w-full px-3 py-2 border border-border rounded-sm text-sm text-text bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              value={form.pouchId}
              onChange={(e) => setForm({ ...form, pouchId: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Grade</label>
            <select
              className="w-full px-3 py-2 border border-border rounded-sm text-sm text-text bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              value={form.grade}
              onChange={(e) => setForm({ ...form, grade: e.target.value })}
              required
            >
              <option value="">Select grade</option>
              <option value="A">Grade A</option>
              <option value="B">Grade B</option>
              <option value="C">Grade C</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Quantity</label>
            <input
              type="number"
              className="w-full px-3 py-2 border border-border rounded-sm text-sm text-text bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              required
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full bg-primary text-white py-2 rounded-sm text-sm font-medium hover:bg-primary-hover transition-colors"
            >
              Stock In
            </button>
          </div>
        </form>
      </Card>

      <Card title="Stock In History">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Pouch/Pallet ID</th>
                <th>Grade</th>
                <th>Quantity</th>
                <th>Warehouse</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{r.time}</td>
                  <td>{r.pouchId}</td>
                  <td>{r.grade}</td>
                  <td>{r.quantity}</td>
                  <td>{r.warehouse}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
