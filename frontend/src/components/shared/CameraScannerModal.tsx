import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
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
 * Universal, cross-platform Camera Barcode & QR Scanner Modal.
 * Uses html5-qrcode for 100% offline decoding of QR Codes and 1D Barcodes
 * (Code128, EAN13, Code39, UPC) across all desktop and mobile browsers.
 */
export default function CameraScannerModal({
  isOpen,
  onClose,
  onScan,
  title,
  subtitle = 'Position the QR code or barcode within the targeting frame.',
  manualPlaceholder = 'Scan barcode or enter ID...',
  quickOptions = [],
}: CameraScannerModalProps) {
  const toast = useToast()
  const [scannerReady, setScannerReady] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([])
  const [selectedCameraId, setSelectedCameraId] = useState<string>('')
  const [manualCode, setManualCode] = useState('')
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null)
  const manualInputRef = useRef<HTMLInputElement>(null)
  const isStoppingRef = useRef(false)

  // Web Audio feedback
  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.setValueAtTime(1200, ctx.currentTime)
      gain.gain.setValueAtTime(0.12, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.12)
    } catch {
      // AudioContext failure gracefully ignored
    }
  }

  const handleSuccessfulScan = (decodedText: string) => {
    const cleanCode = decodedText.trim()
    if (!cleanCode) return
    playBeep()
    toast.success(`Scanned: ${cleanCode}`)
    onScan(cleanCode)
    onClose()
  }

  // Enumerate cameras
  useEffect(() => {
    if (!isOpen) return

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          const list = devices.map((d, idx) => ({
            id: d.id,
            label: d.label || `Camera ${idx + 1}`,
          }))
          setCameras(list)
          // Default to back/environment camera if available, otherwise first camera
          const envCam = list.find((c) => /back|rear|environment/i.test(c.label))
          setSelectedCameraId(envCam ? envCam.id : list[0].id)
        }
      })
      .catch((err) => {
        console.warn('Error discovering cameras:', err)
      })
  }, [isOpen])

  // Start / restart scanner when camera selection or modal visibility changes
  useEffect(() => {
    if (!isOpen) {
      setScannerReady(false)
      setErrorMessage('')
      return
    }

    const elementId = 'enyx-universal-qr-reader'
    isStoppingRef.current = false

    // Delay slightly to ensure DOM element is mounted
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
          fps: 15,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight)
            const boxSize = Math.floor(minEdge * 0.72)
            return { width: boxSize, height: boxSize }
          },
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.DATA_MATRIX,
          ],
        }

        const cameraConfig = selectedCameraId ? selectedCameraId : { facingMode: 'environment' }

        await scanner.start(
          cameraConfig,
          config,
          (decodedText) => {
            handleSuccessfulScan(decodedText)
          },
          () => {
            // Frame parsing failures are expected while scanning empty space
          }
        )

        if (!isStoppingRef.current) {
          setScannerReady(true)
          setErrorMessage('')
        }
      } catch (err: any) {
        if (!isStoppingRef.current) {
          console.error('Html5Qrcode start error:', err)
          setErrorMessage(err?.message || 'Unable to access camera feed.')
          setScannerReady(false)
        }
      }
    }, 150)

    return () => {
      window.clearTimeout(timeout)
      isStoppingRef.current = true
      if (html5QrCodeRef.current) {
        if (html5QrCodeRef.current.isScanning) {
          html5QrCodeRef.current
            .stop()
            .then(() => {
              html5QrCodeRef.current?.clear()
            })
            .catch(() => {})
        } else {
          try {
            html5QrCodeRef.current.clear()
          } catch {}
        }
      }
    }
  }, [isOpen, selectedCameraId])

  // Focus manual input
  useEffect(() => {
    if (isOpen) {
      const t = window.setTimeout(() => {
        manualInputRef.current?.focus()
      }, 300)
      return () => window.clearTimeout(t)
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-2 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-card border border-border rounded-none shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-3 sm:p-4 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Icon name="scan" size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-foreground leading-tight">{title}</h3>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" icon="close" onClick={onClose} aria-label="Close" />
        </div>

        {/* Camera Switcher (If multiple cameras detected) */}
        {cameras.length > 1 && (
          <div className="px-3 sm:px-4 py-2 border-b border-border bg-muted/10 flex items-center justify-between text-xs font-mono">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Icon name="refresh" size={12} />
              Switch Camera:
            </span>
            <select
              value={selectedCameraId}
              onChange={(e) => setSelectedCameraId(e.target.value)}
              className="px-2 py-1 bg-background border border-border text-foreground font-sans text-xs focus:outline-none focus:border-primary"
            >
              {cameras.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Viewfinder Area */}
        <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
          <div className="relative aspect-video sm:aspect-square bg-black border border-border overflow-hidden flex items-center justify-center">
            {/* Target Container for Html5Qrcode */}
            <div id="enyx-universal-qr-reader" className="w-full h-full object-cover" />

            {/* Scanning Overlay Reticle & Laser */}
            {scannerReady && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                {/* Laser scan line animation */}
                <div
                  className="w-4/5 h-0.5 bg-emerald-400 shadow-[0_0_12px_#34d399] absolute animate-bounce"
                  style={{ animationDuration: '2.2s' }}
                />

                {/* Status chip */}
                <div className="absolute bottom-3 px-3 py-1 bg-black/80 text-emerald-400 font-mono text-[11px] font-semibold border border-emerald-500/30 tracking-wider uppercase flex items-center gap-1.5 backdrop-blur-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                  Scanner Active (QR & 1D Barcode)
                </div>
              </div>
            )}

            {/* Error or Loading State */}
            {!scannerReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-black/90 text-white space-y-3">
                {errorMessage ? (
                  <>
                    <Icon name="alert" size={32} className="text-destructive" />
                    <p className="text-xs text-destructive max-w-xs">{errorMessage}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Use the USB scanner wedge input below or select a registered code.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                      Initializing Optical Scanner…
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* USB 2D Scanner Wedge Input */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-mono uppercase block">
              Or USB 2D Scanner Wedge Input:
            </label>
            <div className="flex gap-2">
              <input
                ref={manualInputRef}
                type="text"
                placeholder={manualPlaceholder}
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (manualCode.trim()) {
                      handleSuccessfulScan(manualCode)
                    }
                  }
                }}
                className="flex-1 px-3 py-1.5 text-xs font-mono font-bold uppercase border border-border bg-background focus:outline-none focus:border-primary"
              />
              <Button
                variant="primary"
                size="sm"
                icon="check"
                onClick={() => {
                  if (manualCode.trim()) {
                    handleSuccessfulScan(manualCode)
                  }
                }}
              >
                Verify
              </Button>
            </div>
          </div>

          {/* Quick Select Options */}
          {quickOptions.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-border">
              <p className="text-xs font-mono text-muted-foreground uppercase text-center">
                Quick Registered Selection:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {quickOptions.map((opt) => (
                  <Button
                    key={opt.value}
                    variant="outline"
                    size="sm"
                    onClick={() => handleSuccessfulScan(opt.value)}
                    className="text-xs justify-center font-mono truncate"
                    title={opt.label}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-muted/30 border-t border-border text-center">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Close Scanner
          </Button>
        </div>
      </div>
    </div>
  )
}
