import { useCallback, useEffect, useState } from 'react'
import Badge from '../shared/Badge'
import Button from '../shared/Button'
import Card from '../shared/Card'
import DataTable, { type Column } from '../shared/DataTable'
import { Field, Input } from '../shared/Form'
import { useToast } from '../feedback/Toast'
import { useAuth } from '../../hooks/useAuth'
import { api, type Commodity } from '../../services/api'

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

const emptyForm = {
  code: '',
  name: '',
  gtin: '899447709',
  brand: 'Eptilu',
  packageType: 'Carton Box',
  unit: 'kg',
  description: '',
  isActive: true,
}

export default function CommoditiesSection() {
  const toast = useToast()
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const [items, setItems] = useState<Commodity[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.commodities.list(isAdmin)
      setItems(Array.isArray(data) ? data : [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load commodities.')
    } finally {
      setLoading(false)
    }
  }, [isAdmin, toast])

  useEffect(() => {
    void load()
  }, [load])

  const gtinCheck = form.gtin.trim() ? validateGtin13Client(form.gtin) : { valid: false, message: 'Enter a 13-digit GTIN-13.' }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAdmin) return
    if (!form.code.trim() || !form.name.trim()) {
      toast.error('Product Number and Product Name are required.')
      return
    }
    if (!gtinCheck.valid) {
      toast.error(gtinCheck.message || 'Invalid GTIN-13.')
      return
    }

    setSaving(true)
    try {
      if (editingId) {
        await api.commodities.update(editingId, {
          code: form.code.trim(),
          name: form.name.trim(),
          gtin: form.gtin.trim(),
          brand: form.brand.trim() || 'Eptilu',
          packageType: form.packageType.trim() || 'Carton Box',
          unit: form.unit.trim() || 'kg',
          description: form.description.trim(),
          isActive: form.isActive,
        })
        toast.success(`Commodity ${form.code.trim()} updated.`)
      } else {
        await api.commodities.create({
          code: form.code.trim(),
          name: form.name.trim(),
          gtin: form.gtin.trim(),
          brand: form.brand.trim() || 'Eptilu',
          packageType: form.packageType.trim() || 'Carton Box',
          unit: form.unit.trim() || 'kg',
          description: form.description.trim(),
          isActive: form.isActive,
        })
        toast.success(`Commodity ${form.code.trim()} added.`)
      }
      setEditingId(null)
      setForm(emptyForm)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save commodity.')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (row: Commodity) => {
    setEditingId(row.id)
    setForm({
      code: row.code,
      name: row.name,
      gtin: row.gtin,
      brand: row.brand || 'Eptilu',
      packageType: row.packageType || 'Carton Box',
      unit: row.unit || 'kg',
      description: row.description || '',
      isActive: row.isActive,
    })
  }

  const handleToggleActive = async (row: Commodity) => {
    if (!isAdmin) return
    try {
      await api.commodities.update(row.id, { isActive: !row.isActive })
      toast.success(`${row.code} ${row.isActive ? 'deactivated' : 'activated'}.`)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status.')
    }
  }

  const columns: Column<Commodity>[] = [
    {
      key: 'code',
      label: 'Code',
      priority: true,
      render: (row) => <span className="font-mono font-bold text-foreground">{row.code}</span>,
    },
    {
      key: 'gtin',
      label: 'GTIN-13',
      priority: true,
      render: (row) => <span className="font-mono text-xs text-foreground">{row.gtin || '—'}</span>,
    },
    {
      key: 'name',
      label: 'Product Name',
      priority: true,
      render: (row) => (
        <div>
          <div className="font-semibold text-sm text-foreground">{row.name}</div>
          <div className="text-[11px] text-muted-foreground">
            {row.brand} · {row.packageType} · {row.unit}
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
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => handleEdit(row)}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void handleToggleActive(row)}>
                  {row.isActive ? 'Disable' : 'Enable'}
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ]

  return (
    <div className="space-y-6">
      {isAdmin && (
        <Card
          title={editingId ? `Edit Commodity (${form.code})` : 'Add Commodity & GTIN-13'}
          subtitle="GS1 Indonesia prefix 899447709 + 3-digit Product Number + Modulo-10 check digit"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Product Number (Code)" required>
                <Input
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="e.g. 203"
                  className="font-mono"
                />
              </Field>
              <Field label="GTIN-13 (GS1)" required>
                <Input
                  value={form.gtin}
                  onChange={(e) => setForm((f) => ({ ...f, gtin: e.target.value.replace(/\D/g, '').slice(0, 13) }))}
                  placeholder="8994477092021"
                  className="font-mono"
                />
                {form.gtin.length > 0 && (
                  <p className={`text-xs mt-1 ${gtinCheck.valid ? 'text-emerald-600' : 'text-destructive'}`}>
                    {gtinCheck.valid ? 'Valid GS1 Modulo-10 GTIN-13' : gtinCheck.message}
                  </p>
                )}
              </Field>
              <Field label="Package Type">
                <Input
                  value={form.packageType}
                  onChange={(e) => setForm((f) => ({ ...f, packageType: e.target.value }))}
                  placeholder="Carton Box"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Field label="Product Name" required>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Eptilu Fresh Red Bird's Eye Chili Peppers 10 kg"
                  />
                </Field>
              </div>
              <Field label="Brand">
                <Input
                  value={form.brand}
                  onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                  placeholder="Eptilu"
                />
              </Field>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              {editingId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingId(null)
                    setForm(emptyForm)
                  }}
                >
                  Cancel Edit
                </Button>
              )}
              <Button type="submit" variant="primary" loading={saving} disabled={!gtinCheck.valid}>
                {editingId ? 'Save Changes' : 'Add Commodity'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card title="Registered Commodities & GTIN-13" subtitle="Active catalog available at Station 01 Reception">
        <DataTable
          data={items}
          columns={columns}
          rowKey={(row) => row.id}
          emptyTitle={loading ? 'Loading commodities...' : 'No commodities registered.'}
        />
      </Card>
    </div>
  )
}

