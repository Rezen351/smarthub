import { formatWeight } from '../../lib/utils'

export interface LabelPreviewProps {
  type: 'pallet' | 'grade' | 'pouch' | 'receipt'
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

/* Simulated crisp barcode bars */
function BarcodeGraphic({ code, height = 32 }: { code: string; height?: number }) {
  // Deterministic bar widths based on code characters
  const bars = [3, 1, 4, 2, 1, 3, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 2, 3, 1, 2, 4, 1, 3, 2]
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex gap-[2px] items-center justify-center px-3 py-1 bg-gray-50 rounded border border-gray-200">
        {bars.map((w, idx) => (
          <span
            key={idx}
            className="bg-black inline-block"
            style={{ width: `${w * 1.5}px`, height: `${height}px` }}
          />
        ))}
      </div>
      <span className="text-[10px] font-mono tracking-widest text-gray-700">*{code}*</span>
    </div>
  )
}

/* Simulated crisp QR code pattern */
function QrGraphic({ size = 64 }: { size?: number }) {
  return (
    <div
      className="bg-white border-2 border-black p-1 flex flex-col justify-between rounded shadow-xs"
      style={{ width: `${size}px`, height: `${size}px` }}
      aria-hidden="true"
    >
      <div className="flex justify-between">
        <div className="w-4 h-4 border-2 border-black p-[2px]">
          <div className="w-full h-full bg-black" />
        </div>
        <div className="w-4 h-4 border-2 border-black p-[2px]">
          <div className="w-full h-full bg-black" />
        </div>
      </div>
      <div className="flex justify-center gap-1">
        <div className="w-1.5 h-1.5 bg-black" />
        <div className="w-2 h-1.5 bg-black" />
        <div className="w-1.5 h-1.5 bg-black" />
      </div>
      <div className="flex justify-between items-end">
        <div className="w-4 h-4 border-2 border-black p-[2px]">
          <div className="w-full h-full bg-black" />
        </div>
        <div className="w-3 h-3 bg-black flex items-center justify-center">
          <div className="w-1 h-1 bg-white" />
        </div>
      </div>
    </div>
  )
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
        className={`bg-white text-black border border-gray-300 font-mono rounded-none p-4 shadow-sm space-y-3 ${className}`}
      >
        <div className="text-center pb-2 border-b border-dashed border-gray-400">
          <span className="text-[11px] font-bold tracking-wider uppercase block text-gray-800">
            ENYX-SMART HUB · RECEIVING INTAKE SLIP
          </span>
          <span className="text-[10px] text-gray-500 block">OFFICIAL WEIGHING RECEIPT</span>
          <span className="text-xs font-semibold text-gray-700 block mt-1">
            {date} · {time}
          </span>
        </div>
        <div className="py-2 border-b border-dashed border-gray-300 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-600">Farmer:</span>
            <span className="font-bold">{farmerName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Pallet Code:</span>
            <span className="font-mono font-semibold">{code}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Commodity:</span>
            <span>{commodity}</span>
          </div>
        </div>
        <div className="py-3 border-b border-dashed border-gray-400 text-center">
          <span className="text-[10px] uppercase text-gray-500 block">OFFICIAL NET WEIGHT</span>
          <span className="text-2xl font-black text-emerald-800 block">
            {weightKg !== undefined ? formatWeight(weightKg) : '0'} kg
          </span>
          <span className="text-[10px] text-emerald-700 font-bold block uppercase mt-0.5">
            Status: APPROVED & LABELED
          </span>
        </div>
        <div className="pt-1 text-[10px] text-gray-500 text-center italic">
          * Retain this receipt for official farmer payment & traceability records. *
        </div>
      </div>
    )
  }

  /* ── 2. INTAKE PALLET LABEL ── */
  if (type === 'pallet') {
    return (
      <div
        className={`bg-white text-black border-2 border-dashed border-gray-400 font-mono rounded-none p-4 shadow-sm space-y-3 ${className}`}
      >
        <div className="flex items-center justify-between pb-2 border-b border-gray-300">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-bold block text-gray-600">
              ENYX SMART HUB · INTAKE PALLET
            </span>
            <span className="text-base font-bold tracking-tight block text-gray-900 mt-0.5">
              {code || 'PLT-PENDING'}
            </span>
          </div>
          <QrGraphic size={compact ? 44 : 52} />
        </div>

        <div className="py-1">
          <BarcodeGraphic code={code || 'PLT-PENDING'} height={compact ? 24 : 32} />
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-gray-200">
          <div>
            <span className="text-gray-500 block text-[10px]">Farmer</span>
            <span className="font-semibold truncate block">{farmerName}</span>
            <span className="text-[10px] text-gray-500 font-mono">{farmerId}</span>
          </div>
          <div>
            <span className="text-gray-500 block text-[10px]">Net Weight</span>
            <span className="font-bold text-emerald-800 text-sm block">
              {weightKg !== undefined ? formatWeight(weightKg) : '---'} kg
            </span>
            <span className="text-[10px] text-gray-500">{commodity}</span>
          </div>
        </div>

        <div className="pt-1 text-[10px] text-gray-500 text-center border-t border-gray-200">
          Date: {date} · Attach label to physical pallet box prior to sorting.
        </div>
      </div>
    )
  }

  /* ── 3. SORTED PALLET LABEL (GRD-...) ── */
  if (type === 'grade') {
    return (
      <div
        className={`bg-white text-black border-2 border-dashed border-gray-400 font-mono rounded-none p-4 shadow-sm space-y-3 ${className}`}
      >
        <div className="flex items-center justify-between pb-2 border-b border-gray-300">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-bold block text-gray-600">
              ENYX SMART HUB · SORTED PALLET
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
          <div className="flex-1">
            <BarcodeGraphic code={code} height={compact ? 24 : 30} />
          </div>
          <QrGraphic size={compact ? 44 : 50} />
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

  /* ── 4. 1 KG POUCH RETAIL LABEL (GS1 Digital Link) ── */
  return (
    <div
      className={`bg-white text-black border-2 border-dashed border-gray-400 font-mono rounded-none p-4 shadow-sm space-y-3 ${className}`}
    >
      <div className="flex items-center justify-between pb-2 border-b border-gray-300">
        <div>
          <span className="text-[10px] uppercase tracking-wider font-bold block text-gray-600">
            ENYX FRESH · 1 KG POUCH
          </span>
          <span className="text-xs font-bold text-gray-900 block mt-0.5">{commodity}</span>
        </div>
        <div className="px-2.5 py-0.5 bg-emerald-700 text-white rounded-none font-bold text-xs tracking-wider">
          GRADE {grade}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 py-1">
        <div className="space-y-1">
          <span className="text-[10px] text-gray-500 uppercase block">Net Weight</span>
          <span className="text-2xl font-black text-emerald-800 tracking-tight block">
            {weightKg !== undefined ? formatWeight(weightKg) : '1'} kg
          </span>
          <span className="text-[10px] text-gray-600 font-mono block">
            {code || 'PCH-20261010-001'}
          </span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <QrGraphic size={compact ? 48 : 56} />
          <span className="text-[9px] text-gray-500">GS1 Digital Link</span>
        </div>
      </div>

      <div className="py-1 border-t border-gray-200">
        <BarcodeGraphic code="8991234567890" height={20} />
      </div>

      <div className="pt-1 text-[9px] text-gray-500 text-center border-t border-gray-200 space-y-0.5">
        <div>Pack Date: {date} · {stationName || `Station Scale ${grade}`}</div>
        <div className="text-[8px] text-gray-400 italic">
          Scan QR with smartphone for origin & farm traceability.
        </div>
      </div>
    </div>
  )
}
