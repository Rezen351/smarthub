import { useState, useEffect } from 'react'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import { Field, Input } from '../components/shared/Form'
import PageHeader from '../components/shared/PageHeader'
import { useToast } from '../components/feedback/Toast'
import { api } from '../services/api'

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

export interface ThermalPrinterConfig {
  station: 'RECEPTION' | 'PACKAGING'
  model: string
  paperWidthMm: string
  connection: 'Ethernet'
  ip: string
  port: string
  status: 'ONLINE' | 'OFFLINE'
}

export interface SystemSettings {
  intake: ScaleConfig
  grading: ScaleConfig
  packaging: PackagingScaleConfig
  printers: {
    reception: ThermalPrinterConfig
    packaging: ThermalPrinterConfig
  }
  pollIntervalMs: string
  timeoutMs: string
}

export const INITIAL_SETTINGS: SystemSettings = {
  intake: {
    ip: '',
    port: '',
    slaveId: '1',
    weightRegister: '40001',
    statusRegister: '40002',
    capacityKg: '',
    stabilityGrams: '20',
  },
  grading: {
    ip: '',
    port: '',
    slaveId: '1',
    weightRegister: '40001',
    statusRegister: '40002',
    capacityKg: '',
    stabilityGrams: '10',
  },
  packaging: {
    ip: '',
    port: '',
    slaveId: '1',
    weightRegister: '40001',
    statusRegister: '40002',
    capacityKg: '',
    stabilityGrams: '2',
    pouchToleranceGrams: '5',
  },
  printers: {
    reception: {
      station: 'RECEPTION',
      model: 'IW-J300H',
      paperWidthMm: '80',
      connection: 'Ethernet',
      ip: '',
      port: '9100',
      status: 'OFFLINE',
    },
    packaging: {
      station: 'PACKAGING',
      model: 'IW-J300H',
      paperWidthMm: '80',
      connection: 'Ethernet',
      ip: '',
      port: '9100',
      status: 'OFFLINE',
    },
  },
  pollIntervalMs: '250',
  timeoutMs: '1000',
}

const STORAGE_KEY = 'smarthub_settings'

export default function SettingsPage() {
  const toast = useToast()
  const [form, setForm] = useState<SystemSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        return {
          ...INITIAL_SETTINGS,
          ...parsed,
          printers: {
            reception: { ...INITIAL_SETTINGS.printers.reception, ...(parsed.printers?.reception || {}) },
            packaging: { ...INITIAL_SETTINGS.printers.packaging, ...(parsed.printers?.packaging || {}) },
          },
        }
      }
    } catch {
      // fallback
    }
    return INITIAL_SETTINGS
  })
  const [testingTarget, setTestingTarget] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [scaleOnline, setScaleOnline] = useState<Record<'01' | '02' | '03', boolean>>({
    '01': false,
    '02': false,
    '03': false,
  })

  // Fetch live scale hardware configuration from backend on mount
  useEffect(() => {
    let isMounted = true
    api.scales
      .list()
      .then((stations) => {
        if (!isMounted || !Array.isArray(stations)) return
        setScaleOnline({
          '01': Boolean(stations.find((station: any) => station.stationId === '01')?.online),
          '02': Boolean(stations.find((station: any) => station.stationId === '02')?.online),
          '03': Boolean(stations.find((station: any) => station.stationId === '03')?.online),
        })
        setForm((prev) => {
          const next = { ...prev }
          const s1 = stations.find((s: any) => s.stationId === '01')
          const s2 = stations.find((s: any) => s.stationId === '02')
          const s3 = stations.find((s: any) => s.stationId === '03')
          if (s1) {
            next.intake = {
              ...next.intake,
              ip: s1.ip || next.intake.ip,
              port: String(s1.port || next.intake.port),
              capacityKg: String(s1.capacityKg || next.intake.capacityKg),
            }
          }
          if (s2) {
            next.grading = {
              ...next.grading,
              ip: s2.ip || next.grading.ip,
              port: String(s2.port || next.grading.port),
              capacityKg: String(s2.capacityKg || next.grading.capacityKg),
            }
          }
          if (s3) {
            next.packaging = {
              ...next.packaging,
              ip: s3.ip || next.packaging.ip,
              port: String(s3.port || next.packaging.port),
              capacityKg: String(s3.capacityKg || next.packaging.capacityKg),
            }
          }
          return next
        })
      })
      .catch(() => {
        // Backend scales list unavailable, keep local state
      })
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    api.printers
      .get()
      .then(async (printers) => {
        if (!isMounted || !Array.isArray(printers)) return
        const printersWithStatus = await Promise.all(
          printers.map(async (printer: any) => {
            const station = printer.station?.toLowerCase() as 'reception' | 'packaging'
            if (station !== 'reception' && station !== 'packaging') return printer
            try {
              const status = await api.printers.test(station)
              return { ...printer, status: status?.online ? 'ONLINE' : 'OFFLINE' }
            } catch {
              return { ...printer, status: 'OFFLINE' }
            }
          })
        )
        setForm((prev) => {
          const next = { ...prev, printers: { ...prev.printers } }
          for (const printer of printersWithStatus) {
            const key = printer.station?.toLowerCase() as 'reception' | 'packaging'
            if (!next.printers[key]) continue
            next.printers[key] = {
              ...next.printers[key],
              ...printer,
              paperWidthMm: String(printer.paperWidthMm || next.printers[key].paperWidthMm),
              port: String(printer.port || next.printers[key].port),
              status: printer.status || next.printers[key].status,
            }
          }
          return next
        })
      })
      .catch(() => undefined)
    return () => {
      isMounted = false
    }
  }, [])

  const handleTestConnection = async (stationId: string, stationLabel: string, ip: string, port: string) => {
    setTestingTarget(stationId)
    try {
      // Test direct physical Modbus TCP socket connection via backend
      const res = await api.scales.testConnection(stationId)
      if (res && res.online) {
        const normalizedStation = stationId.replace(/\D/g, '') as '01' | '02' | '03'
        if (normalizedStation in scaleOnline) {
          setScaleOnline((prev) => ({ ...prev, [normalizedStation]: true }))
        }
      toast.success(res.message || `${stationLabel} is ready at ${ip}:${port}`)
      } else {
        const normalizedStation = stationId.replace(/\D/g, '') as '01' | '02' | '03'
        if (normalizedStation in scaleOnline) {
          setScaleOnline((prev) => ({ ...prev, [normalizedStation]: false }))
        }
      toast.warning(res?.message || `Could not reach ${stationLabel} at ${ip}:${port}`)
      }
    } catch (err: any) {
      toast.error(`Scale check failed: ${err.message || 'Scale unavailable'}`)
    } finally {
      setTestingTarget(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.intake.ip.trim() || !form.grading.ip.trim() || !form.packaging.ip.trim()) {
      toast.error('All 3 scale addresses are required.')
      return
    }

    if (Object.values(form.printers).some((printer) => !printer.ip.trim() || Number(printer.port) <= 0 || Number(printer.port) > 65535)) {
      toast.error('Valid Ethernet addresses and ports are required for both thermal printers.')
      return
    }

    if (
      Number(form.intake.capacityKg) <= 0 ||
      Number(form.grading.capacityKg) <= 0 ||
      Number(form.packaging.capacityKg) <= 0
    ) {
      toast.error('Maximum load must be greater than zero.')
      return
    }

    setSaving(true)
    try {
      // Update backend Modbus TCP configuration for each station
      await Promise.all([
        api.scales.updateConfig('01', form.intake.ip.trim(), Number(form.intake.port), Number(form.intake.capacityKg)),
        api.scales.updateConfig('02', form.grading.ip.trim(), Number(form.grading.port), Number(form.grading.capacityKg)),
        api.scales.updateConfig('03', form.packaging.ip.trim(), Number(form.packaging.port), Number(form.packaging.capacityKg)),
        api.printers.update('reception', form.printers.reception.ip.trim(), Number(form.printers.reception.port)),
        api.printers.update('packaging', form.printers.packaging.ip.trim(), Number(form.printers.packaging.port)),
      ])

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(form))
      } catch {
        // storage unavailable
      }

      toast.success('Settings saved and applied.')
    } catch (err: any) {
      toast.error('Failed to update settings: ' + (err.message || 'Connection error'))
    } finally {
      setSaving(false)
    }
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

  const handleTestPrinter = async (station: 'reception' | 'packaging') => {
    setTestingTarget(`printer-${station}`)
    try {
      const result = await api.printers.test(station)
      setForm((prev) => ({ ...prev, printers: { ...prev.printers, [station]: { ...prev.printers[station], status: result?.online ? 'ONLINE' : 'OFFLINE' } } }))
      if (result?.online) toast.success(`${station === 'reception' ? 'Reception' : 'Packaging'} printer is online.`)
      else toast.warning(`${station === 'reception' ? 'Reception' : 'Packaging'} printer is offline.`)
    } catch (err: any) {
      toast.error(`Printer check failed: ${err.message || 'Printer unavailable'}`)
    } finally {
      setTestingTarget(null)
    }
  }

  const renderPrinterSettings = (station: 'reception' | 'packaging') => {
    const printer = form.printers[station]
    const label = station === 'reception' ? 'Reception' : 'Packaging'

    return (
      <div className="border-t border-border pt-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-semibold text-base text-foreground">Printer Settings</span>
            <p className="text-xs text-muted-foreground mt-1">{label} · IW-J300H · 80 mm · Ethernet only</p>
          </div>
          <Badge tone={printer.status === 'ONLINE' ? 'success' : 'warning'} dot>
            {printer.status === 'ONLINE' ? 'Online' : 'Offline'}
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Field label="Printer Model" htmlFor={`${station}-printer-model`}>
            <Input id={`${station}-printer-model`} mono value={printer.model} readOnly />
          </Field>

          <Field label="Paper Width (mm)" htmlFor={`${station}-printer-width`}>
            <Input id={`${station}-printer-width`} type="number" mono value={printer.paperWidthMm} readOnly />
          </Field>

          <Field label="Connection" htmlFor={`${station}-printer-connection`}>
            <Input id={`${station}-printer-connection`} mono value={printer.connection} readOnly />
          </Field>

          <Field label="Printer IP Address" htmlFor={`${station}-printer-ip`} required>
            <Input
              id={`${station}-printer-ip`}
              mono
              placeholder="192.168.1.120"
              value={printer.ip}
              onChange={(e) => setForm({ ...form, printers: { ...form.printers, [station]: { ...printer, ip: e.target.value } } })}
            />
          </Field>

          <Field label="TCP Port" htmlFor={`${station}-printer-port`} required hint="Default printer port: 9100">
            <Input
              id={`${station}-printer-port`}
              type="number"
              min="1"
              max="65535"
              mono
              value={printer.port}
              onChange={(e) => setForm({ ...form, printers: { ...form.printers, [station]: { ...printer, port: e.target.value } } })}
            />
          </Field>
        </div>

        <div className="flex justify-end border-t border-border pt-4">
          <Button
            type="button"
            variant="outline"
            icon="refresh"
            loading={testingTarget === `printer-${station}`}
            onClick={() => handleTestPrinter(station)}
          >
            Test Printer
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Scale connections and thermal printer configuration."
        actions={
          <Badge tone="success" dot live>
            3 Stations · 2 Printers
          </Badge>
        }
      />

      {/* Station overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-none p-4 shadow-sm space-y-3">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Station 01 · Reception</p>
          <div>
            <p className="text-xs text-muted-foreground">Scale</p>
            <p className="font-bold font-mono tracking-tight text-foreground">{form.intake.ip}:{form.intake.port}</p>
            <p className="text-xs text-muted-foreground">{form.intake.capacityKg || '—'} kg Floor Scale</p>
          </div>
          <div className="border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">Printer</p>
            <p className="font-bold font-mono tracking-tight text-foreground">{form.printers.reception.ip || 'Not configured'}</p>
            <p className="text-xs text-muted-foreground">{form.printers.reception.model} · {form.printers.reception.paperWidthMm} mm · {form.printers.reception.status === 'ONLINE' ? 'Online' : 'Offline'}</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-none p-4 shadow-sm space-y-3">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Station 02 · Sorting</p>
          <div>
            <p className="text-xs text-muted-foreground">Scale</p>
            <p className="font-bold font-mono tracking-tight text-foreground">{form.grading.ip}:{form.grading.port}</p>
            <p className="text-xs text-muted-foreground">{form.grading.capacityKg || '—'} kg Floor Scale</p>
          </div>
          <div className="border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">Printer</p>
            <p className="font-bold tracking-tight text-foreground">Not assigned</p>
            <p className="text-xs text-muted-foreground">No thermal printer</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-none p-4 shadow-sm space-y-3">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Station 03 · Packaging</p>
          <div>
            <p className="text-xs text-muted-foreground">Scale</p>
            <p className="font-bold font-mono tracking-tight text-foreground">{form.packaging.ip}:{form.packaging.port}</p>
            <p className="text-xs text-muted-foreground">{form.packaging.capacityKg || '—'} kg Bench Scale</p>
          </div>
          <div className="border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">Printer</p>
            <p className="font-bold font-mono tracking-tight text-foreground">{form.printers.packaging.ip || 'Not configured'}</p>
            <p className="text-xs text-muted-foreground">{form.printers.packaging.model} · {form.printers.packaging.paperWidthMm} mm · {form.printers.packaging.status === 'ONLINE' ? 'Online' : 'Offline'}</p>
          </div>
        </div>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        {/* Station 01: Reception */}
        <div className="bg-card border border-border rounded-none p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <span className="font-semibold text-base text-foreground">Station 01: Reception</span>
            <Badge tone={scaleOnline['01'] ? 'success' : 'warning'} dot>
              {scaleOnline['01'] ? 'Online' : 'Offline'}
            </Badge>
          </div>

          <div className="border-t border-border pt-5">
            <span className="font-semibold text-sm uppercase tracking-wider text-foreground">Scale Settings</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label="Scale Address" htmlFor="intake-ip" required>
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

            <Field label="Connection Port" htmlFor="intake-port" required>
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

            <Field label="Device Number" htmlFor="intake-slave">
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

            <Field label="Weight Reading" htmlFor="intake-reg-weight" required>
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

            <Field label="Status Reading" htmlFor="intake-reg-status">
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

            <Field label="Maximum Load (kg)" htmlFor="intake-cap" required>
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

            <Field label="Stable Reading (g)" htmlFor="intake-stab">
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
              loading={testingTarget === '01'}
              onClick={() => handleTestConnection('01', 'Station 01', form.intake.ip, form.intake.port)}
            >
                Check Scale
            </Button>
          </div>

          {renderPrinterSettings('reception')}
        </div>

        {/* Station 02: Sorting */}
        <div className="bg-card border border-border rounded-none p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <span className="font-semibold text-base text-foreground">Station 02: Sorting</span>
            <Badge tone={scaleOnline['02'] ? 'success' : 'warning'} dot>
              {scaleOnline['02'] ? 'Online' : 'Offline'}
            </Badge>
          </div>

          <div className="border-t border-border pt-5">
            <span className="font-semibold text-sm uppercase tracking-wider text-foreground">Scale Settings</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label="Scale Address" htmlFor="grading-ip" required>
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

            <Field label="Connection Port" htmlFor="grading-port" required>
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

            <Field label="Device Number" htmlFor="grading-slave">
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

            <Field label="Weight Reading" htmlFor="grading-reg-weight" required>
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

            <Field label="Status Reading" htmlFor="grading-reg-status">
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

            <Field label="Maximum Load (kg)" htmlFor="grading-cap" required>
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

            <Field label="Stable Reading (g)" htmlFor="grading-stab">
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
              loading={testingTarget === '02'}
              onClick={() => handleTestConnection('02', 'Station 02', form.grading.ip, form.grading.port)}
            >
                Check Scale
            </Button>
          </div>

        </div>

        {/* Station 03: Packaging */}
        <div className="bg-card border border-border rounded-none p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <span className="font-semibold text-base text-foreground">Station 03: Packaging</span>
            <Badge tone={scaleOnline['03'] ? 'success' : 'warning'} dot>
              {scaleOnline['03'] ? 'Online' : 'Offline'}
            </Badge>
          </div>

          <div className="border-t border-border pt-5">
            <span className="font-semibold text-sm uppercase tracking-wider text-foreground">Scale Settings</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label="Scale Address" htmlFor="pkg-ip" required>
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

            <Field label="Connection Port" htmlFor="pkg-port" required>
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

            <Field label="Device Number" htmlFor="pkg-slave">
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

            <Field label="Weight Reading" htmlFor="pkg-reg-weight" required>
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

            <Field label="Status Reading" htmlFor="pkg-reg-status">
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

            <Field label="Maximum Load (kg)" htmlFor="pkg-cap" required>
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

            <Field label="Stable Reading (g)" htmlFor="pkg-stab">
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

            <Field label="Pouch Allowance (g)" htmlFor="pkg-tol" required>
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
              loading={testingTarget === '03'}
              onClick={() => handleTestConnection('03', 'Station 03', form.packaging.ip, form.packaging.port)}
            >
                Check Scale
            </Button>
          </div>

          {renderPrinterSettings('packaging')}
        </div>

        {/* Global Settings */}
        <div className="bg-card border border-border rounded-none p-6 shadow-sm space-y-6">
          <div className="border-b border-border pb-4">
            <span className="font-semibold text-base text-foreground">General Settings</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Update Speed (ms)" htmlFor="global-poll">
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

            <Field label="Response Limit (ms)" htmlFor="global-timeout">
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
          <Button type="submit" variant="primary" icon="check" loading={saving} touch>
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
