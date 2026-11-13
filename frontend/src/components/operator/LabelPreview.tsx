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
  // Barcode: shown for pallet, pouch, export, grade (omitted for receipt and waring)
  const showsBarcode = type !== 'receipt' && type !== 'waring'
  // QR Code: shown for waring, pallet, pouch, export, grade (omitted for receipt)
  const showsQr = type !== 'receipt'

  // Weight: only shown if positive and not pallet
  const displayWeight = weightKg !== undefined && weightKg > 0 && type !== 'pallet' ? `${weightKg.toFixed(3)} kg` : null
  const statusText = type === 'receipt' ? 'BUFFER_WAITING' : 'PRINTED'
  const displayTime = [date, time].filter(Boolean).join(' ')

  // Determine metadata display by type
  const showFarmer = (type === 'receipt' || type === 'waring') && Boolean(farmerName)
  const showFarmerId = (type === 'receipt' || type === 'waring') && Boolean(farmerId)
  const showCommodity = type === 'receipt' && Boolean(commodity)
  const showStation = type === 'receipt' && Boolean(stationName)
  const showGrade = (type === 'pouch' || type === 'export' || type === 'grade') && Boolean(grade)

  const hasMetadata = showFarmer || showFarmerId || showCommodity || showStation || showGrade

  return (
    <div
      className={`printable-label bg-white text-black border border-gray-400 font-mono rounded-none ${
        screenFit ? 'p-2 space-y-1.5' : 'p-4 space-y-3'
      } ${compact ? 'text-xs' : ''} ${className}`}
    >
      {/* 1. Header (Centered) */}
      <div className={`text-center border-b border-dashed border-gray-400 ${screenFit ? 'pb-1' : 'pb-2'}`}>
        <strong className={`block tracking-wide ${screenFit ? 'text-xs' : 'text-sm'}`}>SMARTGEULIS</strong>
        <span className="block text-xs font-semibold">{TYPE_LABEL[type]}</span>
      </div>

      {/* 2. Metadata (Left-aligned) */}
      {hasMetadata && (
        <div className={`text-left ${screenFit ? 'space-y-0.5' : 'space-y-1'} text-xs break-words`}>
          {showFarmer && (
            <div>
              <span>Farmer: </span>
              <strong>{farmerName}</strong>
            </div>
          )}
          {showFarmerId && (
            <div>
              <span>Farmer ID: </span>
              <strong>{farmerId}</strong>
            </div>
          )}
          {showGrade && (
            <div>
              <span>Grade: </span>
              <strong>{grade}</strong>
            </div>
          )}
          {showCommodity && (
            <div>
              <span>Commodity: </span>
              <strong>{commodity}</strong>
            </div>
          )}
          {showStation && (
            <div>
              <span>Station: </span>
              <strong>{stationName}</strong>
            </div>
          )}
        </div>
      )}

      {/* 3. Weight & Code (Centered) */}
      <div
        className={`text-center ${hasMetadata ? 'border-t border-dashed border-gray-400' : ''} ${
          screenFit ? 'pt-1.5 space-y-1' : 'pt-2.5 space-y-1.5'
        }`}
      >
        {displayWeight && (
          <strong className={`block ${screenFit ? 'text-base' : 'text-lg'}`}>{displayWeight}</strong>
        )}
        <strong className={`block tracking-wide break-all ${screenFit ? 'text-xs' : 'text-sm'}`}>
          {code || 'PENDING'}
        </strong>

        {/* 4. Barcode & QR Code (Centered) */}
        {(showsBarcode || showsQr) && (
          <div className={`border-t border-dashed border-gray-400 ${screenFit ? 'pt-1.5 space-y-1' : 'pt-3 space-y-2'}`}>
            {showsBarcode && (
              <OfflineBarcode
                value={code || 'PENDING'}
                height={screenFit ? 18 : compact ? 24 : 32}
                width={screenFit ? 150 : compact ? 180 : 240}
              />
            )}
            {showsQr && (
              <div className="flex justify-center items-center py-0.5">
                <OfflineQrCode
                  value={code || 'PENDING'}
                  size={screenFit ? 88 : compact ? 96 : 112}
                  className="shrink-0"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. Date/Time & Status Footer (Centered) */}
      <div className={`text-center space-y-0.5 text-xs border-t border-dashed border-gray-400 ${screenFit ? 'pt-1' : 'pt-2'}`}>
        {displayTime && <div>{displayTime}</div>}
        <div className="font-semibold tracking-wider">{statusText}</div>
      </div>
    </div>
  )
}
