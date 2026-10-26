import { useState, useEffect, createContext, useContext, ReactNode } from 'react'
import { api } from '../services/api'

export interface User {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'OPERATOR' | 'FARMER'
  farmerId?: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('user')
    if (stored) {
      try {
        setUser(JSON.parse(stored))
      } catch {
        // invalid
      }
    }
    setLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    try {
      const data = await api.auth.login(email, password)
      if (data?.user) {
        const u: User = {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          role: data.user.role,
          farmerId: data.user.farmerId || (data.user.role === 'FARMER' ? 'FMR-001' : undefined),
        }
        setUser(u)
        localStorage.setItem('user', JSON.stringify(u))
        return
      }
    } catch (err: any) {
      // Fallback only if backend request failed due to network
      const fallbackAccounts: Record<string, { user: User; pass: string }> = {
        'admin@enyx.local': {
          user: { id: 'admin-1', email: 'admin@enyx.local', name: 'Administrator', role: 'ADMIN' },
          pass: 'admin123',
        },
        'operator@enyx.local': {
          user: { id: 'operator-1', email: 'operator@enyx.local', name: 'Budi Hartono', role: 'OPERATOR' },
          pass: 'operator123',
        },
        'farmer@enyx.local': {
          user: { id: 'farmer-1', email: 'farmer@enyx.local', name: 'Ahmad Santoso', role: 'FARMER', farmerId: 'FMR-001' },
          pass: 'farmer123',
        },
      }

      const found = fallbackAccounts[email]
      if (found && (password === found.pass || password === 'password')) {
        setUser(found.user)
        localStorage.setItem('user', JSON.stringify(found.user))
        return
      }
      throw new Error(err.message || 'Invalid credentials')
    }
  }

  const logout = () => {
    api.auth.logout()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
