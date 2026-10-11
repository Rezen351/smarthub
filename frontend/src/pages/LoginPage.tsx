import { useState, FormEvent } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Logo from '../components/shared/Logo'
import Button from '../components/shared/Button'
import Card from '../components/shared/Card'
import Icon from '../components/shared/Icon'
import { Field, Input } from '../components/shared/Form'
import { Alert, AlertDescription } from '../components/ui/alert'

const demoAccounts = [
  { email: 'admin@enyx.local', role: 'Admin' },
  { email: 'weighing@enyx.local', role: 'Weighing Operator' },
  { email: 'sorting@enyx.local', role: 'Sorting Operator' },
  { email: 'packaging@enyx.local', role: 'Packaging Operator' },
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
      <div className="w-full max-w-sm flex flex-col gap-5">
        <div className="text-center flex flex-col gap-2">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2.5 mx-auto"
            aria-label="ENYX Traceability System home"
          >
            <Logo className="h-9 w-auto" markOnly />
            <div className="text-left flex flex-col">
              <span className="font-bold text-lg tracking-tight leading-tight text-foreground">
                Traceability System
              </span>
              <span className="text-xs text-muted-foreground font-mono">ENYX Enterprise</span>
            </div>
          </Link>
          <div className="mt-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">Sign In</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Enter your credentials to continue</p>
          </div>
        </div>

        <Card padding="lg" className="shadow-sm">
          <div className="flex flex-col gap-4">
            {error && (
              <Alert variant="destructive" className="p-3 text-xs">
                <Icon name="alert" size={15} />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

              <Button type="submit" variant="primary" size="lg" block touch loading={loading} className="mt-1">
                {loading ? 'Signing in…' : 'Sign In'}
              </Button>
            </form>

            <div className="pt-3 border-t border-border flex flex-col gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Demo Accounts (pw: password)
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {demoAccounts.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    className="p-1.5 rounded-md border border-border bg-muted/30 hover:bg-muted text-left text-xs transition-colors cursor-pointer"
                    onClick={() => {
                      setEmail(account.email)
                      setPassword('password')
                    }}
                  >
                    <p className="font-medium text-foreground truncate">{account.role}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{account.email}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} ENYX Enterprise. All rights reserved.
        </p>
      </div>
    </div>
  )
}
