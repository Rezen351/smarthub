import { useState } from 'react'
import Card from '../components/shared/Card'

export default function PackagingPage() {
  const [form, setForm] = useState({ size: '10kg', commodity: '', quantity: '' })
  const [packagings, setPackagings] = useState([
    { id: '1', code: 'PKG-001', size: '10kg', commodity: 'Kentang', status: 'PACKED' },
    { id: '2', code: 'PKG-002', size: '50kg', commodity: 'Tomat', status: 'ACTIVE' },
  ])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPackagings([
      ...packagings,
      {
        id: String(packagings.length + 1),
        code: `PKG-${String(packagings.length + 1).padStart(3, '0')}`,
        size: form.size,
        commodity: form.commodity,
        status: 'ACTIVE',
      },
    ])
    setForm({ size: '10kg', commodity: '', quantity: '' })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Packaging</h1>
        <p className="text-text-secondary mt-1">Bundle pouches into packaging units</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Size</label>
            <select
              className="w-full px-3 py-2 border border-border rounded-sm text-sm text-text bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              value={form.size}
              onChange={(e) => setForm({ ...form, size: e.target.value })}
            >
              <option value="10kg">10 kg</option>
              <option value="50kg">50 kg</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Commodity</label>
            <select
              className="w-full px-3 py-2 border border-border rounded-sm text-sm text-text bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              value={form.commodity}
              onChange={(e) => setForm({ ...form, commodity: e.target.value })}
              required
            >
              <option value="">Select commodity</option>
              <option value="Kentang">Kentang</option>
              <option value="Tomat">Tomat</option>
              <option value="Cabai">Cabai</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Quantity (pouches)</label>
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
              Create Packaging
            </button>
          </div>
        </form>
      </Card>

      <Card title="Packaging Units">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Size</th>
                <th>Commodity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {packagings.map((p) => (
                <tr key={p.id}>
                  <td>{p.code}</td>
                  <td>{p.size}</td>
                  <td>{p.commodity}</td>
                  <td>
                    <span className={`badge ${p.status === 'PACKED' ? 'badge-success' : 'badge-warning'}`}>
                      {p.status}
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
