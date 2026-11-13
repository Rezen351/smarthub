import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import Icon, { type IconName } from '../components/shared/Icon'
import { Field, Input } from '../components/shared/Form'
import PageHeader from '../components/shared/PageHeader'
import { useToast } from '../components/feedback/Toast'
import { api } from '../services/api'
import PalletsPage from './PalletsPage'

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
    statusRegister: '40011',
    capacityKg: '',
    stabilityGrams: '20',
  },
  grading: {
    ip: '',
    port: '',
    slaveId: '1',
    weightRegister: '40001',
    statusRegister: '40011',
    capacityKg: '',
    stabilityGrams: '10',
  },
  packaging: {
    ip: '',
    port: '',
    slaveId: '1',
    weightRegister: '40001',
    statusRegister: '40011',
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
  const [searchParams, setSearchParams] = useSearchParams()
  const activeSection = searchParams.get('section') === 'pallets' ? 'pallets' : 'devices'
  const sections: Array<{ id: 'devices' | 'pallets'; label: string; icon: IconName }> = [
    { id: 'devices', label: 'Devices', icon: 'settings' },
    { id: 'pallets', label: 'Pallet Registry', icon: 'pallet' },
  ]

  const selectSection = (section: 'devices' | 'pallets') => {
    setSearchParams({ section }, { replace: true })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Manage connected devices and reusable pallets."
      />

      <div
        className="inline-flex w-full border border-border bg-muted/40 p-1 sm:w-auto"
        role="tablist"
        aria-label="Settings sections"
      >
        {sections.map((section) => {
          const isActive = activeSection === section.id
          return (
            <button
              key={section.id}
              id={`settings-tab-${section.id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`settings-panel-${section.id}`}
              onClick={() => selectSection(section.id)}
              className={`flex min-h-10 flex-1 items-center justify-center gap-2 px-4 text-sm font-semibold transition-colors sm:flex-none ${
                isActive
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-card/60 hover:text-foreground'
              }`}
            >
              <Icon name={section.icon} size={16} />
              {section.label}
            </button>
          )
        })}
      </div>

      <section
        id={`settings-panel-${activeSection}`}
        role="tabpanel"
        aria-labelledby={`settings-tab-${activeSection}`}
      >
        {activeSection === 'devices' ? <DeviceSettings /> : <PalletsPage embedded />}
      </section>
    </div>
  )
}

function DeviceSettings() {
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
              slaveId: String(s1.unitId || next.intake.slaveId),
              weightRegister: String(s1.weightRegister || next.intake.weightRegister),
              statusRegister: String(s1.statusRegister || next.intake.statusRegister),
            }
          }
          if (s2) {
            next.grading = {
              ...next.grading,
              ip: s2.ip || next.grading.ip,
              port: String(s2.port || next.grading.port),
              capacityKg: String(s2.capacityKg || next.grading.capacityKg),
              slaveId: String(s2.unitId || next.grading.slaveId),
              weightRegister: String(s2.weightRegister || next.grading.weightRegister),
              statusRegister: String(s2.statusRegister || next.grading.statusRegister),
            }
          }
          if (s3) {
            next.packaging = {
              ...next.packaging,
              ip: s3.ip || next.packaging.ip,
              port: String(s3.port || next.packaging.port),
              capacityKg: String(s3.capacityKg || next.packaging.capacityKg),
              slaveId: String(s3.unitId || next.packaging.slaveId),
              weightRegister: String(s3.weightRegister || next.packaging.weightRegister),
              statusRegister: String(s3.statusRegister || next.packaging.statusRegister),
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
    const trimmedIp = (ip || '').trim()
    const numPort = Number(port) || 502

    if (!trimmedIp) {
      toast.error(`Please enter an IP address for ${stationLabel} before testing.`)
      setTestingTarget(null)
      return
    }

    try {
      // Test direct physical Modbus TCP socket connection via backend
      const res = await api.scales.testConnection(stationId, { ip: trimmedIp, port: numPort })
      if (res && res.online) {
        const normalizedStation = stationId.replace(/\D/g, '') as '01' | '02' | '03'
        if (normalizedStation in scaleOnline) {
          setScaleOnline((prev) => ({ ...prev, [normalizedStation]: true }))
        }
        toast.success(res.message || `${stationLabel} is ready at ${trimmedIp}:${numPort}`)
      } else {
        const normalizedStation = stationId.replace(/\D/g, '') as '01' | '02' | '03'
        if (normalizedStation in scaleOnline) {
          setScaleOnline((prev) => ({ ...prev, [normalizedStation]: false }))
        }
        toast.warning(res?.message || `Could not reach ${stationLabel} at ${trimmedIp}:${numPort}`)
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

    const configuredPrinters = Object.entries(form.printers).filter(([, printer]) => printer.ip.trim())
    if (configuredPrinters.some(([, printer]) => Number(printer.port) <= 0 || Number(printer.port) > 65535)) {
      toast.error('Configured thermal printers require a valid TCP port.')
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

    const scales = [form.intake, form.grading, form.packaging]
    if (scales.some((scale) => Number(scale.slaveId) < 1 || Number(scale.slaveId) > 247)) {
      toast.error('Modbus Unit ID must be between 1 and 247.')
      return
    }
    if (scales.some((scale) => Number(scale.weightRegister) < 40001 || Number(scale.weightRegister) > 40030)) {
      toast.error('Weight Start Register must be between 40001 and 40030.')
      return
    }
    if (scales.some((scale) => Number(scale.statusRegister) < 40001 || Number(scale.statusRegister) > 40031)) {
      toast.error('Status Register must be between 40001 and 40031.')
      return
    }

    setSaving(true)
    try {
      // Update backend Modbus TCP configuration for each station
      const scaleUpdates = [
        api.scales.updateConfig('01', {
          host: form.intake.ip.trim(), port: Number(form.intake.port), capacityKg: Number(form.intake.capacityKg),
          unitId: Number(form.intake.slaveId), weightRegister: Number(form.intake.weightRegister), statusRegister: Number(form.intake.statusRegister),
        }),
        api.scales.updateConfig('02', {
          host: form.grading.ip.trim(), port: Number(form.grading.port), capacityKg: Number(form.grading.capacityKg),
          unitId: Number(form.grading.slaveId), weightRegister: Number(form.grading.weightRegister), statusRegister: Number(form.grading.statusRegister),
        }),
        api.scales.updateConfig('03', {
          host: form.packaging.ip.trim(), port: Number(form.packaging.port), capacityKg: Number(form.packaging.capacityKg),
          unitId: Number(form.packaging.slaveId), weightRegister: Number(form.packaging.weightRegister), statusRegister: Number(form.packaging.statusRegister),
        }),
      ]
      const printerUpdates = configuredPrinters.map(([station, printer]) =>
        api.printers.update(station as 'reception' | 'packaging', printer.ip.trim(), Number(printer.port)),
      )
      await Promise.all([...scaleUpdates, ...printerUpdates])

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
    const printer = form.printers[station]
    const ip = (printer.ip || '').trim()
    const port = Number(printer.port) || 9100

    if (!ip) {
      toast.error('Please enter a printer IP address before testing.')
      setTestingTarget(null)
      return
    }

    try {
      const result = await api.printers.test(station, { ip, port })
      setForm((prev) => ({ ...prev, printers: { ...prev.printers, [station]: { ...prev.printers[station], status: result?.online ? 'ONLINE' : 'OFFLINE' } } }))
      if (result?.online) toast.success(`${station === 'reception' ? 'Reception' : 'Packaging'} printer is online at ${ip}:${port}.`)
      else toast.warning(`${station === 'reception' ? 'Reception' : 'Packaging'} printer is offline at ${ip}:${port}.`)
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
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Device Settings</h2>
          <p className="mt-1 text-sm text-muted-foreground">Scale and thermal printer connections.</p>
        </div>
        <div>
          <Badge tone="success" dot live>
            3 Stations · 2 Printers
          </Badge>
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

            <Field label="Modbus Unit ID" htmlFor="intake-slave" hint="Valid range: 1–247">
              <Input
                id="intake-slave"
                type="number"
                min="1"
                max="247"
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

            <Field label="Weight Start Register" htmlFor="intake-reg-weight" required hint="FLOAT32 uses this register and the next word">
              <Input
                id="intake-reg-weight"
                type="number"
                min="40001"
                max="40030"
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

            <Field label="Status Register" htmlFor="intake-reg-status" hint="Firmware default: 40011">
              <Input
                id="intake-reg-status"
                type="number"
                min="40001"
                max="40031"
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

            <Field label="Modbus Unit ID" htmlFor="grading-slave" hint="Valid range: 1–247">
              <Input
                id="grading-slave"
                type="number"
                min="1"
                max="247"
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

            <Field label="Weight Start Register" htmlFor="grading-reg-weight" required hint="FLOAT32 uses this register and the next word">
              <Input
                id="grading-reg-weight"
                type="number"
                min="40001"
                max="40030"
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

            <Field label="Status Register" htmlFor="grading-reg-status" hint="Firmware default: 40011">
              <Input
                id="grading-reg-status"
                type="number"
                min="40001"
                max="40031"
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

            <Field label="Modbus Unit ID" htmlFor="pkg-slave" hint="Valid range: 1–247">
              <Input
                id="pkg-slave"
                type="number"
                min="1"
                max="247"
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

            <Field label="Weight Start Register" htmlFor="pkg-reg-weight" required hint="FLOAT32 uses this register and the next word">
              <Input
                id="pkg-reg-weight"
                type="number"
                min="40001"
                max="40030"
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

            <Field label="Status Register" htmlFor="pkg-reg-status" hint="Firmware default: 40011">
              <Input
                id="pkg-reg-status"
                type="number"
                min="40001"
                max="40031"
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
