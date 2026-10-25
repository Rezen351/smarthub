import { useState, useEffect, createContext, useContext, ReactNode } from 'react'

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
      setUser(JSON.parse(stored))
    }
    setLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    const mockUsers: Record<string, User> = {
      'admin@enyx.local': {
        id: 'user-1',
        email: 'admin@enyx.local',
        name: 'System Admin',
        role: 'ADMIN',
      },
      'operator@enyx.local': {
        id: 'user-2',
        email: 'operator@enyx.local',
        name: 'Plant Operator',
        role: 'OPERATOR',
      },
      'farmer@enyx.local': {
        id: 'user-3',
        email: 'farmer@enyx.local',
        name: 'Ahmad Santoso (Farmer)',
        role: 'FARMER',
        farmerId: 'farmer-1',
      },
    }

    const foundUser = mockUsers[email]
    if (!foundUser || password !== 'password') {
      throw new Error('Invalid credentials')
    }

    setUser(foundUser)
    localStorage.setItem('user', JSON.stringify(foundUser))
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('user')
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
