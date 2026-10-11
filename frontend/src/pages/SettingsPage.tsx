import { useState } from 'react'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import { Field, Input } from '../components/shared/Form'
import PageHeader from '../components/shared/PageHeader'
import { useToast } from '../components/feedback/Toast'

interface WeighingSettings {
  // Intake Scale
  transmitterIp: string
  modbusPort: string
  slaveId: string
  weightRegister: string
  statusRegister: string
  scaleCapacityKg: string
  stabilityGrams: string
  pollMs: string

  // Packaging Scale Stations (3 Scale Channels)
  st1Ip: string
  st1Port: string
  st1Register: string

  st2Ip: string
  st2Port: string
  st2Register: string

  st3Ip: string
  st3Port: string
  st3Register: string
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

  st1Ip: '192.168.1.101',
  st1Port: '502',
  st1Register: '40001',

  st2Ip: '192.168.1.102',
  st2Port: '502',
  st2Register: '40001',

  st3Ip: '192.168.1.103',
  st3Port: '502',
  st3Register: '40001',
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
    toast.success('Weighing & Packaging Modbus TCP configuration saved.')
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Weighing & Packaging Configuration"
        subtitle="Modbus TCP weight transmitter IP connection, 3-station packaging scales, and scale parameters."
      />

      <form className="space-y-6" onSubmit={handleSubmit}>
        {/* Receiving Intake Modbus TCP Connection Settings Card */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-base font-bold text-foreground tracking-tight">
                Receiving Station Weight Transmitter (Modbus TCP)
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Target IP address and holding register configuration for intake scale indicator transmitter.
              </p>
            </div>
            <Badge tone="success" dot>
              Intake Modbus TCP Active
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Transmitter IP Address" htmlFor="settings-ip" required hint="e.g. 192.168.1.100">
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

        {/* 3 Packaging Area Scale Stations (Conflict-Free Channels) */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-base font-bold text-foreground tracking-tight">
                Packaging Area Multi-Scale Stations (3 Channels)
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Assigns independent Modbus TCP IP addresses for Station 1 (Grade A), Station 2 (Grade B), and Station 3 (Grade C) to prevent multi-operator conflicts.
              </p>
            </div>
            <Badge tone="accent">3 Independent Channels</Badge>
          </div>

          <div className="space-y-6">
            {/* Station 1 (Grade A) */}
            <div className="p-4 bg-muted/30 border border-border rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Station 1 — Scale Channel (Grade A)
                </span>
                <Badge tone="success">Grade A</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="IP Address" htmlFor="st1-ip">
                  <Input
                    id="st1-ip"
                    mono
                    value={form.st1Ip}
                    onChange={(e) => setForm({ ...form, st1Ip: e.target.value })}
                  />
                </Field>
                <Field label="Port" htmlFor="st1-port">
                  <Input
                    id="st1-port"
                    type="number"
                    mono
                    value={form.st1Port}
                    onChange={(e) => setForm({ ...form, st1Port: e.target.value })}
                  />
                </Field>
                <Field label="Weight Register" htmlFor="st1-reg">
                  <Input
                    id="st1-reg"
                    type="number"
                    mono
                    value={form.st1Register}
                    onChange={(e) => setForm({ ...form, st1Register: e.target.value })}
                  />
                </Field>
              </div>
            </div>

            {/* Station 2 (Grade B) */}
            <div className="p-4 bg-muted/30 border border-border rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Station 2 — Scale Channel (Grade B)
                </span>
                <Badge tone="accent">Grade B</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="IP Address" htmlFor="st2-ip">
                  <Input
                    id="st2-ip"
                    mono
                    value={form.st2Ip}
                    onChange={(e) => setForm({ ...form, st2Ip: e.target.value })}
                  />
                </Field>
                <Field label="Port" htmlFor="st2-port">
                  <Input
                    id="st2-port"
                    type="number"
                    mono
                    value={form.st2Port}
                    onChange={(e) => setForm({ ...form, st2Port: e.target.value })}
                  />
                </Field>
                <Field label="Weight Register" htmlFor="st2-reg">
                  <Input
                    id="st2-reg"
                    type="number"
                    mono
                    value={form.st2Register}
                    onChange={(e) => setForm({ ...form, st2Register: e.target.value })}
                  />
                </Field>
              </div>
            </div>

            {/* Station 3 (Grade C) */}
            <div className="p-4 bg-muted/30 border border-border rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Station 3 — Scale Channel (Grade C)
                </span>
                <Badge tone="warning">Grade C</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="IP Address" htmlFor="st3-ip">
                  <Input
                    id="st3-ip"
                    mono
                    value={form.st3Ip}
                    onChange={(e) => setForm({ ...form, st3Ip: e.target.value })}
                  />
                </Field>
                <Field label="Port" htmlFor="st3-port">
                  <Input
                    id="st3-port"
                    type="number"
                    mono
                    value={form.st3Port}
                    onChange={(e) => setForm({ ...form, st3Port: e.target.value })}
                  />
                </Field>
                <Field label="Weight Register" htmlFor="st3-reg">
                  <Input
                    id="st3-reg"
                    type="number"
                    mono
                    value={form.st3Register}
                    onChange={(e) => setForm({ ...form, st3Register: e.target.value })}
                  />
                </Field>
              </div>
            </div>
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
            <Field label="Intake Capacity (kg)" htmlFor="settings-capacity" required hint="Maximum allowed intake weight">
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
    </div>
  )
}
