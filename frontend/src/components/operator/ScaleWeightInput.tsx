import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Badge from '../shared/Badge'
import Button from '../shared/Button'
import { Field, Input } from '../shared/Form'
import Icon from '../shared/Icon'
import { useToast } from '../feedback/Toast'
import { formatWeight } from '../../lib/utils'

/**
 * Weight input with Auto (live scale) and Manual modes — laporan.pdf §9.6.
 *
 * Auto mode renders a large live readout (refresh ±250 ms), detects stability
 * (±20 g held for ±2 s), shows the scale address and connection state, and
 * falls back to manual input when the reading times out. Manual mode is a
 * plain numeric field with a numeric keypad.
 *
 * Backend Modbus TCP polling is out of scope for the UI; the live reading is
 * simulated locally until the scale API is connected.
 */

const MODE_KEY = 'enyx.scale-mode'
const POLL_MS = 250
const STABILITY_THRESHOLD_KG = 0.02
const STABILITY_WINDOW_MS = 2000
const SCALE_ADDRESS = '192.168.1.50:502'

type Mode = 'auto' | 'manual'
type Connection = 'connected' | 'reconnecting' | 'disconnected'

interface ScaleWeightInputProps {
  id?: string
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
  const [stableSince, setStableSince] = useState<number | null>(null)
  const [lastReadingAt, setLastReadingAt] = useState(() => new Date())
  const [flash, setFlash] = useState(false)
  const simulatedTarget = useRef(0)
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

  /* Simulated live scale reading: converges toward a weight on the platform. */
  useEffect(() => {
    if (mode !== 'auto') return
    setConnection('connected')
    if (simulatedTarget.current === 0) {
      simulatedTarget.current = Number((Math.random() * 12 + 1).toFixed(3))
    }

    let failWindow = 0
    const timer = window.setInterval(() => {
      const drift = (Math.random() - 0.5) * 0.06
      setReading((current) => {
        const next = Math.max(0, current + (simulatedTarget.current - current) * 0.08 + drift)
        return Number(next.toFixed(3))
      })
      setLastReadingAt(new Date())
      failWindow += 1
    }, POLL_MS)

    /* Timeout watchdog: if no reading arrives, fall back to manual. */
    const watchdog = window.setTimeout(() => {
      window.clearInterval(timer)
      setConnection('disconnected')
      toast.warning('Scale not responding. Switch to Manual mode to continue.')
    }, 60000)

    return () => {
      window.clearInterval(timer)
      window.clearTimeout(watchdog)
    }
  }, [mode, toast])

  /* Stability detection */
  useEffect(() => {
    if (mode !== 'auto') return
    const stable = Math.abs(reading - simulatedTarget.current) < STABILITY_THRESHOLD_KG
    if (!stable) {
      setStableSince(null)
      return
    }
    const started = stableSince ?? Date.now()
    if (started !== stableSince) setStableSince(started)
    if (Date.now() - started >= STABILITY_WINDOW_MS) setFlash(true)
  }, [reading, mode, stableSince])

  const isStable =
    mode === 'auto' &&
    connection === 'connected' &&
    stableSince !== null &&
    Date.now() - stableSince >= STABILITY_WINDOW_MS

  const numericValue = Number(value)
  const withinTarget =
    targetKg !== undefined && Number.isFinite(numericValue) && Math.abs(numericValue - targetKg) <= toleranceKg
  const overCapacity = Number.isFinite(numericValue) && numericValue > capacityKg
  const invalid = Boolean(error) || overCapacity || (value !== '' && !(numericValue > 0))

  const useReading = useCallback(() => {
    onChange(formatKg(reading))
    toast.success(`Weight locked at ${formatKg(reading)} kg`)
    setFlash(false)
  }, [onChange, reading, toast])

  const remaining = useMemo(() => {
    if (targetKg === undefined) return null
    return Number((targetKg - numericValue).toFixed(3))
  }, [numericValue, targetKg])

  const setPlatformWeight = useCallback(() => {
    simulatedTarget.current = Number((Math.random() * 40 + 5).toFixed(3))
    setReading(simulatedTarget.current)
    setStableSince(null)
    setFlash(false)
  }, [])

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
          Auto
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
          Manual
        </label>
      </div>

      {mode === 'auto' ? (
        <div className="scale-panel">
          <div className={`scale-readout ${isStable ? 'is-stable' : ''}`} aria-live="polite">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="t-caption" style={{ opacity: 0.75 }}>
                  Live reading
                </p>
                <p className="scale-value">
                  {formatKg(reading)}
                  <span className="scale-unit">kg</span>
                </p>
              </div>
              <div className="stack stack-xs" style={{ alignItems: 'flex-end' }}>
                <Badge tone={connection === 'connected' ? 'success' : connection === 'reconnecting' ? 'warning' : 'neutral'} dot live={connection === 'connected'}>
                  {connection === 'connected' ? 'Live' : connection === 'reconnecting' ? 'Reconnecting' : 'No signal'}
                </Badge>
                <span className="t-caption mono" style={{ opacity: 0.7 }}>
                  {SCALE_ADDRESS}
                </span>
                <span className="t-caption" style={{ opacity: 0.7 }}>
                  Updated {lastReadingAt.toLocaleTimeString('en-GB')}
                </span>
              </div>
            </div>
            <div className="scale-meta">
              <span className="flex items-center gap-1">
                <Icon name={isStable ? 'check-circle' : 'refresh'} size={13} />
                {isStable ? 'Stable value' : 'Waiting for stable value…'}
              </span>
              <span>±{STABILITY_THRESHOLD_KG * 1000} g / {STABILITY_WINDOW_MS / 1000} s</span>
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

            <div className="flex gap-2 flex-wrap">
              <Button variant="primary" icon="check" disabled={!isStable} onClick={useReading}>
                Use This Value
              </Button>
              <Button variant="outline" icon="refresh" onClick={setPlatformWeight}>
                Simulate Load
              </Button>
              <Button variant="ghost" onClick={() => setMode('manual')}>
                Switch to Manual
              </Button>
            </div>

            <p className="field-hint">
              {connection === 'connected'
                ? 'Reading locks into the weight field once the value is stable.'
                : 'Scale unreachable — enter the weight manually or check the connection.'}
            </p>
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
          hint={hint ?? 'Locked from the live scale reading, or edit manually.'}
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
