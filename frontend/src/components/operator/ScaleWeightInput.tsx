import { useCallback, useEffect, useMemo, useState } from 'react'
import Badge from '../shared/Badge'
import Button from '../shared/Button'
import { Field, Input } from '../shared/Form'
import Icon from '../shared/Icon'
import { useToast } from '../feedback/Toast'
import { formatWeight } from '../../lib/utils'
import { api } from '../../services/api'

/**
 * Weight input with Auto (live Modbus TCP scale) and Manual modes.
 *
 * Auto mode queries live telemetry via Express gateway /api/scales/:stationId/weight,
 * which reads the actual holding registers (40001-40031) from the Modbus TCP transmitter.
 * Stability bit 0x0010 and hardware Tare/Zero are fully supported.
 */

const MODE_KEY = 'enyx.scale-mode'
const POLL_MS = 600

type Mode = 'auto' | 'manual'
type Connection = 'connected' | 'reconnecting' | 'disconnected'

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
}

function readMode(): Mode {
  try {
    const stored = localStorage.getItem(MODE_KEY)
    return stored === 'auto' || stored === 'manual' ? stored : 'auto'
  } catch {
    return 'auto'
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
}: ScaleWeightInputProps) {
  const [mode, setMode] = useState<Mode>(readMode)
  const [connection, setConnection] = useState<Connection>('connected')
  const [reading, setReading] = useState(0)
  const [scaleAddress, setScaleAddress] = useState(() => {
    if (stationId === '02') return '192.168.1.101:502'
    if (stationId === '03') return '192.168.1.102:502'
    return '192.168.1.100:502'
  })
  const [isStable, setIsStable] = useState(false)
  const [lastReadingAt, setLastReadingAt] = useState(() => new Date())
  const [flash, setFlash] = useState(false)
  const [tarePending, setTarePending] = useState(false)
  const toast = useToast()

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

    let isSubscribed = true
    let isPolling = false
    let timerId: number

    const pollScale = async (): Promise<boolean> => {
      if (isPolling || !isSubscribed) return false
      isPolling = true
      try {
        const res = await api.scales.getWeight(stationId)
        if (!isSubscribed) return false

        if (res && res.data) {
          const telemetry = res.data
          setReading(telemetry.weightKg ?? 0)
          setIsStable(Boolean(telemetry.isStable))
          setScaleAddress(`${telemetry.ip}:${telemetry.port}`)
          setConnection(telemetry.online ? 'connected' : 'reconnecting')
          setLastReadingAt(new Date(telemetry.timestamp || Date.now()))
          return true
        }
        return false
      } catch {
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
  }, [mode, stationId])

  const numericValue = Number(value)
  const withinTarget =
    targetKg !== undefined && Number.isFinite(numericValue) && Math.abs(numericValue - targetKg) <= toleranceKg
  const overCapacity = Number.isFinite(numericValue) && numericValue > capacityKg
  const invalid = Boolean(error) || overCapacity || (value !== '' && !(numericValue > 0))

  const useReading = useCallback(() => {
    onChange(formatKg(reading))
    toast.success(`Weight locked at ${formatKg(reading)} kg`)
    setFlash(true)
    setTimeout(() => setFlash(false), 500)
  }, [onChange, reading, toast])

  const remaining = useMemo(() => {
    if (targetKg === undefined) return null
    return Number((targetKg - numericValue).toFixed(3))
  }, [numericValue, targetKg])

  /* Hardware Tare via Modbus TCP */
  const handleTare = useCallback(async () => {
    setTarePending(true)
    try {
      await api.scales.tare(stationId)
      toast.success('Scale tared via Modbus TCP (offset zeroed)')
    } catch (err: any) {
      toast.error('Tare command failed: ' + (err.message || 'Scale unreachable'))
    } finally {
      setTarePending(false)
    }
  }, [stationId, toast])

  /* Hardware Zero via Modbus TCP */
  const handleZero = useCallback(async () => {
    try {
      await api.scales.zero(stationId)
      toast.success('Scale zeroed via Modbus TCP')
    } catch (err: any) {
      toast.error('Zero command failed: ' + (err.message || 'Scale unreachable'))
    }
  }, [stationId, toast])

  return (
    <div className="stack-md">
      <div className="radio-row" role="group" aria-label="Weight input mode">
        <label className={`radio-card ${mode === 'auto' ? 'is-active' : ''}`}>
          <input
            type="radio"
            name={`${id}-mode`}
            value="auto"
            checked={mode === 'auto'}
            onChange={() => setMode('auto')}
          />
          <Icon name="flash" size={15} />
          Auto (Modbus TCP)
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
          Manual Keypad
        </label>
      </div>

      {mode === 'auto' ? (
        <div className="scale-panel">
          <div className={`scale-readout ${isStable ? 'is-stable' : ''}`} aria-live="polite">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="t-caption" style={{ opacity: 0.75 }}>
                  Modbus TCP Telemetry · Station {stationId}
                </p>
                <p className="scale-value">
                  {formatKg(reading)}
                  <span className="scale-unit">kg</span>
                </p>
              </div>
              <div className="stack stack-xs" style={{ alignItems: 'flex-end' }}>
                <Badge
                  tone={connection === 'connected' ? 'success' : connection === 'reconnecting' ? 'warning' : 'neutral'}
                  dot
                  live={connection === 'connected'}
                >
                  {connection === 'connected' ? 'Modbus Online' : connection === 'reconnecting' ? 'Reconnecting' : 'Offline'}
                </Badge>
                <span className="t-caption mono font-bold" style={{ opacity: 0.85 }}>
                  {scaleAddress}
                </span>
                <span className="t-caption" style={{ opacity: 0.7 }}>
                  Updated {lastReadingAt.toLocaleTimeString('en-GB')}
                </span>
              </div>
            </div>
            <div className="scale-meta">
              <span className="flex items-center gap-1">
                <Icon name={isStable ? 'check-circle' : 'refresh'} size={13} />
                {isStable ? 'Weight Stable (Bit 0x0010)' : 'Reading settling…'}
              </span>
              <span>Max Capacity {capacityKg} kg</span>
            </div>
          </div>

          <div className="scale-body">
            {targetKg !== undefined && (
              <div className="stack-xs">
                <div className="scale-target">
                  Target <strong>{targetKg} kg</strong>
                  <span>
                    tolerance ±{toleranceKg * 1000} g
                  </span>
                  {remaining !== null && remaining > 0 && (
                    <span className="mono">· remaining {remaining} kg</span>
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

            <div className="flex gap-2 flex-wrap items-center">
              <Button variant="primary" icon="check" disabled={!isStable} onClick={useReading}>
                Lock & Use Value
              </Button>
              <Button
                variant="outline"
                icon="scale"
                disabled={tarePending || connection !== 'connected'}
                onClick={handleTare}
              >
                Tare (Offset)
              </Button>
              <Button
                variant="ghost"
                icon="refresh"
                disabled={connection !== 'connected'}
                onClick={handleZero}
              >
                Zero
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Field
          label={label}
          htmlFor={id}
          hint={hint ?? 'Type the weight shown on the scale indicator.'}
          error={error ?? (overCapacity ? `Weight exceeds scale capacity of ${capacityKg} kg.` : undefined)}
        >
          <Input
            id={id}
            type="number"
            inputMode="decimal"
            step="0.001"
            min="0"
            max={capacityKg}
            className="input-lg"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="0"
            invalid={invalid}
            required
          />
        </Field>
      )}

      {mode === 'auto' && (
        <Field
          label={label}
          htmlFor={id}
          hint={hint ?? 'Locked from the live Modbus TCP scale reading, or edit manually.'}
          error={error ?? (overCapacity ? `Weight exceeds scale capacity of ${capacityKg} kg.` : undefined)}
        >
          <Input
            id={id}
            type="number"
            inputMode="decimal"
            step="0.001"
            min="0"
            max={capacityKg}
            className={`input-lg ${flash ? 'scale-flash' : ''}`}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="0"
            invalid={invalid}
          />
        </Field>
      )}
    </div>
  )
}
