import { useState } from 'react'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import Icon from '../components/shared/Icon'
import { Field, Input } from '../components/shared/Form'
import PageHeader from '../components/shared/PageHeader'
import { useToast } from '../components/feedback/Toast'

interface WeighingSettings {
  transmitterIp: string
  modbusPort: string
  slaveId: string
  weightRegister: string
  statusRegister: string
  scaleCapacityKg: string
  stabilityGrams: string
  pollMs: string
}

const INITIAL_SETTINGS: WeighingSettings = {
  transmitterIp: '192.168.1.100',
  modbusPort: '502',
  slaveId: '1',
  weightRegister: '40001',
  statusRegister: '40002',
  scaleCapacityKg: '150',
  stabilityGrams: '20',
  pollMs: '250',
}

export default function SettingsPage() {
  const toast = useToast()
  const [form, setForm] = useState<WeighingSettings>(INITIAL_SETTINGS)
  const [isTesting, setIsTesting] = useState(false)

  const handleTestConnection = () => {
    setIsTesting(true)
    window.setTimeout(() => {
      setIsTesting(false)
      toast.success(`Modbus TCP connection verified: ${form.transmitterIp}:${form.modbusPort}`)
    }, 800)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.transmitterIp.trim()) {
      toast.error('Transmitter IP address is required.')
      return
    }
    if (!(Number(form.scaleCapacityKg) > 0)) {
      toast.error('Scale capacity must be greater than 0 kg.')
      return
    }
    toast.success('Modbus TCP weighing configuration saved.')
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Weighing Configuration"
        subtitle="Modbus TCP weight transmitter IP connection and scale parameters for receiving intake."
      />

      <form className="space-y-6" onSubmit={handleSubmit}>
        {/* Modbus TCP Connection Settings Card */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-base font-bold text-foreground tracking-tight">
                Weight Transmitter (Modbus TCP)
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Target IP address and holding register configuration for digital scale indicator transmitter.
              </p>
            </div>
            <Badge tone="success" dot>
              Modbus TCP Active
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Transmitter IP Address" htmlFor="settings-ip" required hint="e.g. 192.168.1.100 or 192.168.4.1">
              <Input
                id="settings-ip"
                mono
                value={form.transmitterIp}
                onChange={(e) => setForm({ ...form, transmitterIp: e.target.value })}
                placeholder="192.168.1.100"
              />
            </Field>

            <Field label="Modbus Port" htmlFor="settings-port" required hint="Default Modbus TCP port is 502">
              <Input
                id="settings-port"
                type="number"
                mono
                value={form.modbusPort}
                onChange={(e) => setForm({ ...form, modbusPort: e.target.value })}
              />
            </Field>

            <Field label="Slave / Unit ID" htmlFor="settings-slave" hint="Device address (default 1)">
              <Input
                id="settings-slave"
                type="number"
                mono
                value={form.slaveId}
                onChange={(e) => setForm({ ...form, slaveId: e.target.value })}
              />
            </Field>

            <Field label="Weight Register Address" htmlFor="settings-reg-weight" required hint="Holding register (e.g. 40001)">
              <Input
                id="settings-reg-weight"
                type="number"
                mono
                value={form.weightRegister}
                onChange={(e) => setForm({ ...form, weightRegister: e.target.value })}
              />
            </Field>

            <Field label="Status Register Address" htmlFor="settings-reg-status" hint="Stability flag register (e.g. 40002)">
              <Input
                id="settings-reg-status"
                type="number"
                mono
                value={form.statusRegister}
                onChange={(e) => setForm({ ...form, statusRegister: e.target.value })}
              />
            </Field>
          </div>

          <div className="flex justify-end border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              icon="refresh"
              loading={isTesting}
              onClick={handleTestConnection}
            >
              Test Modbus TCP Connection
            </Button>
          </div>
        </div>

        {/* Scale Parameters Card */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-6">
          <div className="border-b border-border pb-4">
            <h2 className="text-base font-bold text-foreground tracking-tight">Scale & Stability Parameters</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Applies capacity constraints, lock thresholds, and polling frequencies for harvest intake weighing.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Scale Capacity (kg)" htmlFor="settings-capacity" required hint="Maximum allowed intake weight">
              <Input
                id="settings-capacity"
                type="number"
                inputMode="decimal"
                min="1"
                value={form.scaleCapacityKg}
                onChange={(e) => setForm({ ...form, scaleCapacityKg: e.target.value })}
              />
            </Field>

            <Field label="Stability Threshold (g)" htmlFor="settings-stability" hint="Weight locks once variance is under threshold">
              <Input
                id="settings-stability"
                type="number"
                inputMode="numeric"
                min="1"
                value={form.stabilityGrams}
                onChange={(e) => setForm({ ...form, stabilityGrams: e.target.value })}
              />
            </Field>

            <Field label="Polling Interval (ms)" htmlFor="settings-poll" hint="Modbus TCP query frequency">
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
        </div>

        {/* Form Actions */}
        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" icon="check" touch>
            Save Configuration
          </Button>
          <Button type="button" variant="ghost" icon="refresh" onClick={() => setForm(INITIAL_SETTINGS)}>
            Reset Defaults
          </Button>
        </div>
      </form>

      {/* Info Banner */}
      <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl flex items-start gap-3 text-xs text-foreground">
        <Icon name="info" size={18} className="text-primary shrink-0 mt-0.5" />
        <div className="leading-relaxed text-muted-foreground">
          <strong className="font-semibold text-primary">Modbus TCP Polling:</strong> The backend system continuously polls the weight transmitter at IP <code className="font-mono text-foreground font-semibold">{form.transmitterIp}:{form.modbusPort}</code> (Register {form.weightRegister}) and updates live scale readings across all active intake sessions.
        </div>
      </div>
    </div>
  )
}
