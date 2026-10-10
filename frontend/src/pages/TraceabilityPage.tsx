import { useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import Card from '../components/shared/Card'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import Icon from '../components/shared/Icon'
import PageHeader from '../components/shared/PageHeader'
import { useToast } from '../components/feedback/Toast'

export default function TraceabilityPage() {
  const { user } = useAuth()
  const toast = useToast()
  const [copied, setCopied] = useState(false)

  const farmerId = (user as { farmerId?: string })?.farmerId || user?.id || 'unknown'
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
              className="label-qr"
              style={{ width: 208, height: 208, borderColor: 'var(--color-border-strong)' }}
            >
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
              The operator scans this code to open a session context before weighing your harvest.
            </p>
          </div>
        </div>
      </Card>

      <Card title="How deposits are recorded" subtitle="Receiving area — Area Penerimaan">
        <ol className="journey">
          {[
            { title: 'Scan your QR', desc: 'Operator scans this code at the receiving station.' },
            { title: 'Pallet created', desc: 'A pallet code PLT-YYYYMMDD-SEQ is issued for your harvest.' },
            { title: 'Weight approved', desc: 'Sacks are weighed and the weight is approved as the official deposit.' },
            { title: 'Grade & pouch', desc: 'Sortir splits grade A/B/C, pouches are packed and labelled.' },
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
