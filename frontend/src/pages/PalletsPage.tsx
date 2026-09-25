import { useState } from 'react'
import Card from '../components/shared/Card'

export default function PalletsPage() {
  const [form, setForm] = useState({ farmerId: '', commodityId: '', location: '' })
  const [pallets, setPallets] = useState([
    { id: '1', code: 'PLT-20260914-0001', farmer: 'Ahmad', commodity: 'Kentang', status: 'ACTIVE' },
    { id: '2', code: 'PLT-20260914-0002', farmer: 'Budi', commodity: 'Tomat', status: 'ACTIVE' },
  ])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPallets([
      ...pallets,
      {
        id: String(pallets.length + 1),
        code: `PLT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(pallets.length + 1).padStart(4, '0')}`,
        farmer: form.farmerId,
        commodity: form.commodityId,
        status: 'ACTIVE',
      },
    ])
    setForm({ farmerId: '', commodityId: '', location: '' })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Pallets</h1>
        <p className="text-text-secondary mt-1">Manage pallet creation and tracking</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Farmer ID</label>
            <input
              className="w-full px-3 py-2 border border-border rounded-sm text-sm text-text bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              value={form.farmerId}
              onChange={(e) => setForm({ ...form, farmerId: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Commodity</label>
            <select
              className="w-full px-3 py-2 border border-border rounded-sm text-sm text-text bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              value={form.commodityId}
              onChange={(e) => setForm({ ...form, commodityId: e.target.value })}
              required
            >
              <option value="">Select commodity</option>
              <option value="Kentang">Kentang</option>
              <option value="Tomat">Tomat</option>
              <option value="Cabai">Cabai</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Location</label>
            <input
              className="w-full px-3 py-2 border border-border rounded-sm text-sm text-text bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full bg-primary text-white py-2 rounded-sm text-sm font-medium hover:bg-primary-hover transition-colors"
            >
              Create Pallet
            </button>
          </div>
        </form>
      </Card>

      <Card title="Active Pallets">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Farmer</th>
                <th>Commodity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pallets.map((p) => (
                <tr key={p.id}>
                  <td>{p.code}</td>
                  <td>{p.farmer}</td>
                  <td>{p.commodity}</td>
                  <td>
                    <span className="badge badge-success">{p.status}</span>
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
