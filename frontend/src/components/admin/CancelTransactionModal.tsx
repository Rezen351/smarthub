import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import Button from '../shared/Button'
import Icon from '../shared/Icon'
import { api } from '@/services/api'
import { useToast } from '../feedback/Toast'

interface CancelTransactionModalProps {
  open: boolean
  waringCode?: string
  waringId?: string
  farmerName?: string
  onClose: () => void
  onSuccess: () => void
}

export default function CancelTransactionModal({
  open,
  waringCode,
  waringId,
  farmerName,
  onClose,
  onSuccess,
}: CancelTransactionModalProps) {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('')
  const [inspectionData, setInspectionData] = useState<any | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setInspectionData(null)
      setErrorMsg(null)
      setReason('')
      return
    }

    if (waringCode || waringId) {
      setLoading(true)
      api.admin
        .inspectTransaction({ waringCode, waringId })
        .then((items) => {
          if (Array.isArray(items) && items.length > 0) {
            setInspectionData(items[0])
          } else {
            setErrorMsg('Data transaksi tidak ditemukan.')
          }
        })
        .catch((err) => {
          setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat rincian transaksi.')
        })
        .finally(() => setLoading(false))
    }
  }, [open, waringCode, waringId])

  const handleConfirmCancel = async () => {
    setCancelling(true)
    try {
      const res = await api.admin.cancelTransaction({
        waringCode: waringCode || inspectionData?.waringCode,
        waringId: waringId || inspectionData?.waringId,
        reason: reason.trim() || 'Pembatalan transaksi oleh Admin',
      })
      toast.success(res?.message || 'Transaksi berhasil dibatalkan.')
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal membatalkan transaksi.')
    } finally {
      setCancelling(false)
    }
  }

  const canCancel = inspectionData ? inspectionData.canCancel : true

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 border-b border-border pb-3">
            <div className="size-10 rounded-none bg-destructive/15 text-destructive flex items-center justify-center shrink-0 border border-destructive/30">
              <Icon name="alert-triangle" size={20} />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Batalkan & Hapus Transaksi
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground font-mono">
                {waringCode || inspectionData?.waringCode || 'Waring Penerimaan'}
              </DialogDescription>
            </div>
          </div>

          {loading ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-muted-foreground text-xs font-mono">
              <span className="inline-block animate-spin">⏳</span>
              <span>Memeriksa keterhubungan data transaksi…</span>
            </div>
          ) : errorMsg ? (
            <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs">
              {errorMsg}
            </div>
          ) : (
            <div className="space-y-3 text-xs">
              <div className="bg-muted/30 p-3 border border-border space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Petani:</span>
                  <span className="font-semibold text-foreground">
                    {inspectionData?.farmerName || farmerName || '-'} ({inspectionData?.farmerCode || '-'})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bobot Bruto / Neto:</span>
                  <span className="font-semibold text-foreground">
                    {inspectionData?.grossWeightKg?.toFixed(2) ?? '-'} kg / {inspectionData?.netWeightKg?.toFixed(2) ?? '-'} kg
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status Alur:</span>
                  <span className="font-bold text-primary">
                    {inspectionData?.status === 'SORTED' ? 'SUDAH DISORTASI' : 'BELUM DISORTASI (PENERIMAAN)'}
                  </span>
                </div>
              </div>

              {/* Connected Data Cleanup Details */}
              <div className="border border-border p-3 space-y-2 bg-card">
                <span className="font-semibold uppercase tracking-wider text-[11px] text-muted-foreground block">
                  Dampak Pembatalan Transaksi:
                </span>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>
                    Data waring <strong className="text-foreground">{waringCode || inspectionData?.waringCode}</strong> akan dihapus permanen.
                  </li>
                  {inspectionData?.hasSortingBatch && (
                    <>
                      <li>
                        Data sortasi terkait ({((inspectionData.gradeAKg || 0) + (inspectionData.gradeBKg || 0) + (inspectionData.gradeCKg || 0)).toFixed(1)} kg) akan dihapus.
                      </li>
                      {inspectionData?.linkedPalletCodes?.length > 0 && (
                        <li>
                          Palet fisik <strong className="text-foreground">{inspectionData.linkedPalletCodes.join(', ')}</strong> akan{' '}
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">DIRESET ke status TERSEDIA</span>.
                        </li>
                      )}
                      {inspectionData?.packageUnitsCount > 0 && (
                        <li>
                          {inspectionData.packageUnitsCount} unit kemasan terkait akan dihapus dari stok gudang.
                        </li>
                      )}
                    </>
                  )}
                  <li>
                    Operator dapat langsung melakukan penimbangan atau transaksi ulang.
                  </li>
                </ul>
              </div>

              {!canCancel && (
                <div className="p-3 bg-destructive/15 border-2 border-destructive/40 text-destructive font-semibold flex items-center gap-2">
                  <Icon name="alert-triangle" size={16} />
                  <span>{inspectionData?.blockReason || 'Transaksi tidak dapat dibatalkan karena kemasan telah terkirim.'}</span>
                </div>
              )}

              {canCancel && (
                <div className="space-y-1">
                  <label htmlFor="cancel-reason" className="text-[11px] font-semibold text-muted-foreground">
                    Alasan Pembatalan (Opsional):
                  </label>
                  <input
                    id="cancel-reason"
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Contoh: Salah pilih petani / timbangan ulang"
                    className="w-full text-xs px-2.5 py-1.5 border border-border bg-background focus:outline-hidden focus:ring-1 focus:ring-primary"
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex flex-row justify-end gap-2 pt-2 border-t border-border">
            <Button variant="outline" onClick={onClose} disabled={cancelling}>
              Kembali
            </Button>
            {canCancel && !loading && !errorMsg && (
              <Button
                variant="danger"
                icon="trash"
                loading={cancelling}
                onClick={handleConfirmCancel}
              >
                Batalkan & Hapus Transaksi
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
