import { weightInputValue } from '../../lib/weightFormat'
import { idText } from '@/lib/indonesian'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Badge from '../shared/Badge'
import Button from '../shared/Button'
import { Field, Input } from '../shared/Form'
import Icon from '../shared/Icon'
import { useToast } from '../feedback/Toast'
import { formatWeight } from '../../lib/utils'
import { api } from '../../services/api'
import { ReceptionWeightCapture } from '../../lib/receptionSession'

/**
 * Weight input with Auto (live Modbus TCP scale) and Manual modes.
 *
 * Auto mode queries live telemetry via the Go gateway /api/scales/:stationId/weight,
 * which reads the actual holding registers (40001-40031) from the Modbus TCP transmitter.
 * Stability bit 0x0010 and hardware Tare/Zero are fully supported.
 */

const MODE_KEY = 'smartgeulis.scale-mode'
const SETTINGS_STORAGE_KEY = 'smarthub_settings'
const POLL_MS = 600

type Mode = 'auto' | 'manual'
type Connection = 'connected' | 'reconnecting' | 'disconnected'
type ReadingSource = 'stable' | 'instantaneous'

interface ScaleWeightInputProps {
  id?: string
  stationId?: '01' | '02' | '03' | string
  label?: string
  hint?: string
  error?: string
  value: string
  onChange: (value: string) => void
  /** Pouch target, e.g. 1 kg. */
  targetKg?: number
  toleranceKg?: number
  capacityKg?: number
  maxAllowedWeightKg?: number
  allowZero?: boolean
  autoFill?: boolean
  autoFillPaused?: boolean
}

function readMode(): Mode {
  try {
    const stored = localStorage.getItem(MODE_KEY)
    return stored === 'auto' || stored === 'manual' ? stored : 'auto'
  } catch {
    return 'auto'
  }
}

function readReadingSource(stationId: string): ReadingSource {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!stored) return 'instantaneous'

    const settings = JSON.parse(stored)
    const stationKey = stationId === '02' ? 'grading' : stationId === '03' ? 'packaging' : 'intake'
    return String(settings?.[stationKey]?.weightRegister) === '40003' ? 'stable' : 'instantaneous'
  } catch {
    return 'instantaneous'
  }
}

function formatKg(value: number) {
  return formatWeight(value)
}

export default function ScaleWeightInput({
  id = 'weight',
  stationId = '01',
  label = 'Weight (kg)',
  hint,
  error,
  value,
  onChange,
  targetKg,
  toleranceKg = 0.005,
  capacityKg = 150,
  maxAllowedWeightKg,
  allowZero = false,
  autoFill = false,
  autoFillPaused = false,
}: ScaleWeightInputProps) {
  const [mode, setMode] = useState<Mode>(readMode)
  const [connection, setConnection] = useState<Connection>('reconnecting')
  const [instantaneousReading, setInstantaneousReading] = useState(0)
  const [stableReading, setStableReading] = useState(0)
  const [isStable, setIsStable] = useState(true)
  const [lastReadingAt, setLastReadingAt] = useState(() => new Date())
  const [captured, setCaptured] = useState(false)
  const [tarePending, setTarePending] = useState(false)
  const toast = useToast()
  const automatic = useRef(new ReceptionWeightCapture())
  const [waitingForEmpty, setWaitingForEmpty] = useState(true)
  const current = useRef({ value, onChange, capacityKg, autoFillPaused })
  current.current = { value, onChange, capacityKg, autoFillPaused }

  useEffect(() => {
    automatic.current = new ReceptionWeightCapture()
    setWaitingForEmpty(true)
  }, [mode, autoFillPaused])

  /* Persist the chosen mode per station (session-level preference). */
  useEffect(() => {
    try {
      localStorage.setItem(MODE_KEY, mode)
    } catch {
      /* storage unavailable — mode stays in memory */
    }
    if (mode === 'manual') setConnection('disconnected')
  }, [mode])

  /* Live Modbus TCP Telemetry Polling */
  useEffect(() => {
    if (mode !== 'auto') return
    setConnection('reconnecting')

    let isSubscribed = true
    let isPolling = false
    let timerId: number

    const pollScale = async (): Promise<boolean> => {
      if (isPolling || !isSubscribed) return false
      isPolling = true
      try {
        const res = await api.scales.getWeight(stationId)
        if (!isSubscribed) return false

        const telemetry = (res as any)?.data ?? res
        if (telemetry && typeof telemetry === 'object') {
          const liveWeight = Number(telemetry.weightKg ?? telemetry.weight ?? 0)
          const liveStableWeight = Number(telemetry.stableWeightKg ?? liveWeight)
          setInstantaneousReading(liveWeight)
          setStableReading(liveStableWeight)
          setIsStable(telemetry.isStable !== undefined ? Boolean(telemetry.isStable) : true)
          setConnection(telemetry.online !== false ? 'connected' : 'reconnecting')
          setLastReadingAt(new Date(telemetry.timestamp || Date.now()))
          if (autoFill && !current.current.autoFillPaused && !current.current.value) {
            let tolerance = 20
            try {
              tolerance = Number(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}')?.intake?.stabilityGrams) || 20
            } catch { /* Use the Reception stability default. */ }
            const filled = automatic.current.accept({ ...telemetry, weightKg: liveWeight }, current.current.capacityKg, tolerance)
            setWaitingForEmpty(automatic.current.waitingForEmpty)
            if (filled !== null) {
              current.current.onChange(String(filled))
              setCaptured(true)
            }
          }
          return true
        }
        automatic.current.disconnect()
        setWaitingForEmpty(true)
        return false
      } catch {
        automatic.current.disconnect()
        if (isSubscribed) setWaitingForEmpty(true)
        if (isSubscribed) {
          setConnection('reconnecting')
        }
        return false
      } finally {
        isPolling = false
      }
    }

    const scheduleNext = (delayMs: number) => {
      if (!isSubscribed) return
      timerId = window.setTimeout(async () => {
        const ok = await pollScale()
        scheduleNext(ok ? POLL_MS : 1500)
      }, delayMs)
    }

    // Immediate first poll, then schedule
    pollScale().then((ok) => scheduleNext(ok ? POLL_MS : 1500))

    return () => {
      isSubscribed = false
      window.clearTimeout(timerId)
    }
  }, [mode, stationId, autoFill])

  const readingSource = readReadingSource(stationId)
  const reading = readingSource === 'stable' ? stableReading : instantaneousReading
  const numericValue = Number(value)

  // Other stations use explicit capture; Reception can fill the field automatically.
  useEffect(() => {
    if (!value) setCaptured(false)
  }, [value])
  const withinTarget =
    targetKg !== undefined && Number.isFinite(numericValue) && Math.abs(numericValue - targetKg) <= toleranceKg
  const overCapacity = Number.isFinite(numericValue) && numericValue > capacityKg
  const exceedsMaxAllowed =
    maxAllowedWeightKg !== undefined && Number.isFinite(numericValue) && numericValue > maxAllowedWeightKg + 0.0005
  const readingExceedsMax =
    maxAllowedWeightKg !== undefined && Number.isFinite(reading) && reading > maxAllowedWeightKg + 0.0005

  const effectiveError = error ?? (
    overCapacity
      ? `Weight exceeds scale capacity of ${capacityKg} kg.`
      : exceedsMaxAllowed
      ? `Weight (${formatKg(numericValue)} kg) exceeds pallet remaining stock (${formatKg(maxAllowedWeightKg)} kg).`
      : undefined
  )

  const invalid =
    Boolean(effectiveError) ||
    (value !== '' && (allowZero ? !(numericValue >= 0) : !(numericValue > 0)))

  const useReading = useCallback(() => {
    if (reading < 0 || (!allowZero && reading <= 0) || reading > capacityKg) {
      toast.error('Place potatoes on the scale to read a valid weight.')
      return
    }
    if (maxAllowedWeightKg !== undefined && reading > maxAllowedWeightKg + 0.0005) {
      toast.error(
        `Scale reading (${formatKg(reading)} kg) exceeds remaining capacity (${formatKg(maxAllowedWeightKg)} kg).`,
      )
      return
    }
    onChange(weightInputValue(reading))
    setCaptured(true)
    toast.success(`Weight captured: ${formatKg(reading)} kg`)
  }, [allowZero, capacityKg, maxAllowedWeightKg, onChange, reading, toast])

  const remaining = useMemo(() => {
    if (targetKg === undefined) return null
    return Number((targetKg - numericValue).toFixed(3))
  }, [numericValue, targetKg])

  /* Hardware Tare via Modbus TCP */
  const handleTare = useCallback(async () => {
    setTarePending(true)
    try {
      await api.scales.tare(stationId)
      toast.success('Scale cleared and ready.')
    } catch (err: any) {
      toast.error('Could not clear the scale: ' + (err.message || 'Scale unavailable'))
    } finally {
      setTarePending(false)
    }
  }, [stationId, toast])

  /* Hardware Zero via Modbus TCP */
  const handleZero = useCallback(async () => {
    try {
      await api.scales.zero(stationId)
      toast.success('Scale set to zero.')
    } catch (err: any) {
      toast.error('Could not set the scale to zero: ' + (err.message || 'Scale unavailable'))
    }
  }, [stationId, toast])

  return (
    <div className="stack-md">
      <div className="radio-row" role="group" aria-label={idText("Weight input mode")}>
        <label className={`radio-card ${mode === 'auto' ? 'is-active' : ''}`}>
          <input
            type="radio"
            name={`${id}-mode`}
            value="auto"
            checked={mode === 'auto'}
            onChange={() => setMode('auto')}
          />
          <Icon name="flash" size={15} />
          {idText("Live Scale")}
        </label>
        <label className={`radio-card ${mode === 'manual' ? 'is-active' : ''}`}>
          <input
            type="radio"
            name={`${id}-mode`}
            value="manual"
            checked={mode === 'manual'}
            onChange={() => setMode('manual')}
          />
          <Icon name="edit" size={15} />
          {idText("Manual Keypad")}
        </label>
      </div>

      {mode === 'auto' ? (
        <div className="scale-panel">
          <div className={`scale-readout ${isStable ? 'is-stable' : ''}`} aria-live="polite">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="t-caption" style={{ opacity: 0.75 }}>
                  {idText("Live Weight · Station")} {idText(stationId)}
                </p>
                <p className="scale-value">
                  {idText(connection === 'connected' ? formatKg(reading) : '—')}
                  <span className="scale-unit">{idText("kg")}</span>
                </p>
              </div>
              <div className="stack stack-xs" style={{ alignItems: 'flex-end' }}>
                <Badge
                  tone={connection === 'connected' ? 'success' : connection === 'reconnecting' ? 'warning' : 'neutral'}
                  dot
                  live={connection === 'connected'}
                >
                  {idText(connection === 'connected' ? 'Scale Online' : 'Scale Offline')}
                </Badge>
                <span className="t-caption mono font-bold" style={{ opacity: 0.85 }}>
                  {idText("Station")} {idText(stationId)}
                </span>
                <span className="t-caption" style={{ opacity: 0.7 }}>
                  {idText("Updated")} {idText(lastReadingAt.toLocaleTimeString('id-ID'))}
                </span>
              </div>
            </div>
            <div className="scale-meta">
              <span className="flex items-center gap-1">
                <Icon name={isStable ? 'check-circle' : 'refresh'} size={13} />
                {idText(connection !== 'connected' ? 'Waiting for scale' : isStable ? 'Weight Stable' : 'Reading settling…')}
              </span>
              <span>{idText("Maximum Load")} {idText(capacityKg)} {idText("kg")}</span>
            </div>
          </div>

          <div className="scale-body">
            {targetKg !== undefined && (
              <div className="stack-xs">
                <div className="scale-target">
                  {idText("Target")} <strong>{idText(targetKg)} {idText("kg")}</strong>
                  <span>
                    {idText("tolerance ±")}{idText(toleranceKg * 1000)} {idText("g")}
                  </span>
                  {remaining !== null && remaining > 0 && (
                    <span className="mono">{idText("· remaining")} {idText(remaining)} {idText("kg")}</span>
                  )}
                </div>
                <div className="progress-track">
                  <div
                    className={`progress-fill ${withinTarget ? '' : numericValue > targetKg ? 'is-danger' : ''}`}
                    style={{ width: `${Math.min(100, (numericValue / targetKg) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {readingExceedsMax && (
              <div className="p-2.5 bg-destructive/10 border border-destructive/30 rounded text-xs text-destructive font-semibold">
                {idText("Scale reading (")}{idText(formatKg(reading))} {idText("kg) exceeds remaining pallet stock (")}{idText(formatKg(maxAllowedWeightKg))} {idText("kg).")}
              </div>
            )}

            <div className="flex gap-2 flex-wrap items-center">
              {!autoFill && <Button
                variant="primary"
                icon="check"
                disabled={
                  connection !== 'connected' ||
                  !isStable ||
                  !Number.isFinite(reading) ||
                  (!allowZero && reading <= 0) ||
                  reading < 0 ||
                  reading > capacityKg ||
                  readingExceedsMax
                }
                onClick={useReading}
                title={
                  idText(readingExceedsMax
                    ? `Cannot capture: Scale reading exceeds pallet stock (${formatKg(maxAllowedWeightKg)} kg)`
                    : undefined)
                }
              >
                {idText("Capture Weight")}
              </Button>}
              {!autoFill && <Button
                variant="outline"
                icon="scale"
                disabled={tarePending || connection !== 'connected'}
                onClick={handleTare}
              >
                {idText("Tare (Offset)")}
              </Button>}
              <Button
                variant="ghost"
                icon="refresh"
                disabled={connection !== 'connected'}
                onClick={handleZero}
              >
                {idText("Zero")}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Field
          label={idText(label)}
          htmlFor={id}
          hint={idText(hint ?? 'Type the weight shown on the scale indicator.')}
          error={effectiveError}
        >
          <Input
            id={id}
            type="number"
            inputMode="decimal"
            step="0.001"
            min="0"
            max={maxAllowedWeightKg ?? capacityKg}
            className="input-lg"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={idText("0")}
            invalid={invalid}
            required
          />
        </Field>
      )}

      {mode === 'auto' && (
        <Field
          label={idText(label ? `Captured ${label}` : 'Captured Weight (kg)')}
          htmlFor={id}
          hint={autoFill ? (autoFillPaused ? 'Paused' : value ? 'Ready to assign.' : waitingForEmpty ? 'Clear the scale.' : 'Waiting for stable weight.') : idText(captured || numericValue > 0 ? 'This weight will be saved. Capture again to update it.' : 'Wait for a stable reading, then select Capture Weight.')}
          error={effectiveError}
        >
          <Input
            id={id}
            type="number"
            inputMode="decimal"
            step="0.001"
            min="0"
            max={maxAllowedWeightKg ?? capacityKg}
            className="input-lg"
            value={value}
            readOnly
            placeholder={idText("0")}
            invalid={invalid}
          />
        </Field>
      )}
    </div>
  )
}
