import { useState, useEffect } from 'react'
import Card from '../components/shared/Card'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import Icon from '../components/shared/Icon'
import { Field, Input, Select } from '../components/shared/Form'
import PageHeader from '../components/shared/PageHeader'
import { useToast } from '../components/feedback/Toast'

interface Settings {
  farmName: string
  email: string
  language: string
  commodity: string
  scaleCapacityKg: string
  stabilityGrams: string
  pollMs: string
  digitalLinkDomain: string
  gtin: string
  printTimeout: string
}

type TransportMode = 'wifi' | 'ethernet'

const INITIAL: Settings = {
  farmName: 'ENYX Farm',
  email: 'admin@enyx.local',
  language: 'en',
  commodity: 'Kentang',
  scaleCapacityKg: '150',
  stabilityGrams: '20',
  pollMs: '250',
  digitalLinkDomain: 'trace.enyx.id',
  gtin: '8990010000017',
  printTimeout: '10',
}

export default function SettingsPage() {
  const toast = useToast()
  const [form, setForm] = useState<Settings>(INITIAL)

  /* ── Weight Transmitter configuration ── */
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
        toast.success(json.message || 'Transmitter transport configuration saved.')
        await fetchTransportStatus()
      } else {
        toast.error(json.error?.message || 'Failed to save transport mode.')
      }
    } catch {
      toast.error('Error saving transport configuration.')
    } finally {
      setTransportSaving(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!(Number(form.scaleCapacityKg) > 0)) {
      toast.error('Scale capacity must be greater than 0 kg.')
      return
    }
    toast.success('Settings saved.')
  }

  return (
    <div className="stack stack-lg" style={{ maxWidth: 880 }}>
      <PageHeader title="Settings" subtitle="Commodity, scale parameters and label format." />

      <form className="stack-md" onSubmit={handleSubmit}>
        <Card title="Facility" subtitle="Station identity used on printed documents.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
            <Field label="Farm name" htmlFor="settings-farm">
              <Input
                id="settings-farm"
                value={form.farmName}
                onChange={(e) => setForm({ ...form, farmName: e.target.value })}
              />
            </Field>
            <Field label="Admin email" htmlFor="settings-email">
              <Input
                id="settings-email"
                type="email"
                inputMode="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="Language" htmlFor="settings-language">
              <Select
                id="settings-language"
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
              >
                <option value="en">English</option>
                <option value="id">Indonesian</option>
              </Select>
            </Field>
            <Field
              label="Active commodity"
              htmlFor="settings-commodity"
              hint="Only one commodity is active in this scope."
            >
              <Select
                id="settings-commodity"
                value={form.commodity}
                onChange={(e) => setForm({ ...form, commodity: e.target.value })}
              >
                <option value="Kentang">Kentang (grade A/B/C)</option>
                <option value="Tomat" disabled>
                  Tomat — not in scope
                </option>
                <option value="Cabai" disabled>
                  Cabai — not in scope
                </option>
              </Select>
            </Field>
          </div>
        </Card>

        <Card
          title="Scale parameters"
          subtitle="Applies to the Auto (Modbus TCP) weighing mode."
          action={<Badge tone="accent" dot>Auto + Manual</Badge>}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-md">
            <Field label="Scale capacity (kg)" htmlFor="settings-capacity" required>
              <Input
                id="settings-capacity"
                type="number"
                inputMode="decimal"
                min="1"
                value={form.scaleCapacityKg}
                onChange={(e) => setForm({ ...form, scaleCapacityKg: e.target.value })}
              />
            </Field>
            <Field label="Stability threshold (g)" htmlFor="settings-stability" hint="Weight is locked once stable.">
              <Input
                id="settings-stability"
                type="number"
                inputMode="numeric"
                min="1"
                value={form.stabilityGrams}
                onChange={(e) => setForm({ ...form, stabilityGrams: e.target.value })}
              />
            </Field>
            <Field label="Reading interval (ms)" htmlFor="settings-poll">
              <Input
                id="settings-poll"
                type="number"
                inputMode="numeric"
                min="100"
                step="50"
                value={form.pollMs}
                onChange={(e) => setForm({ ...form, pollMs: e.target.value })}
              />
            </Field>
          </div>
          <p className="field-hint" style={{ marginTop: 12 }}>
            Backend performs the Modbus TCP polling, timeout handling and scaling to the scale resolution.
          </p>
        </Card>

        <Card
          title="Weight Transmitter Configuration"
          subtitle="Network transport and status for the weighing indicator transmitter (firmware gateway)."
          action={
            <Badge tone={transportStatus.staConnected || transportStatus.ethernetActive ? 'success' : 'neutral'} dot>
              {transportStatus.ethernetActive ? 'Ethernet active' : transportStatus.staConnected ? 'WiFi active' : 'Ready'}
            </Badge>
          }
        >
          <div className="stack-md">
            <div className="radio-row" role="group" aria-label="Transport mode">
              <label className={`radio-card ${transportMode === 'wifi' ? 'is-active' : ''}`}>
                <input
                  type="radio"
                  name="transportMode"
                  value="wifi"
                  checked={transportMode === 'wifi'}
                  onChange={(e) => setTransportMode(e.target.value as TransportMode)}
                />
                <Icon name="wifi" size={15} />
                WiFi
              </label>
              <label className={`radio-card ${transportMode === 'ethernet' ? 'is-active' : ''}`}>
                <input
                  type="radio"
                  name="transportMode"
                  value="ethernet"
                  checked={transportMode === 'ethernet'}
                  onChange={(e) => setTransportMode(e.target.value as TransportMode)}
                />
                <Icon name="flash" size={15} />
                Ethernet (W5500)
              </label>
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">
              {[
                ['AP SSID', transportStatus.apSsid],
                ['AP IP', transportStatus.apIp],
                ['WiFi status', transportStatus.staConnected ? 'Connected' : 'Disconnected'],
                [
                  'Ethernet status',
                  transportStatus.ethernetActive ? `Active (${transportStatus.ethernetIp})` : 'Inactive',
                ],
              ].map(([label, value]) => (
                <div key={label} className="stack-xs">
                  <dt className="t-caption text-text-secondary uppercase">{label}</dt>
                  <dd className="mono t-small">{value}</dd>
                </div>
              ))}
            </dl>

            <div>
              <Button
                type="button"
                variant="outline"
                icon="check"
                loading={transportSaving}
                onClick={handleTransportSave}
              >
                {transportSaving ? 'Saving…' : 'Save Transmitter Transport'}
              </Button>
            </div>
          </div>
        </Card>

        <Card title="Label format" subtitle="GS1 Digital Link and linear codes.">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-md">
            <Field label="Digital link domain" htmlFor="settings-domain">
              <Input
                id="settings-domain"
                mono
                value={form.digitalLinkDomain}
                onChange={(e) => setForm({ ...form, digitalLinkDomain: e.target.value })}
              />
            </Field>
            <Field label="Pouch GTIN-13" htmlFor="settings-gtin">
              <Input
                id="settings-gtin"
                mono
                inputMode="numeric"
                value={form.gtin}
                onChange={(e) => setForm({ ...form, gtin: e.target.value })}
              />
            </Field>
            <Field label="Print timeout (s)" htmlFor="settings-print-timeout">
              <Input
                id="settings-print-timeout"
                type="number"
                inputMode="numeric"
                min="1"
                value={form.printTimeout}
                onChange={(e) => setForm({ ...form, printTimeout: e.target.value })}
              />
            </Field>
          </div>

          <div className="divider" />

          <div className="stack-sm">
            <p className="field-label">Pouch QR payload</p>
            <div className="code-block">
              https://{form.digitalLinkDomain}/01/{form.gtin}/10/{'{PALLET_CODE}-{GRADE}'}/21/{'{PCH-...}'}
            </div>
            <p className="field-hint">
              EAN-13 is printed in parallel with the QR GS1 Digital Link during the 1D → 2D transition.
            </p>
          </div>
        </Card>

        <div className="row gap-sm">
          <Button type="submit" variant="primary" icon="check" touch>
            Save Settings
          </Button>
          <Button type="button" variant="ghost" icon="refresh" onClick={() => setForm(INITIAL)}>
            Reset
          </Button>
        </div>
      </form>

      <div className="alert alert-info">
        <Icon name="info" size={16} />
        <span>Weighing stations keep their Auto/Manual mode preference per session.</span>
      </div>
    </div>
  )
}
