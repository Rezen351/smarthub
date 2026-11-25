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

async function downloadFile(endpoint: string, filename: string): Promise<void> {
  const headers = getAuthHeader()
  const response = await fetch(endpoint, { headers })

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user')
    }
    let errorMsg = `Download failed with status ${response.status}`
    try {
      const payload = await response.json()
      if (payload?.error?.message) {
        errorMsg = payload.error.message
      }
    } catch {
      // payload not JSON
    }
    throw new Error(errorMsg)
  }

  const blob = await response.blob()
  const blobUrl = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = blobUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(blobUrl)
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  error?: {
    code: string
    message: string
  }
}

export type CloseoutDisposition =
  | 'SHRINKAGE_LOSS'
  | 'CULL_REJECT'
  | 'LOOSE_RESERVE'
  | 'SAMPLE_USE'

export type ThermalPrinterStation = 'reception' | 'packaging' | 'pallet'

export interface PalletCloseout {
  id: string
  palletCode: string
  grade?: string | null
  leftoverKg: number
  disposition: CloseoutDisposition
  notes?: string
  farmerName?: string | null
  operatorName?: string | null
  createdAt: string
}

export interface Commodity {
  id: string
  code: string
  name: string
  exportName?: string
  description: string
  unit: string
  gtin?: string
  brand?: string
  packageType?: string
  isActive: boolean
  createdAt?: string
}

export const DEFAULT_COMMODITIES: Commodity[] = [
  {
    id: 'cmd-potato-001',
    code: '001',
    name: 'Kentang',
    description: 'Kentang panen segar dari petani',
    unit: 'kg',
    brand: 'Eptilu',
    packageType: 'Waring Bag',
    isActive: true,
  },
  {
    id: 'cmd-tomato-101',
    code: '101',
    name: 'Tomat',
    description: 'Tomat panen segar dari petani',
    unit: 'kg',
    brand: 'Eptilu',
    packageType: 'Waring Bag',
    isActive: true,
  },
  {
    id: 'cmd-chili-201',
    code: '201',
    name: 'Cabe Merah Keriting',
    description: 'Cabe merah keriting panen segar dari petani',
    unit: 'kg',
    brand: 'Eptilu',
    packageType: 'Waring Bag',
    isActive: true,
  },
  {
    id: 'cmd-chili-202',
    code: '202',
    name: 'Cabe Rawit Merah',
    description: 'Cabe rawit merah panen segar dari petani',
    unit: 'kg',
    brand: 'Eptilu',
    packageType: 'Waring Bag',
    isActive: true,
  },
]

export interface PackagingSpec {
  gtin: string
  productName: string
  packageType: string
  brand: string
  targetKg: number
}

export function getCommodityFamilyCode(code?: string): string {
  const clean = (code || '').trim()
  if (clean.startsWith('0')) return '0xx'
  if (clean.startsWith('1')) return '1xx'
  if (clean.startsWith('2')) return '2xx'
  if (clean.length > 0) return `${clean[0]}xx`
  return '0xx'
}

/**
 * Ensures Station 01 Reception strictly displays and uses clean, general raw commodity names.
 * Strips packaging weights (10 kg, 5 kg) or export prefixes to decouple Reception from Packaging.
 */
export function getGeneralCommodityName(item?: { code?: string; name?: string }): string {
  const code = (item?.code || '').trim()
  if (code === '001' || code === '0' || code.startsWith('0')) return 'Kentang'
  if (code === '101' || code === '1' || code.startsWith('1')) return 'Tomat'
  if (code === '201') return 'Cabe Merah Keriting'
  if (code === '202') return 'Cabe Rawit Merah'
  if (code.startsWith('2')) return 'Cabe'

  const rawName = (item?.name || '').trim()
  if (!rawName) return 'Kentang'
  const cleaned = rawName
    .replace(/\s*\d+\s*kg\b/gi, '')
    .replace(/\b(Washed|Fresh|Dry|Bulk|Export|Pouch|Carton|TW|Super|Box)\b/gi, '')
    .trim()
  return cleaned || rawName
}

export interface PackagingProduct {
  id: string
  productCode: string
  commodityCode: string
  commodityName: string
  mode: 'RETAIL_POUCH' | 'BULK_EXPORT'
  targetKg: number
  variant?: 'WASHED' | 'DRY' | 'STANDARD'
  productName: string
  packageType: string
  brand: string
  gtin: string
  isActive: boolean
}

export const DEFAULT_PACKAGING_PRODUCTS: PackagingProduct[] = [
  // Kentang (Family 0xx)
  {
    id: 'pkg-potato-carton-10kg-washed',
    productCode: '001',
    commodityCode: '001',
    commodityName: 'Kentang',
    mode: 'BULK_EXPORT',
    targetKg: 10.0,
    variant: 'WASHED',
    productName: 'Eptilu Washed Potatoes 10 kg',
    packageType: 'Carton Box',
    brand: 'Eptilu',
    gtin: '8994477090010',
    isActive: true,
  },
  {
    id: 'pkg-potato-carton-10kg-dry',
    productCode: '002',
    commodityCode: '001',
    commodityName: 'Kentang',
    mode: 'BULK_EXPORT',
    targetKg: 10.0,
    variant: 'DRY',
    productName: 'Eptilu Fresh Potatoes 10 kg',
    packageType: 'Carton Box',
    brand: 'Eptilu',
    gtin: '8994477090027',
    isActive: true,
  },
  {
    id: 'pkg-potato-pouch-1kg',
    productCode: '003',
    commodityCode: '001',
    commodityName: 'Kentang',
    mode: 'RETAIL_POUCH',
    targetKg: 1.0,
    variant: 'STANDARD',
    productName: 'Eptilu Fresh Potatoes 1 kg',
    packageType: 'Retail Pouch',
    brand: 'Eptilu',
    gtin: '8994477090034',
    isActive: true,
  },
  {
    id: 'pkg-potato-carton-50kg',
    productCode: '004',
    commodityCode: '001',
    commodityName: 'Kentang',
    mode: 'BULK_EXPORT',
    targetKg: 50.0,
    variant: 'STANDARD',
    productName: 'Eptilu Bulk Potatoes 50 kg',
    packageType: 'Master Carton',
    brand: 'Eptilu',
    gtin: '8994477090041',
    isActive: true,
  },
  {
    id: 'pkg-potato-carton-5kg',
    productCode: '005',
    commodityCode: '001',
    commodityName: 'Kentang',
    mode: 'BULK_EXPORT',
    targetKg: 5.0,
    variant: 'WASHED',
    productName: 'Eptilu Washed Potatoes 5 kg',
    packageType: 'Carton Box',
    brand: 'Eptilu',
    gtin: '8994477090058',
    isActive: true,
  },
  // Tomat (Family 1xx)
  {
    id: 'pkg-tomato-carton-10kg',
    productCode: '101',
    commodityCode: '101',
    commodityName: 'Tomat',
    mode: 'BULK_EXPORT',
    targetKg: 10.0,
    variant: 'STANDARD',
    productName: 'Eptilu Fresh Red Tomatoes TW 10 kg',
    packageType: 'Carton Box',
    brand: 'Eptilu',
    gtin: '8994477091017',
    isActive: true,
  },
  {
    id: 'pkg-tomato-pouch-1kg',
    productCode: '102',
    commodityCode: '101',
    commodityName: 'Tomat',
    mode: 'RETAIL_POUCH',
    targetKg: 1.0,
    variant: 'STANDARD',
    productName: 'Eptilu Fresh Tomatoes 1 kg',
    packageType: 'Retail Pouch',
    brand: 'Eptilu',
    gtin: '8994477091024',
    isActive: true,
  },
  {
    id: 'pkg-tomato-carton-5kg',
    productCode: '103',
    commodityCode: '101',
    commodityName: 'Tomat',
    mode: 'BULK_EXPORT',
    targetKg: 5.0,
    variant: 'STANDARD',
    productName: 'Eptilu Fresh Red Tomatoes TW 5 kg',
    packageType: 'Carton Box',
    brand: 'Eptilu',
    gtin: '8994477091031',
    isActive: true,
  },
  // Cabe Merah Keriting (Family 2xx)
  {
    id: 'pkg-curly-carton-10kg',
    productCode: '201',
    commodityCode: '201',
    commodityName: 'Cabe Merah Keriting',
    mode: 'BULK_EXPORT',
    targetKg: 10.0,
    variant: 'STANDARD',
    productName: 'Eptilu Fresh Curly Red Chili Peppers 10 kg',
    packageType: 'Carton Box',
    brand: 'Eptilu',
    gtin: '8994477092014',
    isActive: true,
  },
  {
    id: 'pkg-curly-pouch-1kg',
    productCode: '203',
    commodityCode: '201',
    commodityName: 'Cabe Merah Keriting',
    mode: 'RETAIL_POUCH',
    targetKg: 1.0,
    variant: 'STANDARD',
    productName: 'Eptilu Fresh Curly Red Chili 1 kg',
    packageType: 'Retail Pouch',
    brand: 'Eptilu',
    gtin: '8994477092038',
    isActive: true,
  },
  {
    id: 'pkg-curly-carton-5kg',
    productCode: '205',
    commodityCode: '201',
    commodityName: 'Cabe Merah Keriting',
    mode: 'BULK_EXPORT',
    targetKg: 5.0,
    variant: 'STANDARD',
    productName: 'Eptilu Fresh Curly Red Chili Peppers 5 kg',
    packageType: 'Carton Box',
    brand: 'Eptilu',
    gtin: '8994477092052',
    isActive: true,
  },
  // Cabe Rawit Merah (Family 2xx)
  {
    id: 'pkg-birdseye-carton-10kg',
    productCode: '202',
    commodityCode: '202',
    commodityName: 'Cabe Rawit Merah',
    mode: 'BULK_EXPORT',
    targetKg: 10.0,
    variant: 'STANDARD',
    productName: "Eptilu Fresh Red Bird's Eye Chili Peppers 10 kg",
    packageType: 'Carton Box',
    brand: 'Eptilu',
    gtin: '8994477092021',
    isActive: true,
  },
  {
    id: 'pkg-birdseye-pouch-1kg',
    productCode: '204',
    commodityCode: '202',
    commodityName: 'Cabe Rawit Merah',
    mode: 'RETAIL_POUCH',
    targetKg: 1.0,
    variant: 'STANDARD',
    productName: "Eptilu Fresh Red Bird's Eye Chili 1 kg",
    packageType: 'Retail Pouch',
    brand: 'Eptilu',
    gtin: '8994477092045',
    isActive: true,
  },
  {
    id: 'pkg-birdseye-carton-5kg',
    productCode: '206',
    commodityCode: '202',
    commodityName: 'Cabe Rawit Merah',
    mode: 'BULK_EXPORT',
    targetKg: 5.0,
    variant: 'STANDARD',
    productName: "Eptilu Fresh Red Bird's Eye Chili Peppers 5 kg",
    packageType: 'Carton Box',
    brand: 'Eptilu',
    gtin: '8994477092069',
    isActive: true,
  },
]

export const PACKAGING_CATALOG_STORAGE_KEY = 'smarthub_packaging_catalog'

export function getSavedPackagingCatalog(): PackagingProduct[] {
  try {
    const raw = localStorage.getItem(PACKAGING_CATALOG_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {
    // fallback
  }
  return DEFAULT_PACKAGING_PRODUCTS
}

export function savePackagingCatalog(products: PackagingProduct[]): void {
  localStorage.setItem(PACKAGING_CATALOG_STORAGE_KEY, JSON.stringify(products))
}

/**
 * Resolves GS1 packaging specifications based on raw commodity, processing condition (washed/dry),
 * grade/size, and packaging format (1 kg pouch vs 5 kg / 10 kg / 50 kg carton).
 */
export function resolvePackagingSpec(params: {
  commodityCode: string
  variant?: 'WASHED' | 'DRY'
  grade?: string
  mode: 'RETAIL_POUCH' | 'BULK_EXPORT'
  exportTargetKg?: 5 | 10 | 50
}): PackagingSpec {
  const code = params.commodityCode || '001'
  const isPouch = params.mode === 'RETAIL_POUCH'
  const target = isPouch ? 1.0 : (params.exportTargetKg || 10)
  const isDry = params.variant === 'DRY'
  const gradeLabel = params.grade ? ` (Grade ${params.grade})` : ''

  // 1. Check saved custom catalog first
  const catalog = getSavedPackagingCatalog()
  const custom = catalog.find((p) => {
    if (!p.isActive) return false
    if (p.commodityCode !== code) return false
    if (p.mode !== params.mode) return false
    if (Math.abs(p.targetKg - target) > 0.1) return false
    if (code === '001' && !isPouch && p.variant && p.variant !== 'STANDARD') {
      return isDry ? p.variant === 'DRY' : p.variant === 'WASHED'
    }
    return true
  })

  if (custom) {
    return {
      gtin: custom.gtin,
      productName: `${custom.productName}${gradeLabel}`,
      packageType: custom.packageType,
      brand: custom.brand,
      targetKg: custom.targetKg,
    }
  }

  // 2. Default hardcoded fallback
  if (code === '001') {
    // Kentang
    if (isPouch) {
      return {
        gtin: '8994477090034',
        productName: `Eptilu Fresh Potatoes 1 kg${gradeLabel}`,
        packageType: 'Retail Pouch',
        brand: 'Eptilu',
        targetKg: 1.0,
      }
    }
    if (target === 5) {
      return {
        gtin: '8994477090058',
        productName: `Eptilu ${isDry ? 'Fresh' : 'Washed'} Potatoes 5 kg${gradeLabel}`,
        packageType: 'Carton Box',
        brand: 'Eptilu',
        targetKg: 5.0,
      }
    }
    if (target === 10) {
      if (isDry) {
        return {
          gtin: '8994477090027',
          productName: `Eptilu Fresh Potatoes 10 kg${gradeLabel}`,
          packageType: 'Carton Box',
          brand: 'Eptilu',
          targetKg: 10.0,
        }
      }
      return {
        gtin: '8994477090010',
        productName: `Eptilu Washed Potatoes 10 kg${gradeLabel}`,
        packageType: 'Carton Box',
        brand: 'Eptilu',
        targetKg: 10.0,
      }
    }
    return {
      gtin: '8994477090041',
      productName: `Eptilu Bulk Potatoes 50 kg${gradeLabel}`,
      packageType: 'Master Carton',
      brand: 'Eptilu',
      targetKg: 50.0,
    }
  }

  if (code === '101') {
    // Tomat
    if (isPouch) {
      return {
        gtin: '8994477091024',
        productName: `Eptilu Fresh Tomatoes 1 kg${gradeLabel}`,
        packageType: 'Retail Pouch',
        brand: 'Eptilu',
        targetKg: 1.0,
      }
    }
    if (target === 5) {
      return {
        gtin: '8994477091031',
        productName: `Eptilu Fresh Red Tomatoes TW 5 kg${gradeLabel}`,
        packageType: 'Carton Box',
        brand: 'Eptilu',
        targetKg: 5.0,
      }
    }
    return {
      gtin: '8994477091017',
      productName: `Eptilu Fresh Red Tomatoes TW 10 kg${gradeLabel}`,
      packageType: 'Carton Box',
      brand: 'Eptilu',
      targetKg: 10.0,
    }
  }

  if (code === '201') {
    // Cabe Merah Keriting
    if (isPouch) {
      return {
        gtin: '8994477092038',
        productName: `Eptilu Fresh Curly Red Chili 1 kg${gradeLabel}`,
        packageType: 'Retail Pouch',
        brand: 'Eptilu',
        targetKg: 1.0,
      }
    }
    if (target === 5) {
      return {
        gtin: '8994477092052',
        productName: `Eptilu Fresh Curly Red Chili Peppers 5 kg${gradeLabel}`,
        packageType: 'Carton Box',
        brand: 'Eptilu',
        targetKg: 5.0,
      }
    }
    return {
      gtin: '8994477092014',
      productName: `Eptilu Fresh Curly Red Chili Peppers 10 kg${gradeLabel}`,
      packageType: 'Carton Box',
      brand: 'Eptilu',
      targetKg: 10.0,
    }
  }

  if (code === '202') {
    // Cabe Rawit Merah
    if (isPouch) {
      return {
        gtin: '8994477092045',
        productName: `Eptilu Fresh Red Bird's Eye Chili 1 kg${gradeLabel}`,
        packageType: 'Retail Pouch',
        brand: 'Eptilu',
        targetKg: 1.0,
      }
    }
    if (target === 5) {
      return {
        gtin: '8994477092069',
        productName: `Eptilu Fresh Red Bird's Eye Chili Peppers 5 kg${gradeLabel}`,
        packageType: 'Carton Box',
        brand: 'Eptilu',
        targetKg: 5.0,
      }
    }
    return {
      gtin: '8994477092021',
      productName: `Eptilu Fresh Red Bird's Eye Chili Peppers 10 kg${gradeLabel}`,
      packageType: 'Carton Box',
      brand: 'Eptilu',
      targetKg: 10.0,
    }
  }

  return {
    gtin: '8994477090010',
    productName: `Eptilu Packaged Product${gradeLabel}`,
    packageType: isPouch ? 'Retail Pouch' : 'Carton Box',
    brand: 'Eptilu',
    targetKg: target,
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
  commodityId?: string | null
  commodityCode?: string | null
  commodityName?: string | null
  commodityExportName?: string | null
  commodityGtin?: string | null
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

  // Commodities Master Data & GS1 GTIN-13
  commodities: {
    list: async (includeInactive = false) => {
      const query = includeInactive ? '?includeInactive=true' : ''
      const res = await request<ApiResponse<Commodity[]>>(`/commodities${query}`)
      return res.data
    },
    create: async (data: {
      code: string
      name: string
      exportName?: string
      gtin: string
      description?: string
      unit?: string
      brand?: string
      packageType?: string
      isActive?: boolean
    }) => {
      const res = await request<ApiResponse<Commodity>>('/commodities', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      return res.data
    },
    update: async (
      idOrCode: string,
      data: Partial<{
        code: string
        name: string
        exportName: string
        gtin: string
        description: string
        unit: string
        brand: string
        packageType: string
        isActive: boolean
      }>
    ) => {
      const res = await request<ApiResponse<Commodity>>(`/commodities/${encodeURIComponent(idOrCode)}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
      return res.data
    },
    delete: async (idOrCode: string) => {
      const res = await request<ApiResponse<{ id: string; code: string; deleted?: boolean; deactivated?: boolean; message?: string }>>(
        `/commodities/${encodeURIComponent(idOrCode)}`,
        { method: 'DELETE' }
      )
      return res.data
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
      requestId?: string
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
    delete: async (idOrCode: string) => {
      const res = await request<ApiResponse<any>>(`/weighing/${encodeURIComponent(idOrCode)}`, {
        method: 'DELETE',
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
    release: async (idOrCode: string, data: { disposition: CloseoutDisposition; notes?: string }) => {
      const res = await request<
        ApiResponse<{
          closeoutId: string
          palletCode: string
          settledKg: number
          disposition: CloseoutDisposition
          status: string
          released: boolean
          message: string
        }>
      >(`/pallets/${encodeURIComponent(idOrCode)}/release`, {
        method: 'POST',
        body: JSON.stringify(data),
      })
      return res.data
    },
    closeouts: async () => {
      const res = await request<ApiResponse<PalletCloseout[]>>('/pallets/closeouts')
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
      gtin?: string
      productName?: string
      variant?: string
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
    create: async (data: { truckPlate: string; driverName: string; destination: string; grade: 'A' | 'B' | 'C'; commodityCode?: string; units: number }) => {
      const res = await request<ApiResponse<any>>('/deliveries', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      return res.data
    },
    verify: async (id: string, code: string) => {
      const res = await request<ApiResponse<any>>(`/deliveries/${encodeURIComponent(id)}/verify`, {
        method: 'POST', body: JSON.stringify({ code }),
      })
      return res.data
    },
    depart: async (id: string) => {
      const res = await request<ApiResponse<any>>(`/deliveries/${encodeURIComponent(id)}/depart`, { method: 'POST' })
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
    testConnection: async (stationId: string, config?: { ip?: string; port?: number }) => {
      const res = await request<ApiResponse<any>>(`/scales/${encodeURIComponent(stationId)}/test`, {
        method: 'POST',
        body: config ? JSON.stringify(config) : undefined,
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
    update: async (station: ThermalPrinterStation, ip: string, port: number) => {
      const res = await request<ApiResponse<any>>(`/printers/${station}`, {
        method: 'PUT',
        body: JSON.stringify({ ip, port }),
      })
      return res.data
    },
    test: async (station: ThermalPrinterStation, config?: { ip?: string; port?: number }) => {
      const res = await request<ApiResponse<any>>(`/printers/${station}/test`, {
        method: 'POST',
        body: config ? JSON.stringify(config) : undefined,
      })
      return res.data
    },
    print: async (station: ThermalPrinterStation, jobs: any[]) => {
      const res = await request<ApiResponse<any>>(`/printers/${station}/print`, {
        method: 'POST',
        body: JSON.stringify({ jobs }),
      })
      return res.data
    },
  },

  // Reports, Analytics & Recaps
  reports: {
    dailyRecap: async (date?: string, commodityCode?: string) => {
      const sp = new URLSearchParams()
      if (date) sp.set('date', date)
      if (commodityCode) sp.set('commodityCode', commodityCode)
      const query = sp.toString() ? `?${sp.toString()}` : ''
      const res = await request<ApiResponse<any>>(`/reports/recap/daily${query}`)
      return res.data
    },
    monthlyRecap: async (month?: string, commodityCode?: string) => {
      const sp = new URLSearchParams()
      if (month) sp.set('month', month)
      if (commodityCode) sp.set('commodityCode', commodityCode)
      const query = sp.toString() ? `?${sp.toString()}` : ''
      const res = await request<ApiResponse<any>>(`/reports/recap/monthly${query}`)
      return res.data
    },
    farmerRankings: async (limit = 10, period = 'all', commodityCode?: string) => {
      const sp = new URLSearchParams({ limit: String(limit), period })
      if (commodityCode) sp.set('commodityCode', commodityCode)
      const res = await request<ApiResponse<{ period: string; grandTotalGross: number; rankings: any[] }>>(
        `/reports/rankings/farmers?${sp.toString()}`
      )
      return res.data
    },
    downloadDailyCsvUrl: (date?: string, commodityCode?: string) => {
      const sp = new URLSearchParams({ date: date || new Date().toISOString().slice(0, 10), format: 'csv' })
      if (commodityCode) sp.set('commodityCode', commodityCode)
      return `/api/v1/reports/recap/daily?${sp.toString()}`
    },
    downloadMonthlyCsvUrl: (month?: string, commodityCode?: string) => {
      const sp = new URLSearchParams({ month: month || new Date().toISOString().slice(0, 7), format: 'csv' })
      if (commodityCode) sp.set('commodityCode', commodityCode)
      return `/api/v1/reports/recap/monthly?${sp.toString()}`
    },
    downloadRankingsCsvUrl: (limit = 10, period = 'all', commodityCode?: string) => {
      const sp = new URLSearchParams({ limit: String(limit), period, format: 'csv' })
      if (commodityCode) sp.set('commodityCode', commodityCode)
      return `/api/v1/reports/rankings/farmers?${sp.toString()}`
    },
    downloadDailyCsv: async (date?: string, commodityCode?: string) => {
      const d = date || new Date().toISOString().slice(0, 10)
      const sp = new URLSearchParams({ date: d, format: 'csv' })
      if (commodityCode) sp.set('commodityCode', commodityCode)
      return downloadFile(`/api/v1/reports/recap/daily?${sp.toString()}`, `smartgeulis_daily_recap_${d}.csv`)
    },
    downloadMonthlyCsv: async (month?: string, commodityCode?: string) => {
      const m = month || new Date().toISOString().slice(0, 7)
      const sp = new URLSearchParams({ month: m, format: 'csv' })
      if (commodityCode) sp.set('commodityCode', commodityCode)
      return downloadFile(`/api/v1/reports/recap/monthly?${sp.toString()}`, `smartgeulis_monthly_recap_${m}.csv`)
    },
    downloadRankingsCsv: async (limit = 50, period = 'all', commodityCode?: string) => {
      const sp = new URLSearchParams({ limit: String(limit), period, format: 'csv' })
      if (commodityCode) sp.set('commodityCode', commodityCode)
      return downloadFile(`/api/v1/reports/rankings/farmers?${sp.toString()}`, `smartgeulis_farmer_rankings_${period}.csv`)
    },
  },

  // Admin Operations & Transaction Management
  admin: {
    inspectTransaction: async (params: { waringCode?: string; waringId?: string; farmerId?: string; date?: string }) => {
      const sp = new URLSearchParams()
      if (params.waringCode) sp.set('waringCode', params.waringCode)
      if (params.waringId) sp.set('waringId', params.waringId)
      if (params.farmerId) sp.set('farmerId', params.farmerId)
      if (params.date) sp.set('date', params.date)
      const res = await request<ApiResponse<any[]>>(`/admin/transactions/inspect?${sp.toString()}`)
      return res.data
    },
    cancelTransaction: async (params: { waringCode?: string; waringId?: string; farmerId?: string; date?: string; reason?: string }) => {
      const res = await request<ApiResponse<any>>('/admin/transactions/cancel', {
        method: 'POST',
        body: JSON.stringify(params),
      })
      return res.data
    },
  },
}
