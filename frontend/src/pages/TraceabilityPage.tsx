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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(farmerId)
      setCopied(true)
      toast.success('Farmer ID copied to clipboard.')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Copy failed — select the code manually.')
    }
  }

  return (
    <div className="stack stack-lg" style={{ maxWidth: 640 }}>
      <PageHeader
        title="My QR"
        subtitle="Show this code at the receiving station so every weighing is linked to your ID."
        actions={<Badge tone="accent" dot>Active</Badge>}
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
                  {copied ? 'Copied' : 'Copy ID'}
                </Button>
              </div>
            </div>
          </div>

          <div className="divider" />

          <div className="stack-sm">
            <p className="field-label">QR payload</p>
            <div className="code-block">{qrData}</div>
            <p className="field-hint">
              The operator scans this code to link your session before weighing your harvest.
            </p>
          </div>
        </div>
      </Card>

      <Card title="How deposits are recorded" subtitle="Station 01: Reception & Intake">
        <ol className="journey">
          {[
            { title: 'Scan Farmer QR', desc: 'Operator scans this code at Station 01 Reception to load your profile.' },
            { title: 'Waring Weighed & Tagged', desc: 'Sack is placed on the scale, net weight confirmed, and a Waring QR is issued.' },
            { title: 'Buffer Warehouse Queue', desc: 'Waring enters the temporary storage buffer awaiting sorting.' },
            { title: 'Sorting & Packaging', desc: 'Produce is washed, sorted into Grade A/B/C, and packaged into retail pouches.' },
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
