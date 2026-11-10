import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import Button from '../shared/Button'
import Icon from '../shared/Icon'
import { cn } from '@/lib/utils'

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
 * Two-step confirmation for destructive actions.
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
    if (open) {
      // Focus the confirmation button when dialog opens
      setTimeout(() => confirmRef.current?.focus(), 50)
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="max-w-md p-6">
        <div className="flex flex-col gap-4">
          <div
            className={cn(
              'size-10 rounded-md flex items-center justify-center shrink-0',
              tone === 'danger' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700',
            )}
          >
            <Icon name={tone === 'danger' ? 'alert' : 'info'} size={20} />
          </div>

          <DialogHeader className="text-left space-y-2">
            <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              {description}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex flex-row justify-end gap-2 pt-2">
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
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
