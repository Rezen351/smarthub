import { useState, FormEvent } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Logo from '../components/shared/Logo'
import Icon from '../components/shared/Icon'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
    <div className="min-h-screen bg-[#fafafa] text-[#171717] font-['Archivo',sans-serif] selection:bg-[#fff7ed] selection:text-[#ea580c] flex flex-col justify-between relative overflow-x-hidden">
      {/* ── Sub-pixel Grain Overlay ── */}
      <div
        className="fixed inset-[-10%] pointer-events-none z-[190] opacity-[0.04] mix-blend-multiply"
        style={{
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='250' height='250'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`,
        }}
        aria-hidden="true"
      />

      {/* ── Scoped CSS Styles ── */}
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
          border: 2px solid #ea580c;
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

        .notch-dark {
          position: relative;
        }
        .notch-dark::before,
        .notch-dark::after {
          content: '';
          position: absolute;
          width: 14px;
          height: 14px;
          border: 2px solid rgba(234, 88, 12, 0.7);
          pointer-events: none;
        }
        .notch-dark::before {
          top: -1px;
          left: -1px;
          border-right: none;
          border-bottom: none;
        }
        .notch-dark::after {
          bottom: -1px;
          right: -1px;
          border-left: none;
          border-top: none;
        }

        @keyframes pulse-btn-glow {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(234, 88, 12, 0.45), 0 4px 12px rgba(234, 88, 12, 0.25);
          }
          50% {
            box-shadow: 0 0 0 14px rgba(234, 88, 12, 0), 0 4px 12px rgba(234, 88, 12, 0.25);
          }
        }
        .pulse-btn {
          animation: pulse-btn-glow 2.4s ease-out infinite;
        }
      `}</style>

      {/* ── Top Header Bar ── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#eaeaea]">
        <div className="max-w-[1500px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group" aria-label="SmartGeulis home">
            <Logo className="h-8 w-auto" markOnly />
            <div>
              <div className="font-display text-2xl leading-none tracking-wider text-[#171717] flex items-center gap-2">
                SmartGeulis
              </div>
              <div className="font-mono-custom text-[10px] text-[#666666] tracking-[0.25em] uppercase">
                TRACEABILITY SYSTEM
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 font-mono-custom text-[11px] text-[#666666] border border-[#eaeaea] bg-[#f5f5f5] px-3 py-1.5 rounded-none">
              <span className="w-2 h-2 rounded-full bg-[#16a34a] animate-pulse"></span>
              <span>SYSTEM ONLINE</span>
            </div>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 font-heading text-xs uppercase tracking-wider text-[#666666] hover:text-[#171717] transition-colors"
            >
              <Icon name="arrow-left" size={13} />
              <span>SmartGeulis</span>
            </Link>
            <Link
              to="/traceability"
              className="hidden md:inline-flex items-center gap-1.5 font-heading text-xs uppercase tracking-wider text-[#ea580c] hover:text-[#c2410c] font-semibold transition-colors"
            >
              <span>Public Trace</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Two-Column Layout (Left: Form Login, Right: Papan Nama) ── */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 my-4">
        <div className="w-full max-w-[1500px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            
            {/* ── LEFT COLUMN: Form Login ── */}
            <div className="lg:col-span-5 flex flex-col justify-center">
              <div className="notch-corner border border-[#eaeaea] bg-white p-6 sm:p-10 shadow-sm rounded-none h-full flex flex-col justify-between">
                <div>
                  {/* Station Authentication Tag */}
                  <div className="flex items-start gap-2.5 font-mono-custom text-[10px] sm:text-xs text-[#ea580c] tracking-[0.08em] sm:tracking-[0.25em] uppercase mb-2">
                    <span className="w-6 h-[2px] bg-[#ea580c] shrink-0 mt-2"></span>
                    <span className="min-w-0">STATION AUTHENTICATION · PACKHOUSE NETWORK</span>
                  </div>

                  <h1 className="font-display text-4xl sm:text-5xl tracking-tight text-[#171717] leading-none mb-2">
                    OPERATOR SIGN IN
                  </h1>
                  <p className="text-xs sm:text-sm text-[#666666] font-body mb-6 leading-relaxed">
                    Enter your credentials to access your terminal.
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
                      <div className="relative">
                        <input
                          id="email"
                          type="email"
                          inputMode="email"
                          autoComplete="username"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="admin@smartgeulisunpad.com"
                          required
                          className="w-full bg-[#fafafa] border border-[#d1d5db] rounded-none px-4 py-3 font-mono text-sm text-[#171717] placeholder:text-[#999999] focus:outline-none focus:border-[#ea580c] focus:ring-2 focus:ring-[#ea580c]/20 transition-all pr-10"
                        />
                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#999999] pointer-events-none">
                          <Icon name="user" size={16} />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="password"
                        className="block font-mono-custom text-[11px] font-semibold uppercase tracking-[0.2em] text-[#666666] mb-1.5"
                      >
                        Station Password
                      </label>
                      <div className="relative">
                        <input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          className="w-full bg-[#fafafa] border border-[#d1d5db] rounded-none px-4 py-3 font-mono text-sm text-[#171717] placeholder:text-[#999999] focus:outline-none focus:border-[#ea580c] focus:ring-2 focus:ring-[#ea580c]/20 transition-all pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#999999] hover:text-[#171717] transition-colors focus:outline-none"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          <Icon name="eye" size={16} />
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="pulse-btn w-full bg-[#000000] text-white py-3.5 font-heading text-sm uppercase tracking-[0.2em] hover:bg-[#ea580c] transition-all flex items-center justify-center gap-2 rounded-none font-semibold cursor-pointer disabled:opacity-50 mt-6"
                    >
                      <span>{loading ? 'AUTHENTICATING…' : 'SIGN IN TO STATION'}</span>
                      <Icon name="arrow-right" size={16} />
                    </button>
                  </form>
                </div>

                {/* Left Footer Security / Protocol Badges */}
                <div className="mt-8 pt-6 border-t border-[#eaeaea]">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="border border-[#f0f0f0] bg-[#fafafa] p-2">
                      <div className="font-mono-custom text-[9px] text-[#999999] uppercase tracking-wider">PROTOCOL</div>
                      <div className="font-heading text-xs text-[#171717] uppercase tracking-wider font-semibold mt-0.5">TLS 1.3</div>
                    </div>
                    <div className="border border-[#f0f0f0] bg-[#fafafa] p-2">
                      <div className="font-mono-custom text-[9px] text-[#999999] uppercase tracking-wider">TELEMETRY</div>
                      <div className="font-heading text-xs text-[#171717] uppercase tracking-wider font-semibold mt-0.5">MODBUS RTU</div>
                    </div>
                    <div className="border border-[#f0f0f0] bg-[#fafafa] p-2">
                      <div className="font-mono-custom text-[9px] text-[#999999] uppercase tracking-wider">STANDARDS</div>
                      <div className="font-heading text-xs text-[#171717] uppercase tracking-wider font-semibold mt-0.5">GS1 DIGITAL</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── RIGHT COLUMN: Papan Nama Showcase (Signboard Showcase) ── */}
            <div className="lg:col-span-7 flex flex-col justify-center">
              <div className="notch-dark border border-[#262626] bg-[#0f1115] text-white p-6 sm:p-8 shadow-xl rounded-none flex flex-col justify-between h-full relative overflow-hidden">
                {/* Subtle Ambient Radial Glow */}
                <div
                  className="absolute -top-32 -right-32 w-96 h-96 bg-[#ea580c]/15 rounded-full blur-3xl pointer-events-none"
                  aria-hidden="true"
                />

                {/* Top Status Bar */}
                <div className="relative z-10 flex items-center justify-between border-b border-white/10 pb-4 mb-5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-[#ea580c] shrink-0"></span>
                    <span className="font-mono-custom text-[11px] text-[#ea580c] tracking-[0.2em] uppercase font-semibold">
                      OFFICIAL FACILITY SIGNBOARD
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono-custom text-[11px] text-white/80 bg-white/5 border border-white/10 px-3 py-1">
                    <span className="w-2 h-2 rounded-full bg-[#16a34a] animate-ping shrink-0"></span>
                    <span className="tracking-wider uppercase">NODE SG-GARUT-01 · ACTIVE</span>
                  </div>
                </div>

                {/* Papan Nama Image Showcase Frame */}
                <div className="relative z-10 border border-white/15 bg-black/60 p-2 sm:p-3 overflow-hidden group mb-5">
                  <div className="relative overflow-hidden bg-black/40">
                    <img
                      src="/Papan Nama Warehouse.png"
                      alt="SmartGeulis Packhouse and Warehouse Signboard"
                      className="w-full h-auto max-h-[380px] object-contain mx-auto transition-transform duration-700 group-hover:scale-[1.02]"
                    />
                    {/* Badge Overlay on Image */}
                    <div className="absolute bottom-3 left-3 bg-black/85 backdrop-blur-md border border-white/20 text-white px-3 py-1 text-[10px] font-mono-custom uppercase tracking-wider flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#ea580c]"></span>
                      <span>Garut Highland Packhouse & Warehouse</span>
                    </div>
                  </div>
                </div>

                {/* Facility Technical Specifications */}
                <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 border-y border-white/10 py-4">
                  <div>
                    <div className="font-mono-custom text-[10px] text-white/50 uppercase tracking-wider">Facility Type</div>
                    <div className="font-heading text-xs uppercase tracking-wider text-white font-medium mt-0.5">Central Packhouse</div>
                  </div>
                  <div>
                    <div className="font-mono-custom text-[10px] text-white/50 uppercase tracking-wider">Elevation</div>
                    <div className="font-heading text-xs uppercase tracking-wider text-white font-medium mt-0.5">1,240m ASL · Papandayan</div>
                  </div>
                  <div>
                    <div className="font-mono-custom text-[10px] text-white/50 uppercase tracking-wider">Trace System</div>
                    <div className="font-heading text-xs uppercase tracking-wider text-[#ea580c] font-medium mt-0.5">SmartGeulis Core</div>
                  </div>
                  <div>
                    <div className="font-mono-custom text-[10px] text-white/50 uppercase tracking-wider">Compliance</div>
                    <div className="font-heading text-xs uppercase tracking-wider text-white font-medium mt-0.5">ISO 22005 / GS1</div>
                  </div>
                </div>

                {/* Partner Ecosystem Bar */}
                <div className="relative z-10">
                  <div className="font-mono-custom text-[10px] text-white/60 uppercase tracking-[0.2em] mb-2.5 flex items-center gap-2">
                    <span>OPERATED IN COLLABORATION WITH</span>
                    <span className="flex-1 h-[1px] bg-white/10"></span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="bg-white p-2 flex items-center justify-center h-12 border border-white/20 shadow-xs">
                      <img src="/Unpad.png" alt="Universitas Padjadjaran" className="max-h-8 max-w-full object-contain" />
                    </div>
                    <div className="bg-white p-2 flex items-center justify-center h-12 border border-white/20 shadow-xs">
                      <img src="/Ministry of Agriculture of the Republic of Indonesia.png" alt="Ministry of Agriculture" className="max-h-8 max-w-full object-contain" />
                    </div>
                    <div className="bg-white p-2 flex items-center justify-center h-12 border border-white/20 shadow-xs">
                      <img src="/I Care.png" alt="I-CARE Initiative" className="max-h-8 max-w-full object-contain" />
                    </div>
                    <div className="bg-white p-2 flex items-center justify-center h-12 border border-white/20 shadow-xs">
                      <img src="/Eptilu.jpeg" alt="Eptilu Fresh Produce" className="max-h-8 max-w-full object-contain" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-[#eaeaea] bg-white py-5 text-xs text-[#666666]">
        <div className="max-w-[1500px] mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} SmartGeulis. All rights reserved.</p>
          <div className="flex flex-wrap items-center justify-center gap-3 font-mono-custom text-[11px]">
            <span className="bg-[#f5f5f5] px-2 py-0.5 border border-[#eaeaea] text-[#171717]">
              Type: smartgeulis
            </span>
            <span>Traceability System v1.0.0</span>
          </div>
          <Link to="/traceability" className="text-[#ea580c] hover:underline font-medium">
            Public Traceability Portal
          </Link>
        </div>
      </footer>
    </div>
  )
}
