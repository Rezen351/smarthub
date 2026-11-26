import PackagingBarcode from '../shared/PackagingBarcode'
import OfflineBarcode from '../shared/OfflineBarcode'
import OfflineQrCode from '../shared/OfflineQrCode'

export interface LabelPreviewProps {
  type: 'pallet' | 'grade' | 'pouch' | 'receipt' | 'waring' | 'export'
  code: string
  farmerName?: string
  farmerId?: string
  grade?: 'A' | 'B' | 'C'
  weightKg?: number
  items?: { code: string; weightKg: number }[]
  commodity?: string
  gtin?: string
  barcodeValue?: string
  qrValue?: string
  date?: string
  time?: string
  stationName?: string
  compact?: boolean
  screenFit?: boolean
  className?: string
}

const TYPE_LABEL: Record<LabelPreviewProps['type'], string> = {
  receipt: 'BUKTI PENERIMAAN',
  waring: 'LABEL WARING',
  pallet: 'PALET SORTASI',
  grade: 'PALET TERSORTASI',
  pouch: 'LABEL KEMASAN',
  export: 'LABEL EKSPOR',
}

export default function LabelPreview({
  type,
  code,
  farmerName = '',
  farmerId = '',
  grade,
  weightKg,
  items,
  commodity = 'Kentang',
  gtin,
  barcodeValue,
  qrValue,
  date = new Date().toISOString().slice(0, 10),
  time = 'Langsung',
  compact = false,
  screenFit = false,
  className = '',
}: LabelPreviewProps) {
  // Barcode: shown for pallet, pouch, export, grade (omitted for receipt and waring)
  const showsBarcode = type !== 'receipt' && type !== 'waring'
  // QR Code: shown for waring, pallet, pouch, export, grade (omitted for receipt)
  const isPackaging = type === 'pouch' || type === 'export'
  const showsQr = type !== 'receipt' && !isPackaging
  const packagingGtin = barcodeValue?.match(/^010(\d{13})21/)?.[1] || gtin || ''

  // Weight: only shown if positive and not pallet
  const receiptItems = items ?? [{ code, weightKg: weightKg || 0 }]
  const totalWeight = type === 'receipt' ? receiptItems.reduce((sum, item) => sum + Math.round(item.weightKg * 1000), 0) / 1000 : weightKg
  const displayWeight = totalWeight !== undefined && totalWeight > 0 && type !== 'pallet' ? `${Math.round(totalWeight)} kg` : null
  const statusText = type === 'receipt' ? 'Terima kasih' : 'TERCETAK'
  const displayTime = [date, time].filter(Boolean).join(' ')

  // Determine metadata display by type:
  // Receipt & Packaging (pouch/export) show Commodity; Waring stays compact without Commodity.
  const showFarmer = (type === 'receipt' || type === 'waring') && Boolean(farmerName)
  const showFarmerId = (type === 'waring') && Boolean(farmerId)
  const showCommodity = (type === 'receipt' || type === 'pouch' || type === 'export') && Boolean(commodity)
  const showGtin = (type === 'pouch' || type === 'export') && Boolean(packagingGtin)
  const showGrade = (type === 'pouch' || type === 'export' || type === 'grade') && Boolean(grade)

  const hasMetadata = showFarmer || showFarmerId || showCommodity || showGtin || showGrade

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
              <span>Petani: </span>
              <strong>{farmerName}</strong>
            </div>
          )}
          {showFarmerId && (
            <div>
              <span>ID Petani: </span>
              <strong>{farmerId}</strong>
            </div>
          )}
          {showCommodity && (
            <div>
              <span>{type === 'receipt' ? 'Hasil panen: ' : 'Komoditas: '}</span>
              <strong>{commodity === 'Potatoes' ? 'Kentang' : commodity}</strong>
            </div>
          )}
          {showGtin && (
            <div>
              <span>GTIN: </span>
              <strong>{packagingGtin}</strong>
            </div>
          )}
          {showGrade && (
            <div>
              <span>Grade: </span>
              <strong>{grade}</strong>
            </div>
          )}

        </div>
      )}

      {/* 3. Weight & Code (Centered) */}
      {type === 'receipt' && (
        <div className="text-xs text-left space-y-1 border-t border-dashed border-gray-400 pt-2">
          <strong>Jumlah waring: {receiptItems.length}</strong>
          {receiptItems.map((item, index) => (
            <div key={item.code} className="break-all">Waring {index + 1}: {Math.round(item.weightKg)} kg</div>
          ))}
          <strong className="block">Total berat</strong>
        </div>
      )}
      <div
        className={`text-center ${hasMetadata ? 'border-t border-dashed border-gray-400' : ''} ${
          screenFit ? 'pt-1.5 space-y-1' : 'pt-2.5 space-y-1.5'
        }`}
      >
        {displayWeight && (
          <strong className={`block ${screenFit ? 'text-base' : 'text-lg'}`}>{displayWeight}</strong>
        )}
        {type !== 'receipt' && <strong className={`block tracking-wide break-all ${screenFit ? 'text-xs' : 'text-sm'}`}>
          {code || 'MENUNGGU'}
        </strong>}

        {/* 4. Barcode & QR Code (Centered) */}
        {(showsBarcode || showsQr) && (
          <div className={`border-t border-dashed border-gray-400 ${screenFit ? 'pt-1.5 space-y-1' : 'pt-3 space-y-2'}`}>
            {isPackaging && <PackagingBarcode gtin={packagingGtin} />}
            {showsBarcode && !isPackaging && (
              <OfflineBarcode
                value={barcodeValue || code || 'PENDING'}
                height={screenFit ? 18 : compact ? 24 : 32}
                width={screenFit ? 150 : compact ? 180 : 240}
              />
            )}
            {showsQr && (
              <div className="flex justify-center items-center py-0.5">
                <OfflineQrCode
                  value={qrValue || code || 'PENDING'}
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
