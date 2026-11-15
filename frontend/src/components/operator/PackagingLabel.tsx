import { formatWeight } from '../../lib/weightFormat'
import type { PackagingProduct } from '../../services/api'
import { encodeEAN13 } from '../../lib/barcodeEncoder'

function Barcode({ value }: { value: string }) {
  const bits = encodeEAN13(value)
  return (
    <div className="text-center space-y-1">
      <svg viewBox={`0 0 ${bits.length} 48`} width={bits.length * 2} height="96" role="img" aria-label={`ean13 ${value}`} className="max-w-full h-auto mx-auto bg-white" shapeRendering="crispEdges">
        <rect width={bits.length} height="48" fill="white" />
        {Array.from(bits, (bit, x) => bit === '1' ? <rect key={x} x={x} width="1" height="48" fill="black" /> : null)}
      </svg>
      <div className="text-xs font-mono break-all">{value}</div>
    </div>
  )
}

export default function PackagingLabel({ product, grade, weightKg, className = '' }: {
  product?: PackagingProduct | null; grade?: string; weightKg?: number; className?: string
}) {
  const hasGtin = product && /^\d{13}$/.test(product.gtin)
  return (
    <div className={`printable-label bg-white text-black border border-gray-400 p-3 space-y-2 font-mono ${className}`}>
      {weightKg !== undefined && weightKg > 0 && <div className="text-center font-bold">Weight: {formatWeight(weightKg, 3)} kg</div>}
      <div className="text-center">Grade: {grade || '—'}</div>
      <div className="space-y-2">
        <div className="text-xs font-bold text-center">GS1 Barcode</div>
        {hasGtin ? <Barcode value={product.gtin} /> : <p className="text-xs text-center" role="status">A 13-digit GTIN is unavailable.</p>}
      </div>
    </div>
  )
}
