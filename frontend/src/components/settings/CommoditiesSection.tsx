import { useCallback, useEffect, useMemo, useState } from 'react'
import Badge from '../shared/Badge'
import Button from '../shared/Button'
import Card from '../shared/Card'
import DataTable, { type Column } from '../shared/DataTable'
import { Field, Input, Select } from '../shared/Form'
import Icon from '../shared/Icon'
import { useToast } from '../feedback/Toast'
import { useAuth } from '../../hooks/useAuth'
import {
  api,
  type Commodity,
  type PackagingProduct,
  DEFAULT_PACKAGING_PRODUCTS,
  getSavedPackagingCatalog,
  savePackagingCatalog,
  getCommodityFamilyCode,
  getGeneralCommodityName,
} from '../../services/api'

function validateGtin13Client(raw: string): { valid: boolean; message?: string } {
  const g = raw.trim()
  if (!/^\d{13}$/.test(g)) {
    return { valid: false, message: 'GTIN-13 must be exactly 13 numeric digits.' }
  }
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += Number(g[i]) * (i % 2 === 0 ? 1 : 3)
  }
  const expected = (10 - (sum % 10)) % 10
  const actual = Number(g[12])
  if (actual !== expected) {
    return { valid: false, message: `Invalid GS1 check digit (expected ${expected}, got ${actual}).` }
  }
  return { valid: true }
}

function computeGtin13FromCode(code3: string): string {
  const clean = code3.trim().replace(/\D/g, '').padStart(3, '0').slice(-3)
  const base = `899447709${clean}`
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += Number(base[i]) * (i % 2 === 0 ? 1 : 3)
  }
  const check = (10 - (sum % 10)) % 10
  return `${base}${check}`
}

export default function CommoditiesSection() {
  const toast = useToast()
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const [activeTab, setActiveTab] = useState<'packaging' | 'raw'>('packaging')

  /* ─────────────────────────────────────────────────────────────
   * 1. Packaging & GS1 Catalog State (Product Codes & GTINs)
   * ───────────────────────────────────────────────────────────── */
  const [catalog, setCatalog] = useState<PackagingProduct[]>(() => getSavedPackagingCatalog())
  const [editingPkgId, setEditingPkgId] = useState<string | null>(null)
  const [isAddingPkg, setIsAddingPkg] = useState(false)
  const [pkgFilterCommodity, setPkgFilterCommodity] = useState<string>('ALL')
  const [pkgSearch, setPkgSearch] = useState<string>('')

  // Edit packaging form
  const [pkgForm, setPkgForm] = useState<{
    productCode: string
    productName: string
    targetKg: number
    packageType: string
    variant: 'STANDARD' | 'WASHED' | 'DRY'
    grade: 'ALL' | 'A' | 'B' | 'C'
    brand: string
    gtin: string
    isActive: boolean
  }>({
    productCode: '001',
    productName: '',
    targetKg: 10,
    packageType: 'Carton Box',
    variant: 'STANDARD',
    grade: 'ALL',
    brand: 'Eptilu',
    gtin: '',
    isActive: true,
  })

  // Add new packaging form
  const [newPkgForm, setNewPkgForm] = useState<{
    productCode: string
    commodityCode: string
    commodityName: string
    productName: string
    targetKg: number
    mode: 'RETAIL_POUCH' | 'BULK_EXPORT'
    packageType: string
    variant: 'STANDARD' | 'WASHED' | 'DRY'
    grade: 'ALL' | 'A' | 'B' | 'C'
    brand: string
    gtin: string
    isActive: boolean
  }>({
    productCode: '006',
    commodityCode: '001',
    commodityName: 'Kentang',
    productName: '',
    targetKg: 10,
    mode: 'BULK_EXPORT',
    packageType: 'Carton Box',
    variant: 'STANDARD',
    grade: 'ALL',
    brand: 'Eptilu',
    gtin: computeGtin13FromCode('006'),
    isActive: true,
  })

  /* ─────────────────────────────────────────────────────────────
   * 2. Raw Commodities (Reception Intake) State (Family Groups Only)
   * ───────────────────────────────────────────────────────────── */
  const [rawItems, setRawItems] = useState<Commodity[]>([])
  const [rawLoading, setRawLoading] = useState(true)
  const [rawSaving, setRawSaving] = useState(false)
  const [editingRawId, setEditingRawId] = useState<string | null>(null)
  const [isAddingRaw, setIsAddingRaw] = useState(false)

  // Edit raw commodity form
  const [rawForm, setRawForm] = useState<{
    code: string
    name: string
    description: string
    unit: string
    isActive: boolean
  }>({
    code: '',
    name: '',
    description: '',
    unit: 'kg',
    isActive: true,
  })

  // Add new raw commodity form
  const [newRawForm, setNewRawForm] = useState<{
    code: string
    name: string
    description: string
    unit: string
    isActive: boolean
  }>({
    code: '',
    name: '',
    description: '',
    unit: 'kg',
    isActive: true,
  })

  const loadRaw = useCallback(async () => {
    setRawLoading(true)
    try {
      const data = await api.commodities.list(isAdmin)
      setRawItems(Array.isArray(data) ? data : [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load raw commodities.')
    } finally {
      setRawLoading(false)
    }
  }, [isAdmin, toast])

  useEffect(() => {
    void loadRaw()
  }, [loadRaw])

  /* Commodity options for Packaging creation and filtering */
  const rawCommodityOptions = useMemo(() => {
    if (rawItems.length > 0) {
      return rawItems.map((r) => ({
        code: r.code,
        name: getGeneralCommodityName(r),
        family: getCommodityFamilyCode(r.code),
      }))
    }
    return [
      { code: '001', name: 'Kentang', family: '0xx' },
      { code: '101', name: 'Tomat', family: '1xx' },
      { code: '201', name: 'Cabe Merah Keriting', family: '2xx' },
      { code: '202', name: 'Cabe Rawit Merah', family: '2xx' },
    ]
  }, [rawItems])

  /* ── Packaging Catalog Handlers ── */
  const getNextAvailableProductCode = useCallback((): string => {
    const existingNums = catalog
      .map((p) => parseInt(p.productCode || p.gtin.slice(9, 12), 10))
      .filter((n) => !isNaN(n))
    const maxNum = existingNums.length > 0 ? Math.max(...existingNums) : 0
    const nextNum = maxNum + 1
    return String(nextNum).padStart(3, '0')
  }, [catalog])

  const handleOpenAddPkg = () => {
    const nextCode = getNextAvailableProductCode()
    const defaultRaw = rawCommodityOptions[0] || { code: '001', name: 'Kentang' }
    setNewPkgForm({
      productCode: nextCode,
      commodityCode: defaultRaw.code,
      commodityName: defaultRaw.name,
      productName: '',
      targetKg: 10,
      mode: 'BULK_EXPORT',
      packageType: 'Carton Box',
      variant: 'STANDARD',
      grade: 'ALL',
      brand: 'Eptilu',
      gtin: computeGtin13FromCode(nextCode),
      isActive: true,
    })
    setIsAddingPkg(true)
    setEditingPkgId(null)
  }

  const handleNewPkgProductCodeChange = (newCode: string) => {
    const clean = newCode.replace(/\D/g, '').slice(0, 3)
    setNewPkgForm((f) => {
      const next = { ...f, productCode: clean }
      if (clean.length === 3) {
        next.gtin = computeGtin13FromCode(clean)
      }
      return next
    })
  }

  const handleRawOriginSelect = (code: string) => {
    const found = rawCommodityOptions.find((c) => c.code === code)
    if (found) {
      setNewPkgForm((f) => ({
        ...f,
        commodityCode: found.code,
        commodityName: found.name,
      }))
    }
  }

  const handleCreatePkg = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAdmin) return

    if (!newPkgForm.productName.trim()) {
      toast.error('Packaging product title is required.')
      return
    }
    const cleanCode = newPkgForm.productCode.trim().replace(/\D/g, '').padStart(3, '0').slice(-3)
    if (cleanCode.length !== 3) {
      toast.error('Product Code must be a 3-digit number (e.g. 006).')
      return
    }

    const gtin = newPkgForm.gtin.trim() || computeGtin13FromCode(cleanCode)
    const gtinCheck = validateGtin13Client(gtin)
    if (!gtinCheck.valid) {
      toast.error(gtinCheck.message || 'Invalid GS1 GTIN-13.')
      return
    }

    const newProduct: PackagingProduct = {
      id: `pkg-${Date.now()}`,
      productCode: cleanCode,
      commodityCode: newPkgForm.commodityCode,
      commodityName: newPkgForm.commodityName,
      mode: newPkgForm.mode,
      targetKg: Number(newPkgForm.targetKg) || 10,
      variant: newPkgForm.variant,
      grade: newPkgForm.grade,
      productName: newPkgForm.productName.trim(),
      packageType: newPkgForm.packageType.trim() || 'Carton Box',
      brand: newPkgForm.brand.trim() || 'Eptilu',
      gtin,
      isActive: newPkgForm.isActive,
    }

    const updated = [newProduct, ...catalog]
    setCatalog(updated)
    savePackagingCatalog(updated)
    setIsAddingPkg(false)
    toast.success(`Packaging specification "${newProduct.productName}" added successfully.`)
  }

  const handleEditPkg = (product: PackagingProduct) => {
    setEditingPkgId(product.id)
    setIsAddingPkg(false)
    setPkgForm({
      productCode: product.productCode || product.gtin.slice(9, 12) || '001',
      productName: product.productName,
      targetKg: product.targetKg,
      packageType: product.packageType,
      variant: product.variant || 'STANDARD',
      grade: product.grade || 'ALL',
      brand: product.brand,
      gtin: product.gtin,
      isActive: product.isActive,
    })
  }

  const handleProductCodeChange = (newCode: string) => {
    const clean = newCode.replace(/\D/g, '').slice(0, 3)
    setPkgForm((f) => {
      const next = { ...f, productCode: clean }
      if (clean.length === 3) {
        next.gtin = computeGtin13FromCode(clean)
      }
      return next
    })
  }

  const handleSavePkg = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPkgId) return

    if (!pkgForm.productName.trim()) {
      toast.error('Product title is required.')
      return
    }

    if (pkgForm.gtin.trim()) {
      const gtinCheck = validateGtin13Client(pkgForm.gtin)
      if (!gtinCheck.valid) {
        toast.error(gtinCheck.message || 'Invalid GTIN-13.')
        return
      }
    }

    const updated = catalog.map((p) => {
      if (p.id === editingPkgId) {
        return {
          ...p,
          productCode: pkgForm.productCode.trim() || p.productCode,
          productName: pkgForm.productName.trim(),
          targetKg: Number(pkgForm.targetKg) || p.targetKg,
          packageType: pkgForm.packageType.trim() || p.packageType,
          variant: pkgForm.variant,
          grade: pkgForm.grade,
          brand: pkgForm.brand.trim() || p.brand,
          gtin: pkgForm.gtin.trim() || p.gtin,
          isActive: pkgForm.isActive,
        }
      }
      return p
    })

    setCatalog(updated)
    savePackagingCatalog(updated)
    setEditingPkgId(null)
    toast.success(`Packaging specification updated. Station 01 Reception is unaffected.`)
  }

  const handleDeletePkg = (product: PackagingProduct) => {
    if (!isAdmin) return
    const confirmed = window.confirm(
      `Delete packaging specification "${product.productName}" (Code: ${product.productCode || product.gtin.slice(9, 12)})?\n\nThis specification will no longer be available for selection at Station 03 Packaging.`
    )
    if (!confirmed) return

    const updated = catalog.filter((p) => p.id !== product.id)
    setCatalog(updated)
    savePackagingCatalog(updated)
    if (editingPkgId === product.id) {
      setEditingPkgId(null)
    }
    toast.success(`Packaging specification deleted.`)
  }

  const handleTogglePkgActive = (product: PackagingProduct) => {
    if (!isAdmin) return
    const updated = catalog.map((p) => (p.id === product.id ? { ...p, isActive: !p.isActive } : p))
    setCatalog(updated)
    savePackagingCatalog(updated)
    toast.success(`Packaging spec "${product.productName}" ${product.isActive ? 'disabled' : 'enabled'}.`)
  }

  const handleResetCatalog = () => {
    if (!window.confirm('Reset packaging catalog to standard factory defaults?')) return
    setCatalog(DEFAULT_PACKAGING_PRODUCTS)
    savePackagingCatalog(DEFAULT_PACKAGING_PRODUCTS)
    setEditingPkgId(null)
    setIsAddingPkg(false)
    toast.success('Packaging catalog reset to factory defaults.')
  }

  /* ── Raw Commodities Handlers ── */
  const handleOpenAddRaw = () => {
    const nextCode = String(300 + (rawItems.length + 1))
    setNewRawForm({
      code: nextCode,
      name: '',
      description: '',
      unit: 'kg',
      isActive: true,
    })
    setIsAddingRaw(true)
    setEditingRawId(null)
  }

  const handleCreateRaw = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAdmin) return

    const code = newRawForm.code.trim()
    const name = newRawForm.name.trim()
    if (!code || !name) {
      toast.error('Commodity code and crop name are required.')
      return
    }

    setRawSaving(true)
    try {
      await api.commodities.create({
        code,
        name,
        description: newRawForm.description.trim(),
        unit: newRawForm.unit.trim() || 'kg',
        isActive: true,
      })
      toast.success(`Raw harvest commodity "${name}" (${getCommodityFamilyCode(code)}) created.`)
      setIsAddingRaw(false)
      await loadRaw()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create raw commodity.')
    } finally {
      setRawSaving(false)
    }
  }

  const handleEditRaw = (row: Commodity) => {
    setEditingRawId(row.id)
    setIsAddingRaw(false)
    setRawForm({
      code: row.code,
      name: getGeneralCommodityName(row),
      description: row.description || '',
      unit: row.unit || 'kg',
      isActive: row.isActive,
    })
  }

  const handleSaveRaw = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingRawId || !isAdmin) return

    setRawSaving(true)
    try {
      await api.commodities.update(editingRawId, {
        code: rawForm.code.trim(),
        name: rawForm.name.trim(),
        description: rawForm.description.trim(),
        unit: rawForm.unit.trim() || 'kg',
        isActive: rawForm.isActive,
      })
      toast.success(`Raw commodity updated.`)
      setEditingRawId(null)
      await loadRaw()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save commodity.')
    } finally {
      setRawSaving(false)
    }
  }

  const handleToggleRawActive = async (row: Commodity) => {
    if (!isAdmin) return
    try {
      await api.commodities.update(row.id, { isActive: !row.isActive })
      toast.success(`${getCommodityFamilyCode(row.code)} ${row.isActive ? 'deactivated' : 'activated'}.`)
      await loadRaw()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status.')
    }
  }

  const handleDeleteRaw = async (row: Commodity) => {
    if (!isAdmin) return
    const confirmed = window.confirm(
      `Delete raw commodity "${getGeneralCommodityName(row)}" (${getCommodityFamilyCode(row.code)})?\n\nIf this commodity has historical intake weighings, it will be safely deactivated instead of permanently deleted.`
    )
    if (!confirmed) return

    setRawSaving(true)
    try {
      const res = await api.commodities.delete(row.id)
      if (res?.deactivated) {
        toast.info(res.message || 'Commodity has historical intake records; deactivated instead.')
      } else {
        toast.success(`Raw commodity deleted.`)
      }
      if (editingRawId === row.id) {
        setEditingRawId(null)
      }
      await loadRaw()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete commodity.')
    } finally {
      setRawSaving(false)
    }
  }

  /* ── Filtered Packaging Products ── */
  const filteredCatalog = useMemo(() => {
    return catalog.filter((item) => {
      if (pkgFilterCommodity !== 'ALL' && item.commodityCode !== pkgFilterCommodity) {
        return false
      }
      if (pkgSearch.trim()) {
        const q = pkgSearch.toLowerCase()
        const matchTitle = item.productName.toLowerCase().includes(q)
        const matchCode = (item.productCode || '').includes(q)
        const matchGtin = item.gtin.includes(q)
        const matchBrand = item.brand.toLowerCase().includes(q)
        const matchType = item.packageType.toLowerCase().includes(q)
        return matchTitle || matchCode || matchGtin || matchBrand || matchType
      }
      return true
    })
  }, [catalog, pkgFilterCommodity, pkgSearch])

  /* Dynamic filter chips from catalog */
  const commodityFilterChips = useMemo(() => {
    const list = [{ id: 'ALL', label: 'All Commodities' }]
    const seen = new Set<string>()
    catalog.forEach((item) => {
      if (!seen.has(item.commodityCode)) {
        seen.add(item.commodityCode)
        const fam = getCommodityFamilyCode(item.commodityCode)
        list.push({
          id: item.commodityCode,
          label: `${item.commodityName} (${fam})`,
        })
      }
    })
    return list
  }, [catalog])

  /* ── Packaging Columns (Includes Product Code) ── */
  const packagingColumns: Column<PackagingProduct>[] = [
    {
      key: 'productCode',
      label: 'Code',
      priority: true,
      render: (row) => (
        <span className="font-mono font-bold text-foreground bg-muted px-2 py-0.5 rounded">
          {row.productCode || row.gtin.slice(9, 12) || '—'}
        </span>
      ),
    },
    {
      key: 'targetKg',
      label: 'Target',
      priority: true,
      render: (row) => (
        <span className="font-mono font-bold text-foreground">
          {row.targetKg} kg
        </span>
      ),
    },
    {
      key: 'commodityName',
      label: 'Raw Origin',
      render: (row) => (
        <div>
          <span className="font-semibold text-foreground">{row.commodityName}</span>
          <span className="ml-1 text-xs text-muted-foreground font-mono">({getCommodityFamilyCode(row.commodityCode)})</span>
        </div>
      ),
    },
    {
      key: 'productName',
      label: 'Packaging & Export Title',
      priority: true,
      render: (row) => (
        <div>
          <div className="font-semibold text-sm text-foreground">{row.productName}</div>
          <div className="text-[11px] text-muted-foreground font-mono">
            {row.brand} · {row.packageType}
            {row.variant && row.variant !== 'STANDARD' ? ` · ${row.variant}` : ''}
            {row.grade && row.grade !== 'ALL' ? ` · Grade ${row.grade}` : ''}
          </div>
        </div>
      ),
    },
    {
      key: 'gtin',
      label: 'GS1 GTIN-13',
      priority: true,
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-foreground bg-muted px-1.5 py-0.5 rounded">
          {row.gtin}
        </span>
      ),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (row) => (
        <Badge tone={row.isActive ? 'success' : 'neutral'} dot>
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    ...(isAdmin
      ? [
          {
            key: 'actions',
            label: 'Actions',
            render: (row: PackagingProduct) => (
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => handleEditPkg(row)}>
                  Edit Spec
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleTogglePkgActive(row)}>
                  {row.isActive ? 'Disable' : 'Enable'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDeletePkg(row)}
                >
                  Delete
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ]

  /* ── Raw Commodities Columns (Family & Name Only, NO specific product code) ── */
  const rawColumns: Column<Commodity>[] = [
    {
      key: 'family',
      label: 'Family Group',
      priority: true,
      render: (row) => (
        <span className="font-mono font-bold text-primary px-2.5 py-1 bg-primary/10 rounded text-xs">
          {getCommodityFamilyCode(row.code)}
        </span>
      ),
    },
    {
      key: 'name',
      label: 'Raw Intake Commodity',
      priority: true,
      render: (row) => (
        <div>
          <div className="font-semibold text-sm text-foreground">{getGeneralCommodityName(row)}</div>
          <div className="text-[11px] text-muted-foreground">
            {row.description || 'Harvest intake from farmer'}
          </div>
        </div>
      ),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (row) => (
        <Badge tone={row.isActive ? 'success' : 'neutral'} dot>
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    ...(isAdmin
      ? [
          {
            key: 'actions',
            label: 'Actions',
            render: (row: Commodity) => (
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => handleEditRaw(row)}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void handleToggleRawActive(row)}>
                  {row.isActive ? 'Disable' : 'Enable'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => void handleDeleteRaw(row)}
                >
                  Delete
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ]

  const editGtinValidation = pkgForm.gtin.trim() ? validateGtin13Client(pkgForm.gtin) : { valid: true }
  const newGtinValidation = newPkgForm.gtin.trim() ? validateGtin13Client(newPkgForm.gtin) : { valid: false, message: 'GTIN-13 required' }

  return (
    <div className="space-y-6">
      {/* ── Sub Navigation Tabs ── */}
      <div className="flex items-center justify-between border-b border-border pb-3 flex-wrap gap-3">
        <div className="inline-flex border border-border bg-muted/40 p-1 rounded-none">
          <button
            type="button"
            onClick={() => {
              setActiveTab('packaging')
              setEditingRawId(null)
              setIsAddingRaw(false)
            }}
            className={`px-4 py-2 text-sm font-semibold transition-colors flex items-center gap-2 ${
              activeTab === 'packaging'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon name="package" size={16} />
            Packaging & GS1 Catalog (Product Codes)
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('raw')
              setEditingPkgId(null)
              setIsAddingPkg(false)
            }}
            className={`px-4 py-2 text-sm font-semibold transition-colors flex items-center gap-2 ${
              activeTab === 'raw'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon name="leaf" size={16} />
            Raw Intake Commodities (Family Groups)
          </button>
        </div>

        {activeTab === 'packaging' && isAdmin && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="primary" icon="plus" onClick={handleOpenAddPkg}>
              Add Packaging Spec
            </Button>
            <Button size="sm" variant="ghost" icon="refresh" onClick={handleResetCatalog}>
              Reset Defaults
            </Button>
          </div>
        )}

        {activeTab === 'raw' && isAdmin && (
          <Button size="sm" variant="primary" icon="plus" onClick={handleOpenAddRaw}>
            Add Raw Commodity
          </Button>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
       * SUB-TAB 1: PACKAGING & GS1 CATALOG (Station 03 Packaging)
       * Product codes (001, 002, 003, etc.) and GTINs live here!
       * ───────────────────────────────────────────────────────────── */}
      {activeTab === 'packaging' && (
        <div className="space-y-6">
          {/* Isolation Guarantee Banner */}
          <div className="p-4 bg-primary/5 border border-primary/20 flex items-start gap-3">
            <div className="p-2 bg-primary/10 text-primary mt-0.5">
              <Icon name="info" size={18} />
            </div>
            <div className="text-sm space-y-1">
              <div className="font-semibold text-foreground">Packaging & GS1 Trade Item Codes</div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Specific 3-digit product codes (e.g. <strong>001</strong> for Kentang 10kg Washed, <strong>005</strong> for Kentang 5kg, <strong>003</strong> for Retail 1kg)
                and GTIN-13 barcodes belong exclusively to packaging products.
                Adding or modifying packaging specifications here will <strong>NEVER alter Station 01 Reception</strong>.
              </p>
            </div>
          </div>

          {/* Add Form */}
          {isAddingPkg && (
            <Card
              title="Add New Packaging Specification"
              subtitle="Register a new packaging SKU with 3-digit product code and GS1 GTIN-13 for Station 03 Packaging."
            >
              <form onSubmit={handleCreatePkg} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Field label="Raw Commodity Origin" required hint="Crop origin for this package">
                      <Select
                        value={newPkgForm.commodityCode}
                        onChange={(e) => handleRawOriginSelect(e.target.value)}
                      >
                        {rawCommodityOptions.map((opt) => (
                          <option key={opt.code} value={opt.code}>
                            {opt.name} ({opt.family})
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                  <div>
                    <Field
                      label="Product Code (3 digits)"
                      required
                      hint="Digits 10-12 of GTIN (e.g. 006)"
                    >
                      <Input
                        value={newPkgForm.productCode}
                        onChange={(e) => handleNewPkgProductCodeChange(e.target.value)}
                        placeholder="006"
                        className="font-mono font-bold"
                        maxLength={3}
                      />
                    </Field>
                  </div>
                  <div className="md:col-span-2">
                    <Field label="Packaging Product Title" required hint="e.g. Eptilu Fresh Potatoes 5 kg">
                      <Input
                        value={newPkgForm.productName}
                        onChange={(e) => setNewPkgForm((f) => ({ ...f, productName: e.target.value }))}
                        placeholder="e.g. Eptilu Fresh Potatoes 5 kg"
                      />
                    </Field>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Field label="Target Weight (kg)" required>
                      <Input
                        type="number"
                        step="0.1"
                        value={newPkgForm.targetKg}
                        onChange={(e) => setNewPkgForm((f) => ({ ...f, targetKg: parseFloat(e.target.value) || 0 }))}
                        className="font-mono"
                      />
                    </Field>
                  </div>
                  <div>
                    <Field label="Packaging Mode" required>
                      <Select
                        value={newPkgForm.mode}
                        onChange={(e) =>
                          setNewPkgForm((f) => ({
                            ...f,
                            mode: e.target.value as 'RETAIL_POUCH' | 'BULK_EXPORT',
                            packageType: e.target.value === 'RETAIL_POUCH' ? 'Retail Pouch' : 'Carton Box',
                          }))
                        }
                      >
                        <option value="BULK_EXPORT">Bulk Export (Box/Crate)</option>
                        <option value="RETAIL_POUCH">Retail Pouch (Consumer)</option>
                      </Select>
                    </Field>
                  </div>
                  <div>
                    <Field label="Package Format" required>
                      <Input
                        value={newPkgForm.packageType}
                        onChange={(e) => setNewPkgForm((f) => ({ ...f, packageType: e.target.value }))}
                        placeholder="Carton Box / Retail Pouch / Mesh Bag"
                      />
                    </Field>
                  </div>
                  <div>
                    <Field label="Condition Variant">
                      <Select
                        value={newPkgForm.variant}
                        onChange={(e) =>
                          setNewPkgForm((f) => ({
                            ...f,
                            variant: e.target.value as 'STANDARD' | 'WASHED' | 'DRY',
                          }))
                        }
                      >
                        <option value="STANDARD">Standard</option>
                        <option value="WASHED">Washed (Cleaned)</option>
                        <option value="DRY">Dry (Unwashed)</option>
                      </Select>
                    </Field>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Field label="Grade Scope">
                      <Select
                        value={newPkgForm.grade}
                        onChange={(e) =>
                          setNewPkgForm((f) => ({
                            ...f,
                            grade: e.target.value as 'ALL' | 'A' | 'B' | 'C',
                          }))
                        }
                      >
                        <option value="ALL">All Grades (A/B/C)</option>
                        <option value="A">Grade A Only</option>
                        <option value="B">Grade B Only</option>
                        <option value="C">Grade C Only</option>
                      </Select>
                    </Field>
                  </div>
                  <div>
                    <Field label="Brand">
                      <Input
                        value={newPkgForm.brand}
                        onChange={(e) => setNewPkgForm((f) => ({ ...f, brand: e.target.value }))}
                        placeholder="Eptilu"
                      />
                    </Field>
                  </div>
                  <div className="md:col-span-2">
                    <Field label="GS1 GTIN-13 Barcode" required hint="Auto-computed from Product Code using GS1 Modulo-10">
                      <Input
                        value={newPkgForm.gtin}
                        onChange={(e) =>
                          setNewPkgForm((f) => ({
                            ...f,
                            gtin: e.target.value.replace(/\D/g, '').slice(0, 13),
                          }))
                        }
                        placeholder="8994477090065"
                        className="font-mono font-semibold"
                        maxLength={13}
                      />
                      {newPkgForm.gtin.trim().length > 0 && (
                        <p className={`text-xs mt-1 ${newGtinValidation.valid ? 'text-emerald-600 font-medium' : 'text-destructive'}`}>
                          {newGtinValidation.valid ? '✓ Valid GS1 Modulo-10 GTIN-13' : newGtinValidation.message}
                        </p>
                      )}
                    </Field>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <Button type="button" variant="outline" onClick={() => setIsAddingPkg(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" disabled={!newGtinValidation.valid}>
                    Create Packaging Spec
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* Edit Form */}
          {editingPkgId && (
            <Card
              title="Edit Packaging Specification"
              subtitle="Configure product title, 3-digit item code, and GS1 GTIN-13 for Station 03 Packaging."
            >
              <form onSubmit={handleSavePkg} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Field
                      label="Product Code"
                      required
                      hint="3-digit item code (digits 10-12 of GTIN)"
                    >
                      <Input
                        value={pkgForm.productCode}
                        onChange={(e) => handleProductCodeChange(e.target.value)}
                        placeholder="e.g. 001"
                        className="font-mono font-bold"
                        maxLength={3}
                      />
                    </Field>
                  </div>
                  <div className="md:col-span-2">
                    <Field label="Packaging Product Title" required hint="e.g. Eptilu Washed Potatoes 10 kg">
                      <Input
                        value={pkgForm.productName}
                        onChange={(e) => setPkgForm((f) => ({ ...f, productName: e.target.value }))}
                        placeholder="e.g. Eptilu Washed Potatoes 10 kg"
                      />
                    </Field>
                  </div>
                  <div>
                    <Field label="Target Weight (kg)" required>
                      <Input
                        type="number"
                        step="0.1"
                        value={pkgForm.targetKg}
                        onChange={(e) => setPkgForm((f) => ({ ...f, targetKg: parseFloat(e.target.value) || 0 }))}
                        className="font-mono"
                      />
                    </Field>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div>
                    <Field label="Package Format">
                      <Input
                        value={pkgForm.packageType}
                        onChange={(e) => setPkgForm((f) => ({ ...f, packageType: e.target.value }))}
                        placeholder="Carton Box / Retail Pouch"
                      />
                    </Field>
                  </div>
                  <div>
                    <Field label="Condition Variant">
                      <Select
                        value={pkgForm.variant}
                        onChange={(e) =>
                          setPkgForm((f) => ({
                            ...f,
                            variant: e.target.value as 'STANDARD' | 'WASHED' | 'DRY',
                          }))
                        }
                      >
                        <option value="STANDARD">Standard</option>
                        <option value="WASHED">Washed (Cleaned)</option>
                        <option value="DRY">Dry (Unwashed)</option>
                      </Select>
                    </Field>
                  </div>
                  <div>
                    <Field label="Grade Scope">
                      <Select
                        value={pkgForm.grade}
                        onChange={(e) =>
                          setPkgForm((f) => ({
                            ...f,
                            grade: e.target.value as 'ALL' | 'A' | 'B' | 'C',
                          }))
                        }
                      >
                        <option value="ALL">All Grades (A/B/C)</option>
                        <option value="A">Grade A Only</option>
                        <option value="B">Grade B Only</option>
                        <option value="C">Grade C Only</option>
                      </Select>
                    </Field>
                  </div>
                  <div>
                    <Field label="Brand">
                      <Input
                        value={pkgForm.brand}
                        onChange={(e) => setPkgForm((f) => ({ ...f, brand: e.target.value }))}
                        placeholder="Eptilu"
                      />
                    </Field>
                  </div>
                  <div>
                    <Field label="GS1 GTIN-13 (13 digits)" required>
                      <Input
                        value={pkgForm.gtin}
                        onChange={(e) =>
                          setPkgForm((f) => ({
                            ...f,
                            gtin: e.target.value.replace(/\D/g, '').slice(0, 13),
                          }))
                        }
                        placeholder="8994477090010"
                        className="font-mono"
                      />
                      {pkgForm.gtin.trim().length > 0 && (
                        <p className={`text-xs mt-1 ${editGtinValidation.valid ? 'text-emerald-600 font-medium' : 'text-destructive'}`}>
                          {editGtinValidation.valid ? '✓ Valid GS1 Modulo-10 GTIN-13' : editGtinValidation.message}
                        </p>
                      )}
                    </Field>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <Button type="button" variant="outline" onClick={() => setEditingPkgId(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" disabled={!editGtinValidation.valid}>
                    Save Packaging Spec
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* Catalog Table */}
          <Card
            title="Packaging & GS1 Trade Item Catalog"
            subtitle="Available packaging formats, 3-digit product codes, and GTIN-13 barcodes assigned at Station 03."
          >
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
              {/* Dynamic Commodity Filter Chips */}
              <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
                {commodityFilterChips.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setPkgFilterCommodity(chip.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-none border transition-colors ${
                      pkgFilterCommodity === chip.id
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border text-muted-foreground hover:bg-card hover:text-foreground'
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="w-full sm:w-64">
                <Input
                  value={pkgSearch}
                  onChange={(e) => setPkgSearch(e.target.value)}
                  placeholder="Filter code, title, or GTIN..."
                  className="text-xs py-1.5"
                />
              </div>
            </div>

            <DataTable
              data={filteredCatalog}
              columns={packagingColumns}
              rowKey={(row) => row.id}
              emptyTitle="No packaging specifications found."
            />
          </Card>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
       * SUB-TAB 2: RAW INTAKE COMMODITIES (Station 01 Reception)
       * Only family codes (0xx, 1xx, 2xx) and crop names live here!
       * ───────────────────────────────────────────────────────────── */}
      {activeTab === 'raw' && (
        <div className="space-y-6">
          {/* Reception Guarantee Banner */}
          <div className="p-4 bg-muted/60 border border-border flex items-start gap-3">
            <div className="p-2 bg-muted text-foreground mt-0.5">
              <Icon name="leaf" size={18} />
            </div>
            <div className="text-sm space-y-1">
              <div className="font-semibold text-foreground">Station 01 Reception Raw Intake Master</div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Raw commodities represent incoming agricultural harvest delivered by farmers.
                Intake at Station 01 uses strictly <strong>Family Classification (0xx, 1xx, 2xx)</strong> and general crop names (<strong>Kentang</strong>, <strong>Tomat</strong>, <strong>Cabe Merah Keriting</strong>, <strong>Cabe Rawit Merah</strong>).
                Reception tickets and farmer receipts <strong>do NOT carry product SKU codes (001, 005) or packaging weights</strong>.
              </p>
            </div>
          </div>

          {/* Add Raw Commodity Modal / Card */}
          {isAddingRaw && (
            <Card
              title="Add New Raw Harvest Commodity"
              subtitle="Register a new harvest crop accepted from farmers at Station 01 Reception."
            >
              <form onSubmit={handleCreateRaw} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Field
                      label="Commodity Code / Identifier"
                      required
                      hint="Unique 3-digit code. First digit determines Family Group (0xx, 1xx, 2xx, 3xx...)"
                    >
                      <div className="flex items-center gap-2">
                        <Input
                          value={newRawForm.code}
                          onChange={(e) =>
                            setNewRawForm((f) => ({
                              ...f,
                              code: e.target.value.replace(/\D/g, '').slice(0, 3),
                            }))
                          }
                          placeholder="e.g. 301"
                          className="font-mono font-bold"
                          maxLength={3}
                        />
                        {newRawForm.code && (
                          <span className="font-mono font-bold text-primary px-2.5 py-2 bg-primary/10 rounded text-xs shrink-0">
                            {getCommodityFamilyCode(newRawForm.code)}
                          </span>
                        )}
                      </div>
                    </Field>
                  </div>
                  <div className="md:col-span-2">
                    <Field
                      label="Raw Commodity Name"
                      required
                      hint="General crop name (e.g. 'Wortel', 'Bawang Merah', 'Kubis')."
                    >
                      <Input
                        value={newRawForm.name}
                        onChange={(e) => setNewRawForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="e.g. Wortel"
                      />
                    </Field>
                  </div>
                </div>

                <div>
                  <Field label="Harvest Description">
                    <Input
                      value={newRawForm.description}
                      onChange={(e) => setNewRawForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="e.g. Fresh highland harvest crops delivered from local farmers"
                    />
                  </Field>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <Button type="button" variant="outline" onClick={() => setIsAddingRaw(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" loading={rawSaving}>
                    Create Raw Commodity
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* Edit Raw Commodity Modal / Card */}
          {editingRawId && (
            <Card
              title="Edit Raw Harvest Commodity"
              subtitle="Modify general raw harvest commodity information for Station 01 Reception."
            >
              <form onSubmit={handleSaveRaw} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Field label="Family Classification">
                    <div className="flex items-center gap-2 py-2">
                      <span className="font-mono font-bold text-primary px-3 py-1 bg-primary/10 rounded text-sm">
                        {getCommodityFamilyCode(rawForm.code)}
                      </span>
                      <span className="text-xs text-muted-foreground">General intake crop family</span>
                    </div>
                  </Field>
                  <div className="md:col-span-2">
                    <Field
                      label="Raw Commodity Name"
                      required
                      hint="General intake crop name (e.g. 'Kentang')."
                    >
                      <Input
                        value={rawForm.name}
                        onChange={(e) => setRawForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="e.g. Kentang"
                      />
                    </Field>
                  </div>
                </div>

                <div>
                  <Field label="Harvest Description">
                    <Input
                      value={rawForm.description}
                      onChange={(e) => setRawForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="e.g. Freshly harvested raw crop from highland farmers"
                    />
                  </Field>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <Button type="button" variant="outline" onClick={() => setEditingRawId(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" loading={rawSaving}>
                    Save Raw Commodity
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* Raw Catalog Table */}
          <Card
            title="General Raw Commodities"
            subtitle="Crops accepted at Station 01 Reception categorized strictly by Family Groups (0xx, 1xx, 2xx)."
          >
            <DataTable
              data={rawItems}
              columns={rawColumns}
              rowKey={(row) => row.id}
              emptyTitle={rawLoading ? 'Loading raw commodities...' : 'No raw commodities found.'}
            />
          </Card>
        </div>
      )}
    </div>
  )
}
