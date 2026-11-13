import { useMemo } from 'react'
import { encodeQr } from '../../lib/qrEncoder'

interface OfflineQrCodeProps {
  value: string
  size?: number
  className?: string
  dataAttribute?: string
}

const QUIET_ZONE = 4

/**
 * Offline SVG QR Code (ISO/IEC 18004, ECC level M).
 * Works with zero network calls on local LAN / offline packhouses.
 */
export default function OfflineQrCode({ value, size = 180, className = '', dataAttribute }: OfflineQrCodeProps) {
  const { path, dim } = useMemo(() => {
    try {
      const matrix = encodeQr(value)
      let d = ''
      matrix.forEach((row, y) =>
        row.forEach((dark, x) => {
          if (dark) d += `M${x + QUIET_ZONE} ${y + QUIET_ZONE}h1v1h-1z`
        }),
      )
      return { path: d, dim: matrix.length + QUIET_ZONE * 2 }
    } catch {
      return { path: '', dim: 0 }
    }
  }, [value])

  if (!dim) {
    return (
      <div className={`bg-white text-xs text-center ${className}`} style={{ width: size, height: size }}>
        QR payload too long
      </div>
    )
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${dim} ${dim}`}
      preserveAspectRatio="xMidYMid meet"
      shapeRendering="crispEdges"
      className={`bg-white select-none shrink-0 ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        maxWidth: `${size}px`,
        maxHeight: `${size}px`,
        aspectRatio: '1 / 1',
        display: 'block',
      }}
      role="img"
      aria-label={`QR Code for ${value}`}
      data-farmer-qr={dataAttribute}
    >
      <rect width={dim} height={dim} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  )
}
