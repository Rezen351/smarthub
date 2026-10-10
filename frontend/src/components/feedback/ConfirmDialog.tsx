import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import Button from '../shared/Button'
import Icon from '../shared/Icon'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'accent'
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Two-step confirmation for destructive actions (laporan §9.11).
 * The destructive button is never the default action and the dialog
 * cannot be dismissed by clicking the overlay, so touch-screen
 * operators cannot confirm by accident.
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    confirmRef.current?.focus()
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="dialog-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) return
      }}
    >
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-desc">
        <div className={`dialog-icon ${tone === 'danger' ? 'dialog-icon-danger' : 'dialog-icon-accent'}`}>
          <Icon name={tone === 'danger' ? 'alert' : 'info'} size={18} />
        </div>
        <h2 className="dialog-title" id="dialog-title">
          {title}
        </h2>
        <div className="dialog-desc" id="dialog-desc">
          {description}
        </div>
        <div className="dialog-actions">
          <Button variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
