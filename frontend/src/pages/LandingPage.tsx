import { Link } from 'react-router-dom'
import Logo from '../components/shared/Logo'
import Button from '../components/shared/Button'
import Badge from '../components/shared/Badge'
import Icon from '../components/shared/Icon'

const flowSteps = [
  {
    title: 'Receive & Weigh',
    description:
      'Scan the farmer ID, open a pallet, weigh the sacks in Auto (live scale) or Manual mode, then approve the official weight.',
    icon: 'scale' as const,
  },
  {
    title: 'Sort & Pack',
    description:
      'Split the harvest into grade A/B/C, fill 1 kg pouches per grade, and print GS1 labels without rescanning anything.',
    icon: 'package' as const,
  },
  {
    title: 'Track & Ship',
    description:
      'Record warehouse in/out, verify export loads with an ITF-14 scan, and let buyers trace each pouch by QR code.',
    icon: 'truck' as const,
  },
]

const features = [
  {
    title: 'Auto & Manual Weighing',
    description:
      'Live Modbus TCP readout with a stability lock, scale address and connection state — with one-tap fallback to manual entry.',
    icon: 'flash' as const,
    tone: 'icon-tile-accent',
  },
  {
    title: 'GS1 Digital Link Labels',
    description:
      'Pallet, grade and pouch labels in QR GS1 Digital Link, EAN-13 and ITF-14, printed straight from the station.',
    icon: 'qr' as const,
    tone: 'icon-tile-solid',
  },
  {
    title: 'Public Traceability',
    description:
      'Consumers scan the pouch label and see farmer, farm, harvest date, grade and the full journey — no login required.',
    icon: 'search' as const,
    tone: 'icon-tile',
  },
] as const

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header / Navbar */}
      <nav className="sticky top-0 z-30 h-14 bg-background/90 backdrop-blur-md border-b border-border flex items-center">
        <div className="max-w-6xl mx-auto px-4 w-full flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5" aria-label="ENYX Traceability System home">
            <Logo className="h-7 w-auto" markOnly />
            <div className="flex flex-col">
              <span className="font-semibold text-base tracking-tight leading-tight text-foreground">
                Traceability System
              </span>
              <span className="text-[11px] text-muted-foreground leading-none font-mono">
                ENYX Enterprise
              </span>
            </div>
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

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 w-full flex-1">
        {/* Hero Section */}
        <section className="py-16 md:py-24 text-center flex flex-col items-center">
          <Badge tone="accent" icon="qr" className="px-3 py-1 text-xs">
            GS1 Digital Link · QR + EAN-13 labels
          </Badge>
          <h1 className="t-display-lg mt-5 max-w-[22ch] text-foreground">
            Potato harvest, weighed and traceable end-to-end
          </h1>
          <p className="t-body text-muted-foreground mt-4 max-w-[58ch]">
            ENYX-Smart Hub records every step from the farmer's field to the export truck:
            weighing, grade sorting, pouch packing, warehouse and delivery — with printed
            labels consumers can scan.
          </p>
          <div className="flex gap-3 justify-center mt-8 flex-wrap">
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

        {/* How It Works Section */}
        <section className="pb-16 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <h2 className="text-xl font-bold tracking-tight text-foreground">How it works</h2>
            <span className="text-xs text-muted-foreground hidden sm:inline">Three stations, one record</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {flowSteps.map((step, index) => (
              <article
                className="rounded-lg border border-border bg-card p-5 flex flex-col gap-3 shadow-xs"
                key={step.title}
              >
                <div className="flex items-center gap-3">
                  <span className="size-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </span>
                  <span className="icon-tile">
                    <Icon name={step.icon} size={18} />
                  </span>
                </div>
                <h3 className="text-base font-semibold text-foreground">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Features Section */}
        <section className="pb-20 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <h2 className="text-xl font-bold tracking-tight text-foreground">Built for the field</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {features.map((feature) => (
              <article
                className="rounded-lg border border-border bg-card p-5 flex flex-col gap-3 shadow-xs transition-shadow hover:shadow-sm"
                key={feature.title}
              >
                <span className={`icon-tile ${feature.tone}`}>
                  <Icon name={feature.icon} size={18} />
                </span>
                <h3 className="text-base font-semibold text-foreground">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 text-sm text-muted-foreground mt-auto">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between gap-4 flex-wrap">
          <p>© {new Date().getFullYear()} ENYX Enterprise. All rights reserved.</p>
          <div className="flex items-center gap-3">
            <span className="text-xs bg-muted px-2 py-0.5 rounded font-mono">Type: enyx-enterprise</span>
            <span className="text-xs">Traceability System v1.0.0</span>
          </div>
          <Link to="/traceability" className="flex items-center gap-1.5 hover:text-foreground transition-colors">
            <Icon name="search" size={13} />
            Public traceability
          </Link>
        </div>
      </footer>
    </div>
  )
}
