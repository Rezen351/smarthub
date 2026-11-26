import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import Button from './Button'
import Icon from './Icon'
import { useToast } from '../feedback/Toast'

interface CameraScannerModalProps {
  isOpen: boolean
  onClose: () => void
  onScan: (code: string) => void
  title: string
  subtitle?: string
  manualPlaceholder?: string
  quickOptions?: { label: string; value: string }[]
}

/**
 * Minimal QR/Barcode Camera Scanner Modal.
 * Camera-only scan view without manual input form.
 */
export default function CameraScannerModal({
  isOpen,
  onClose,
  onScan,
  title,
  subtitle = 'Arahkan kode QR ke dalam bingkai',
}: CameraScannerModalProps) {
  const toast = useToast()
  const [scannerReady, setScannerReady] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null)
  const isStoppingRef = useRef(false)

  const handleSuccessfulScan = (decodedText: string) => {
    const text = decodedText.trim()
    if (!text) return
    // Extract farmer code
    const m = text.match(/(FMR|FRM)-?\d{3,}/i)
    const cleanCode = m ? m[0].toUpperCase().replace(/FRM/i, 'FMR') : text
    toast.success(`Terpindai: ${cleanCode}`)
    onScan(cleanCode)
    onClose()
  }

  // Start scanner
  useEffect(() => {
    if (!isOpen) {
      setScannerReady(false)
      setErrorMessage('')
      return
    }

    const elementId = 'qr-reader'
    isStoppingRef.current = false

    const timeout = window.setTimeout(async () => {
      const container = document.getElementById(elementId)
      if (!container) return

      try {
        if (html5QrCodeRef.current) {
          if (html5QrCodeRef.current.isScanning) {
            await html5QrCodeRef.current.stop()
          }
          html5QrCodeRef.current.clear()
        }

        const scanner = new Html5Qrcode(elementId)
        html5QrCodeRef.current = scanner

        const config = {
          fps: 10,
          qrbox: { width: 200, height: 200 },
        }

        await scanner.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => handleSuccessfulScan(decodedText),
          () => {}
        )

        if (!isStoppingRef.current) {
          setScannerReady(true)
          setErrorMessage('')
        }
      } catch (err: any) {
        if (!isStoppingRef.current) {
          setErrorMessage(err?.message || 'Gagal mengakses kamera')
        }
      }
    }, 100)

    return () => {
      window.clearTimeout(timeout)
      isStoppingRef.current = true
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {})
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-3 border-b flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm">{title}</h3>
            <p className="text-xs text-gray-500">{subtitle}</p>
          </div>
          <Button variant="ghost" size="sm" icon="close" onClick={onClose} />
        </div>

        {/* Scanner area */}
        <div className="p-3">
          {/* Camera view */}
          <div className="relative aspect-square bg-black rounded overflow-hidden">
            <div id="qr-reader" className="w-full h-full" />
            
            {!scannerReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white p-4 text-center">
                {errorMessage ? (
                  <>
                    <Icon name="alert" size={24} className="text-red-500 mb-2" />
                    <p className="text-xs text-red-300 mb-1">{errorMessage}</p>
                    <p className="text-[10px] text-gray-300">Tutup modal ini untuk input manual</p>
                  </>
                ) : (
                  <>
                    <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mb-2" />
                    <p className="text-xs">Memulai kamera...</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t bg-gray-50 text-center">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-sm">
            Batal
          </Button>
        </div>
      </div>
    </div>
  )
}