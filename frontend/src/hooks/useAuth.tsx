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

function toUser(raw: any): User {
  return {
    id: raw.id,
    email: raw.email,
    name: raw.name,
    role: raw.role,
    farmerId: raw.farmerProfile?.code || undefined,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('user')
    if (stored) {
      try {
        setUser(JSON.parse(stored))
      } catch {
        localStorage.removeItem('user')
      }
    }
    setLoading(false)

    if (!localStorage.getItem('auth_token')) return
    let cancelled = false
    api.auth
      .me()
      .then((data) => {
        if (cancelled || !data) return
        const u = toUser(data)
        setUser(u)
        localStorage.setItem('user', JSON.stringify(u))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const login = async (email: string, password: string) => {
    const data = await api.auth.login(email, password)
    if (!data?.user) throw new Error('Invalid credentials')
    const u = toUser(data.user)
    setUser(u)
    localStorage.setItem('user', JSON.stringify(u))
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
