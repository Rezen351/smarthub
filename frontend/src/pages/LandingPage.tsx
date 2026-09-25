import { Link } from 'react-router-dom'
import Logo from '../components/shared/Logo'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <Link to="/">
                <Logo className="w-32 h-8" />
              </Link>
            </div>
            <Link
              to="/login"
              className="bg-primary text-white px-6 py-2 rounded-sm text-sm font-medium hover:bg-primary-hover transition-colors"
            >
              Login
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-text mb-6">
            IoT-based Potato Packaging
            <br />
            <span className="text-text-secondary">& Warehouse Management</span>
          </h1>
          <p className="text-lg text-text-secondary mb-10 max-w-2xl mx-auto">
            End-to-end traceability system for modern agriculture. From field to warehouse,
            track every step with precision.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              to="/login"
              className="bg-primary text-white px-8 py-3 rounded-sm text-sm font-medium hover:bg-primary-hover transition-colors"
            >
              Get Started
            </Link>
            <a
              href="#features"
              className="border border-border text-text px-8 py-3 rounded-sm text-sm font-medium hover:border-primary hover:text-text transition-colors"
            >
              Learn More
            </a>
          </div>
        </div>

        <div id="features" className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-6 border border-border rounded-sm bg-surface">
            <div className="w-12 h-12 bg-background border border-border rounded-sm flex items-center justify-center mb-4">
              <span className="text-xl">🥔</span>
            </div>
            <h3 className="text-lg font-semibold text-text mb-2">Multi-Commodity Support</h3>
            <p className="text-text-secondary text-sm">
              Support for potatoes, tomatoes, chilies, and more with separate grading systems per commodity.
            </p>
          </div>

          <div className="p-6 border border-border rounded-sm bg-surface">
            <div className="w-12 h-12 bg-background border border-border rounded-sm flex items-center justify-center mb-4">
              <span className="text-xl">📡</span>
            </div>
            <h3 className="text-lg font-semibold text-text mb-2">Real-time IoT Integration</h3>
            <p className="text-text-secondary text-sm">
              MQTT-based scale readings and real-time updates from field to warehouse operations.
            </p>
          </div>

          <div className="p-6 border border-border rounded-sm bg-surface">
            <div className="w-12 h-12 bg-background border border-border rounded-sm flex items-center justify-center mb-4">
              <span className="text-xl">🔍</span>
            </div>
            <h3 className="text-lg font-semibold text-text mb-2">Full Traceability</h3>
            <p className="text-text-secondary text-sm">
              QR code and barcode tracking for farmers, pallets, pouches, and packaging units.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-border mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-text-secondary text-sm">
            © 2026 ENYX-Smart Hub. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
