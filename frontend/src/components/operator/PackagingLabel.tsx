import type { PackagingProduct } from '../../services/api'
import { encodeCode128, encodeEAN13, validGTIN13 } from '../../lib/barcodeEncoder'

function Barcode({ value, format }: { value: string; format: 'code128' | 'ean13' }) {
  const bits = format === 'ean13' ? encodeEAN13(value) : encodeCode128(value)
  return (
    <div className="text-center space-y-1">
      <svg viewBox={`0 0 ${bits.length} 48`} width={bits.length * 2} height="96" role="img" aria-label={`${format} ${value}`} className="max-w-full h-auto mx-auto bg-white" shapeRendering="crispEdges">
        <rect width={bits.length} height="48" fill="white" />
        {Array.from(bits, (bit, x) => bit === '1' ? <rect key={x} x={x} width="1" height="48" fill="black" /> : null)}
      </svg>
      <div className="text-xs font-mono break-all">{value}</div>
    </div>
  )
}

export default function PackagingLabel({ code, product, grade, weightKg, date, time, className = '' }: {
  code: string; product?: PackagingProduct | null; grade?: string; weightKg?: number; date?: string; time?: string; className?: string
}) {
  const valid = product && validGTIN13(product.gtin)
  const saved = /^(EXP|PCH)-\d{8}-\d+$/.test(code)
  return (
    <div className={`printable-label bg-white text-black border border-gray-400 p-3 space-y-3 font-mono ${className}`}>
      <div className="text-center border-b border-dashed border-gray-400 pb-2"><strong>SMARTGEULIS</strong><div>BOX LABEL</div></div>
      {product ? <div className="text-xs space-y-1"><strong>{product.brand}</strong><div>{product.productName}</div><div>Box: {product.nominalWeightKg} kg</div></div>
        : <p className="text-xs" role="status">Product identity unavailable. GS1 label printing is blocked.</p>}
      <div className="text-xs">Grade: {grade || '—'}</div>
      {weightKg !== undefined && weightKg > 0 && <div className="text-center font-bold">{weightKg.toFixed(3)} kg</div>}
      <div className="border-t border-dashed border-gray-400 pt-2 space-y-2">
        <div className="text-xs font-bold">Operational Barcode</div>
        {saved ? <Barcode value={code} format="code128" /> : <div className="text-xs text-center">Assigned on save</div>}
        <div className="text-xs font-bold">GS1 Barcode</div>
        {valid ? <Barcode value={product.gtin} format="ean13" /> : <p className="text-xs" role="status">Invalid GTIN. Confirm the official GTIN before printing.{product && ` (${product.gtin})`}</p>}
      </div>
      <div className="text-xs text-center border-t border-dashed border-gray-400 pt-2">{[date, time].filter(Boolean).join(' ')}</div>
    </div>
  )
}
