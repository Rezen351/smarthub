import { encodeEAN13, validGTIN13 } from '../../lib/ean13'

export default function PackagingBarcode({ gtin }: { gtin: string }) {
  if (!validGTIN13(gtin)) return <span role="alert">Valid GTIN-13 required</span>
  const pattern = encodeEAN13(gtin)
  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${pattern.length} 80`} width="226" height="160" className="max-w-full bg-white" aria-label={`GS1 EAN-13 ${gtin}`}>
        <rect width={pattern.length} height="80" fill="white" />
        {Array.from(pattern, (bit, i) => bit === '1' ? <rect key={i} x={i} width="1" height="80" fill="black" /> : null)}
      </svg>
      <span className="font-mono text-xs">{gtin}</span>
    </div>
  )
}
