import { idText } from '@/lib/indonesian'
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
            <span className="context-chip-label">{idText("Farmer")}</span>
            <span className="context-chip-value">{farmer.name}</span>
          </span>
          {pallet?.code && (
            <span className="context-chip">
              <Icon name="pallet" size={14} />
              <span className="context-chip-label">{idText("Pallet")}</span>
              <span className="context-chip-value mono">{idText(pallet.code)}</span>
            </span>
          )}
          {defaultGrade && (
            <span className="context-chip hide-mobile">
              <Icon name="grade" size={14} />
              <span className="context-chip-label">{idText("Default grade")}</span>
              <span className="context-chip-value">{idText(defaultGrade)}</span>
            </span>
          )}
          {offline ? (
            <Badge tone="warning" icon="wifi-off">
              {idText("Offline — not synced")}
            </Badge>
          ) : (
            <Badge tone="accent" dot className="hide-mobile">
              {idText("Session")} {idText(hours)}{idText("h")} {idText(minutes)}{idText("m left")}
            </Badge>
          )}
          <button
            type="button"
            className="context-reset"
            onClick={() => setConfirmOpen(true)}
            aria-label={idText("Reset session context")}
          >
            <Icon name="trash" size={14} />
            {idText("Reset")}
          </button>
        </div>
        <div className="context-progress" aria-hidden="true">
          <div className="context-progress-bar" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        tone="danger"
        title={idText("Reset session context?")}
        description={
          <>
            {idText("Farmer")} <strong>{farmer.name}</strong>
            {pallet?.code ? (
              <>
                {idText(' ')}{idText("and pallet")} <strong>{idText(pallet.code)}</strong>
              </>
            ) : null}{idText(' ')}
            {idText("will be cleared. Any unsaved weighing will be lost.")}
          </>
        }
        confirmLabel="Yes, Reset"
        onConfirm={() => {
          reset()
          setConfirmOpen(false)
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}
