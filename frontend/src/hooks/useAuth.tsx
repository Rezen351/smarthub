import { useState, useEffect, createContext, useContext, ReactNode } from 'react'
import { api } from '../services/api'
import { resolveFarmerId } from '../lib/authUser'

export interface User {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'OPERATOR' | 'FARMER'
  cardCode?: string
  address?: string
  farmerId?: string
  farmerProfile?: {
    code?: string
    phone?: string
    address?: string
    village?: string
  }
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<User | null>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function toUser(raw: any): User {
  return {
    id: raw.id,
    email: raw.email,
    name: raw.name,
    role: raw.role,
    cardCode: raw.cardCode,
    address: raw.address,
    farmerId: resolveFarmerId(raw),
    farmerProfile: raw.farmerProfile,
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

  const refreshUser = async () => {
    try {
      const data = await api.auth.me()
      if (data) {
        const u = toUser(data)
        setUser(u)
        localStorage.setItem('user', JSON.stringify(u))
        return u
      }
    } catch {
      // ignore
    }
    return null
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
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
