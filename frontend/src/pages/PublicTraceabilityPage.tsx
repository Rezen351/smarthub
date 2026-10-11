import { useEffect, useState, useRef, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Logo from '../components/shared/Logo'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import Icon from '../components/shared/Icon'
import { formatWeight } from '../lib/utils'

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

const PRESET_MOCKS: Record<string, TraceResult> = {
  'PCH-PLT-20260914-0001-001': {
    code: 'PCH-PLT-20260914-0001-001',
    type: 'POUCH',
    commodity: 'Potato',
    variety: 'Granola Table Potato',
    grade: 'A',
    weightKg: 1,
    farmerName: 'Ahmad Santoso',
    farmerId: 'FMR-001',
    farmLocation: 'Dieng Plateau, Central Java',
    elevation: '1,450 m ASL',
    harvestDate: '2026-09-12',
    intakeDate: '2026-09-14 08:15',
    packDate: '2026-09-14 10:05',
    gs1Uri: 'https://id.enyx.io/01/08901234567890/21/PCH-PLT-20260914-0001-001',
    gtin: '08901234567890',
    batchLot: 'LOT-20260914-01',
    serialNumber: 'PCH-001',
    qualityScore: '98.5 / 100',
    moisturePercent: '78.2%',
    journey: [
      {
        stage: 'Field Harvest',
        location: 'Ahmad Santoso Farm (Plot #D-04)',
        timestamp: '2026-09-12 07:30',
        operator: 'Ahmad Santoso (Farmer)',
        completed: true,
        details: 'Hand-picked, matured tubers, zero rot detected',
      },
      {
        stage: 'Intake Weighing',
        location: 'Hub Station 01 — Platform Scale',
        timestamp: '2026-09-14 08:15',
        operator: 'Marcus Reid (Weighing Operator)',
        completed: true,
        details: 'Gross 172.5 kg, Tare 4.5 kg, Net Approved 168.0 kg',
      },
      {
        stage: 'Sorting & Classification',
        location: 'Sorting Station 01',
        timestamp: '2026-09-14 09:40',
        operator: 'Elena Voss (Quality Inspector)',
        completed: true,
        details: 'Grade A classification (size > 150g, no green skin, no blight)',
      },
      {
        stage: 'Pouch Packaging',
        location: 'Packaging Station A — Channel A',
        timestamp: '2026-09-14 10:05',
        operator: 'Jiang "Tank" Wei (Packaging Lead)',
        completed: true,
        details: 'Retail pack 1.000 kg ± 5g. GS1 Digital Link sticker attached',
      },
      {
        stage: 'Warehouse Inbound',
        location: 'Central Storage Bin #B-04',
        timestamp: '2026-09-14 10:30',
        operator: 'Alex Mercer (Warehouse Lead)',
        completed: true,
        details: 'Temperature 8.5°C, humidity 85%, pallet sealed',
      },
      {
        stage: 'Logistics & Dispatch',
        location: 'Cold-Chain Reefer Truck #TRK-08',
        timestamp: '2026-09-15 06:00',
        operator: 'Budi Hartono (Driver)',
        completed: true,
        details: 'ITF-14 barcode verified, departing to Supermarket Distribution Center',
      },
    ],
  },
  'GRD-PLT-20261011-0042-A': {
    code: 'GRD-PLT-20261011-0042-A',
    type: 'SORTED_PALLET',
    commodity: 'Potato',
    variety: 'Atlantic Processing Potato',
    grade: 'A',
    weightKg: 120,
    farmerName: 'Siti Rahmawati',
    farmerId: 'FMR-003',
    farmLocation: 'Pangalengan, West Java',
    elevation: '1,420 m ASL',
    harvestDate: '2026-10-10',
    intakeDate: '2026-10-11 07:45',
    packDate: '2026-10-11 08:30',
    gs1Uri: 'https://id.enyx.io/01/08901234567890/10/GRD-PLT-20261011-0042-A',
    gtin: '08901234567890',
    batchLot: 'LOT-20261011-0042',
    serialNumber: 'GRD-PLT-A-042',
    qualityScore: '99.0 / 100',
    moisturePercent: '77.8%',
    journey: [
      {
        stage: 'Field Harvest',
        location: 'Pangalengan Ridge Block 2',
        timestamp: '2026-10-10 06:45',
        operator: 'Siti Rahmawati',
        completed: true,
        details: 'Chipping potato quality, dry matter > 21%',
      },
      {
        stage: 'Intake Weighing',
        location: 'Weighing Station 01',
        timestamp: '2026-10-11 07:45',
        operator: 'Weighing Station Modbus TCP',
        completed: true,
        details: 'Intake pallet verified at 123.0 kg',
      },
      {
        stage: 'Sorting & Classification',
        location: 'Sorting Area Belt 02',
        timestamp: '2026-10-11 08:30',
        operator: 'Quality Inspector #2',
        completed: true,
        details: 'Grade A Sorted Pallet generated and sealed',
      },
      {
        stage: 'Warehouse Storage',
        location: 'Cold Storage Room #2',
        timestamp: '2026-10-11 09:00',
        operator: 'Warehouse Ops',
        completed: true,
        details: 'Queued for 1 kg retail pouch packaging station',
      },
    ],
  },
  'PLT-20261011-0042': {
    code: 'PLT-20261011-0042',
    type: 'PALLET',
    commodity: 'Potato',
    variety: 'Granola Table Potato',
    grade: 'A/B/C',
    weightKg: 123,
    farmerName: 'Bambang Kusuma',
    farmerId: 'FMR-005',
    farmLocation: 'Wonosobo Highlands, Central Java',
    elevation: '1,380 m ASL',
    harvestDate: '2026-10-10',
    intakeDate: '2026-10-11 07:20',
    packDate: 'In Intake Queue',
    gs1Uri: 'https://id.enyx.io/01/08901234567890/10/PLT-20261011-0042',
    gtin: '08901234567890',
    batchLot: 'PLT-20261011-0042',
    serialNumber: 'PLT-0042',
    qualityScore: '97.0 / 100',
    moisturePercent: '79.1%',
    journey: [
      {
        stage: 'Field Harvest',
        location: 'Wonosobo South Valley Plot #07',
        timestamp: '2026-10-10 07:00',
        operator: 'Bambang Kusuma',
        completed: true,
        details: 'Delivered in woven sacks directly to collection hub',
      },
      {
        stage: 'Intake Weighing',
        location: 'Weighing Station #1',
        timestamp: '2026-10-11 07:20',
        operator: 'Weighing Operator',
        completed: true,
        details: 'Official weight approved: 123 kg. Struk Petani & QR Pallet printed',
      },
      {
        stage: 'Sorting & Classification',
        location: 'Sorting Area',
        timestamp: 'Pending Transfer',
        operator: 'Sorting Station',
        completed: false,
        details: 'Ready to scan QR pallet label for Grade A/B/C classification',
      },
    ],
  },
}

/** Extract code or serial from GS1 Digital Link URL or plain text input. */
function extractCode(input: string): string {
  const clean = input.trim()
  const match = clean.match(/\/(21|10)\/([^/?#]+)/)
  if (match) return decodeURIComponent(match[2]).toUpperCase()
  return clean.toUpperCase()
}

/** Synthesize realistic trace details if code matches standard naming convention. */
function resolveTraceResult(inputCode: string): TraceResult | null {
  const code = extractCode(inputCode)
  if (PRESET_MOCKS[code]) {
    return PRESET_MOCKS[code]
  }

  // Dynamic synthesizer for POUCH codes
  if (code.startsWith('PCH-')) {
    const isGradeB = code.includes('-B')
    const isGradeC = code.includes('-C')
    const grade: 'A' | 'B' | 'C' = isGradeC ? 'C' : isGradeB ? 'B' : 'A'
    return {
      code,
      type: 'POUCH',
      commodity: 'Potato',
      variety: 'Granola Table Potato',
      grade,
      weightKg: 1,
      farmerName: 'Agro Sentosa Cooperative',
      farmerId: 'FMR-COOP-01',
      farmLocation: 'Pangalengan Highland Valley',
      elevation: '1,420 m ASL',
      harvestDate: new Date().toISOString().slice(0, 10),
      intakeDate: 'Today 08:30',
      packDate: 'Today 09:45',
      gs1Uri: `https://id.enyx.io/01/08901234567890/21/${code}`,
      gtin: '08901234567890',
      batchLot: 'LOT-' + code.slice(4, 12),
      serialNumber: code,
      qualityScore: grade === 'A' ? '98.0 / 100' : '94.5 / 100',
      moisturePercent: '78.0%',
      journey: [
        {
          stage: 'Field Harvest',
          location: 'Highland Cooperative Plot #02',
          timestamp: 'Harvest Date',
          operator: 'Registered Farmer Co-op',
          completed: true,
          details: 'Tubers harvested and transported in ventilated sacks',
        },
        {
          stage: 'Intake Weighing',
          location: 'Packhouse Intake Station',
          timestamp: 'Session #1',
          operator: 'Weighing Station Modbus TCP',
          completed: true,
          details: 'Official gross and net weight verified with dual printing',
        },
        {
          stage: 'Sorting & Classification',
          location: 'Optical Sorting Belt',
          timestamp: 'Session #2',
          operator: 'Sorting Operator',
          completed: true,
          details: `Classified into Grade ${grade} based on diameter and tuber purity`,
        },
        {
          stage: 'Pouch Packaging',
          location: `Packaging Station — Channel ${grade}`,
          timestamp: 'Packaging Timestamp',
          operator: 'Packaging Operator',
          completed: true,
          details: '1.000 kg retail pouch weighed, sealed, and labeled with GS1 QR',
        },
        {
          stage: 'Warehouse & Dispatch',
          location: 'Cold Chain Staging',
          timestamp: 'In Dispatch Buffer',
          operator: 'Warehouse Operator',
          completed: true,
          details: 'Stored in monitored cold storage at 8°C prior to supermarket dispatch',
        },
      ],
    }
  }

  // Dynamic synthesizer for PALLET codes
  if (code.startsWith('PLT-') || code.startsWith('GRD-PLT-')) {
    const isSorted = code.startsWith('GRD-PLT-')
    const gradeMatch = code.match(/-([ABC])$/)
    const grade = (gradeMatch ? gradeMatch[1] : 'A/B/C') as 'A' | 'B' | 'C' | 'A/B/C'
    return {
      code,
      type: isSorted ? 'SORTED_PALLET' : 'PALLET',
      commodity: 'Potato',
      variety: 'Granola Potato',
      grade,
      weightKg: isSorted ? 120 : 150,
      farmerName: 'Dieng Harvest Association',
      farmerId: 'FMR-DNG-08',
      farmLocation: 'Dieng Plateau, Central Java',
      elevation: '1,500 m ASL',
      harvestDate: new Date().toISOString().slice(0, 10),
      intakeDate: 'Today 07:15',
      packDate: isSorted ? 'Sorted Today' : 'Pending Sorting',
      gs1Uri: `https://id.enyx.io/01/08901234567890/10/${code}`,
      gtin: '08901234567890',
      batchLot: code,
      serialNumber: code,
      qualityScore: '97.5 / 100',
      moisturePercent: '78.5%',
      journey: [
        {
          stage: 'Field Harvest',
          location: 'Dieng Plateau Organic Farm',
          timestamp: 'Harvest Cycle',
          operator: 'Dieng Farmer Association',
          completed: true,
          details: 'High-elevation harvest with certified soil condition',
        },
        {
          stage: 'Intake Weighing',
          location: 'Central Intake Station 01',
          timestamp: 'Intake Timestamp',
          operator: 'Modbus Platform Scale',
          completed: true,
          details: 'Pallet tare subtracted, official intake weight approved',
        },
        {
          stage: 'Sorting Station',
          location: 'Sorting Area',
          timestamp: isSorted ? 'Completed' : 'Queued',
          operator: 'Sorting Team',
          completed: isSorted,
          details: isSorted
            ? `Assigned to Grade ${grade} and printed with barcode`
            : 'Pending scan of intake QR label at sorting station',
        },
      ],
    }
  }

  return null
}

export default function PublicTraceabilityPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [queryCode, setQueryCode] = useState('')
  const [searched, setSearched] = useState(false)
  const [result, setResult] = useState<TraceResult | null>(null)

  // Camera & live scanner state
  const [scannerOpen, setScannerOpen] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setCameraActive(false)
  }, [])

  const startCamera = useCallback(async () => {
    setCameraError(null)
    setScannerOpen(true)
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by your browser.')
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      setCameraActive(true)
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

  const executeSearch = useCallback((rawCode: string) => {
    const trimmed = rawCode.trim()
    if (!trimmed) return
    const matched = resolveTraceResult(trimmed)
    setResult(matched)
    setSearched(true)
    stopCamera()
    setScannerOpen(false)
  }, [stopCamera])

  // Resolve code from query params (e.g. ?code=... or ?link=...)
  useEffect(() => {
    const param = searchParams.get('code') ?? searchParams.get('link')
    if (param) {
      setQueryCode(param)
      executeSearch(param)
    } else {
      // Default initial view: load the showcase pouch sample
      setQueryCode('PCH-PLT-20260914-0001-001')
      executeSearch('PCH-PLT-20260914-0001-001')
    }
  }, [searchParams, executeSearch])

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSearchParams({ code: queryCode })
    executeSearch(queryCode)
  }

  const handleSimulateScan = (codeToSimulate: string) => {
    setQueryCode(codeToSimulate)
    setSearchParams({ code: codeToSimulate })
    executeSearch(codeToSimulate)
  }

  const handlePrintCertificate = () => {
    window.print()
  }

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#171717] font-['Archivo',sans-serif] selection:bg-[#f0fdf4] selection:text-[#15803d] flex flex-col">
      {/* ── Top Header Bar ── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#eaeaea]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group" aria-label="ENYX-SMART HUB home">
            <Logo className="h-8 w-auto" markOnly />
            <div>
              <div className="font-display text-2xl leading-none tracking-wider text-[#171717] flex items-center gap-2">
                ENYX-SMART HUB
              </div>
              <div className="font-mono-custom text-[10px] text-[#666666] tracking-[0.25em] uppercase">
                TRACEABILITY · ENTERPRISE
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
                  onClick={startCamera}
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
              Test Samples:
            </span>
            <button
              type="button"
              onClick={() => handleSimulateScan('PCH-PLT-20260914-0001-001')}
              className="text-xs font-mono bg-[#f0fdf4] text-[#15803d] hover:bg-[#dcfce7] border border-[#bbf7d0] px-2.5 py-1 rounded-none transition-colors"
            >
              Pouch 1 kg Grade A
            </button>
            <button
              type="button"
              onClick={() => handleSimulateScan('GRD-PLT-20261011-0042-A')}
              className="text-xs font-mono bg-[#f0fdf4] text-[#15803d] hover:bg-[#dcfce7] border border-[#bbf7d0] px-2.5 py-1 rounded-none transition-colors"
            >
              Sorted Pallet Grade A
            </button>
            <button
              type="button"
              onClick={() => handleSimulateScan('PLT-20261011-0042')}
              className="text-xs font-mono bg-[#fef2f2] text-[#b91c1c] hover:bg-[#fee2e2] border border-[#fecaca] px-2.5 py-1 rounded-none transition-colors"
            >
              Intake Pallet (123 kg)
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
                  className="text-[#666666] hover:text-[#171717] p-1"
                >
                  <Icon name="close" size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {cameraActive ? (
                  <div className="relative rounded-none overflow-hidden aspect-square bg-black flex items-center justify-center">
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      playsInline
                      muted
                      autoPlay
                    />
                    {/* Viewfinder Reticle & Laser */}
                    <div className="absolute inset-8 border-2 border-[#229856] rounded-none pointer-events-none">
                      <div className="w-full h-0.5 bg-[#229856] shadow-[0_0_8px_#229856] animate-bounce" />
                    </div>
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
                          : 'Position the QR code within the frame, or test using the simulation buttons below.'}
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-2 pt-2">
                  <p className="text-xs font-mono text-[#666666] uppercase text-center">
                    Simulate Camera Scans:
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSimulateScan('PCH-PLT-20260914-0001-001')}
                      className="text-xs justify-center font-mono"
                    >
                      Pouch QR (Grade A)
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSimulateScan('PLT-20261011-0042')}
                      className="text-xs justify-center font-mono"
                    >
                      Pallet QR (123 kg)
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
              onClick={() => handleSimulateScan('PCH-PLT-20260914-0001-001')}
            >
              Load Default Pouch
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
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(
                    result.gs1Uri
                  )}`}
                  alt="GS1 Digital Link QR"
                  className="w-32 h-32 object-contain"
                />
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
          <p>© {new Date().getFullYear()} ENYX-SMART HUB. All rights reserved.</p>
          <div className="flex items-center gap-3">
            <span className="bg-[#f5f5f5] px-2 py-0.5 rounded-none font-mono border border-[#eaeaea]">
              Type: enyx-enterprise
            </span>
            <span>Traceability Enterprise v1.0.0</span>
          </div>
          <Link to="/" className="text-[#15803d] hover:underline font-medium">
            Smart Hub Overview
          </Link>
        </div>
      </footer>
    </div>
  )
}
