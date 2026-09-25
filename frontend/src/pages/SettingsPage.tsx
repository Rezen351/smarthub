import { useState } from 'react'
import Card from '../components/shared/Card'

export default function SettingsPage() {
  const [form, setForm] = useState({ farmName: 'ENYX Farm', email: 'admin@enyx.local', language: 'en' })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    alert('Settings saved')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Settings</h1>
        <p className="text-text-secondary mt-1">Manage system settings</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Farm Name</label>
            <input
              className="w-full px-3 py-2 border border-border rounded-sm text-sm text-text bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              value={form.farmName}
              onChange={(e) => setForm({ ...form, farmName: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Admin Email</label>
            <input
              type="email"
              className="w-full px-3 py-2 border border-border rounded-sm text-sm text-text bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Language</label>
            <select
              className="w-full px-3 py-2 border border-border rounded-sm text-sm text-text bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              value={form.language}
              onChange={(e) => setForm({ ...form, language: e.target.value })}
            >
              <option value="en">English</option>
              <option value="id">Indonesian</option>
            </select>
          </div>
          <button
            type="submit"
            className="bg-primary text-white px-6 py-2 rounded-sm text-sm font-medium hover:bg-primary-hover transition-colors"
          >
            Save Settings
          </button>
        </form>
      </Card>
    </div>
  )
}
