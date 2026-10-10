import { useState, FormEvent } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Logo from '../components/shared/Logo'
import Button from '../components/shared/Button'
import Icon from '../components/shared/Icon'
import { Field, Input } from '../components/shared/Form'

const demoAccounts = [
  { email: 'admin@enyx.local', role: 'Admin' },
  { email: 'weighing@enyx.local', role: 'Weighing Operator' },
  { email: 'sorting@enyx.local', role: 'Sorting Operator' },
  { email: 'warehouse@enyx.local', role: 'Warehouse Operator' },
  { email: 'delivery@enyx.local', role: 'Delivery Operator' },
  { email: 'farmer@enyx.local', role: 'Farmer' },
]

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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full" style={{ maxWidth: 400 }}>
        <div className="text-center stack-sm" style={{ marginBottom: 20 }}>
          <Link to="/" className="inline-flex items-center justify-center gap-2.5" aria-label="ENYX Traceability System home">
            <Logo className="h-9 w-auto" markOnly />
            <div className="text-left flex flex-col">
              <span className="font-bold text-lg tracking-tight leading-tight text-text">Traceability System</span>
              <span className="text-xs text-text-light font-mono">ENYX Enterprise</span>
            </div>
          </Link>
          <div>
            <h1 className="t-h2">Sign In</h1>
            <p className="t-small text-text-secondary">Enter your credentials to continue</p>
          </div>
        </div>

        <div className="card card-pad-lg stack-md">
          {error && (
            <div className="alert alert-danger" role="alert">
              <Icon name="alert" size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="stack-md">
            <Field label="Email" htmlFor="email" required>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@enyx.local"
                required
              />
            </Field>

            <Field label="Password" htmlFor="password" required>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="password"
                required
              />
            </Field>

            <Button type="submit" variant="primary" size="lg" block touch loading={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>

          <div className="divider" />

          <div className="stack-sm">
            <p className="t-caption text-text-secondary">Demo accounts · password: password</p>
            <div className="stack-xs">
              {demoAccounts.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  className="quick-action"
                  style={{ padding: '10px 12px' }}
                  onClick={() => {
                    setEmail(account.email)
                    setPassword('password')
                  }}
                >
                  <span className="flex items-center justify-between gap-sm w-full">
                    <span className="mono t-small">{account.email}</span>
                    <span className="t-caption text-text-secondary">{account.role}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="t-caption text-text-secondary text-center" style={{ marginTop: 16 }}>
          <Link to="/traceability" className="flex items-center gap-xs justify-center">
            <Icon name="search" size={12} />
            Trace a product without an account
          </Link>
        </p>

        <footer className="text-center" style={{ marginTop: 24, fontSize: '0.75rem', color: 'var(--text-secondary, #64748b)' }}>
          <p style={{ margin: 0 }}>ENYX Enterprise • Traceability System • v1.0.0</p>
          <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: '0.7rem' }}>Type: enyx-enterprise</p>
        </footer>
      </div>
    </div>
  )
}
