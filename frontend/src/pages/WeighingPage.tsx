import { useState, useEffect } from 'react'
import Card from '../components/shared/Card'

type TransportMode = 'wifi' | 'ethernet'

export default function WeighingPage() {
  const [form, setForm] = useState({ palletId: '', gradeId: '', weightKg: '', note: '' })
  const [records, setRecords] = useState([
    { id: '1', palletId: 'PLT-001', grade: 'A', weightKg: 45.5, time: '10:15' },
    { id: '2', palletId: 'PLT-002', grade: 'B', weightKg: 38.2, time: '09:45' },
  ])

  const [transportMode, setTransportMode] = useState<TransportMode>('wifi')
  const [transportStatus, setTransportStatus] = useState({
    staConnected: false,
    ethernetActive: false,
    ethernetIp: '',
    apSsid: 'ENYX-SMARTHUB-AP',
    apIp: '192.168.4.1',
  })
  const [transportSaving, setTransportSaving] = useState(false)

  useEffect(() => {
    fetchTransportStatus()
  }, [])

  const fetchTransportStatus = async () => {
    try {
      const res = await fetch('/api/weighing/transport')
      const json = await res.json()
      if (json.success) {
        setTransportMode(json.data.transportMode || 'wifi')
        setTransportStatus(json.data)
      }
    } catch (e) {
      console.error('Failed to fetch transport status', e)
    }
  }

  const handleTransportSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setTransportSaving(true)
    try {
      const res = await fetch('/api/weighing/transport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: transportMode }),
      })
      const json = await res.json()
      if (json.success) {
        alert(json.message)
        await fetchTransportStatus()
      } else {
        alert(json.error?.message || 'Failed to save transport mode')
      }
    } catch (e) {
      alert('Error saving transport configuration')
    } finally {
      setTransportSaving(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setRecords([
      ...records,
      {
        id: String(records.length + 1),
        palletId: form.palletId,
        grade: form.gradeId,
        weightKg: parseFloat(form.weightKg),
        time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      },
    ])
    setForm({ palletId: '', gradeId: '', weightKg: '', note: '' })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Weighing</h1>
        <p className="text-text-secondary mt-1">Record weighing for pallets</p>
      </div>

      <Card title="Transmitter Configuration">
        <form onSubmit={handleTransportSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Transport Mode</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="transportMode"
                  value="wifi"
                  checked={transportMode === 'wifi'}
                  onChange={(e) => setTransportMode(e.target.value as TransportMode)}
                  className="text-primary focus:ring-primary"
                />
                <span className="text-sm text-text">WiFi</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="transportMode"
                  value="ethernet"
                  checked={transportMode === 'ethernet'}
                  onChange={(e) => setTransportMode(e.target.value as TransportMode)}
                  className="text-primary focus:ring-primary"
                />
                <span className="text-sm text-text">Ethernet (W5500)</span>
              </label>
            </div>
          </div>

          <div className="text-xs text-text-secondary space-y-1">
            <p>AP SSID: {transportStatus.apSsid}</p>
            <p>AP IP: {transportStatus.apIp}</p>
            <p>WiFi Status: {transportStatus.staConnected ? 'Connected' : 'Disconnected'}</p>
            <p>Ethernet Status: {transportStatus.ethernetActive ? `Active (${transportStatus.ethernetIp})` : 'Inactive'}</p>
          </div>

          <button
            type="submit"
            disabled={transportSaving}
            className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-sm hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            {transportSaving ? 'Saving...' : 'Save Transport Configuration'}
          </button>
        </form>
      </Card>

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
              value={form.gradeId}
              onChange={(e) => setForm({ ...form, gradeId: e.target.value })}
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
              Record
            </button>
          </div>
        </form>
      </Card>

      <Card title="Today's Records">
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
