import { useState, useEffect } from 'react'
import Button from './Button'
import Icon from './Icon'
import Badge from './Badge'
import { Field, Input } from './Form'
import { useToast } from '../feedback/Toast'
import { api, type CloseoutDisposition } from '../../services/api'
import { formatWeight } from '../../lib/utils'

interface PalletCloseoutModalProps {
  open: boolean
  palletCode: string
  grade?: string | null
  farmerName?: string | null
  remainingKg: number
  onClose: () => void
  onReleased: (result: { palletCode: string; settledKg: number; disposition: CloseoutDisposition }) => void
}

const DISPOSITION_OPTIONS: Array<{
  value: CloseoutDisposition
  label: string
  description: string
}> = [
  {
    value: 'SHRINKAGE_LOSS',
    label: 'Shrinkage / Scale Loss',
    description: 'Moisture loss, soil, or weighing variance.',
  },
  {
    value: 'LOOSE_RESERVE',
    label: 'Move to Loose Crate',
    description: 'Transfer edible remainder to loose stock.',
  },
  {
    value: 'CULL_REJECT',
    label: 'Quality Reject / Damaged',
    description: 'Bruised or defective potatoes removed.',
  },
  {
    value: 'SAMPLE_USE',
    label: 'Sample / QC Use',
    description: 'Used for quality inspection or testing.',
  },
]

export default function PalletCloseoutModal({
  open,
  palletCode,
  grade,
  farmerName,
  remainingKg,
  onClose,
  onReleased,
}: PalletCloseoutModalProps) {
  const toast = useToast()
  const [disposition, setDisposition] = useState<CloseoutDisposition>('SHRINKAGE_LOSS')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setDisposition(remainingKg >= 0.995 ? 'LOOSE_RESERVE' : 'SHRINKAGE_LOSS')
      setNotes('')
    }
  }, [open, palletCode, remainingKg])

  if (!open || !palletCode) return null

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await api.pallets.release(palletCode, {
        disposition,
        notes: notes.trim(),
      })
      toast.success(res?.message || `Pallet ${palletCode} released for reuse.`)
      onReleased({
        palletCode: res?.palletCode || palletCode,
        settledKg: Number(res?.settledKg ?? remainingKg),
        disposition,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to release pallet.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label={`Close and release pallet ${palletCode}`}
    >
      <div className="bg-card border border-border p-6 shadow-xl max-w-lg w-full space-y-5 animate-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between border-b border-border pb-3 gap-3">
          <div>
            <h3 className="text-lg font-bold text-foreground">Close &amp; Release Pallet</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Record the disposition of remaining weight so this pallet returns to Station 02 Sorting.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-muted-foreground hover:text-foreground p-1 cursor-pointer"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="p-3.5 bg-muted/30 border border-border flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-base text-foreground">{palletCode}</span>
              {grade && <Badge tone="accent">Grade {grade}</Badge>}
            </div>
            {farmerName && <span className="text-xs text-muted-foreground block">Origin: {farmerName}</span>}
          </div>
          <div className="text-right">
            <span className="text-[11px] uppercase font-mono text-muted-foreground block">Remaining Stock</span>
            <span className="font-mono text-xl font-black text-amber-700 dark:text-amber-400">
              {formatWeight(remainingKg)} kg
            </span>
          </div>
        </div>

        <form onSubmit={handleConfirm} className="space-y-4">
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
              Remainder Disposition
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {DISPOSITION_OPTIONS.map((opt) => {
                const selected = disposition === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDisposition(opt.value)}
                    className={`p-3 text-left border transition-colors cursor-pointer ${
                      selected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border bg-card hover:bg-muted/40'
                    }`}
                  >
                    <div className="text-xs font-bold text-foreground">{opt.label}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{opt.description}</div>
                  </button>
                )
              })}
            </div>
          </div>

          <Field label="Notes (Optional)" hint="Recorded in the pallet closeout audit log">
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Transferred remaining tubers to loose crate..."
              disabled={submitting}
            />
          </Field>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" icon="check" loading={submitting}>
              {submitting ? 'Releasing…' : 'Settle & Release Pallet'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

