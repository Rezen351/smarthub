import { useMemo } from 'react'
import Card from '../components/shared/Card'
import { useAuth } from '../hooks/useAuth'

export default function TraceabilityPage() {
  const { user } = useAuth()

  const farmerId = (user as any)?.farmerId || user?.id || 'unknown'
  const farmerName = user?.name || 'Farmer'
  const farmerEmail = user?.email || ''

  const qrData = useMemo(() => {
    const payload = {
      type: 'farmer',
      farmerId,
      name: farmerName,
      email: farmerEmail,
    }
    return JSON.stringify(payload)
  }, [farmerId, farmerName, farmerEmail])

  const qrSrc = useMemo(() => {
    const encoded = encodeURIComponent(qrData)
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encoded}`
  }, [qrData])

  const fallbackQrSrc = useMemo(() => {
    const encoded = encodeURIComponent(farmerId)
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encoded}`
  }, [farmerId])

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-text">My QR</h1>
        <p className="text-text-secondary mt-1">Scan this QR to verify your farmer identity</p>
      </div>

      <Card>
        <div className="flex flex-col items-center">
          <div className="w-48 h-48 bg-background border border-border rounded-sm flex items-center justify-center overflow-hidden">
            <img
              src={qrSrc}
              alt="Farmer QR"
              className="w-full h-full object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                if (target.src !== fallbackQrSrc) {
                  target.src = fallbackQrSrc
                }
              }}
            />
          </div>

          <div className="mt-6 text-center space-y-1">
            <div className="text-lg font-semibold text-text">{farmerName}</div>
            <div className="text-sm text-text-secondary">{farmerEmail}</div>
            <div className="text-xs text-text-secondary">Farmer ID: {farmerId}</div>
          </div>

          <div className="mt-4 w-full">
            <label className="block text-xs text-text-secondary mb-1">QR Data</label>
            <div className="bg-background border border-border rounded-sm p-3 text-xs text-text-secondary break-all">
              {qrData}
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
