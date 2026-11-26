import { useEffect, useState, useCallback } from 'react'
import { Link, useSearchParams, useParams } from 'react-router-dom'
import Logo from '../components/shared/Logo'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import Icon from '../components/shared/Icon'
import { formatWeight, formatSafeDate, formatSafeDateTime } from '../lib/utils'
import OfflineQrCode from '../components/shared/OfflineQrCode'
import { api } from '../services/api'
import CameraScannerModal from '../components/shared/CameraScannerModal'
import { translateStatus } from '../lib/i18n'

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
      commodity: 'Kentang Cuci Eptilu 10 kg',
      variety: 'Kentang Konsumsi Granola',
      grade: 'A/B/C',
      weightKg: Number(w.netWeightKg || w.grossWeightKg || 0),
      farmerName: o.farmerName || '-',
      farmerId: o.farmerCode || '-',
      farmLocation: o.village || '-',
      elevation: '1.450 mdpl',
      harvestDate: formatSafeDate(w.receivedAt),
      intakeDate: formatSafeDateTime(w.receivedAt),
      packDate: w.approvedAt ? formatSafeDateTime(w.approvedAt) : 'Menunggu Sortasi',
      gs1Uri: `https://id.smartgeulis.id/01/08901234567890/21/${w.code || code}`,
      gtin: '8994477090010',
      batchLot: w.code || code,
      serialNumber: w.code || code,
      qualityScore: '99.0 / 100',
      moisturePercent: '78.0%',
      journey: [
        {
          stage: 'Panen & Muat Kebun',
          location: `Kebun ${o.farmerName || '-'} (${o.village || '-'})`,
          timestamp: formatSafeDate(w.receivedAt),
          operator: `${o.farmerName || '-'}`,
          completed: true,
          details: 'Kentang konsumsi dipetik manual dan dimuat ke dalam waring berventilasi.',
        },
        {
          stage: 'Stasiun 01: Penerimaan & Penimbangan',
          location: 'Area Penerimaan SmartGeulis (Timbangan #01)',
          timestamp: formatSafeDateTime(w.receivedAt),
          operator: 'Operator',
          completed: true,
          details: `Berat kotor terverifikasi ${w.grossWeightKg} kg, bersih ${w.netWeightKg} kg. Status: ${translateStatus(w.status)}.`,
        },
        {
          stage: 'Stasiun 02: Sortasi',
          location: 'Lini Sortasi Rumah Kemas (Timbangan #02)',
          timestamp: w.sortedBatch ? 'Tersortasi' : 'Antrean Gudang Buffer',
          operator: 'Mesin Sortasi 3-Tingkat Otomatis',
          completed: Boolean(w.sortedBatch),
          details: w.sortedBatch ? 'Disortasi ke Grade A/B/C' : 'Menunggu antrean buffer ke konveyor sortasi.',
        },
        {
          stage: 'Stasiun 03: Pengemasan Pouch & Karton',
          location: 'Stasiun Pengemasan (Timbangan #03)',
          timestamp: 'Tahap Berikutnya',
          operator: 'Operator Lini Pengemasan',
          completed: false,
          details: 'Pengemasan ke pouch ritel 1 kg atau karton ekspor.',
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
      commodity: intake.commodity || 'Kentang',
      variety: 'Kentang Konsumsi Granola',
      grade: (pkg.grade || 'A') as any,
      weightKg: Number(pkg.weightKg || 1),
      farmerName: origin.farmerName || origin.name || 'Petani Terdaftar',
      farmerId: origin.farmerCode || origin.code || '-',
      farmLocation: origin.village || 'Kebun Dataran Tinggi',
      elevation: '1.450 mdpl',
      harvestDate: formatSafeDate(intake.receivedAt),
      intakeDate: formatSafeDateTime(intake.receivedAt),
      packDate: formatSafeDateTime(pkg.packedAt),
      gs1Uri: `https://id.smartgeulis.id/01/08901234567890/21/${pkg.code || code}`,
      gtin: '8994477090010',
      batchLot: pallet.code || pkg.code,
      serialNumber: pkg.code,
      qualityScore: pkg.grade === 'A' ? '98.5 / 100' : '95.0 / 100',
      moisturePercent: '78.2%',
      journey: [
        {
          stage: 'Panen & Muat Kebun',
          location: `${origin.farmerName} (${origin.village || 'Kebun'})`,
          timestamp: formatSafeDate(intake.receivedAt),
          operator: `${origin.farmerName}`,
          completed: true,
          details: 'Umbi dipanen dan diangkut menggunakan waring berventilasi.',
        },
        {
          stage: 'Stasiun 01: Penerimaan',
          location: 'Area Penerimaan SmartGeulis',
          timestamp: formatSafeDateTime(intake.receivedAt),
          operator: 'Operator Penerimaan',
          completed: true,
          details: `Waring masuk ${intake.waringCode || 'Waring'}, kotor ${intake.grossWeightKg} kg, bersih ${intake.netWeightKg} kg.`,
        },
        {
          stage: 'Stasiun 02: Sortasi',
          location: 'Lini Sortasi Otomatis',
          timestamp: formatSafeDateTime(sorting.sortedAt),
          operator: 'Operator Sortasi',
          completed: true,
          details: `Disortasi ke Grade ${pkg.grade}. Pencucian: ${sorting.washDecision === 'WASHED' ? 'Dicuci' : 'Tanpa Cuci'}. Susut: ${sorting.shrinkagePct || 0}%.`,
        },
        {
          stage: 'Stasiun 03: Pengemasan & Label GS1',
          location: 'Ruang Bersih Pengemasan',
          timestamp: formatSafeDateTime(pkg.packedAt),
          operator: 'Operator Pengemasan',
          completed: true,
          details: `Dikemas ke ${pkg.format === 'RETAIL_POUCH' ? 'Pouch Ritel 1 kg' : 'Karton Ekspor'}. Barcode: ${pkg.barcode || pkg.code}.`,
        },
        {
          stage: 'Pengiriman & Transportasi',
          location: dispatch ? dispatch.destination : 'Gudang Pendingin Barang Jadi',
          timestamp: dispatch ? formatSafeDateTime(dispatch.departedAt) : 'Di Gudang',
          operator: dispatch ? `Pengemudi: ${dispatch.driverName} (${dispatch.truckPlate})` : 'Petugas Gudang',
          completed: Boolean(dispatch),
          details: dispatch ? `Dikirim dengan manifes ${dispatch.deliveryCode} ke ${dispatch.destination}` : 'Tersimpan di gudang pendingin menunggu pengiriman.',
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
    commodity: intake.commodity || 'Kentang',
    variety: 'Kentang Konsumsi Granola',
    grade: (pallet.grade || 'A') as any,
    weightKg: Number(pallet.initialWeightKg || pallet.weightKg || 0),
    farmerName: origin.farmerName || origin.name || 'Petani Terdaftar',
    farmerId: origin.farmerCode || origin.code || '-',
    farmLocation: origin.village || 'Kebun Dataran Tinggi',
    elevation: '1.450 mdpl',
    harvestDate: formatSafeDate(intake.receivedAt),
    intakeDate: formatSafeDateTime(intake.receivedAt),
    packDate: formatSafeDateTime(pallet.createdAt),
    gs1Uri: `https://id.smartgeulis.id/01/08901234567890/21/${pallet.code || code}`,
    gtin: '8994477090010',
    batchLot: pallet.code || code,
    serialNumber: pallet.code || code,
    qualityScore: '97.5 / 100',
    moisturePercent: '78.5%',
    journey: [
      {
        stage: 'Panen & Muat Kebun',
        location: `${origin.farmerName} (${origin.village || 'Kebun'})`,
        timestamp: formatSafeDate(intake.receivedAt),
        operator: `${origin.farmerName}`,
        completed: true,
        details: 'Umbi dipanen dan diangkut menggunakan waring berventilasi.',
      },
      {
        stage: 'Stasiun 01: Penerimaan',
        location: 'Area Penerimaan SmartGeulis',
        timestamp: formatSafeDateTime(intake.receivedAt),
        operator: 'Operator Penerimaan',
        completed: true,
        details: `Waring masuk ${intake.waringCode || 'Waring'}, kotor ${intake.grossWeightKg} kg, bersih ${intake.netWeightKg} kg.`,
      },
      {
        stage: 'Stasiun 02: Sortasi & Penataan Palet',
        location: 'Lini Sortasi Rumah Kemas',
        timestamp: formatSafeDateTime(pallet.createdAt),
        operator: 'Mesin Sortasi 3-Tingkat Otomatis',
        completed: true,
        details: `Ditata pada Palet Grade ${pallet.grade}. Sisa berat: ${pallet.remainingKg || pallet.weightKg} kg.`,
      },
      {
        stage: 'Stasiun 03: Pengemasan Pouch',
        location: 'Stasiun Pengemasan',
        timestamp: pallet.status === 'IN_PACKAGING' ? 'Sedang Diproses' : 'Menunggu',
        operator: 'Lini Pengemasan',
        completed: pallet.status === 'DEPLETED',
        details: 'Dialirkan ke stasiun pengisian dan penyegelan pouch.',
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

  // Camera modal state
  const [scannerOpen, setScannerOpen] = useState(false)
  const startCamera = () => setScannerOpen(true)
  const stopCamera = () => setScannerOpen(false)

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
    <div className="min-h-screen bg-[#fafafa] text-[#171717] font-['Archivo',sans-serif] selection:bg-[#fff7ed] selection:text-[#ea580c] flex flex-col">
      {/* ── Top Header Bar ── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#eaeaea]">
        <div className="public-trace-header max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="public-trace-brand flex items-center gap-3 group min-w-0" aria-label="Beranda SmartGeulis">
            <Logo className="h-8 w-auto" markOnly />
            <div className="public-trace-brand-copy min-w-0">
              <div className="public-trace-brand-title font-display text-2xl leading-none tracking-wider text-[#171717] flex items-center gap-2">
                SmartGeulis
              </div>
              <div className="public-trace-brand-subtitle font-mono-custom text-[10px] text-[#666666] tracking-[0.25em] uppercase">
                SISTEM KETERTELUSURAN
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-[#666666] hover:text-[#171717] px-3 py-2 rounded-sm transition-colors"
            >
              <Icon name="arrow-left" size={14} />
              <span>Kembali ke Beranda</span>
            </Link>
            <Link
              to="/login"
              className="public-trace-login inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider bg-[#000000] text-white hover:bg-[#333333] px-4 py-2 rounded-sm transition-colors shrink-0"
            >
              <span>Masuk Operator</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Container ── */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 w-full flex-1 space-y-8">
        {/* Page Title & Mission Banner */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <Badge tone="accent" icon="qr" className="px-3 py-1 text-xs">
            Verifikasi Produk
          </Badge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#171717]">
            Ketertelusuran Produk
          </h1>
          <p className="text-sm sm:text-base text-[#666666] leading-relaxed">
            Pindai kode QR pada pouch atau palet kentang Anda, atau masukkan kode secara manual untuk memastikan asal dan kualitas produk.
          </p>
        </div>

        {/* Search & Code Resolver Box */}
        <div className="bg-white border border-[#eaeaea] rounded-none p-5 sm:p-7 shadow-xs space-y-5">
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-[#666666]">
              Masukkan Kode Pouch atau Palet
            </label>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={queryCode}
                  onChange={(e) => setQueryCode(e.target.value)}
                  placeholder="Contoh: PCH-PLT-20260914-0001-001 atau PLT-20261011-0042"
                  className="w-full bg-[#fafafa] border border-[#d1d5db] rounded-none px-4 py-3 font-mono text-sm text-[#171717] placeholder:text-[#999999] focus:outline-none focus:border-[#ea580c] focus:ring-2 focus:ring-[#ea580c]/20 transition-all"
                />
                {queryCode && (
                  <button
                    type="button"
                    onClick={() => setQueryCode('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999999] hover:text-[#171717] p-1"
                    aria-label="Hapus kode"
                  >
                    <Icon name="close" size={14} />
                  </button>
                )}
              </div>

              <div className="trace-actions flex gap-2">
                <Button
                  type="submit"
                  variant="primary"
                  icon="search"
                  className="min-w-0 px-6 py-3 text-sm font-semibold justify-center flex-1 sm:flex-none"
                >
                  Lacak Produk
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  icon="scan"
                  onClick={() => startCamera()}
                  className="min-w-0 px-4 py-3 text-sm font-semibold justify-center flex-1 sm:flex-none"
                >
                  Pindai QR
                </Button>
              </div>
            </div>
          </form>

          {/* Quick Sample Chips for Instant Verification */}
          <div className="pt-4 border-t border-[#f0f0f0] flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono text-[#666666] tracking-wider uppercase mr-1">
              Data Contoh:
            </span>
            <button
              type="button"
              onClick={() => handleSelectSampleCode('WRG-20261026-0001')}
              className="text-xs font-mono bg-[#fff7ed] text-[#ea580c] hover:bg-[#ffedd5] border border-[#fed7aa] px-2.5 py-1 rounded-none transition-colors"
            >
              Waring Penerimaan (WRG-20261026-0001)
            </button>
          </div>
        </div>

        {/* ── Universal Camera Barcode/QR Scanner Modal ── */}
        <CameraScannerModal
          isOpen={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onScan={(code) => {
            setQueryCode(code)
            setSearchParams({ code })
            executeSearch(code)
          }}
          title="Pemindai Kode QR & Barcode"
          subtitle="Arahkan kode QR pada stiker kemasan atau waring ke dalam bingkai."
          manualPlaceholder="Masukkan kode lacak (WRG-..., PCH-..., PLT-...)..."
          quickOptions={[
            { label: 'Contoh Waring (WRG-20261026-0001)', value: 'WRG-20261026-0001' },
            { label: 'Contoh Pouch (PCH-GRD-A-0001)', value: 'PCH-GRD-A-0001' },
          ]}
        />

        {/* ── NOT FOUND STATE ── */}
        {searched && !result && (
          <div className="bg-white border border-[#eaeaea] rounded-none p-8 sm:p-12 text-center space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded-none bg-[#fef2f2] text-[#ef4444] flex items-center justify-center mx-auto">
              <Icon name="alert" size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#171717]">Data Tidak Ditemukan</h3>
              <p className="text-sm text-[#666666] max-w-md mx-auto">
                Tidak ditemukan batch terverifikasi dengan kode <span className="font-mono font-bold text-[#171717]">{queryCode}</span>.
                Periksa format kode atau coba tombol contoh di atas.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              icon="refresh"
              onClick={() => handleSelectSampleCode('WRG-20261026-0001')}
            >
              Muat Waring Terverifikasi
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
                      Terverifikasi Asli
                    </Badge>
                    <Badge tone="neutral" className="font-mono uppercase text-xs">
                      {result.type === 'SORTED_PALLET' ? 'PALET TERSORTASI' : result.type === 'PALLET' ? 'PALET' : 'POUCH'}
                    </Badge>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-[#171717]">
                    {result.code}
                  </h2>
                  <p className="text-xs text-[#666666] font-mono mt-1">
                    Tautan Produk: <a href={result.gs1Uri} target="_blank" rel="noreferrer" className="text-[#ea580c] hover:underline">Buka tautan</a>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    icon="print"
                    onClick={handlePrintCertificate}
                  >
                    Cetak Sertifikat
                  </Button>
                </div>
              </div>

              {/* Product Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-[#fafafa] rounded-none border border-[#f0f0f0]">
                  <span className="text-[11px] font-mono uppercase text-[#666666] block">Produk & Varietas</span>
                  <span className="text-base font-bold text-[#171717] mt-1 block">{result.variety}</span>
                </div>

                <div className="p-4 bg-[#fafafa] rounded-none border border-[#f0f0f0]">
                  <span className="text-[11px] font-mono uppercase text-[#666666] block">Grade</span>
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
                  <span className="text-[11px] font-mono uppercase text-[#666666] block">Berat Bersih Terverifikasi</span>
                  <span className="text-base font-bold font-mono text-emerald-600 mt-1 block">
                    {formatWeight(result.weightKg)} kg
                  </span>
                </div>

                <div className="p-4 bg-[#fafafa] rounded-none border border-[#f0f0f0]">
                  <span className="text-[11px] font-mono uppercase text-[#666666] block">Kualitas</span>
                  <span className="text-base font-bold text-[#171717] mt-1 block">{result.qualityScore}</span>
                </div>
              </div>

              {/* Farm Origin & Field Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                <div className="space-y-3">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-[#666666] font-semibold">
                    Asal Kebun
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-1.5 border-b border-[#f0f0f0]">
                      <span className="text-[#666666]">Petani / Produsen</span>
                      <span className="font-semibold text-[#171717]">{result.farmerName} ({result.farmerId})</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-[#f0f0f0]">
                      <span className="text-[#666666]">Lokasi</span>
                      <span className="font-semibold text-[#171717]">{result.farmLocation}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-[#f0f0f0]">
                      <span className="text-[#666666]">Ketinggian</span>
                      <span className="font-semibold text-[#171717]">{result.elevation}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-[#666666] font-semibold">
                    Detail Batch
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-1.5 border-b border-[#f0f0f0]">
                      <span className="text-[#666666]">Nomor Produk</span>
                      <span className="font-mono font-semibold text-[#171717]">{result.gtin}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-[#f0f0f0]">
                      <span className="text-[#666666]">Nomor Batch / Lot</span>
                      <span className="font-mono font-semibold text-[#171717]">{result.batchLot}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-[#f0f0f0]">
                      <span className="text-[#666666]">Tanggal Panen</span>
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
                  Riwayat Panen & Pemrosesan Terverifikasi
                </h3>
                <p className="text-xs text-[#666666]">
                  Setiap tahap tercatat waktunya dan dikonfirmasi oleh tim rumah kemas.
                </p>
              </div>

              <div className="relative pl-6 sm:pl-8 border-l-2 border-[#eaeaea] space-y-8 my-6">
                {result.journey.map((step, index) => (
                  <div key={index} className="relative group">
                    {/* Timeline Node Dot */}
                    <div
                      className={`absolute -left-[31px] sm:-left-[39px] top-1 w-6 h-6 rounded-none flex items-center justify-center text-xs font-bold transition-all ${
                        step.completed
                          ? 'bg-[#ea580c] text-white shadow-[0_0_0_4px_#fff7ed]'
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

                      <p className="text-xs font-medium text-[#ea580c]">
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

            {/* Product QR Visual Representation */}
            <div className="bg-white border border-[#eaeaea] rounded-none p-6 sm:p-8 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2 max-w-lg">
                <Badge tone="accent" className="font-mono text-[10px]">
                  QR PRODUK
                </Badge>
                <h4 className="text-lg font-bold text-[#171717]">
                  Kode QR Verifikasi Produk
                </h4>
                <p className="text-xs text-[#666666] leading-relaxed">
                  Konsumen dan peritel dapat memindai kode QR pada stiker kemasan menggunakan kamera ponsel standar untuk melihat halaman verifikasi ini.
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
          <p>© {new Date().getFullYear()} SmartGeulis. Hak cipta dilindungi.</p>
          <div className="flex items-center gap-3">
            <span className="bg-[#f5f5f5] px-2 py-0.5 rounded-none font-mono border border-[#eaeaea]">
              Tipe: smartgeulis
            </span>
            <span>Sistem Ketertelusuran v1.0.0</span>
          </div>
          <Link to="/" className="text-[#ea580c] hover:underline font-medium">
            Ringkasan SmartGeulis
          </Link>
        </div>
      </footer>
    </div>
  )
}
