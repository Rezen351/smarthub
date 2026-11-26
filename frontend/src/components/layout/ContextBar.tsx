import { useState } from 'react'
import Badge from '../shared/Badge'
import Icon from '../shared/Icon'
import ConfirmDialog from '../feedback/ConfirmDialog'
import { SESSION_TTL_MS, useSessionContext } from '../../hooks/useSessionContext'

/**
 * Session context bar (laporan.pdf §9.7).
 * Sticky below the navbar, shows the active farmer / pallet / grade,
 * a thin TTL progress line, and a destructive reset guarded by a dialog.
 */
export default function ContextBar() {
  const { farmer, pallet, defaultGrade, active, remainingMs, offline, reset } = useSessionContext()
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (!active || !farmer) return null

  const progress = Math.max(0, Math.min(100, (remainingMs / SESSION_TTL_MS) * 100))
  const hours = Math.floor(remainingMs / 3600000)
  const minutes = Math.floor((remainingMs % 3600000) / 60000)

  return (
    <>
      <div className="context-bar-wrap">
        <div className={`context-bar ${offline ? 'is-offline' : ''}`} data-testid="context-bar">
          <span className="context-chip">
            <Icon name="user" size={14} />
            <span className="context-chip-label">Petani</span>
            <span className="context-chip-value">{farmer.name}</span>
          </span>
          {pallet?.code && (
            <span className="context-chip">
              <Icon name="pallet" size={14} />
              <span className="context-chip-label">Palet</span>
              <span className="context-chip-value mono">{pallet.code}</span>
            </span>
          )}
          {defaultGrade && (
            <span className="context-chip hide-mobile">
              <Icon name="grade" size={14} />
              <span className="context-chip-label">Grade bawaan</span>
              <span className="context-chip-value">{defaultGrade}</span>
            </span>
          )}
          {offline ? (
            <Badge tone="warning" icon="wifi-off">
              Terputus — belum tersinkron
            </Badge>
          ) : (
            <Badge tone="accent" dot className="hide-mobile">
              Sesi tersisa {hours}j {minutes}m
            </Badge>
          )}
          <button
            type="button"
            className="context-reset"
            onClick={() => setConfirmOpen(true)}
            aria-label="Reset konteks sesi"
          >
            <Icon name="trash" size={14} />
            Reset
          </button>
        </div>
        <div className="context-progress" aria-hidden="true">
          <div className="context-progress-bar" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        tone="danger"
        title="Reset konteks sesi?"
        description={
          <>
            Petani <strong>{farmer.name}</strong>
            {pallet?.code ? (
              <>
                {' '}dan palet <strong>{pallet.code}</strong>
              </>
            ) : null}{' '}
            akan dikosongkan. Penimbangan yang belum disimpan akan hilang.
          </>
        }
        confirmLabel="Ya, Reset"
        onConfirm={() => {
          reset()
          setConfirmOpen(false)
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}
