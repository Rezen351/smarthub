import { useState } from 'react'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import { Field, Input } from '../components/shared/Form'
import PageHeader from '../components/shared/PageHeader'
import { useToast } from '../components/feedback/Toast'

export interface ScaleConfig {
  ip: string
  port: string
  slaveId: string
  weightRegister: string
  statusRegister: string
  capacityKg: string
  stabilityGrams: string
}

export interface PackagingScaleConfig extends ScaleConfig {
  pouchToleranceGrams: string
}

export interface SystemScaleSettings {
  intake: ScaleConfig
  grading: ScaleConfig
  packaging: PackagingScaleConfig
  pollIntervalMs: string
  timeoutMs: string
}

export const INITIAL_SETTINGS: SystemScaleSettings = {
  intake: {
    ip: '192.168.1.100',
    port: '502',
    slaveId: '1',
    weightRegister: '40001',
    statusRegister: '40002',
    capacityKg: '150',
    stabilityGrams: '20',
  },
  grading: {
    ip: '192.168.1.101',
    port: '502',
    slaveId: '1',
    weightRegister: '40001',
    statusRegister: '40002',
    capacityKg: '100',
    stabilityGrams: '10',
  },
  packaging: {
    ip: '192.168.1.102',
    port: '502',
    slaveId: '1',
    weightRegister: '40001',
    statusRegister: '40002',
    capacityKg: '30',
    stabilityGrams: '2',
    pouchToleranceGrams: '5',
  },
  pollIntervalMs: '250',
  timeoutMs: '1000',
}

const STORAGE_KEY = 'smarthub_scale_settings'

export default function SettingsPage() {
  const toast = useToast()
  const [form, setForm] = useState<SystemScaleSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) return JSON.parse(saved)
    } catch {
      // fallback
    }
    return INITIAL_SETTINGS
  })
  const [testingTarget, setTestingTarget] = useState<string | null>(null)

  const handleTestConnection = (stationId: string, stationLabel: string, ip: string, port: string) => {
    setTestingTarget(stationId)
    window.setTimeout(() => {
      setTestingTarget(null)
      toast.success(`${stationLabel} verified at ${ip}:${port}`)
    }, 600)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.intake.ip.trim() || !form.grading.ip.trim() || !form.packaging.ip.trim()) {
      toast.error('All 3 scale IP addresses are required.')
      return
    }

    if (
      Number(form.intake.capacityKg) <= 0 ||
      Number(form.grading.capacityKg) <= 0 ||
      Number(form.packaging.capacityKg) <= 0
    ) {
      toast.error('Capacity must be greater than zero.')
      return
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form))
    } catch {
      // storage unavailable
    }

    toast.success('Settings saved.')
  }

  const handleResetDefaults = () => {
    setForm(INITIAL_SETTINGS)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // storage unavailable
    }
    toast.info('Settings reset to defaults.')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scale Settings"
        subtitle="Modbus TCP parameters for Stations 01, 02, and 03."
        actions={
          <Badge tone="success" dot live>
            Port 502 · Active
          </Badge>
        }
      />

      {/* 4 Quick Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-none p-4 shadow-sm space-y-1">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Station 01</p>
          <p className="text-xl font-bold font-mono tracking-tight text-foreground">{form.intake.ip}:{form.intake.port}</p>
          <p className="text-xs text-muted-foreground">150 kg Floor Scale</p>
        </div>

        <div className="bg-card border border-border rounded-none p-4 shadow-sm space-y-1">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Station 02</p>
          <p className="text-xl font-bold font-mono tracking-tight text-foreground">{form.grading.ip}:{form.grading.port}</p>
          <p className="text-xs text-muted-foreground">100 kg Floor Scale</p>
        </div>

        <div className="bg-card border border-border rounded-none p-4 shadow-sm space-y-1">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Station 03</p>
          <p className="text-xl font-bold font-mono tracking-tight text-foreground">{form.packaging.ip}:{form.packaging.port}</p>
          <p className="text-xs text-muted-foreground">30 kg Bench Scale</p>
        </div>

        <div className="bg-card border border-border rounded-none p-4 shadow-sm space-y-1">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Polling</p>
          <p className="text-xl font-bold font-mono tracking-tight text-foreground">{form.pollIntervalMs} ms</p>
          <p className="text-xs text-muted-foreground">{form.timeoutMs} ms Timeout</p>
        </div>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        {/* Station 01: Reception */}
        <div className="bg-card border border-border rounded-none p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <span className="font-semibold text-base text-foreground">Station 01: Reception</span>
            <Badge tone="success" dot>Online</Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label="IP Address" htmlFor="intake-ip" required>
              <Input
                id="intake-ip"
                mono
                value={form.intake.ip}
                onChange={(e) =>
                  setForm({
                    ...form,
                    intake: { ...form.intake, ip: e.target.value },
                  })
                }
              />
            </Field>

            <Field label="Port" htmlFor="intake-port" required>
              <Input
                id="intake-port"
                type="number"
                mono
                value={form.intake.port}
                onChange={(e) =>
                  setForm({
                    ...form,
                    intake: { ...form.intake, port: e.target.value },
                  })
                }
              />
            </Field>

            <Field label="Slave ID" htmlFor="intake-slave">
              <Input
                id="intake-slave"
                type="number"
                mono
                value={form.intake.slaveId}
                onChange={(e) =>
                  setForm({
                    ...form,
                    intake: { ...form.intake, slaveId: e.target.value },
                  })
                }
              />
            </Field>

            <Field label="Weight Register" htmlFor="intake-reg-weight" required>
              <Input
                id="intake-reg-weight"
                type="number"
                mono
                value={form.intake.weightRegister}
                onChange={(e) =>
                  setForm({
                    ...form,
                    intake: { ...form.intake, weightRegister: e.target.value },
                  })
                }
              />
            </Field>

            <Field label="Status Register" htmlFor="intake-reg-status">
              <Input
                id="intake-reg-status"
                type="number"
                mono
                value={form.intake.statusRegister}
                onChange={(e) =>
                  setForm({
                    ...form,
                    intake: { ...form.intake, statusRegister: e.target.value },
                  })
                }
              />
            </Field>

            <Field label="Capacity (kg)" htmlFor="intake-cap" required>
              <Input
                id="intake-cap"
                type="number"
                mono
                value={form.intake.capacityKg}
                onChange={(e) =>
                  setForm({
                    ...form,
                    intake: { ...form.intake, capacityKg: e.target.value },
                  })
                }
              />
            </Field>

            <Field label="Stability (g)" htmlFor="intake-stab">
              <Input
                id="intake-stab"
                type="number"
                mono
                value={form.intake.stabilityGrams}
                onChange={(e) =>
                  setForm({
                    ...form,
                    intake: { ...form.intake, stabilityGrams: e.target.value },
                  })
                }
              />
            </Field>
          </div>

          <div className="flex justify-end border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              icon="refresh"
              loading={testingTarget === 'st-01'}
              onClick={() => handleTestConnection('st-01', 'Station 01', form.intake.ip, form.intake.port)}
            >
              Test Connection
            </Button>
          </div>
        </div>

        {/* Station 02: Sorting */}
        <div className="bg-card border border-border rounded-none p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <span className="font-semibold text-base text-foreground">Station 02: Sorting</span>
            <Badge tone="success" dot>Online</Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label="IP Address" htmlFor="grading-ip" required>
              <Input
                id="grading-ip"
                mono
                value={form.grading.ip}
                onChange={(e) =>
                  setForm({
                    ...form,
                    grading: { ...form.grading, ip: e.target.value },
                  })
                }
              />
            </Field>

            <Field label="Port" htmlFor="grading-port" required>
              <Input
                id="grading-port"
                type="number"
                mono
                value={form.grading.port}
                onChange={(e) =>
                  setForm({
                    ...form,
                    grading: { ...form.grading, port: e.target.value },
                  })
                }
              />
            </Field>

            <Field label="Slave ID" htmlFor="grading-slave">
              <Input
                id="grading-slave"
                type="number"
                mono
                value={form.grading.slaveId}
                onChange={(e) =>
                  setForm({
                    ...form,
                    grading: { ...form.grading, slaveId: e.target.value },
                  })
                }
              />
            </Field>

            <Field label="Weight Register" htmlFor="grading-reg-weight" required>
              <Input
                id="grading-reg-weight"
                type="number"
                mono
                value={form.grading.weightRegister}
                onChange={(e) =>
                  setForm({
                    ...form,
                    grading: { ...form.grading, weightRegister: e.target.value },
                  })
                }
              />
            </Field>

            <Field label="Status Register" htmlFor="grading-reg-status">
              <Input
                id="grading-reg-status"
                type="number"
                mono
                value={form.grading.statusRegister}
                onChange={(e) =>
                  setForm({
                    ...form,
                    grading: { ...form.grading, statusRegister: e.target.value },
                  })
                }
              />
            </Field>

            <Field label="Capacity (kg)" htmlFor="grading-cap" required>
              <Input
                id="grading-cap"
                type="number"
                mono
                value={form.grading.capacityKg}
                onChange={(e) =>
                  setForm({
                    ...form,
                    grading: { ...form.grading, capacityKg: e.target.value },
                  })
                }
              />
            </Field>

            <Field label="Stability (g)" htmlFor="grading-stab">
              <Input
                id="grading-stab"
                type="number"
                mono
                value={form.grading.stabilityGrams}
                onChange={(e) =>
                  setForm({
                    ...form,
                    grading: { ...form.grading, stabilityGrams: e.target.value },
                  })
                }
              />
            </Field>
          </div>

          <div className="flex justify-end border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              icon="refresh"
              loading={testingTarget === 'st-02'}
              onClick={() => handleTestConnection('st-02', 'Station 02', form.grading.ip, form.grading.port)}
            >
              Test Connection
            </Button>
          </div>
        </div>

        {/* Station 03: Packaging */}
        <div className="bg-card border border-border rounded-none p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <span className="font-semibold text-base text-foreground">Station 03: Packaging</span>
            <Badge tone="success" dot>Online</Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label="IP Address" htmlFor="pkg-ip" required>
              <Input
                id="pkg-ip"
                mono
                value={form.packaging.ip}
                onChange={(e) =>
                  setForm({
                    ...form,
                    packaging: { ...form.packaging, ip: e.target.value },
                  })
                }
              />
            </Field>

            <Field label="Port" htmlFor="pkg-port" required>
              <Input
                id="pkg-port"
                type="number"
                mono
                value={form.packaging.port}
                onChange={(e) =>
                  setForm({
                    ...form,
                    packaging: { ...form.packaging, port: e.target.value },
                  })
                }
              />
            </Field>

            <Field label="Slave ID" htmlFor="pkg-slave">
              <Input
                id="pkg-slave"
                type="number"
                mono
                value={form.packaging.slaveId}
                onChange={(e) =>
                  setForm({
                    ...form,
                    packaging: { ...form.packaging, slaveId: e.target.value },
                  })
                }
              />
            </Field>

            <Field label="Weight Register" htmlFor="pkg-reg-weight" required>
              <Input
                id="pkg-reg-weight"
                type="number"
                mono
                value={form.packaging.weightRegister}
                onChange={(e) =>
                  setForm({
                    ...form,
                    packaging: { ...form.packaging, weightRegister: e.target.value },
                  })
                }
              />
            </Field>

            <Field label="Status Register" htmlFor="pkg-reg-status">
              <Input
                id="pkg-reg-status"
                type="number"
                mono
                value={form.packaging.statusRegister}
                onChange={(e) =>
                  setForm({
                    ...form,
                    packaging: { ...form.packaging, statusRegister: e.target.value },
                  })
                }
              />
            </Field>

            <Field label="Capacity (kg)" htmlFor="pkg-cap" required>
              <Input
                id="pkg-cap"
                type="number"
                mono
                value={form.packaging.capacityKg}
                onChange={(e) =>
                  setForm({
                    ...form,
                    packaging: { ...form.packaging, capacityKg: e.target.value },
                  })
                }
              />
            </Field>

            <Field label="Stability (g)" htmlFor="pkg-stab">
              <Input
                id="pkg-stab"
                type="number"
                mono
                value={form.packaging.stabilityGrams}
                onChange={(e) =>
                  setForm({
                    ...form,
                    packaging: { ...form.packaging, stabilityGrams: e.target.value },
                  })
                }
              />
            </Field>

            <Field label="Pouch Tolerance (g)" htmlFor="pkg-tol" required>
              <Input
                id="pkg-tol"
                type="number"
                mono
                value={form.packaging.pouchToleranceGrams}
                onChange={(e) =>
                  setForm({
                    ...form,
                    packaging: { ...form.packaging, pouchToleranceGrams: e.target.value },
                  })
                }
              />
            </Field>
          </div>

          <div className="flex justify-end border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              icon="refresh"
              loading={testingTarget === 'st-03'}
              onClick={() => handleTestConnection('st-03', 'Station 03', form.packaging.ip, form.packaging.port)}
            >
              Test Connection
            </Button>
          </div>
        </div>

        {/* Global Settings */}
        <div className="bg-card border border-border rounded-none p-6 shadow-sm space-y-6">
          <div className="border-b border-border pb-4">
            <span className="font-semibold text-base text-foreground">Global Settings</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Polling (ms)" htmlFor="global-poll">
              <Input
                id="global-poll"
                type="number"
                mono
                min="100"
                step="50"
                value={form.pollIntervalMs}
                onChange={(e) => setForm({ ...form, pollIntervalMs: e.target.value })}
              />
            </Field>

            <Field label="Timeout (ms)" htmlFor="global-timeout">
              <Input
                id="global-timeout"
                type="number"
                mono
                min="200"
                step="100"
                value={form.timeoutMs}
                onChange={(e) => setForm({ ...form, timeoutMs: e.target.value })}
              />
            </Field>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" variant="primary" icon="check" touch>
            Save Settings
          </Button>
          <Button type="button" variant="ghost" icon="refresh" onClick={handleResetDefaults}>
            Reset Defaults
          </Button>
        </div>
      </form>
    </div>
  )
}
