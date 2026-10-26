/**
 * E-Tani SmartHub Centralized API Client
 * Connects Frontend directly to Express REST Backend at /api/v1
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

  // Pallets
  pallets: {
    list: async () => {
      const res = await request<ApiResponse<any[]>>('/pallets')
      return res.data
    },
    get: async (code: string) => {
      const res = await request<ApiResponse<any>>(`/pallets/${encodeURIComponent(code)}`)
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
    updateConfig: async (stationId: string, host: string, port: number) => {
      const res = await request<ApiResponse<any>>(`/scales/${encodeURIComponent(stationId)}/config`, {
        method: 'PUT',
        body: JSON.stringify({ host, port }),
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
}
