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
  hideTare?: boolean
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
  label = 'Berat (kg)',
  hint,
  error,
  value,
  onChange,
  targetKg,
  toleranceKg = 0.005,
  capacityKg = 150,
  maxAllowedWeightKg,
  allowZero = false,
}: ScaleWeightInputProps) {
  const [mode, setMode] = useState<Mode>(readMode)
  const [connection, setConnection] = useState<Connection>('reconnecting')
  const [instantaneousReading, setInstantaneousReading] = useState(0)
  const [stableReading, setStableReading] = useState(0)
  const [isStable, setIsStable] = useState(true)
  const [lastReadingAt, setLastReadingAt] = useState(() => new Date())
  const [captured, setCaptured] = useState(false)
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

  const readingSource = readReadingSource(stationId)
  const reading = readingSource === 'stable' ? stableReading : instantaneousReading
  const numericValue = Number(value)

  // A live reading becomes a form value only after explicit capture.
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
      ? `Berat melebihi kapasitas timbangan ${capacityKg} kg.`
      : exceedsMaxAllowed
      ? `Berat (${formatKg(numericValue)} kg) melebihi sisa stok palet (${formatKg(maxAllowedWeightKg)} kg).`
      : undefined
  )

  const invalid =
    Boolean(effectiveError) ||
    (value !== '' && (allowZero ? !(numericValue >= 0) : !(numericValue > 0)))

  const useReading = useCallback(() => {
    if (reading < 0 || (!allowZero && reading <= 0) || reading > capacityKg) {
      toast.error('Letakkan kentang di timbangan untuk membaca berat yang valid.')
      return
    }
    if (maxAllowedWeightKg !== undefined && reading > maxAllowedWeightKg + 0.0005) {
      toast.error(
        `Pembacaan timbangan (${formatKg(reading)} kg) melebihi sisa kapasitas (${formatKg(maxAllowedWeightKg)} kg).`,
      )
      return
    }
    onChange(formatKg(reading))
    setCaptured(true)
    toast.success(`Berat diambil: ${formatKg(reading)} kg`)
  }, [allowZero, capacityKg, maxAllowedWeightKg, onChange, reading, toast])

  const remaining = useMemo(() => {
    if (targetKg === undefined) return null
    return Number((targetKg - numericValue).toFixed(3))
  }, [numericValue, targetKg])

  return (
    <div className="stack-md">
      <div className="radio-row" role="group" aria-label="Mode input berat">
        <label className={`radio-card ${mode === 'auto' ? 'is-active' : ''}`}>
          <input
            type="radio"
            name={`${id}-mode`}
            value="auto"
            checked={mode === 'auto'}
            onChange={() => setMode('auto')}
          />
          <Icon name="flash" size={15} />
          Timbangan Langsung
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
          Input Manual
        </label>
      </div>

      {mode === 'auto' ? (
        <div className="scale-panel">
          <div className={`scale-readout ${isStable ? 'is-stable' : ''}`} aria-live="polite">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="t-caption" style={{ opacity: 0.75 }}>
                  Berat Langsung · Stasiun {stationId}
                </p>
                <p className="scale-value">
                  {connection === 'connected' ? formatKg(reading) : '—'}
                  <span className="scale-unit">kg</span>
                </p>
              </div>
              <div className="stack stack-xs" style={{ alignItems: 'flex-end' }}>
                <Badge
                  tone={connection === 'connected' ? 'success' : connection === 'reconnecting' ? 'warning' : 'neutral'}
                  dot
                  live={connection === 'connected'}
                >
                  {connection === 'connected' ? 'Timbangan Terhubung' : 'Timbangan Terputus'}
                </Badge>
                <span className="t-caption mono font-bold" style={{ opacity: 0.85 }}>
                  Stasiun {stationId}
                </span>
                <span className="t-caption" style={{ opacity: 0.7 }}>
                  Diperbarui {lastReadingAt.toLocaleTimeString('id-ID')}
                </span>
              </div>
            </div>
            <div className="scale-meta">
              <span className="flex items-center gap-1">
                <Icon name={isStable ? 'check-circle' : 'refresh'} size={13} />
                {connection !== 'connected' ? 'Menunggu timbangan' : isStable ? 'Berat Stabil' : 'Menstabilkan…'}
              </span>
              <span>Beban Maksimum {capacityKg} kg</span>
            </div>
          </div>

          <div className="scale-body">
            {targetKg !== undefined && (
              <div className="stack-xs">
                <div className="scale-target">
                  Target <strong>{targetKg} kg</strong>
                  <span>
                    toleransi ±{toleranceKg * 1000} g
                  </span>
                  {remaining !== null && remaining > 0 && (
                    <span className="mono">· sisa {remaining} kg</span>
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
                Pembacaan timbangan ({formatKg(reading)} kg) melebihi sisa stok palet ({formatKg(maxAllowedWeightKg)} kg).
              </div>
            )}

            <div className="flex gap-2 flex-wrap items-center">
              <Button
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
                  readingExceedsMax
                    ? `Tidak dapat mengambil: Pembacaan timbangan melebihi stok palet (${formatKg(maxAllowedWeightKg)} kg)`
                    : undefined
                }
              >
                Ambil Berat
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Field
          label={label}
          htmlFor={id}
          hint={hint ?? 'Ketik berat yang tampil pada indikator timbangan.'}
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
            placeholder="0"
            invalid={invalid}
            required
          />
        </Field>
      )}

      {mode === 'auto' && (
        <Field
          label={label ? `${label} Terambil` : 'Berat Terambil (kg)'}
          htmlFor={id}
          hint={captured || numericValue > 0 ? 'Berat ini akan disimpan. Ambil ulang untuk memperbarui.' : 'Tunggu pembacaan stabil, lalu pilih Ambil Berat.'}
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
            placeholder="0"
            invalid={invalid}
          />
        </Field>
      )}
    </div>
  )
}
