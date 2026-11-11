import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { api } from '../services/api'
import Icon from '../components/shared/Icon'
import Button from '../components/shared/Button'
import Card from '../components/shared/Card'
import PageHeader from '../components/shared/PageHeader'
import { useToast } from '../components/feedback/Toast'
import { IdCard, exportIdCardToPng, printIdCard, type IdCardData } from '../components/shared/IdCard'

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
  const [exporting, setExporting] = useState(false)
  const farmerId = farmerData?.code || user?.farmerId

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
    } catch {
      toast.error('Failed to load farmer profile')
    } finally {
      setLoading(false)
    }
  }

  const cardData: IdCardData = {
    id: user?.id,
    name: farmerData?.name || user?.name || 'Farmer',
    role: 'FARMER',
    code: farmerId || 'FMR-001',
    domicile: farmerData?.village || user?.farmerProfile?.village || 'Garut, Jawa Barat',
    issuedAt: farmerData?.createdAt,
  }

  const handleExportPng = async () => {
    try {
      setExporting(true)
      await exportIdCardToPng(cardData)
      toast.success('ID Card PNG exported successfully.')
    } catch {
      toast.error('Failed to export ID Card image.')
    } finally {
      setExporting(false)
    }
  }

  const handlePrint = () => {
    printIdCard(cardData)
  }

  if (!farmerId) {
    return (
      <div className="container py-8 max-w-xl mx-auto">
        <Card>
          <div className="text-center py-8 stack-sm">
            <Icon name="user" size={36} className="text-text-secondary mx-auto" />
            <h1 className="t-h2">My Farmer ID Card</h1>
            <p className="t-small text-text-secondary">
              No registered farmer profile is linked to your account. Please contact the administrator.
            </p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="stack stack-lg" style={{ maxWidth: 760 }}>
      <PageHeader
        title="My Farmer ID Card"
        subtitle="Official identity pass for Station 01 Reception weighing check-in."
        actions={
          <div className="row gap-xs">
            <Button variant="outline" size="sm" icon="print" onClick={handlePrint}>
              Print ID Card
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon="download"
              disabled={exporting}
              onClick={handleExportPng}
            >
              {exporting ? 'Exporting...' : 'Export to PNG'}
            </Button>
          </div>
        }
      />

      {/* Main Official ID Card Display */}
      <Card
        title="Official Laminated Badge"
        subtitle="Registered identity badge for packhouse intake check-in"
      >
        <div className="flex flex-col sm:flex-row items-center gap-6 justify-between p-2">
          <div className="shrink-0 flex justify-center w-full sm:w-auto">
            {loading ? (
              <div
                className="flex items-center justify-center bg-muted/40 rounded-lg border border-border"
                style={{ width: 320, height: 220 }}
              >
                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <IdCard data={cardData} />
            )}
          </div>

          <div className="stack-sm text-xs text-text-secondary flex-1">
            <div>
              <p className="font-semibold text-text text-sm">Station 01 Weighing Check-In</p>
              <p className="mt-1">
                Show this official card to the operator at Station 01 Reception or scan the QR code directly at the intake station.
              </p>
            </div>

            <div className="bg-bg-alt p-3 rounded border border-border space-y-1">
              <div className="flex justify-between">
                <span className="font-medium text-text">Farmer Name:</span>
                <span className="font-semibold text-text">{cardData.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-text">Farmer ID:</span>
                <span className="font-mono font-bold text-accent">{cardData.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-text">Domicile:</span>
                <span>{cardData.domicile}</span>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="primary" icon="print" onClick={handlePrint}>
                Print ID Card
              </Button>
              <Button
                size="sm"
                variant="outline"
                icon="download"
                disabled={exporting}
                onClick={handleExportPng}
              >
                {exporting ? 'Exporting...' : 'Export PNG'}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
