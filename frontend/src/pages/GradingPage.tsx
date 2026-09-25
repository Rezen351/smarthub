import { useState } from 'react'
import Card from '../components/shared/Card'

export default function GradingPage() {
  const [form, setForm] = useState({ palletId: '', grade: '', weightKg: '', note: '' })
  const [records, setRecords] = useState([
    { id: '1', palletId: 'PLT-001', grade: 'A', weightKg: 45.5, time: '10:15' },
    { id: '2', palletId: 'PLT-001', grade: 'B', weightKg: 30.0, time: '10:20' },
  ])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setRecords([
      ...records,
      {
        id: String(records.length + 1),
        palletId: form.palletId,
        grade: form.grade,
        weightKg: parseFloat(form.weightKg),
        time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      },
    ])
    setForm({ palletId: '', grade: '', weightKg: '', note: '' })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Grading</h1>
        <p className="text-text-secondary mt-1">Grade products by quality</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Pallet ID</label>
            <input
              className="w-full px-3 py-2 border border-border rounded-sm text-sm text-text bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              value={form.palletId}
              onChange={(e) => setForm({ ...form, palletId: e.target.value })}
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
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Weight (kg)</label>
            <input
              type="number"
              step="0.1"
              className="w-full px-3 py-2 border border-border rounded-sm text-sm text-text bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              value={form.weightKg}
              onChange={(e) => setForm({ ...form, weightKg: e.target.value })}
              required
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full bg-primary text-white py-2 rounded-sm text-sm font-medium hover:bg-primary-hover transition-colors"
            >
              Save Grade
            </button>
          </div>
        </form>
      </Card>

      <Card title="Grading Records">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Pallet ID</th>
                <th>Grade</th>
                <th>Weight (kg)</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{r.time}</td>
                  <td>{r.palletId}</td>
                  <td>{r.grade}</td>
                  <td>{r.weightKg}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
