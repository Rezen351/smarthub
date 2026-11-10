import OfflineBarcode from '../shared/OfflineBarcode'
import OfflineQrCode from '../shared/OfflineQrCode'
import { formatWeight } from '../../lib/utils'

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
  screenFit?: boolean
  className?: string
}

const TYPE_LABEL: Record<LabelPreviewProps['type'], string> = {
  receipt: 'RECEIVING RECEIPT',
  waring: 'WARING LABEL',
  pallet: 'SORTING PALLET',
  grade: 'SORTED PALLET',
  pouch: 'POUCH LABEL',
  export: 'EXPORT LABEL',
}

export default function LabelPreview({
  type,
  code,
  farmerName = '',
  farmerId = '',
  grade,
  weightKg,
  commodity = 'Potatoes',
  date = new Date().toISOString().slice(0, 10),
  time = 'Live',
  stationName,
  compact = false,
  screenFit = false,
  className = '',
}: LabelPreviewProps) {
  const showsQr = type !== 'receipt'
  const showsBarcode = type !== 'receipt'
  const displayWeight = weightKg !== undefined ? `${formatWeight(weightKg)} kg` : '—'

  return (
    <div
      className={`printable-label bg-white text-black border border-gray-400 font-mono rounded-none ${screenFit ? 'p-2 space-y-1.5' : 'p-4 space-y-3'} ${compact ? 'text-xs' : ''} ${className}`}
    >
      <div className={`text-center border-b border-dashed border-gray-400 ${screenFit ? 'pb-1' : 'pb-2'}`}>
        <strong className={`block tracking-wide ${screenFit ? 'text-xs' : 'text-sm'}`}>ENYX-ENTERPRISE</strong>
        <span className={`block ${screenFit ? 'text-[10px]' : 'text-xs'}`}>{TYPE_LABEL[type]}</span>
      </div>

      <div className={`${screenFit ? 'space-y-0.5 text-[10px]' : 'space-y-1 text-xs'}`}>
        {farmerName && (
          <div className="flex justify-between gap-3">
            <span>Farmer</span>
            <strong className="text-right">{farmerName}</strong>
          </div>
        )}
        {farmerId && (
          <div className="flex justify-between gap-3">
            <span>Farmer ID</span>
            <strong className="text-right">{farmerId}</strong>
          </div>
        )}
        {grade && (
          <div className="flex justify-between gap-3">
            <span>Grade</span>
            <strong className="text-right">{grade}</strong>
          </div>
        )}
        {type === 'receipt' && (
          <div className="flex justify-between gap-3">
            <span>Commodity</span>
            <strong className="text-right">{commodity}</strong>
          </div>
        )}
        {stationName && (
          <div className="flex justify-between gap-3">
            <span>Station</span>
            <strong className="text-right">{stationName}</strong>
          </div>
        )}
      </div>

      <div className={`text-center border-t border-dashed border-gray-400 ${screenFit ? 'pt-1.5 space-y-1' : 'pt-3 space-y-2'}`}>
        <strong className={`block ${screenFit ? 'text-base' : 'text-lg'}`}>{displayWeight}</strong>
        <strong className={`block tracking-wide break-all ${screenFit ? 'text-xs' : 'text-sm'}`}>{code || 'PENDING'}</strong>
        <div className={`border-t border-dashed border-gray-400 ${screenFit ? 'pt-1.5 space-y-1' : 'pt-3 space-y-2'}`}>
          {showsBarcode && <OfflineBarcode value={code || 'PENDING'} height={screenFit ? 18 : compact ? 24 : 32} width={screenFit ? 150 : compact ? 180 : 240} />}
          {showsQr && <OfflineQrCode value={code || 'PENDING'} size={screenFit ? 112 : 189} className="mx-auto" />}
        </div>
      </div>

      <div className={`text-center space-y-0.5 ${screenFit ? 'text-[9px]' : 'text-[10px]'}`}>
        <div>{date} · {time}</div>
        <div>{type === 'receipt' ? 'BUFFER_WAITING' : 'PRINTED'}</div>
      </div>
    </div>
  )
}
