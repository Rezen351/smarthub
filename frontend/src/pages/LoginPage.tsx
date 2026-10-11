import { useState, FormEvent } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Logo from '../components/shared/Logo'
import Icon, { type IconName } from '../components/shared/Icon'

const demoAccounts = [
  { email: 'admin@enyx.local', role: 'Admin' },
  { email: 'weighing@enyx.local', role: 'Weighing Operator' },
  { email: 'sorting@enyx.local', role: 'Sorting Operator' },
  { email: 'packaging@enyx.local', role: 'Packaging Operator' },
  { email: 'warehouse@enyx.local', role: 'Warehouse Operator' },
  { email: 'delivery@enyx.local', role: 'Delivery Operator' },
  { email: 'farmer@enyx.local', role: 'Farmer' },
]

const getRoleIcon = (role: string): IconName => {
  switch (role) {
    case 'Admin':
      return 'shield'
    case 'Weighing Operator':
      return 'scale'
    case 'Sorting Operator':
      return 'sortir'
    case 'Packaging Operator':
      return 'package'
    case 'Warehouse Operator':
      return 'box'
    case 'Delivery Operator':
      return 'truck'
    case 'Farmer':
      return 'user'
    default:
      return 'user'
  }
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { user, login } = useAuth()
  const navigate = useNavigate()

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#171717] font-['Archivo',sans-serif] selection:bg-[#f0fdf4] selection:text-[#15803d] flex flex-col justify-between relative overflow-x-hidden">
      {/* ── Sub-pixel Grain Overlay ── */}
      <div
        className="fixed inset-[-10%] pointer-events-none z-[190] opacity-[0.04] mix-blend-multiply"
        style={{
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='250' height='250'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`,
        }}
        aria-hidden="true"
      />

      {/* ── Scoped CSS Styles Aligned with Landing Page ── */}
      <style>{`
        .font-display { font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.02em; }
        .font-heading { font-family: 'Oswald', sans-serif; }
        .font-mono-custom { font-family: 'JetBrains Mono', monospace; }

        .notch-corner {
          position: relative;
        }
        .notch-corner::before,
        .notch-corner::after {
          content: '';
          position: absolute;
          width: 14px;
          height: 14px;
          border: 2px solid #229856;
          pointer-events: none;
        }
        .notch-corner::before {
          top: -1px;
          left: -1px;
          border-right: none;
          border-bottom: none;
        }
        .notch-corner::after {
          bottom: -1px;
          right: -1px;
          border-left: none;
          border-top: none;
        }

        @keyframes pulse-btn-glow {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(34, 152, 86, 0.45), 0 4px 12px rgba(34, 152, 86, 0.25);
          }
          50% {
            box-shadow: 0 0 0 14px rgba(34, 152, 86, 0), 0 4px 12px rgba(34, 152, 86, 0.25);
          }
        }
        .pulse-btn {
          animation: pulse-btn-glow 2.4s ease-out infinite;
        }
      `}</style>

      {/* ── Top Header Bar ── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#eaeaea]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group" aria-label="ENYX-ENTERPRISE home">
            <Logo className="h-8 w-auto" markOnly />
            <div>
              <div className="font-display text-2xl leading-none tracking-wider text-[#171717] flex items-center gap-2">
                ENYX-ENTERPRISE
              </div>
              <div className="font-mono-custom text-[10px] text-[#666666] tracking-[0.25em] uppercase">
                TRACEABILITY · SMART HUB
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 font-mono-custom text-[11px] text-[#666666] border border-[#eaeaea] bg-[#f5f5f5] px-3 py-1.5 rounded-none">
              <span className="w-2 h-2 rounded-full bg-[#15803d] animate-pulse"></span>
              <span>MODBUS TELEMETRY · ACTIVE</span>
            </div>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 font-heading text-xs uppercase tracking-wider text-[#666666] hover:text-[#171717] transition-colors"
            >
              <Icon name="arrow-left" size={13} />
              <span>Smart Hub</span>
            </Link>
            <Link
              to="/traceability"
              className="hidden md:inline-flex items-center gap-1.5 font-heading text-xs uppercase tracking-wider text-[#15803d] hover:text-[#0E5030] font-semibold transition-colors"
            >
              <span>Public Trace</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Login Container ── */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-6">
        <div className="w-full max-w-xl">
          {/* Industrial Sharp Card with Corner Brackets */}
          <div className="notch-corner border border-[#eaeaea] bg-white p-6 sm:p-10 shadow-sm rounded-none">
            {/* Station Authentication Tag */}
            <div className="inline-flex items-center gap-2.5 font-mono-custom text-xs text-[#15803d] tracking-[0.25em] uppercase mb-2">
              <span className="w-6 h-[2px] bg-[#229856]"></span>
              <span>STATION AUTHENTICATION · PACKHOUSE NETWORK</span>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl tracking-tight text-[#171717] leading-none mb-2">
              OPERATOR SIGN IN
            </h1>
            <p className="text-xs sm:text-sm text-[#666666] font-body mb-6 leading-relaxed">
              Select an authorized station profile below or enter credentials to access your terminal.
            </p>

            {/* Error Message */}
            {error && (
              <div
                className="border border-red-200 border-l-4 border-l-red-600 bg-red-50 text-red-900 p-3.5 text-xs font-mono rounded-none flex items-center gap-2.5 mb-5"
                role="alert"
              >
                <Icon name="alert" size={16} className="text-red-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block font-mono-custom text-[11px] font-semibold uppercase tracking-[0.2em] text-[#666666] mb-1.5"
                >
                  Operator Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@enyx.local"
                  required
                  className="w-full bg-[#fafafa] border border-[#d1d5db] rounded-none px-4 py-3 font-mono text-sm text-[#171717] placeholder:text-[#999999] focus:outline-none focus:border-[#229856] focus:ring-2 focus:ring-[#229856]/20 transition-all"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block font-mono-custom text-[11px] font-semibold uppercase tracking-[0.2em] text-[#666666] mb-1.5"
                >
                  Station Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-[#fafafa] border border-[#d1d5db] rounded-none px-4 py-3 font-mono text-sm text-[#171717] placeholder:text-[#999999] focus:outline-none focus:border-[#229856] focus:ring-2 focus:ring-[#229856]/20 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="pulse-btn w-full bg-[#000000] text-white py-3.5 font-heading text-sm uppercase tracking-[0.2em] hover:bg-[#15803d] transition-all flex items-center justify-center gap-2 rounded-none font-semibold cursor-pointer disabled:opacity-50 mt-6"
              >
                <span>{loading ? 'AUTHENTICATING…' : 'SIGN IN TO STATION'}</span>
                <Icon name="arrow-right" size={16} />
              </button>
            </form>

            {/* Quick Demo Accounts Selection */}
            <div className="mt-8 pt-6 border-t border-[#eaeaea]">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono-custom text-[11px] text-[#15803d] tracking-[0.2em] uppercase font-semibold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-[#229856]"></span>
                  AUTHORIZED STATIONS (PW: PASSWORD)
                </span>
                <span className="font-mono-custom text-[10px] text-[#999999] uppercase tracking-wider">
                  CLICK TO AUTO-FILL
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {demoAccounts.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => {
                      setEmail(account.email)
                      setPassword('password')
                    }}
                    className="p-3 rounded-none border border-[#eaeaea] bg-[#fafafa] hover:border-[#229856] hover:bg-[#f0fdf4] text-left transition-all cursor-pointer group flex items-start gap-3"
                  >
                    <div className="w-7 h-7 bg-white border border-[#eaeaea] group-hover:border-[#229856] group-hover:text-[#229856] flex items-center justify-center shrink-0 text-[#666666] transition-colors rounded-none mt-0.5">
                      <Icon name={getRoleIcon(account.role)} size={13} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-heading text-xs uppercase tracking-wider text-[#171717] group-hover:text-[#0E5030] font-semibold truncate">
                        {account.role}
                      </div>
                      <div className="font-mono-custom text-[10px] text-[#666666] group-hover:text-[#15803d] truncate mt-0.5">
                        {account.email}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-[#eaeaea] bg-white py-5 text-xs text-[#666666]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} ENYX-ENTERPRISE. All rights reserved.</p>
          <div className="flex items-center gap-3 font-mono-custom text-[11px]">
            <span className="bg-[#f5f5f5] px-2 py-0.5 border border-[#eaeaea] text-[#171717]">
              Type: enyx-enterprise
            </span>
            <span>Traceability Smart Hub v1.0.0</span>
          </div>
          <Link to="/traceability" className="text-[#15803d] hover:underline font-medium">
            Public Traceability Portal →
          </Link>
        </div>
      </footer>
    </div>
  )
}
