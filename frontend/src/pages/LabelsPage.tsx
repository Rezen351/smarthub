import { useState } from 'react'
import Card from '../components/shared/Card'

export default function LabelsPage() {
  const [form, setForm] = useState({ pouchId: '', type: 'pouch' })
  const [labels, setLabels] = useState([
    { id: '1', code: 'PCH-PLT-20260914-0001-001', type: 'QR + EAN-13', status: 'Printed' },
    { id: '2', code: 'PCH-PLT-20260914-0001-002', type: 'QR + EAN-13', status: 'Pending' },
  ])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLabels([
      ...labels,
      {
        id: String(labels.length + 1),
        code: form.type === 'pouch' ? `PCH-PLT-20260914-${String(labels.length + 1).padStart(4, '0')}` : `PKG-${String(labels.length + 1).padStart(4, '0')}`,
        type: form.type === 'pouch' ? 'QR + EAN-13' : 'ITF-14',
        status: 'Pending',
      },
    ])
    setForm({ pouchId: '', type: 'pouch' })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Labels</h1>
        <p className="text-text-secondary mt-1">Generate and print barcode labels</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Pouch/Packaging ID</label>
            <input
              className="w-full px-3 py-2 border border-border rounded-sm text-sm text-text bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              value={form.pouchId}
              onChange={(e) => setForm({ ...form, pouchId: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Label Type</label>
            <select
              className="w-full px-3 py-2 border border-border rounded-sm text-sm text-text bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="pouch">Pouch (QR + EAN-13)</option>
              <option value="packaging">Packaging (ITF-14)</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full bg-primary text-white py-2 rounded-sm text-sm font-medium hover:bg-primary-hover transition-colors"
            >
              Generate Label
            </button>
          </div>
        </form>
      </Card>

      <Card title="Generated Labels">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {labels.map((l) => (
                <tr key={l.id}>
                  <td>{l.code}</td>
                  <td>{l.type}</td>
                  <td>
                    <span className={`badge ${l.status === 'Printed' ? 'badge-success' : 'badge-warning'}`}>
                      {l.status}
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
