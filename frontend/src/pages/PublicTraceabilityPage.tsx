import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Card from '../components/shared/Card'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import Icon from '../components/shared/Icon'
import Logo from '../components/shared/Logo'
import { Field, Input } from '../components/shared/Form'
import EmptyState from '../components/shared/EmptyState'

type TraceStep = { stage: string; location: string; time: string; done: boolean }

type TraceResult = {
  code: string
  commodity: string
  farmerName: string
  farmLocation: string
  harvestDate: string
  grade: string
  weightKg: number
  journey: TraceStep[]
}

// Data contoh sampai backend aktif; struktur mengikuti Pallet -> Pouch.
const MOCK_RESULTS: Record<string, TraceResult> = {
  'PCH-PLT-20260914-0001-001': {
    code: 'PCH-PLT-20260914-0001-001',
    commodity: 'Kentang',
    farmerName: 'Ahmad Santoso',
    farmLocation: 'Dieng, Wonosobo',
    harvestDate: '2026-09-12',
    grade: 'A',
    weightKg: 1,
    journey: [
      { stage: 'Panen', location: 'Kebun Ahmad Santoso', time: '2026-09-12 07:30', done: true },
      { stage: 'Penerimaan (Approved)', location: 'Area Penerimaan', time: '2026-09-14 08:15', done: true },
      { stage: 'Sortir Grade A', location: 'Area Sortir', time: '2026-09-14 09:40', done: true },
      { stage: 'Pengepakan Pouch 1 kg', location: 'Area Pengepakan', time: '2026-09-14 10:05', done: true },
      { stage: 'Warehouse In', location: 'Gudang Utama', time: '2026-09-14 10:30', done: true },
      { stage: 'Pengiriman', location: 'Menunggu jadwal', time: '-', done: false },
    ],
  },
  'PLT-20260914-0001': {
    code: 'PLT-20260914-0001',
    commodity: 'Kentang',
    farmerName: 'Ahmad Santoso',
    farmLocation: 'Dieng, Wonosobo',
    harvestDate: '2026-09-12',
    grade: 'A/B/C',
    weightKg: 168,
    journey: [
      { stage: 'Panen', location: 'Kebun Ahmad Santoso', time: '2026-09-12 07:30', done: true },
      { stage: 'Penerimaan (Approved)', location: 'Area Penerimaan', time: '2026-09-14 08:15', done: true },
      { stage: 'Sortir', location: 'Area Sortir', time: '2026-09-14 09:40', done: true },
      { stage: 'Pengepakan', location: 'Area Pengepakan', time: '2026-09-14 10:05', done: true },
    ],
  },
}

/** Extract the pouch/pallet serial from a GS1 Digital Link URL (AI 21 / 10). */
function codeFromLink(input: string) {
  const match = input.match(/\/(21|10)\/([^/?]+)/)
  if (match) return decodeURIComponent(match[2]).toUpperCase()
  return input.trim().toUpperCase()
}

export default function PublicTraceabilityPage() {
  const [searchParams] = useSearchParams()
  const [code, setCode] = useState('')
  const [searched, setSearched] = useState(false)
  const [result, setResult] = useState<TraceResult | null>(null)
  const [scanning, setScanning] = useState(false)

  const runSearch = (value: string) => {
    const key = codeFromLink(value)
    setResult(MOCK_RESULTS[key] || null)
    setSearched(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    runSearch(code)
  }

  /**
   * A scanned pouch QR is a GS1 Digital Link URL; open it with ?link=<url>
   * (or use the code directly) so the public page resolves it without typing.
   */
  useEffect(() => {
    const link = searchParams.get('link') ?? searchParams.get('code')
    if (!link) return
    setCode(link)
    setScanning(false)
    const key = codeFromLink(link)
    setResult(MOCK_RESULTS[key] || null)
    setSearched(true)
  }, [searchParams])

  const details: [string, string][] = result
    ? [
        ['Farmer', result.farmerName],
        ['Farm location', result.farmLocation],
        ['Harvest date', result.harvestDate],
        ['Commodity', result.commodity],
        ['Grade', result.grade],
        ['Weight', `${result.weightKg} kg`],
      ]
    : []

  return (
    <div className="min-h-screen bg-background">
      <nav className="public-nav">
        <div className="public-container flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5" aria-label="ENYX Traceability System home">
            <Logo className="h-7 w-auto" markOnly />
            <div className="flex flex-col">
              <span className="font-semibold text-base tracking-tight leading-tight text-text">Traceability System</span>
              <span className="text-[11px] text-text-light leading-none font-mono">ENYX Enterprise</span>
            </div>
          </Link>
          <div className="flex items-center gap-sm">
            <Link to="/">
              <Button variant="ghost" size="sm" icon="arrow-left" touch>
                Home
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="primary" size="sm" touch>
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="public-container stack-md" style={{ paddingTop: 32, paddingBottom: 48, maxWidth: 760 }}>
        <header className="page-header">
          <h1 className="page-title">Product Traceability</h1>
          <p className="page-subtitle">
            Scan the QR code on the pouch label or enter the code manually to trace its journey
            from farm to delivery.
          </p>
        </header>

        <Card>
          <form onSubmit={handleSubmit} className="stack-md">
            <Field
              label="Pouch / Pallet Code"
              htmlFor="trace-code"
              hint="Example: PCH-PLT-20260914-0001-001 (pouch) or PLT-20260914-0001 (pallet)"
            >
              <Input
                id="trace-code"
                mono
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="PCH-PLT-20260914-0001-001"
              />
            </Field>

            <div className="flex gap-sm flex-wrap">
              <Button type="submit" variant="primary" icon="search" touch>
                Trace Product
              </Button>
              <Button
                type="button"
                variant="outline"
                icon="scan"
                touch
                onClick={() => setScanning((value) => !value)}
              >
                {scanning ? 'Hide Scanner' : 'Scan with Camera'}
              </Button>
            </div>

            {scanning && (
              <div className="scan-frame is-scanning">
                <Icon name="scan" size={22} />
                <p className="t-small font-semibold">Camera scanning</p>
                <p className="t-caption text-text-secondary">
                  Camera scanning is not enabled yet — enter the code manually to continue.
                </p>
              </div>
            )}
          </form>
        </Card>

        {searched && !result && (
          <Card>
            <EmptyState
              icon="search"
              title="Product not found"
              description="Please check the QR code or enter the code manually. Codes start with PCH-, PLT- or GRD-."
              action={
                <Link to="/traceability">
                  <Button variant="outline" icon="refresh">
                    Try Another Code
                  </Button>
                </Link>
              }
            />
          </Card>
        )}

        {result && (
          <>
            <Card
              title="Product Details"
              subtitle={`Code ${result.code}`}
              action={
                <Badge tone="success" icon="check-circle">
                  Verified
                </Badge>
              }
            >
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                {details.map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3 border-b border-border pb-2">
                    <dt className="t-small text-text-secondary">{label}</dt>
                    <dd className="t-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            </Card>

            <Card title="Journey" subtitle="Every stage recorded from harvest to delivery">
              <ol className="journey">
                {result.journey.map((step) => (
                  <li className={`journey-step ${step.done ? 'is-done' : ''}`} key={step.stage}>
                    <span className="journey-dot">
                      <Icon name={step.done ? 'check' : 'clock'} size={12} />
                    </span>
                    <div className="min-w-0">
                      <p className="journey-title">{step.stage}</p>
                      <p className="journey-meta">
                        {step.location} · {step.time}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          </>
        )}

        <p className="t-caption text-text-light text-center">
          Sample data is shown until the server is connected. Codes follow the GS1 Digital Link
          format printed on the pouch label.
        </p>
      </main>

      <footer className="public-footer border-t border-border mt-12 py-6">
        <div className="public-container flex items-center justify-between gap-md flex-wrap text-sm text-text-secondary">
          <p>© {new Date().getFullYear()} ENYX Enterprise. All rights reserved.</p>
          <div className="flex items-center gap-3">
            <span className="text-xs bg-bg-alt px-2 py-0.5 rounded font-mono">Type: enyx-enterprise</span>
            <span className="text-xs">Traceability System v1.0.0</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
