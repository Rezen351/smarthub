/**
 * E-Tani SmartHub Centralized API Client
 * Connects the frontend to the Go REST backend at /api/v1
 */

const BASE_URL = '/api/v1'

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('auth_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...(options.headers || {}),
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    if (response.status === 401 && !endpoint.includes('/auth/login')) {
      // Clear stale token on 401 to prevent repeated authentication failure loops
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user')
    }
    const errorMsg = payload?.error?.message || `Request failed with status ${response.status}`
    throw new Error(errorMsg)
  }

  return payload
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  error?: {
    code: string
    message: string
  }
}

export interface Pallet {
  id: string
  code: string
  tareKg: number
  weightKg: number
  remainingKg: number
  grade?: string | null
  status: 'AVAILABLE' | 'IN_USE' | 'PACKAGING' | 'DEPLETED' | string
  notes?: string | null
  farmerName?: string | null
  farmerVillage?: string | null
  waringCode?: string | null
  createdAt?: string
  updatedAt?: string
}

export const api = {
  // Authentication
  auth: {
    login: async (email: string, password: string) => {
      const res = await request<ApiResponse<{ token: string; user: any }>>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      if (res.data?.token) {
        localStorage.setItem('auth_token', res.data.token)
      }
      return res.data
    },
    me: async () => {
      const res = await request<ApiResponse<any>>('/auth/me')
      return res.data
    },
    users: async () => {
      const res = await request<ApiResponse<any[]>>('/auth/users')
      return res.data
    },
    createUser: async (data: { name: string; email: string; role: string; password?: string }) => {
      const res = await request<ApiResponse<any>>('/auth/users', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      return res.data
    },
    updateUser: async (id: string, data: any) => {
      const res = await request<ApiResponse<any>>(`/auth/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
      return res.data
    },
    changePassword: async (data: { currentPassword: string; newPassword: string }) => {
      const res = await request<ApiResponse<any>>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      return res.data
    },
    updateProfile: async (data: { name: string; phone?: string; address?: string; village?: string }) => {
      const res = await request<ApiResponse<any>>('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
      })
      return res.data
    },
    deleteUser: async (id: string) => {
      const res = await request<ApiResponse<any>>(`/auth/users/${id}`, {
        method: 'DELETE',
      })
      return res.data
    },
    logout: () => {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user')
    },
  },

  // Farmers
  farmers: {
    list: async () => {
      const res = await request<ApiResponse<any[]>>('/farmers')
      return res.data
    },
    get: async (idOrCode: string) => {
      const res = await request<ApiResponse<any>>(`/farmers/${encodeURIComponent(idOrCode)}`)
      return res.data
    },
    summary: async (idOrCode: string) => {
      const res = await request<ApiResponse<any>>(`/farmers/${encodeURIComponent(idOrCode)}/summary`)
      return res.data
    },
  },

  // Station 01: Weighing & Reception
  weighing: {
    list: async (status?: string) => {
      const query = status ? `?status=${encodeURIComponent(status)}` : ''
      const res = await request<ApiResponse<any[]>>(`/weighing${query}`)
      return res.data
    },
    create: async (data: {
      farmerCode: string
      grossWeightKg: number
      tareWeightKg?: number
      netWeightKg?: number
      commodityCode?: string
      notes?: string
    }) => {
      const res = await request<ApiResponse<any>>('/weighing', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      return res.data
    },
    approve: async (id: string) => {
      const res = await request<ApiResponse<any>>(`/weighing/${id}/approve`, {
        method: 'PATCH',
      })
      return res.data
    },
    correct: async (id: string, grossWeightKg: number, note?: string) => {
      const res = await request<ApiResponse<any>>(`/weighing/${id}/correct`, {
        method: 'PATCH',
        body: JSON.stringify({ grossWeightKg, note }),
      })
      return res.data
    },
  },

  // Station 02: Sorting
  sorting: {
    queue: async () => {
      const res = await request<ApiResponse<any[]>>('/sorting/queue')
      return res.data
    },
    process: async (data: {
      waringCode: string
      washingRecord?: string
      grades: Array<{
        gradeCode: string
        weightKg: number
        palletCode?: string
      }>
    }) => {
      const res = await request<ApiResponse<any>>('/sorting/process', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      return res.data
    },
    batches: async () => {
      const res = await request<ApiResponse<any[]>>('/sorting/batches')
      return res.data
    },
  },

  // Physical Pallets Management & QR Label Printing
  pallets: {
    list: async () => {
      const res = await request<ApiResponse<Pallet[]>>('/pallets')
      return res.data
    },
    get: async (code: string) => {
      const res = await request<ApiResponse<Pallet>>(`/pallets/${encodeURIComponent(code)}`)
      return res.data
    },
    create: async (data: { code: string; tareKg?: number; notes?: string }) => {
      const res = await request<ApiResponse<Pallet>>('/pallets', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      return res.data
    },
    delete: async (idOrCode: string) => {
      const res = await request<ApiResponse<{ message: string }>>(`/pallets/${encodeURIComponent(idOrCode)}`, {
        method: 'DELETE',
      })
      return res.data
    },
    print: async (idOrCode: string) => {
      const res = await request<ApiResponse<{ message: string; pallet: Pallet }>>(`/pallets/${encodeURIComponent(idOrCode)}/print`, {
        method: 'POST',
      })
      return res.data
    },
  },

  // Station 03: Packaging
  packaging: {
    pack: async (data: {
      palletCode: string
      packageTypeCode: string
      quantity: number
      totalNetWeightKg: number
      storageLocation?: string
    }) => {
      const res = await request<ApiResponse<any>>('/packaging/pack', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      return res.data
    },
    records: async () => {
      const res = await request<ApiResponse<any[]>>('/packaging/records')
      return res.data
    },
  },

  // Warehouse Management
  warehouse: {
    overview: async () => {
      const res = await request<ApiResponse<any>>('/warehouse/overview')
      return res.data
    },
  },

  // Deliveries & Outbound
  deliveries: {
    list: async () => {
      const res = await request<ApiResponse<any[]>>('/deliveries')
      return res.data
    },
    create: async (data: {
      truckPlate: string
      driverName: string
      destination: string
      items: Array<{
        packageUnitId: string
        quantity: number
      }>
    }) => {
      const res = await request<ApiResponse<any>>('/deliveries', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      return res.data
    },
  },

  // Public & Station Traceability
  traceability: {
    lookup: async (code: string) => {
      const res = await request<ApiResponse<any>>(`/traceability/${encodeURIComponent(code)}`)
      return res.data
    },
  },

  // Modbus TCP Scales
  scales: {
    list: async () => {
      const res = await request<ApiResponse<any[]>>('/scales')
      return res.data
    },
    getWeight: async (stationId: string) => {
      const res = await request<ApiResponse<any>>(`/scales/${encodeURIComponent(stationId)}/weight`)
      return res.data
    },
    tare: async (stationId: string) => {
      const res = await request<ApiResponse<any>>(`/scales/${encodeURIComponent(stationId)}/tare`, {
        method: 'POST',
      })
      return res.data
    },
    zero: async (stationId: string) => {
      const res = await request<ApiResponse<any>>(`/scales/${encodeURIComponent(stationId)}/zero`, {
        method: 'POST',
      })
      return res.data
    },
    updateConfig: async (stationId: string, config: {
      host: string
      port: number
      capacityKg: number
      unitId: number
      weightRegister: number
      statusRegister: number
    }) => {
      const res = await request<ApiResponse<any>>(`/scales/${encodeURIComponent(stationId)}/config`, {
        method: 'PUT',
        body: JSON.stringify(config),
      })
      return res.data
    },
    testConnection: async (stationId: string) => {
      const res = await request<ApiResponse<any>>(`/scales/${encodeURIComponent(stationId)}/test`, {
        method: 'POST',
      })
      return res.data
    },
  },

  // IW-J300H Thermal Printers
  printers: {
    get: async () => {
      const res = await request<ApiResponse<any[]>>('/printers')
      return res.data
    },
    update: async (station: 'reception' | 'packaging', ip: string, port: number) => {
      const res = await request<ApiResponse<any>>(`/printers/${station}`, {
        method: 'PUT',
        body: JSON.stringify({ ip, port }),
      })
      return res.data
    },
    test: async (station: 'reception' | 'packaging') => {
      const res = await request<ApiResponse<any>>(`/printers/${station}/test`, { method: 'POST' })
      return res.data
    },
    print: async (station: 'reception' | 'packaging', jobs: any[]) => {
      const res = await request<ApiResponse<any>>(`/printers/${station}/print`, {
        method: 'POST',
        body: JSON.stringify({ jobs }),
      })
      return res.data
    },
  },

  // Reports, Analytics & Recaps
  reports: {
    dailyRecap: async (date?: string) => {
      const query = date ? `?date=${encodeURIComponent(date)}` : ''
      const res = await request<ApiResponse<any>>(`/reports/recap/daily${query}`)
      return res.data
    },
    monthlyRecap: async (month?: string) => {
      const query = month ? `?month=${encodeURIComponent(month)}` : ''
      const res = await request<ApiResponse<any>>(`/reports/recap/monthly${query}`)
      return res.data
    },
    farmerRankings: async (limit = 10, period = 'all') => {
      const res = await request<ApiResponse<{ period: string; grandTotalGross: number; rankings: any[] }>>(
        `/reports/rankings/farmers?limit=${limit}&period=${period}`
      )
      return res.data
    },
    downloadDailyCsvUrl: (date?: string) => {
      const d = date || new Date().toISOString().slice(0, 10)
      return `/api/v1/reports/recap/daily?date=${encodeURIComponent(d)}&format=csv`
    },
    downloadMonthlyCsvUrl: (month?: string) => {
      const m = month || new Date().toISOString().slice(0, 7)
      return `/api/v1/reports/recap/monthly?month=${encodeURIComponent(m)}&format=csv`
    },
    downloadRankingsCsvUrl: (limit = 10, period = 'all') => {
      return `/api/v1/reports/rankings/farmers?limit=${limit}&period=${period}&format=csv`
    },
  },
}
