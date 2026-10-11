import { useState, useEffect, createContext, useContext, ReactNode } from 'react'

export interface User {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'WEIGHING_OPERATOR' | 'SORTING_OPERATOR' | 'PACKAGING_OPERATOR' | 'WAREHOUSE_OPERATOR' | 'DELIVERY_OPERATOR' | 'FARMER'
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
        name: 'Admin',
        role: 'ADMIN',
      },
      'weighing@enyx.local': {
        id: 'user-2',
        email: 'weighing@enyx.local',
        name: 'Weighing Operator',
        role: 'WEIGHING_OPERATOR',
      },
      'sorting@enyx.local': {
        id: 'user-3',
        email: 'sorting@enyx.local',
        name: 'Sorting Operator',
        role: 'SORTING_OPERATOR',
      },
      'packaging@enyx.local': {
        id: 'user-4',
        email: 'packaging@enyx.local',
        name: 'Packaging Operator',
        role: 'PACKAGING_OPERATOR',
      },
      'warehouse@enyx.local': {
        id: 'user-5',
        email: 'warehouse@enyx.local',
        name: 'Warehouse Operator',
        role: 'WAREHOUSE_OPERATOR',
      },
      'delivery@enyx.local': {
        id: 'user-6',
        email: 'delivery@enyx.local',
        name: 'Delivery Operator',
        role: 'DELIVERY_OPERATOR',
      },
      'farmer@enyx.local': {
        id: 'user-7',
        email: 'farmer@enyx.local',
        name: 'Farmer',
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
