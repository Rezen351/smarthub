import { formatWeight } from '../../lib/utils'
import OfflineBarcode from '../shared/OfflineBarcode'
import OfflineQrCode from '../shared/OfflineQrCode'

export interface LabelPreviewProps {
  type: 'pallet' | 'grade' | 'pouch' | 'receipt' | 'waring' | 'export'
  code: string
  farmerName?: string
  farmerId?: string
  grade?: 'A' | 'B' | 'C'
  weightKg?: number
  commodity?: string
  date?: string
  time?: string
  stationName?: string
  compact?: boolean
  className?: string
}

export default function LabelPreview({
  type,
  code,
  farmerName = 'Ahmad Santoso',
  farmerId = 'FRM-2026-0001',
  grade = 'A',
  weightKg,
  commodity = 'Kentang (Potatoes)',
  date = new Date().toISOString().slice(0, 10),
  time = 'Live',
  stationName,
  compact = false,
  className = '',
}: LabelPreviewProps) {
  /* ── 1. RECEIPT SLIP ── */
  if (type === 'receipt') {
    return (
      <div
        className={`printable-label bg-white text-black border-2 border-dashed border-gray-400 font-mono rounded-none p-4 shadow-sm space-y-3 ${className}`}
      >
        <div className="text-center pb-2 border-b border-dashed border-gray-400">
          <span className="text-[11px] font-bold tracking-wider uppercase block text-gray-800 print:text-black">
            ENYX-ENTERPRISE · RECEIVING INTAKE SLIP
          </span>
          <span className="text-[10px] text-gray-500 print:text-gray-700 block">OFFICIAL WEIGHING RECEIPT</span>
          <span className="text-xs font-semibold text-gray-700 print:text-black block mt-1">
            {date} · {time}
          </span>
        </div>
        <div className="py-2 border-b border-dashed border-gray-300 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-600 print:text-gray-700">Farmer:</span>
            <span className="font-bold print:text-black">{farmerName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 print:text-gray-700">Farmer ID:</span>
            <span className="font-mono text-xs print:text-black">{farmerId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 print:text-gray-700">Waring Code:</span>
            <span className="font-mono font-semibold print:text-black">{code}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 print:text-gray-700">Commodity:</span>
            <span className="print:text-black">{commodity}</span>
          </div>
        </div>
        <div className="py-3 border-b border-dashed border-gray-400 text-center">
          <span className="text-[10px] uppercase text-gray-500 print:text-gray-700 block">OFFICIAL GROSS INTAKE WEIGHT</span>
          <span className="text-2xl font-black text-emerald-800 print:text-black block">
            {weightKg !== undefined ? formatWeight(weightKg) : '0'} kg
          </span>
          <span className="text-[10px] text-emerald-700 print:text-black font-bold block uppercase mt-0.5">
            Status: BUFFER_WAITING (DISPATCHED TO QUEUE)
          </span>
        </div>
        <div className="pt-1 text-[10px] text-gray-500 print:text-gray-700 text-center italic">
          * Retain this receipt for farmer settlement & deposit verification. *
        </div>
      </div>
    )
  }

  /* ── 2. WARING INTAKE QR LABEL (WRG-...) ── */
  if (type === 'waring') {
    return (
      <div
        className={`printable-label bg-white text-black border-2 border-dashed border-gray-400 font-mono rounded-none p-4 shadow-sm space-y-3 ${className}`}
      >
        <div className="flex items-center justify-between pb-2 border-b border-gray-300">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-bold block text-gray-600 print:text-gray-700">
              ENYX-ENTERPRISE · RAW HARVEST WARING
            </span>
            <span className="text-base font-bold tracking-tight block text-gray-900 print:text-black mt-0.5">
              {code || 'WRG-PENDING'}
            </span>
          </div>
          <div className="px-2 py-0.5 bg-black text-white font-bold text-[10px] border border-black">
            BUFFER QUEUE
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 py-1">
          <div className="flex-1 space-y-1">
            <span className="text-[10px] text-gray-500 print:text-gray-700 uppercase block">Gross Weight</span>
            <span className="text-2xl font-black text-emerald-800 print:text-black tracking-tight block">
              {weightKg !== undefined ? formatWeight(weightKg) : '---'} kg
            </span>
            <span className="text-[10px] text-gray-600 print:text-black block">{commodity}</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <OfflineQrCode value={code || 'WRG-PENDING'} size={compact ? 44 : 52} />
            <span className="text-[8px] text-gray-500 print:text-gray-700 uppercase">Scan to Pair</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-gray-200">
          <div>
            <span className="text-gray-500 block text-[10px]">Farmer</span>
            <span className="font-semibold truncate block">{farmerName}</span>
            <span className="text-[10px] text-gray-500 font-mono">{farmerId}</span>
          </div>
          <div>
            <span className="text-gray-500 block text-[10px]">Destination</span>
            <span className="font-semibold text-gray-800 block">Buffer Warehouse</span>
            <span className="text-[10px] text-gray-500">Zone: Raw Queue</span>
          </div>
        </div>

        <div className="pt-1 text-[10px] text-gray-500 text-center border-t border-gray-200">
          Date: {date} · Scan at Manual Sorting station to associate with pallet.
        </div>
      </div>
    )
  }

  /* ── 3. INTAKE PALLET LABEL (PLT-...) ── */
  if (type === 'pallet') {
    return (
      <div
        className={`printable-label bg-white text-black border-2 border-dashed border-gray-400 font-mono rounded-none p-4 shadow-sm space-y-3 ${className}`}
      >
        <div className="flex items-center justify-between pb-2 border-b border-gray-300">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-bold block text-gray-600">
              ENYX-ENTERPRISE · SORTING PALLET
            </span>
            <span className="text-base font-bold tracking-tight block text-gray-900 mt-0.5">
              {code || 'PLT-PENDING'}
            </span>
          </div>
          <OfflineQrCode value={code || 'PLT-PENDING'} size={compact ? 44 : 52} />
        </div>

        <div className="py-1 flex justify-center">
          <OfflineBarcode value={code || 'PLT-PENDING'} height={compact ? 24 : 32} width={compact ? 160 : 200} />
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-gray-200">
          <div>
            <span className="text-gray-500 block text-[10px]">Associated Waring</span>
            <span className="font-semibold font-mono truncate block text-xs">{farmerId || 'WRG-BATCH'}</span>
          </div>
          <div>
            <span className="text-gray-500 block text-[10px]">Sorting Status</span>
            <span className="font-bold text-emerald-800 block">MANUAL SORTED</span>
          </div>
        </div>

        <div className="pt-1 text-[10px] text-gray-500 text-center border-t border-gray-200">
          Date: {date} · Target: Mechanical Sizer & Grading Station.
        </div>
      </div>
    )
  }

  /* ── 4. SORTED PALLET LABEL (GRD-...) ── */
  if (type === 'grade') {
    return (
      <div
        className={`printable-label bg-white text-black border-2 border-dashed border-gray-400 font-mono rounded-none p-4 shadow-sm space-y-3 ${className}`}
      >
        <div className="flex items-center justify-between pb-2 border-b border-gray-300">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-bold block text-gray-600">
              ENYX-ENTERPRISE · SORTED PALLET
            </span>
            <span className="text-base font-bold tracking-tight block text-gray-900 mt-0.5">
              {code}
            </span>
          </div>
          <div className="px-3 py-1 bg-black text-white rounded-none font-black text-sm tracking-wide">
            GRADE {grade}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 py-1">
          <div className="flex-1 flex justify-center">
            <OfflineBarcode value={code || 'GRD-PENDING'} height={compact ? 24 : 30} width={compact ? 140 : 180} />
          </div>
          <OfflineQrCode value={code || 'GRD-PENDING'} size={compact ? 44 : 50} />
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-gray-200">
          <div>
            <span className="text-gray-500 block text-[10px]">Source Lot / Farmer</span>
            <span className="font-semibold truncate block">{farmerName}</span>
          </div>
          <div>
            <span className="text-gray-500 block text-[10px]">Commodity Grade</span>
            <span className="font-bold text-gray-900 block">
              Grade {grade} ({grade === 'A' ? 'Premium' : grade === 'B' ? 'Medium' : 'Industrial'})
            </span>
          </div>
        </div>

        <div className="pt-1 text-[10px] text-gray-500 text-center border-t border-gray-200">
          Date: {date} · Sorted produce ready for packaging station.
        </div>
      </div>
    )
  }

  /* ── 5. BULK EXPORT MASTER LABEL (ITF-14) ── */
  if (type === 'export') {
    return (
      <div
        className={`printable-label bg-white text-black border-2 border-dashed border-gray-400 font-mono rounded-none p-4 shadow-sm space-y-3 ${className}`}
      >
        <div className="flex items-center justify-between pb-2 border-b border-gray-300">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-bold block text-gray-600 print:text-gray-700">
              ENYX-ENTERPRISE · EXPORT MASTER UNIT
            </span>
            <span className="text-xs font-bold text-gray-900 print:text-black block mt-0.5">
              {commodity} · BULK EXPORT CRATE
            </span>
          </div>
          <div className="px-2.5 py-0.5 bg-blue-700 print:bg-black text-white rounded-none font-bold text-xs tracking-wider">
            GRADE {grade}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 py-1">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-500 print:text-gray-700 uppercase block">Net Master Weight</span>
            <span className="text-2xl font-black text-gray-900 print:text-black tracking-tight block">
              {weightKg !== undefined ? formatWeight(weightKg) : '10.00'} kg
            </span>
            <span className="text-[10px] text-gray-600 print:text-gray-700 font-mono block">
              ITF-14: 01 08990012345678
            </span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <OfflineQrCode value={code || 'EXP-BATCH-001'} size={compact ? 48 : 56} />
            <span className="text-[9px] text-gray-500 print:text-gray-700">GS1 Export QR</span>
          </div>
        </div>

        <div className="py-1 border-t border-gray-200 flex justify-center">
          <OfflineBarcode value={code || '0108990012345678'} height={24} width={compact ? 160 : 200} />
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-gray-200">
          <div>
            <span className="text-gray-500 print:text-gray-700 block text-[10px]">Carton Spec</span>
            <span className="font-semibold text-gray-900 print:text-black block">
              {weightKg && weightKg >= 30 ? '50 kg Export Carton' : '10 kg Export Carton'}
            </span>
          </div>
          <div>
            <span className="text-gray-500 print:text-gray-700 block text-[10px]">Unit Code</span>
            <span className="font-mono text-gray-800 print:text-black block text-xs">{code || 'EXP-BATCH-001'}</span>
          </div>
        </div>

        <div className="pt-1 text-[9px] text-gray-500 print:text-gray-700 text-center border-t border-gray-200">
          Pack Date: {date} · Standard export packaging specification.
        </div>
      </div>
    )
  }

  /* ── 6. 1 KG POUCH RETAIL LABEL (GS1 Digital Link) ── */
  return (
    <div
      className={`printable-label bg-white text-black border-2 border-dashed border-gray-400 font-mono rounded-none p-4 shadow-sm space-y-3 ${className}`}
    >
      <div className="flex items-center justify-between pb-2 border-b border-gray-300">
        <div>
          <span className="text-[10px] uppercase tracking-wider font-bold block text-gray-600 print:text-gray-700">
            ENYX-ENTERPRISE · 1 KG POUCH
          </span>
          <span className="text-xs font-bold text-gray-900 print:text-black block mt-0.5">{commodity}</span>
        </div>
        <div className="px-2.5 py-0.5 bg-emerald-700 print:bg-black text-white rounded-none font-bold text-xs tracking-wider">
          GRADE {grade}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 py-1">
        <div className="space-y-1">
          <span className="text-[10px] text-gray-500 print:text-gray-700 uppercase block">Net Weight</span>
          <span className="text-2xl font-black text-emerald-800 print:text-black tracking-tight block">
            {weightKg !== undefined ? formatWeight(weightKg) : '1.000'} kg
          </span>
          <span className="text-[10px] text-gray-600 print:text-gray-700 font-mono block">
            {code || 'PCH-20261010-001'}
          </span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <OfflineQrCode value={code || 'PCH-20261010-001'} size={compact ? 48 : 56} />
          <span className="text-[9px] text-gray-500 print:text-gray-700">GS1 Digital Link</span>
        </div>
      </div>

      <div className="py-1 border-t border-gray-200 flex justify-center">
        <OfflineBarcode value="8991234567890" height={20} width={compact ? 160 : 200} />
      </div>

      <div className="pt-1 text-[9px] text-gray-500 print:text-gray-700 text-center border-t border-gray-200 space-y-0.5">
        <div>Pack Date: {date} · {stationName || `Station Scale ${grade}`}</div>
        <div className="text-[8px] text-gray-400 print:text-gray-600 italic">
          Scan QR with smartphone for origin & farm traceability.
        </div>
      </div>
    </div>
  )
}
