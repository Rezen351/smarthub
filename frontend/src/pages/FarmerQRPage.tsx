import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { api } from '../services/api'
import Icon from '../components/shared/Icon'
import Button from '../components/shared/Button'
import { useToast } from '../components/feedback/Toast'
import OfflineQrCode from '../components/shared/OfflineQrCode'

type Farmer = {
  id: string
  code: string
  name: string
  village: string
  createdAt: string
}

export default function FarmerQRPage() {
  const { user } = useAuth()
  const toast = useToast()
  const [farmerData, setFarmerData] = useState<Farmer | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user?.farmerId) {
      fetchFarmerData(user.farmerId)
    }
  }, [user?.farmerId])

  const fetchFarmerData = async (farmerId: string) => {
    setLoading(true)
    try {
      const data = await api.farmers.get(farmerId)
      setFarmerData(data)
    } catch (error) {
      toast.error('Failed to load farmer profile')
    } finally {
      setLoading(false)
    }
  }

  const downloadQR = () => {
    if (!user?.farmerId) return
    const canvas = document.createElement('canvas')
    const svg = document.querySelector(`svg[aria-label="QR Code for ${user.farmerId}"]`)
    if (!svg) return
    
    const svgData = new XMLSerializer().serializeToString(svg)
    const img = new Image()
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0)
        const link = document.createElement('a')
        link.download = `farmer-${user.farmerId}-qr.png`
        link.href = canvas.toDataURL()
        link.click()
      }
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData)
  }

  if (!user?.farmerId) {
    return (
      <div className="container py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">My Farmer ID Card</h1>
          <p className="text-muted-foreground mt-2">
            No farmer profile linked to your account
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-8">
      <div className="max-w-md mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">My Farmer ID Card</h1>
          <p className="text-muted-foreground mt-2">
            Scan this QR code at Station 01 for quick identification
          </p>
        </div>

        <div className="bg-white border rounded-lg p-6 text-center">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Farmer ID</p>
              <p className="text-2xl font-bold font-mono">{user.farmerId}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="text-lg">{farmerData?.name || user.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Village</p>
              <p className="text-lg">{farmerData?.village || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Registration Date</p>
              <p className="text-lg">{farmerData?.createdAt ? new Date(farmerData.createdAt).toLocaleDateString() : '-'}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border rounded-lg p-6 text-center">
          <h2 className="text-lg font-semibold mb-4">Farmer QR Code</h2>
          {loading ? (
            <div className="flex justify-center">
              <div className="w-32 h-32 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-center">
                <OfflineQrCode 
                  value={user.farmerId}
                  size={192}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Scan this QR code at Station 01 Reception
              </p>
              <Button onClick={downloadQR} variant="outline" size="sm">
                <Icon name="download" size={16} />
                Download QR
              </Button>
            </div>
          )}
        </div>

        <div className="text-xs text-muted-foreground text-center">
          <p>
            Present this QR code to the operator at Station 01 for faster harvest weighing process.
          </p>
        </div>
      </div>
    </div>
  )
}