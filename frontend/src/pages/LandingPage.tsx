import { Link } from 'react-router-dom'
import Logo from '../components/shared/Logo'
import Button from '../components/shared/Button'
import Icon from '../components/shared/Icon'

const flowSteps = [
  {
    title: 'Receive & Weigh',
    description:
      'Scan the farmer ID, open a pallet, weigh the sacks in Auto (live scale) or Manual mode, then approve the official weight.',
    icon: 'scale',
  },
  {
    title: 'Sort & Pack',
    description:
      'Split the harvest into grade A/B/C, fill 1 kg pouches per grade, and print GS1 labels without rescanning anything.',
    icon: 'package',
  },
  {
    title: 'Track & Ship',
    description:
      'Record warehouse in/out, verify export loads with an ITF-14 scan, and let buyers trace each pouch by QR code.',
    icon: 'truck',
  },
]

const features = [
  {
    title: 'Auto & Manual Weighing',
    description:
      'Live Modbus TCP readout with a stability lock, scale address and connection state — with one-tap fallback to manual entry.',
    icon: 'flash',
    tone: 'icon-tile-accent',
  },
  {
    title: 'GS1 Digital Link Labels',
    description:
      'Pallet, grade and pouch labels in QR GS1 Digital Link, EAN-13 and ITF-14, printed straight from the station.',
    icon: 'qr',
    tone: 'icon-tile-solid',
  },
  {
    title: 'Public Traceability',
    description:
      'Consumers scan the pouch label and see farmer, farm, harvest date, grade and the full journey — no login required.',
    icon: 'search',
    tone: 'icon-tile',
  },
] as const

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="public-nav">
        <div className="public-container flex items-center justify-between">
          <Link to="/" aria-label="ENYX-Smart Hub home">
            <Logo className="h-7 w-auto" />
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/traceability">
              <Button variant="outline" size="sm" icon="search" touch>
                Trace Product
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

      <main className="public-container">
        <section className="public-hero text-center">
          <span className="hero-badge">
            <Icon name="qr" size={14} />
            GS1 Digital Link · QR + EAN-13 labels
          </span>
          <h1 className="t-display-lg mt-5 mx-auto" style={{ maxWidth: '22ch' }}>
            Potato harvest, weighed and traceable end-to-end
          </h1>
          <p className="t-body text-text-secondary mt-4 mx-auto" style={{ maxWidth: '58ch' }}>
            ENYX-Smart Hub records every step from the farmer's field to the export truck:
            weighing, grade sorting, pouch packing, warehouse and delivery — with printed
            labels consumers can scan.
          </p>
          <div className="flex gap-sm justify-center mt-6 flex-wrap">
            <Link to="/login">
              <Button variant="primary" size="lg" icon="arrow-right" touch>
                Get Started
              </Button>
            </Link>
            <Link to="/traceability">
              <Button variant="outline" size="lg" icon="search" touch>
                Trace a Product
              </Button>
            </Link>
          </div>
        </section>

        <section className="stack-md" style={{ paddingBottom: 56 }}>
          <div className="section-header">
            <h2 className="section-title">How it works</h2>
            <span className="t-caption text-text-secondary hide-mobile">Three stations, one record</span>
          </div>
          <div className="flow-grid">
            {flowSteps.map((step, index) => (
              <article className="flow-step" key={step.title}>
                <div className="flex items-center gap-sm">
                  <span className="flow-index">{index + 1}</span>
                  <span className="icon-tile">
                    <Icon name={step.icon} size={18} />
                  </span>
                </div>
                <h3 className="t-h3">{step.title}</h3>
                <p className="t-small text-text-secondary">{step.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="stack-md" style={{ paddingBottom: 64 }}>
          <div className="section-header">
            <h2 className="section-title">Built for the field</h2>
          </div>
          <div className="feature-grid">
            {features.map((feature) => (
              <article className="feature-card" key={feature.title}>
                <span className={`icon-tile ${feature.tone}`}>
                  <Icon name={feature.icon} size={18} />
                </span>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-desc">{feature.description}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="public-footer">
        <div className="public-container flex items-center justify-between gap-md flex-wrap">
          <p>© 2026 ENYX-Smart Hub. All rights reserved.</p>
          <Link to="/traceability" className="flex items-center gap-xs">
            <Icon name="search" size={13} />
            Public traceability
          </Link>
        </div>
      </footer>
    </div>
  )
}
