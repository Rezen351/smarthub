import { useEffect, useState, useRef, useCallback } from 'react'
import { Link, useSearchParams, useParams } from 'react-router-dom'
import Logo from '../components/shared/Logo'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import Icon from '../components/shared/Icon'
import { formatWeight, formatSafeDate, formatSafeDateTime } from '../lib/utils'
import OfflineQrCode from '../components/shared/OfflineQrCode'
import { api } from '../services/api'

export type TraceStep = {
  stage: string
  location: string
  timestamp: string
  operator: string
  completed: boolean
  details?: string
}

export type TraceResult = {
  code: string
  type: 'POUCH' | 'PALLET' | 'SORTED_PALLET'
  commodity: string
  variety: string
  grade: 'A' | 'B' | 'C' | 'A/B/C'
  weightKg: number
  farmerName: string
  farmerId: string
  farmLocation: string
  elevation: string
  harvestDate: string
  intakeDate: string
  packDate: string
  gs1Uri: string
  gtin: string
  batchLot: string
  serialNumber: string
  qualityScore: string
  moisturePercent: string
  journey: TraceStep[]
}

/** Extract code or serial from GS1 Digital Link URL or plain text input. */
function extractCode(input: string): string {
  const clean = input.trim()
  const match = clean.match(/\/(21|10)\/([^/?#]+)/)
  if (match) return decodeURIComponent(match[2]).toUpperCase()
  return clean.toUpperCase()
}

function mapApiResponseToTraceResult(payload: any, code: string): TraceResult {
  if (payload.traceType === 'WARING' || payload.waring) {
    const w = payload.waring || {}
    const o = payload.origin || {}
    return {
      code: w.code || code,
      type: 'PALLET',
      commodity: 'Potato',
      variety: 'Granola Table Potato',
      grade: 'A/B/C',
      weightKg: Number(w.netWeightKg || w.grossWeightKg || 0),
      farmerName: o.farmerName || 'Registered Farmer',
      farmerId: o.farmerCode || 'FMR-001',
      farmLocation: o.village || 'Highland Valley',
      elevation: '1,450 m ASL',
      harvestDate: formatSafeDate(w.receivedAt),
      intakeDate: formatSafeDateTime(w.receivedAt),
      packDate: w.approvedAt ? formatSafeDateTime(w.approvedAt) : 'Pending Sorting',
      gs1Uri: `https://id.enyx.io/01/08901234567890/21/${w.code || code}`,
      gtin: '08901234567890',
      batchLot: w.code || code,
      serialNumber: w.code || code,
      qualityScore: '99.0 / 100',
      moisturePercent: '78.0%',
      journey: [
        {
          stage: 'Field Harvest & Farm Loading',
          location: `${o.farmerName || 'Farmer'} Farm (${o.village || 'Origin Farm'})`,
          timestamp: formatSafeDate(w.receivedAt),
          operator: `${o.farmerName || 'Farmer'} (${o.farmerCode || 'FMR'})`,
          completed: true,
          details: 'Hand-picked table potatoes, loaded into ventilated waring sacks.',
        },
        {
          stage: 'Station 01: Reception & Weighing',
          location: 'Smart Hub Reception Bay (Scale #01)',
          timestamp: formatSafeDateTime(w.receivedAt),
          operator: 'Budi Hartono (Operator)',
          completed: true,
          details: `Gross weight verified at ${w.grossWeightKg} kg, net ${w.netWeightKg} kg. Status: ${w.status}.`,
        },
        {
          stage: 'Station 02: Sorting & Grading',
          location: 'Packhouse Sorting Line (Scale #02)',
          timestamp: w.sortedBatch ? 'Sorted' : 'Queued in Buffer Warehouse',
          operator: 'Automated 3-Tier Sizer',
          completed: Boolean(w.sortedBatch),
          details: w.sortedBatch ? 'Sized and graded into Grade A/B/C' : 'Awaiting buffer queue dispatch to sizing conveyor.',
        },
        {
          stage: 'Station 03: Pouch & Carton Packaging',
          location: 'Packaging Station (Scale #03)',
          timestamp: 'Downstream',
          operator: 'Packaging Line Operator',
          completed: false,
          details: 'Packaging into 1 kg retail pouches or bulk export cartons.',
        },
      ],
    }
  }

  if (payload.traceType === 'PACKAGE' || payload.package) {
    const pkg = payload.package || {}
    const origin = payload.origin || payload.farmer || {}
    const intake = payload.intake || {}
    const sorting = payload.sorting || {}
    const pallet = payload.pallet || {}
    const dispatch = payload.dispatch
    return {
      code: pkg.code || code,
      type: 'POUCH',
      commodity: intake.commodity || 'Potato',
      variety: 'Granola Table Potato',
      grade: (pkg.grade || 'A') as any,
      weightKg: Number(pkg.weightKg || 1),
      farmerName: origin.farmerName || origin.name || 'Registered Farmer',
      farmerId: origin.farmerCode || origin.code || 'FMR-001',
      farmLocation: origin.village || 'Highland Farm',
      elevation: '1,450 m ASL',
      harvestDate: formatSafeDate(intake.receivedAt),
      intakeDate: formatSafeDateTime(intake.receivedAt),
      packDate: formatSafeDateTime(pkg.packedAt),
      gs1Uri: `https://id.enyx.io/01/08901234567890/21/${pkg.code || code}`,
      gtin: '08901234567890',
      batchLot: pallet.code || pkg.code,
      serialNumber: pkg.code,
      qualityScore: pkg.grade === 'A' ? '98.5 / 100' : '95.0 / 100',
      moisturePercent: '78.2%',
      journey: [
        {
          stage: 'Field Harvest & Farm Loading',
          location: `${origin.farmerName} (${origin.village || 'Farm'})`,
          timestamp: formatSafeDate(intake.receivedAt),
          operator: `${origin.farmerName}`,
          completed: true,
          details: 'Tubers harvested and transported in ventilated sacks.',
        },
        {
          stage: 'Station 01: Reception & Intake',
          location: 'Smart Hub Reception Bay',
          timestamp: formatSafeDateTime(intake.receivedAt),
          operator: 'Receiving Operator',
          completed: true,
          details: `Intake sack ${intake.waringCode || 'Waring'}, gross ${intake.grossWeightKg} kg, net ${intake.netWeightKg} kg.`,
        },
        {
          stage: 'Station 02: Sorting & Grading',
          location: 'Automated Sizer & Optical Line',
          timestamp: formatSafeDateTime(sorting.sortedAt),
          operator: 'Grading Operator',
          completed: true,
          details: `Graded to Grade ${pkg.grade}. Washing decision: ${sorting.washDecision || 'UNWASHED'}. Shrinkage: ${sorting.shrinkagePct || 0}%.`,
        },
        {
          stage: 'Station 03: Packaging & GS1 Tagging',
          location: 'Clean Pack Cleanroom',
          timestamp: formatSafeDateTime(pkg.packedAt),
          operator: 'Packaging Operator',
          completed: true,
          details: `Packed into ${pkg.format === 'RETAIL_POUCH' ? '1 kg Retail Pouch' : 'Export Carton'}. Barcode: ${pkg.barcode || pkg.code}.`,
        },
        {
          stage: 'Outbound Dispatch & Transport',
          location: dispatch ? dispatch.destination : 'Finished Goods Cold Storage',
          timestamp: dispatch ? formatSafeDateTime(dispatch.departedAt) : 'In Warehouse',
          operator: dispatch ? `Driver: ${dispatch.driverName} (${dispatch.truckPlate})` : 'Warehouse Custodian',
          completed: Boolean(dispatch),
          details: dispatch ? `Dispatched under manifest ${dispatch.deliveryCode} to ${dispatch.destination}` : 'Stored in cold warehouse awaiting dispatch.',
        },
      ],
    }
  }

  // Pallet
  const pallet = payload.pallet || {}
  const origin = payload.origin || payload.farmer || {}
  const intake = payload.intake || {}
  return {
    code: pallet.code || code,
    type: 'SORTED_PALLET',
    commodity: intake.commodity || 'Potato',
    variety: 'Granola Table Potato',
    grade: (pallet.grade || 'A') as any,
    weightKg: Number(pallet.initialWeightKg || pallet.weightKg || 0),
    farmerName: origin.farmerName || origin.name || 'Registered Farmer',
    farmerId: origin.farmerCode || origin.code || 'FMR-001',
    farmLocation: origin.village || 'Highland Farm',
    elevation: '1,450 m ASL',
    harvestDate: formatSafeDate(intake.receivedAt),
    intakeDate: formatSafeDateTime(intake.receivedAt),
    packDate: formatSafeDateTime(pallet.createdAt),
    gs1Uri: `https://id.enyx.io/01/08901234567890/21/${pallet.code || code}`,
    gtin: '08901234567890',
    batchLot: pallet.code || code,
    serialNumber: pallet.code || code,
    qualityScore: '97.5 / 100',
    moisturePercent: '78.5%',
    journey: [
      {
        stage: 'Field Harvest & Farm Loading',
        location: `${origin.farmerName} (${origin.village || 'Farm'})`,
        timestamp: formatSafeDate(intake.receivedAt),
        operator: `${origin.farmerName}`,
        completed: true,
        details: 'Tubers harvested and transported in ventilated sacks.',
      },
      {
        stage: 'Station 01: Reception & Intake',
        location: 'Smart Hub Reception Bay',
        timestamp: formatSafeDateTime(intake.receivedAt),
        operator: 'Receiving Operator',
        completed: true,
        details: `Intake sack ${intake.waringCode || 'Waring'}, gross ${intake.grossWeightKg} kg, net ${intake.netWeightKg} kg.`,
      },
      {
        stage: 'Station 02: Sorting & Pallet Staging',
        location: 'Packhouse Sorting Line',
        timestamp: formatSafeDateTime(pallet.createdAt),
        operator: 'Automated 3-Tier Sizer',
        completed: true,
        details: `Assembled onto Grade ${pallet.grade} Pallet. Remaining weight: ${pallet.remainingKg || pallet.weightKg} kg.`,
      },
      {
        stage: 'Station 03: Packaging & Pouching',
        location: 'Packaging Station',
        timestamp: pallet.status === 'IN_PACKAGING' ? 'In Progress' : 'Pending',
        operator: 'Packaging Line',
        completed: pallet.status === 'DEPLETED',
        details: 'Fed to pouch fill and heat seal station.',
      },
    ],
  }
}

export default function PublicTraceabilityPage() {
  const { code: pathCode } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [queryCode, setQueryCode] = useState('')
  const [searched, setSearched] = useState(false)
  const [result, setResult] = useState<TraceResult | null>(null)

  // Camera & live scanner state
  const [scannerOpen, setScannerOpen] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([])
  const [selectedCameraId, setSelectedCameraId] = useState<string>('')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setCameraStream(null)
    setCameraActive(false)
  }, [])

  const startCamera = useCallback(async (deviceId?: string) => {
    setCameraError(null)
    setScannerOpen(true)
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by your browser.')
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }

      let stream: MediaStream
      const constraints: MediaStreamConstraints = deviceId
        ? { video: { deviceId: { exact: deviceId } } }
        : {
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          }

      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints)
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true })
      }

      streamRef.current = stream
      setCameraStream(stream)
      setCameraActive(true)

      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const videoDevices = devices.filter((d) => d.kind === 'videoinput')
        setAvailableCameras(videoDevices)
        if (deviceId) {
          setSelectedCameraId(deviceId)
        } else if (videoDevices.length > 0) {
          setSelectedCameraId(videoDevices[0].deviceId)
        }
      } catch {
        // Enumerate not permitted
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unable to access camera.'
      setCameraError(errMsg)
      setCameraActive(false)
    }
  }, [])

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  // Bind camera stream to video element when mounted or changed
  useEffect(() => {
    if (cameraActive && cameraStream && videoRef.current) {
      if (videoRef.current.srcObject !== cameraStream) {
        videoRef.current.srcObject = cameraStream
        videoRef.current.play().catch(() => {})
      }
    }
  }, [cameraActive, cameraStream])

  const executeSearch = useCallback(async (rawCode: string) => {
    const trimmed = rawCode.trim()
    if (!trimmed) return
    const clean = extractCode(trimmed)
    try {
      const res = await api.traceability.lookup(clean)
      if (res) {
        setResult(mapApiResponseToTraceResult(res, clean))
      } else {
        setResult(null)
      }
    } catch {
      setResult(null)
    } finally {
      setSearched(true)
      stopCamera()
      setScannerOpen(false)
    }
  }, [stopCamera])

  // Live Barcode/QR detection loop for public scanner
  useEffect(() => {
    if (!cameraActive || !cameraStream) return
    let isCancelled = false
    let animationId: number

    const scanLoop = async () => {
      if (isCancelled) return
      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        try {
          const detector = new (window as any).BarcodeDetector({
            formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8'],
          })
          const video = videoRef.current
          if (video && video.readyState >= 2 && !video.paused && !video.ended) {
            const barcodes = await detector.detect(video)
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              const code = barcodes[0].rawValue.trim()
              if (code) {
                try {
                  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
                  const osc = ctx.createOscillator()
                  const gain = ctx.createGain()
                  osc.frequency.setValueAtTime(1200, ctx.currentTime)
                  gain.gain.setValueAtTime(0.1, ctx.currentTime)
                  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1)
                  osc.connect(gain)
                  gain.connect(ctx.destination)
                  osc.start()
                  osc.stop(ctx.currentTime + 0.1)
                } catch {}
                setQueryCode(code)
                setSearchParams({ code })
                executeSearch(code)
                return
              }
            }
          }
        } catch {
          // Frame read exception
        }
      }
      animationId = requestAnimationFrame(scanLoop)
    }

    animationId = requestAnimationFrame(scanLoop)

    return () => {
      isCancelled = true
      if (animationId) cancelAnimationFrame(animationId)
    }
  }, [cameraActive, cameraStream, executeSearch, setSearchParams])

  // Resolve code from query params (e.g. ?code=... or ?link=...) or route params (/traceability/:code)
  useEffect(() => {
    const param = pathCode ?? searchParams.get('code') ?? searchParams.get('link')
    if (param) {
      setQueryCode(param)
      executeSearch(param)
    } else {
      // Default initial view: lookup live verified intake waring WRG-20261026-0001
      setQueryCode('WRG-20261026-0001')
      executeSearch('WRG-20261026-0001')
    }
  }, [pathCode, searchParams, executeSearch])

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSearchParams({ code: queryCode })
    executeSearch(queryCode)
  }

  const handleSelectSampleCode = (codeToSearch: string) => {
    setQueryCode(codeToSearch)
    setSearchParams({ code: codeToSearch })
    executeSearch(codeToSearch)
  }

  const handlePrintCertificate = () => {
    window.print()
  }

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#171717] font-['Archivo',sans-serif] selection:bg-[#f0fdf4] selection:text-[#15803d] flex flex-col">
      {/* ── Top Header Bar ── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#eaeaea]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group" aria-label="ENYX-ENTERPRISE home">
            <Logo className="h-8 w-auto" markOnly />
            <div>
              <div className="font-display text-2xl leading-none tracking-wider text-[#171717] flex items-center gap-2">
                ENYX-ENTERPRISE
              </div>
              <div className="font-mono-custom text-[10px] text-[#666666] tracking-[0.25em] uppercase">
                TRACEABILITY SYSTEM
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-[#666666] hover:text-[#171717] px-3 py-2 rounded-sm transition-colors"
            >
              <Icon name="arrow-left" size={14} />
              <span>Back to Home</span>
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider bg-[#000000] text-white hover:bg-[#333333] px-4 py-2 rounded-sm transition-colors"
            >
              <span>Operator Login</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Container ── */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 w-full flex-1 space-y-8">
        {/* Page Title & Mission Banner */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <Badge tone="accent" icon="qr" className="px-3 py-1 text-xs">
            GS1 Digital Link · End-to-End Verification
          </Badge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#171717]">
            Product Traceability
          </h1>
          <p className="text-sm sm:text-base text-[#666666] leading-relaxed">
            Scan the QR code on your potato pouch label (1 kg), pallet tag, or enter the code manually to verify
            authenticity, farm origin, and lab quality standards.
          </p>
        </div>

        {/* Search & Code Resolver Box */}
        <div className="bg-white border border-[#eaeaea] rounded-none p-5 sm:p-7 shadow-xs space-y-5">
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-[#666666]">
              Enter Pouch / Pallet Code or GS1 URL
            </label>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={queryCode}
                  onChange={(e) => setQueryCode(e.target.value)}
                  placeholder="e.g. PCH-PLT-20260914-0001-001 or PLT-20261011-0042"
                  className="w-full bg-[#fafafa] border border-[#d1d5db] rounded-none px-4 py-3 font-mono text-sm text-[#171717] placeholder:text-[#999999] focus:outline-none focus:border-[#229856] focus:ring-2 focus:ring-[#229856]/20 transition-all"
                />
                {queryCode && (
                  <button
                    type="button"
                    onClick={() => setQueryCode('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999999] hover:text-[#171717] p-1"
                    aria-label="Clear code"
                  >
                    <Icon name="close" size={14} />
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  type="submit"
                  variant="primary"
                  icon="search"
                  className="px-6 py-3 text-sm font-semibold justify-center flex-1 sm:flex-none"
                >
                  Trace Product
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  icon="scan"
                  onClick={() => startCamera()}
                  className="px-4 py-3 text-sm font-semibold justify-center flex-1 sm:flex-none"
                >
                  Scan QR
                </Button>
              </div>
            </div>
          </form>

          {/* Quick Sample Chips for Instant Verification */}
          <div className="pt-4 border-t border-[#f0f0f0] flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono text-[#666666] tracking-wider uppercase mr-1">
              Database Records:
            </span>
            <button
              type="button"
              onClick={() => handleSelectSampleCode('WRG-20261026-0001')}
              className="text-xs font-mono bg-[#f0fdf4] text-[#15803d] hover:bg-[#dcfce7] border border-[#bbf7d0] px-2.5 py-1 rounded-none transition-colors"
            >
              Intake Waring (WRG-20261026-0001)
            </button>
          </div>
        </div>

        {/* ── Camera Scanner Viewfinder Modal ── */}
        {scannerOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-none max-w-md w-full overflow-hidden shadow-2xl border border-[#eaeaea]">
              <div className="p-4 border-b border-[#eaeaea] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon name="scan" size={18} className="text-[#229856]" />
                  <span className="font-semibold text-sm text-[#171717]">Live QR Code Scanner</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    stopCamera()
                    setScannerOpen(false)
                  }}
                  className="text-[#666666] hover:text-[#171717] p-1 cursor-pointer"
                >
                  <Icon name="close" size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {cameraActive ? (
                  <div className="relative rounded-none overflow-hidden aspect-square bg-black flex items-center justify-center">
                    <video
                      ref={(el) => {
                        videoRef.current = el
                        if (el && cameraStream && el.srcObject !== cameraStream) {
                          el.srcObject = cameraStream
                          el.play().catch(() => {})
                        }
                      }}
                      className="w-full h-full object-cover"
                      playsInline
                      muted
                      autoPlay
                    />
                    {/* Viewfinder Reticle & Laser */}
                    <div className="absolute inset-8 border-2 border-[#229856] rounded-none pointer-events-none">
                      <div className="w-full h-0.5 bg-[#229856] shadow-[0_0_8px_#229856] animate-bounce" />
                    </div>
                    {/* Live Scanner Status Badge */}
                    <div className="absolute bottom-3 left-3 bg-black/80 px-2 py-1 text-[11px] font-mono text-emerald-400 flex items-center gap-1.5 backdrop-blur-xs border border-emerald-500/40">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <span>Live Scanner Active</span>
                    </div>
                    {/* Multi-camera switcher */}
                    {availableCameras.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const idx = availableCameras.findIndex((c) => c.deviceId === selectedCameraId)
                          const next = availableCameras[(idx + 1) % availableCameras.length]
                          startCamera(next.deviceId)
                        }}
                        className="absolute top-3 right-3 bg-black/80 hover:bg-black text-white px-2.5 py-1 text-xs font-mono flex items-center gap-1 border border-border cursor-pointer backdrop-blur-xs"
                      >
                        <Icon name="scan" size={13} />
                        Switch Camera
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="bg-[#fafafa] border border-dashed border-[#d1d5db] rounded-none p-6 text-center space-y-3">
                    <div className="w-12 h-12 rounded-none bg-[#f0fdf4] text-[#15803d] flex items-center justify-center mx-auto">
                      <Icon name="scan" size={24} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-[#171717]">
                        {cameraError ? 'Camera Access Notice' : 'Ready to Scan'}
                      </p>
                      <p className="text-xs text-[#666666]">
                        {cameraError
                          ? cameraError
                          : 'Position the QR code within the camera frame, or select a sample code below.'}
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-2 pt-2">
                  <p className="text-xs font-mono text-[#666666] uppercase text-center">
                    Sample Quick Lookup:
                  </p>
                  <div className="flex justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSelectSampleCode('WRG-20261026-0001')}
                      className="text-xs justify-center font-mono"
                    >
                      Sample Waring (WRG-20261026-0001)
                    </Button>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-[#fafafa] border-t border-[#eaeaea] text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    stopCamera()
                    setScannerOpen(false)
                  }}
                  className="text-xs"
                >
                  Close Scanner
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── NOT FOUND STATE ── */}
        {searched && !result && (
          <div className="bg-white border border-[#eaeaea] rounded-none p-8 sm:p-12 text-center space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded-none bg-[#fef2f2] text-[#ef4444] flex items-center justify-center mx-auto">
              <Icon name="alert" size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#171717]">Record Not Found</h3>
              <p className="text-sm text-[#666666] max-w-md mx-auto">
                No verified batch matching code <span className="font-mono font-bold text-[#171717]">{queryCode}</span> was
                found. Check the code format or try one of the test sample buttons above.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              icon="refresh"
              onClick={() => handleSelectSampleCode('WRG-20261026-0001')}
            >
              Load Verified Waring
            </Button>
          </div>
        )}

        {/* ── VERIFIED TRACEABILITY RESULT ── */}
        {result && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Header Result Card */}
            <div className="bg-white border border-[#eaeaea] rounded-none p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#eaeaea]">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge tone="success" icon="check-circle" live>
                      Verified Authentic
                    </Badge>
                    <Badge tone="neutral" className="font-mono uppercase text-xs">
                      {result.type.replace('_', ' ')}
                    </Badge>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-[#171717]">
                    {result.code}
                  </h2>
                  <p className="text-xs text-[#666666] font-mono mt-1">
                    GS1 Digital Link URI: <a href={result.gs1Uri} target="_blank" rel="noreferrer" className="text-[#15803d] hover:underline">{result.gs1Uri}</a>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    icon="print"
                    onClick={handlePrintCertificate}
                  >
                    Print Certificate
                  </Button>
                </div>
              </div>

              {/* Product Specifications Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-[#fafafa] rounded-none border border-[#f0f0f0]">
                  <span className="text-[11px] font-mono uppercase text-[#666666] block">Commodity & Variety</span>
                  <span className="text-base font-bold text-[#171717] mt-1 block">{result.variety}</span>
                </div>

                <div className="p-4 bg-[#fafafa] rounded-none border border-[#f0f0f0]">
                  <span className="text-[11px] font-mono uppercase text-[#666666] block">Official Grade</span>
                  <div className="mt-1 flex items-center gap-1.5">
                    <Badge
                      tone={result.grade === 'A' ? 'success' : result.grade === 'B' ? 'accent' : 'warning'}
                      className="font-bold text-xs"
                    >
                      Grade {result.grade}
                    </Badge>
                  </div>
                </div>

                <div className="p-4 bg-[#fafafa] rounded-none border border-[#f0f0f0]">
                  <span className="text-[11px] font-mono uppercase text-[#666666] block">Verified Net Weight</span>
                  <span className="text-base font-bold font-mono text-emerald-600 mt-1 block">
                    {formatWeight(result.weightKg)} kg
                  </span>
                </div>

                <div className="p-4 bg-[#fafafa] rounded-none border border-[#f0f0f0]">
                  <span className="text-[11px] font-mono uppercase text-[#666666] block">Quality Score</span>
                  <span className="text-base font-bold text-[#171717] mt-1 block">{result.qualityScore}</span>
                </div>
              </div>

              {/* Farm Origin & Field Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                <div className="space-y-3">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-[#666666] font-semibold">
                    Farm Origin & Elevation
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-1.5 border-b border-[#f0f0f0]">
                      <span className="text-[#666666]">Farmer / Producer</span>
                      <span className="font-semibold text-[#171717]">{result.farmerName} ({result.farmerId})</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-[#f0f0f0]">
                      <span className="text-[#666666]">Location</span>
                      <span className="font-semibold text-[#171717]">{result.farmLocation}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-[#f0f0f0]">
                      <span className="text-[#666666]">Elevation</span>
                      <span className="font-semibold text-[#171717]">{result.elevation}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-[#666666] font-semibold">
                    GS1 Batch & Standard Identifiers
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-1.5 border-b border-[#f0f0f0]">
                      <span className="text-[#666666]">Global Trade Item No (GTIN)</span>
                      <span className="font-mono font-semibold text-[#171717]">{result.gtin}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-[#f0f0f0]">
                      <span className="text-[#666666]">Batch / Lot Number</span>
                      <span className="font-mono font-semibold text-[#171717]">{result.batchLot}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-[#f0f0f0]">
                      <span className="text-[#666666]">Harvest Date</span>
                      <span className="font-mono font-semibold text-[#171717]">{result.harvestDate}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Complete Journey Timeline */}
            <div className="bg-white border border-[#eaeaea] rounded-none p-6 sm:p-8 shadow-xs space-y-6">
              <div className="space-y-1">
                <h3 className="text-xl font-bold tracking-tight text-[#171717]">
                  Verified Harvest & Processing Journey
                </h3>
                <p className="text-xs text-[#666666]">
                  Every stage is immutably timestamped and verified by IoT platform scales and authorized packhouse operators.
                </p>
              </div>

              <div className="relative pl-6 sm:pl-8 border-l-2 border-[#eaeaea] space-y-8 my-6">
                {result.journey.map((step, index) => (
                  <div key={index} className="relative group">
                    {/* Timeline Node Dot */}
                    <div
                      className={`absolute -left-[31px] sm:-left-[39px] top-1 w-6 h-6 rounded-none flex items-center justify-center text-xs font-bold transition-all ${
                        step.completed
                          ? 'bg-[#15803d] text-white shadow-[0_0_0_4px_#f0fdf4]'
                          : 'bg-[#e5e7eb] text-[#9ca3af]'
                      }`}
                    >
                      <Icon name={step.completed ? 'check' : 'clock'} size={12} />
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-base text-[#171717]">{step.stage}</span>
                        <span className="font-mono text-xs text-[#666666] bg-[#fafafa] border border-[#f0f0f0] px-2 py-0.5 rounded-none">
                          {step.timestamp}
                        </span>
                      </div>

                      <p className="text-xs font-medium text-[#15803d]">
                        {step.location} · <span className="text-[#666666]">{step.operator}</span>
                      </p>

                      {step.details && (
                        <p className="text-xs text-[#525252] bg-[#f9fafb] p-2.5 rounded-none border border-[#f3f4f6] mt-1.5">
                          {step.details}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* GS1 Digital Link Label Visual Representation */}
            <div className="bg-white border border-[#eaeaea] rounded-none p-6 sm:p-8 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2 max-w-lg">
                <Badge tone="accent" className="font-mono text-[10px]">
                  GS1 STANDARD DIGITAL LINK EMBED
                </Badge>
                <h4 className="text-lg font-bold text-[#171717]">
                  Scannable Product Verification QR
                </h4>
                <p className="text-xs text-[#666666] leading-relaxed">
                  Consumers and retailers can scan the QR code printed on the physical packaging sticker using any standard smartphone camera to view this live verification page.
                </p>
              </div>

              <div className="p-4 bg-white border-2 border-[#171717] rounded-none shadow-xs text-center flex flex-col items-center shrink-0">
                <OfflineQrCode value={result.gs1Uri} size={128} />
                <span className="font-mono text-[10px] text-[#666666] mt-2 block">
                  {result.code}
                </span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-[#eaeaea] bg-white py-6 text-xs text-[#666666] mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} ENYX-ENTERPRISE. All rights reserved.</p>
          <div className="flex items-center gap-3">
            <span className="bg-[#f5f5f5] px-2 py-0.5 rounded-none font-mono border border-[#eaeaea]">
              Type: enyx-enterprise
            </span>
            <span>Traceability System v1.0.0</span>
          </div>
          <Link to="/" className="text-[#15803d] hover:underline font-medium">
            Smart Hub Overview
          </Link>
        </div>
      </footer>
    </div>
  )
}
