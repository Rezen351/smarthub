import { useCallback, useEffect, useMemo, useState } from 'react'
import Badge from '../shared/Badge'
import Button from '../shared/Button'
import Card from '../shared/Card'
import DataTable, { type Column } from '../shared/DataTable'
import { Field, Input } from '../shared/Form'
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

export default function CommoditiesSection() {
  const toast = useToast()
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const [activeTab, setActiveTab] = useState<'packaging' | 'raw'>('packaging')

  /* ─────────────────────────────────────────────────────────────
   * 1. Packaging & GS1 Catalog State
   * ───────────────────────────────────────────────────────────── */
  const [catalog, setCatalog] = useState<PackagingProduct[]>(() => getSavedPackagingCatalog())
  const [editingPkgId, setEditingPkgId] = useState<string | null>(null)
  const [pkgFilterCommodity, setPkgFilterCommodity] = useState<string>('ALL')
  const [pkgSearch, setPkgSearch] = useState<string>('')
  const [pkgForm, setPkgForm] = useState<{
    productName: string
    targetKg: number
    packageType: string
    brand: string
    gtin: string
    isActive: boolean
  }>({
    productName: '',
    targetKg: 10,
    packageType: 'Carton Box',
    brand: 'Eptilu',
    gtin: '',
    isActive: true,
  })

  /* ─────────────────────────────────────────────────────────────
   * 2. Raw Commodities (Reception Intake) State
   * ───────────────────────────────────────────────────────────── */
  const [rawItems, setRawItems] = useState<Commodity[]>([])
  const [rawLoading, setRawLoading] = useState(true)
  const [rawSaving, setRawSaving] = useState(false)
  const [editingRawId, setEditingRawId] = useState<string | null>(null)
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

  /* ── Packaging Catalog Handlers ── */
  const handleEditPkg = (product: PackagingProduct) => {
    setEditingPkgId(product.id)
    setPkgForm({
      productName: product.productName,
      targetKg: product.targetKg,
      packageType: product.packageType,
      brand: product.brand,
      gtin: product.gtin,
      isActive: product.isActive,
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
          productName: pkgForm.productName.trim(),
          targetKg: Number(pkgForm.targetKg) || p.targetKg,
          packageType: pkgForm.packageType.trim() || p.packageType,
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

  const handleResetCatalog = () => {
    if (!window.confirm('Reset packaging catalog to standard factory defaults?')) return
    setCatalog(DEFAULT_PACKAGING_PRODUCTS)
    savePackagingCatalog(DEFAULT_PACKAGING_PRODUCTS)
    setEditingPkgId(null)
    toast.success('Packaging catalog reset to factory defaults.')
  }

  /* ── Raw Commodities Handlers ── */
  const handleEditRaw = (row: Commodity) => {
    setEditingRawId(row.id)
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
        name: getGeneralCommodityName({ code: rawForm.code, name: rawForm.name }),
        description: rawForm.description.trim(),
        unit: rawForm.unit.trim() || 'kg',
        isActive: rawForm.isActive,
      })
      toast.success(`Raw commodity ${rawForm.code} updated.`)
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
      toast.success(`${row.code} ${row.isActive ? 'deactivated' : 'activated'}.`)
      await loadRaw()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status.')
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
        const matchGtin = item.gtin.includes(q)
        const matchBrand = item.brand.toLowerCase().includes(q)
        const matchType = item.packageType.toLowerCase().includes(q)
        return matchTitle || matchGtin || matchBrand || matchType
      }
      return true
    })
  }, [catalog, pkgFilterCommodity, pkgSearch])

  /* ── Packaging Columns ── */
  const packagingColumns: Column<PackagingProduct>[] = [
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
            {row.brand} · {row.packageType} {row.variant && row.variant !== 'STANDARD' ? `· ${row.variant}` : ''}
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
              <Button size="sm" variant="outline" onClick={() => handleEditPkg(row)}>
                Edit Spec
              </Button>
            ),
          },
        ]
      : []),
  ]

  /* ── Raw Commodities Columns ── */
  const rawColumns: Column<Commodity>[] = [
    {
      key: 'family',
      label: 'Family',
      priority: true,
      render: (row) => (
        <span className="font-mono font-bold text-primary px-2 py-0.5 bg-primary/10 rounded">
          {getCommodityFamilyCode(row.code)}
        </span>
      ),
    },
    {
      key: 'code',
      label: 'Code',
      priority: true,
      render: (row) => <span className="font-mono font-bold text-foreground">{row.code}</span>,
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
      key: 'unit',
      label: 'Unit',
      render: (row) => <span className="font-mono text-xs">{row.unit || 'kg'}</span>,
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
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => handleEditRaw(row)}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void handleToggleRawActive(row)}>
                  {row.isActive ? 'Disable' : 'Enable'}
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ]

  const gtinValidation = pkgForm.gtin.trim() ? validateGtin13Client(pkgForm.gtin) : { valid: true }

  return (
    <div className="space-y-6">
      {/* ── Sub Navigation Tabs ── */}
      <div className="flex items-center justify-between border-b border-border pb-3 flex-wrap gap-3">
        <div className="inline-flex border border-border bg-muted/40 p-1 rounded-none">
          <button
            type="button"
            onClick={() => setActiveTab('packaging')}
            className={`px-4 py-2 text-sm font-semibold transition-colors flex items-center gap-2 ${
              activeTab === 'packaging'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon name="package" size={16} />
            Packaging & GS1 Catalog
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('raw')}
            className={`px-4 py-2 text-sm font-semibold transition-colors flex items-center gap-2 ${
              activeTab === 'raw'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon name="leaf" size={16} />
            Raw Intake Commodities (Reception)
          </button>
        </div>

        {activeTab === 'packaging' && isAdmin && (
          <Button size="sm" variant="ghost" icon="refresh" onClick={handleResetCatalog}>
            Reset Catalog to Defaults
          </Button>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
       * SUB-TAB 1: PACKAGING & GS1 CATALOG (Station 03 Packaging)
       * ───────────────────────────────────────────────────────────── */}
      {activeTab === 'packaging' && (
        <div className="space-y-6">
          {/* Isolation Guarantee Banner */}
          <div className="p-4 bg-primary/5 border border-primary/20 flex items-start gap-3">
            <div className="p-2 bg-primary/10 text-primary mt-0.5">
              <Icon name="info" size={18} />
            </div>
            <div className="text-sm space-y-1">
              <div className="font-semibold text-foreground">Station 03 Packaging & GS1 Specifications</div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Specifications configured here (e.g. <strong>Kentang 10 kg</strong>, <strong>Kentang 5 kg</strong>, <strong>Retail 1 kg</strong>)
                apply exclusively to Station 03 Packaging, GS1-128 barcodes, and export labels.
                Modifying these packaging products will <strong>NEVER alter Station 01 Reception</strong>.
              </p>
            </div>
          </div>

          {/* Edit Form */}
          {editingPkgId && (
            <Card
              title="Edit Packaging Specification"
              subtitle="Updates the product title, target weight, and GS1 GTIN-13 for Station 03 Packaging."
            >
              <form onSubmit={handleSavePkg} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                        <p className={`text-xs mt-1 ${gtinValidation.valid ? 'text-emerald-600 font-medium' : 'text-destructive'}`}>
                          {gtinValidation.valid ? 'Valid GS1 Modulo-10 GTIN-13' : gtinValidation.message}
                        </p>
                      )}
                    </Field>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <Button type="button" variant="outline" onClick={() => setEditingPkgId(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" disabled={!gtinValidation.valid}>
                    Save Packaging Spec
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* Catalog Table */}
          <Card
            title="Packaging & GS1 Trade Item Catalog"
            subtitle="Available packaging formats and GTIN-13 barcodes assigned at Station 03."
          >
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
              {/* Commodity Filter Chips */}
              <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
                {[
                  { id: 'ALL', label: 'All Commodities' },
                  { id: '001', label: 'Kentang' },
                  { id: '101', label: 'Tomat' },
                  { id: '201', label: 'Cabe Keriting' },
                  { id: '202', label: 'Cabe Rawit' },
                ].map((chip) => (
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
                  placeholder="Filter product title or GTIN..."
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
                Intake at Station 01 is strictly general (<strong>Kentang</strong>, <strong>Tomat</strong>, <strong>Cabe Merah Keriting</strong>, <strong>Cabe Rawit Merah</strong>).
                Reception tickets and farmer receipts <strong>do NOT carry packaging sizes or GTIN barcodes</strong>.
              </p>
            </div>
          </div>

          {/* Edit Raw Commodity Modal / Card */}
          {editingRawId && (
            <Card
              title={`Edit Raw Commodity (${rawForm.code})`}
              subtitle="Modify general raw harvest commodity information for Station 01 Reception."
            >
              <form onSubmit={handleSaveRaw} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Field label="Commodity Code" required>
                    <Input value={rawForm.code} disabled className="font-mono bg-muted/40 cursor-not-allowed" />
                  </Field>
                  <div className="md:col-span-2">
                    <Field
                      label="Raw Commodity Name"
                      required
                      hint="Strictly general intake name (e.g. 'Kentang'). Do NOT enter packaging sizes like '10kg'."
                    >
                      <Input
                        value={rawForm.name}
                        onChange={(e) => setRawForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="e.g. Kentang"
                      />
                    </Field>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Field label="Measurement Unit">
                    <Input
                      value={rawForm.unit}
                      onChange={(e) => setRawForm((f) => ({ ...f, unit: e.target.value }))}
                      placeholder="kg"
                    />
                  </Field>
                  <div className="md:col-span-2">
                    <Field label="Harvest Description">
                      <Input
                        value={rawForm.description}
                        onChange={(e) => setRawForm((f) => ({ ...f, description: e.target.value }))}
                        placeholder="e.g. Freshly harvested raw crop from highland farmers"
                      />
                    </Field>
                  </div>
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
            subtitle="Crops accepted at Station 01 Reception. Family codes (0xx, 1xx, 2xx) are automatically assigned."
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
