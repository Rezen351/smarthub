import { useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import Card from '../components/shared/Card'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import Icon from '../components/shared/Icon'
import PageHeader from '../components/shared/PageHeader'
import OfflineQrCode from '../components/shared/OfflineQrCode'
import { useToast } from '../components/feedback/Toast'

export default function TraceabilityPage() {
  const { user } = useAuth()
  const toast = useToast()
  const [copied, setCopied] = useState(false)

  const farmerId = user?.farmerId || 'unknown'
  const farmerName = user?.name || 'Petani'
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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(farmerId)
      setCopied(true)
      toast.success('ID Petani disalin ke papan klip.')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Gagal menyalin — pilih kode secara manual.')
    }
  }

  return (
    <div className="stack stack-lg" style={{ maxWidth: 640 }}>
      <PageHeader
        title="QR Saya"
        subtitle="Tunjukkan kode ini di stasiun penerimaan agar setiap penimbangan terhubung ke ID Anda."
        actions={<Badge tone="accent" dot>Aktif</Badge>}
      />

      <Card>
        <div className="stack-md">
          <div className="flex flex-col items-center gap-md">
            <div
              className="p-3 bg-white border-2 border-border-strong rounded-none shadow-xs flex items-center justify-center"
              style={{ width: 208, height: 208 }}
            >
              <OfflineQrCode value={qrData} size={184} />
            </div>

            <div className="text-center stack-xs">
              <p className="t-h2">{farmerName}</p>
              <p className="t-small text-text-secondary">{farmerEmail}</p>
              <div className="row gap-sm justify-center">
                <span className="mono t-medium">{farmerId}</span>
                <Button size="sm" variant="outline" icon={copied ? 'check' : 'clipboard'} onClick={handleCopy}>
                  {copied ? 'Disalin' : 'Salin ID'}
                </Button>
              </div>
            </div>
          </div>

          <div className="divider" />

          <div className="stack-sm">
            <p className="field-label">Kode QR Anda</p>
            <div className="code-block">{farmerId}</div>
            <p className="field-hint">
              Operator memindai kode ini untuk menghubungkan sesi Anda sebelum menimbang hasil panen.
            </p>
          </div>
        </div>
      </Card>

      <Card title="Alur Pencatatan Setoran" subtitle="Stasiun 01: Penerimaan">
        <ol className="journey">
          {[
            { title: 'Pindai QR Petani', desc: 'Operator memindai kode ini di Stasiun 01 Penerimaan untuk memuat profil Anda.' },
            { title: 'Penimbangan & Pelabelan Waring', desc: 'Waring diletakkan di timbangan, berat bersih dikonfirmasi, dan QR Waring diterbitkan.' },
            { title: 'Antrean Gudang Buffer', desc: 'Waring masuk ke penyimpanan sementara menunggu proses sortasi.' },
            { title: 'Sortasi & Pengemasan', desc: 'Hasil panen dicuci, disortasi ke Grade A/B/C, dan dikemas ke dalam pouch ritel.' },
          ].map((step, index) => (
            <li className={`journey-step ${index < 2 ? 'is-done' : ''}`} key={step.title}>
              <span className="journey-dot">
                <Icon name={index < 2 ? 'check' : 'clock'} size={12} />
              </span>
              <div className="min-w-0">
                <p className="journey-title">{step.title}</p>
                <p className="journey-meta">{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  )
}
