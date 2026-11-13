import { useMemo, useState, useEffect } from 'react'
import Card from '../components/shared/Card'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import Icon from '../components/shared/Icon'
import { Field, Input, Select } from '../components/shared/Form'
import DataTable, { type Column } from '../components/shared/DataTable'
import PageHeader from '../components/shared/PageHeader'
import ConfirmDialog from '../components/feedback/ConfirmDialog'
import { useToast } from '../components/feedback/Toast'
import { api } from '../services/api'
import { IdCardModal, type IdCardData } from '../components/shared/IdCard'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

type Role = 'ADMIN' | 'OPERATOR' | 'FARMER'

type User = {
  id: string
  name: string
  email: string
  role: Role
  status: 'ACTIVE' | 'INVITED'
  createdAt?: string
  farmerCode?: string
  farmerId?: string
  cardCode?: string
  phone?: string
  village?: string
  address?: string
  nik?: string
  gender?: string
  age?: number
  landStatus?: string
  district?: string
  landArea?: string
  landAreaUnit?: string
  joinYear?: string
  averageProduction?: string
}

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Admin',
  OPERATOR: 'Plant Operator',
  FARMER: 'Farmer',
}

const ROLE_TONE: Record<Role, 'neutral' | 'accent' | 'success' | 'warning'> = {
  ADMIN: 'neutral',
  OPERATOR: 'accent',
  FARMER: 'success',
}

export default function UsersPage() {
  const toast = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ name: '', email: '', role: 'OPERATOR' as Role, password: '' })
  const [formOpen, setFormOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<User | null>(null)
  const [idCardUser, setIdCardUser] = useState<IdCardData | null>(null)
  const [idCardOpen, setIdCardOpen] = useState(false)

  const openIdCard = (u: User) => {
    setIdCardUser({
      id: u.id,
      name: u.name,
      role: u.role,
      code: u.farmerCode || u.farmerId || u.cardCode || (u.role === 'ADMIN' ? 'ADM-001' : u.role === 'OPERATOR' ? 'OPR-001' : 'USER-01'),
      domicile: u.address || u.village || (u.role === 'FARMER' ? 'Garut, Jawa Barat' : 'SmartGeulis Facility'),
      email: u.email,
      phone: u.phone,
    })
    setIdCardOpen(true)
  }

  // Edit user state
  const [editUser, setEditUser] = useState<User | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    role: 'OPERATOR' as Role,
    password: '',
    phone: '',
    village: '',
    address: '',
    nik: '',
    gender: 'Laki-laki',
    age: '' as string | number,
    landStatus: 'Milik Sendiri',
    district: 'Cigedug',
    landArea: '',
    landAreaUnit: 'hektar',
    joinYear: '',
    averageProduction: '',
  })

  useEffect(() => {
    let active = true
    api.auth.users()
      .then((data) => {
        if (active && Array.isArray(data)) {
          setUsers(data)
        }
      })
      .catch(() => {
        // Fallback or offline
      })
    return () => {
      active = false
    }
  }, [])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return users
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        (user.farmerCode && user.farmerCode.toLowerCase().includes(query)) ||
        (user.village && user.village.toLowerCase().includes(query)) ||
        ROLE_LABEL[user.role].toLowerCase().includes(query),
    )
  }, [search, users])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Name and email are required.')
      return
    }
    if (users.some((user) => user.email.toLowerCase() === form.email.trim().toLowerCase())) {
      toast.error('That email is already registered.')
      return
    }
    try {
      const created = await api.auth.createUser({
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        password: form.password.trim() || undefined,
      })
      setUsers((prev) => [...prev, created])
      setForm({ name: '', email: '', role: form.role, password: '' })
      setFormOpen(false)
      toast.success('User account created in database.')
    } catch (err: any) {
      toast.error(err.message || 'Failed to create user account.')
    }
  }

  const openEdit = (user: User) => {
    setEditUser(user)
    setEditForm({
      name: user.name || '',
      email: user.email || '',
      role: user.role || 'OPERATOR',
      password: '',
      phone: user.phone || '',
      village: user.village || '',
      address: user.address || '',
      nik: user.nik || '',
      gender: user.gender || 'Laki-laki',
      age: user.age !== undefined && user.age !== null ? user.age : '',
      landStatus: user.landStatus || 'Milik Sendiri',
      district: user.district || 'Cigedug',
      landArea: user.landArea || '',
      landAreaUnit: user.landAreaUnit || 'hektar',
      joinYear: user.joinYear || '',
      averageProduction: user.averageProduction || '',
    })
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editUser) return
    if (!editForm.name.trim() || !editForm.email.trim()) {
      toast.error('Name and email are required.')
      return
    }
    try {
      const payload: any = {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        role: editForm.role,
      }
      if (editForm.password.trim()) {
        payload.password = editForm.password.trim()
      }
      if (editForm.role === 'FARMER' || editUser.farmerCode) {
        payload.phone = editForm.phone.trim() || null
        payload.village = editForm.village.trim() || null
        payload.address = editForm.address.trim() || null
        payload.nik = editForm.nik.trim() || null
        payload.gender = editForm.gender.trim() || null
        payload.age = editForm.age !== '' ? Number(editForm.age) : null
        payload.landStatus = editForm.landStatus.trim() || null
        payload.district = editForm.district.trim() || null
        payload.landArea = editForm.landArea.trim() || null
        payload.landAreaUnit = editForm.landAreaUnit.trim() || null
        payload.joinYear = editForm.joinYear.trim() || null
        payload.averageProduction = editForm.averageProduction.trim() || null
      }
      const updated = await api.auth.updateUser(editUser.id, payload)
      setUsers((prev) => prev.map((u) => (u.id === editUser.id ? { ...u, ...updated } : u)))
      setEditUser(null)
      toast.success(`User ${updated.name} updated successfully.`)
    } catch (err: any) {
      toast.error(err.message || 'Failed to update user.')
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    try {
      await api.auth.deleteUser(confirmDelete.id)
      setUsers((current) => current.filter((user) => user.id !== confirmDelete.id))
      toast.success(`User ${confirmDelete.name} deleted — sessions invalidated.`)
      setConfirmDelete(null)
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete user.')
    }
  }

  const columns: Column<User>[] = [
    { key: 'name', label: 'Name', priority: true, render: (row) => <span className="cell-strong">{row.name}</span> },
    { key: 'email', label: 'Email', priority: true, render: (row) => <span className="mono t-small">{row.email}</span> },
    {
      key: 'role',
      label: 'Role',
      priority: true,
      render: (row) => <Badge tone={ROLE_TONE[row.role]}>{ROLE_LABEL[row.role]}</Badge>,
    },
    {
      key: 'farmerCode',
      label: 'Farmer ID',
      render: (row) =>
        row.farmerCode ? (
          <span className="mono font-semibold text-xs bg-slate-100 px-2 py-0.5 border border-slate-200 text-slate-800">
            {row.farmerCode}
          </span>
        ) : (
          <span className="text-text-muted text-xs">-</span>
        ),
    },
    {
      key: 'village',
      label: 'Village',
      render: (row) => row.village || <span className="text-text-muted text-xs">-</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <Badge tone={row.status === 'ACTIVE' ? 'success' : 'warning'} dot>{row.status}</Badge>,
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button size="sm" variant="outline" icon="qr" onClick={() => openIdCard(row)}>
            ID Card
          </Button>
          <Button size="sm" variant="outline" icon="edit" onClick={() => openEdit(row)}>
            Edit
          </Button>
          <Button size="sm" variant="danger-soft" icon="trash" onClick={() => setConfirmDelete(row)}>
            Delete
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="stack stack-lg">
      <PageHeader
        title="Users"
        subtitle="Manage accounts, security credentials, and farmer profiles across the facility."
        actions={
          <Button variant="primary" size="sm" icon="plus" touch onClick={() => setFormOpen((open) => !open)}>
            {formOpen ? 'Close' : 'Add User'}
          </Button>
        }
      />

      <div className="grid-stats">
        <div className="stat-card">
          <p className="stat-label">Total users</p>
          <p className="stat-value">{users.length}</p>
          <p className="stat-sub">Across 3 roles</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Operators</p>
          <p className="stat-value">{users.filter((user) => user.role !== 'FARMER' && user.role !== 'ADMIN').length}</p>
          <p className="stat-sub">Weighing, sorting, warehouse, delivery</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Farmers</p>
          <p className="stat-value">{users.filter((user) => user.role === 'FARMER').length}</p>
          <p className="stat-sub">Deposit accounts</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Admins</p>
          <p className="stat-value">{users.filter((user) => user.role === 'ADMIN').length}</p>
          <p className="stat-sub">Full access</p>
        </div>
      </div>

      {formOpen && (
        <Card title="Add user" subtitle="Role is enforced by RBAC on every endpoint.">
          <form className="stack-md" onSubmit={handleCreate}>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-md">
              <Field label="Full name" htmlFor="user-name" required>
                <Input
                  id="user-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Nina Operator"
                  required
                />
              </Field>
              <Field label="Email" htmlFor="user-email" required>
                <Input
                  id="user-email"
                  type="email"
                  inputMode="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="nina@smartgeulisunpad.com"
                  required
                />
              </Field>
              <Field label="Role" htmlFor="user-role" required>
                <Select
                  id="user-role"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                >
                  {(Object.keys(ROLE_LABEL) as Role[]).map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABEL[role]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Initial Password" htmlFor="user-password">
                <Input
                  id="user-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Default: password123"
                />
              </Field>
            </div>
            <div className="row gap-sm">
              <Button type="submit" variant="primary" icon="check" touch>
                Create Account
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card
        title="Accounts"
        subtitle={`${filtered.length} of ${users.length} shown`}
        action={
          <div style={{ minWidth: 220 }}>
            <Input
              placeholder="Search name, email, village or role"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search users"
            />
          </div>
        }
      >
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(row) => row.id}
          emptyTitle="No users match your search."
          emptyDescription="Clear the search field or add a new account."
          emptyAction={
            <Button variant="outline" icon="refresh" onClick={() => setSearch('')}>
              Clear Search
            </Button>
          }
        />
      </Card>

      <div className="alert alert-info">
        <Icon name="shield" size={16} />
        <span>Roles map to JWT claims verified by middleware on every endpoint.</span>
      </div>

      {/* Edit User Modal Dialog */}
      <Dialog open={Boolean(editUser)} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-xl font-bold">
              Edit User {editUser?.farmerCode ? `— ${editUser.farmerCode}` : ''}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Update authentication credentials, role permissions, and profile parameters.
            </DialogDescription>
          </DialogHeader>

          <form className="stack-md mt-4" onSubmit={handleUpdate}>
            <div className="p-3 bg-slate-50 border border-slate-200">
              <h3 className="font-semibold text-xs tracking-wider uppercase text-slate-700 mb-3">
                Account Credentials
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
                <Field label="Full Name" htmlFor="edit-name" required>
                  <Input
                    id="edit-name"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    required
                  />
                </Field>
                <Field label="Email Address" htmlFor="edit-email" required>
                  <Input
                    id="edit-email"
                    type="email"
                    inputMode="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    required
                  />
                </Field>
                <Field label="System Role" htmlFor="edit-role" required>
                  <Select
                    id="edit-role"
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value as Role })}
                  >
                    {(Object.keys(ROLE_LABEL) as Role[]).map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABEL[role]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="New Password (optional)" htmlFor="edit-password">
                  <Input
                    id="edit-password"
                    type="password"
                    placeholder="Leave blank to keep existing"
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  />
                </Field>
              </div>
            </div>

            {(editForm.role === 'FARMER' || editUser?.farmerCode) && (
              <div className="p-3 bg-emerald-50/50 border border-emerald-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-xs tracking-wider uppercase text-emerald-800">
                    Farmer Profile Parameters
                  </h3>
                  {editUser?.farmerCode && (
                    <span className="mono font-bold text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 border border-emerald-300">
                      {editUser.farmerCode}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
                  <Field label="NIK (Nomor Induk Kependudukan)" htmlFor="edit-nik">
                    <Input
                      id="edit-nik"
                      value={editForm.nik}
                      onChange={(e) => setEditForm({ ...editForm, nik: e.target.value })}
                      placeholder="e.g. 3205181211930001"
                    />
                  </Field>
                  <Field label="Phone Number" htmlFor="edit-phone">
                    <Input
                      id="edit-phone"
                      type="tel"
                      inputMode="tel"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      placeholder="e.g. 081234567890"
                    />
                  </Field>
                  <Field label="Gender" htmlFor="edit-gender">
                    <Select
                      id="edit-gender"
                      value={editForm.gender}
                      onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                    >
                      <option value="Laki-laki">Laki-laki</option>
                      <option value="Perempuan">Perempuan</option>
                    </Select>
                  </Field>
                  <Field label="Age (Years)" htmlFor="edit-age">
                    <Input
                      id="edit-age"
                      type="number"
                      min={1}
                      max={120}
                      value={editForm.age}
                      onChange={(e) => setEditForm({ ...editForm, age: e.target.value })}
                      placeholder="e.g. 42"
                    />
                  </Field>
                  <Field label="Village (Desa/Kelurahan)" htmlFor="edit-village">
                    <Input
                      id="edit-village"
                      value={editForm.village}
                      onChange={(e) => setEditForm({ ...editForm, village: e.target.value })}
                      placeholder="e.g. Barusuda"
                    />
                  </Field>
                  <Field label="District (Kecamatan)" htmlFor="edit-district">
                    <Input
                      id="edit-district"
                      value={editForm.district}
                      onChange={(e) => setEditForm({ ...editForm, district: e.target.value })}
                      placeholder="e.g. Cigedug"
                    />
                  </Field>
                  <Field label="Full Address" htmlFor="edit-address" className="sm:col-span-2">
                    <Input
                      id="edit-address"
                      value={editForm.address}
                      onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                      placeholder="Desa Barusuda, Kec. Cigedug, Kab. Garut"
                    />
                  </Field>
                  <Field label="Land Ownership Status" htmlFor="edit-landStatus">
                    <Select
                      id="edit-landStatus"
                      value={editForm.landStatus}
                      onChange={(e) => setEditForm({ ...editForm, landStatus: e.target.value })}
                    >
                      <option value="Milik Sendiri">Milik Sendiri</option>
                      <option value="Sewa">Sewa</option>
                    </Select>
                  </Field>
                  <div className="grid grid-cols-2 gap-sm">
                    <Field label="Land Area" htmlFor="edit-landArea">
                      <Input
                        id="edit-landArea"
                        value={editForm.landArea}
                        onChange={(e) => setEditForm({ ...editForm, landArea: e.target.value })}
                        placeholder="e.g. 0.5"
                      />
                    </Field>
                    <Field label="Unit" htmlFor="edit-landAreaUnit">
                      <Select
                        id="edit-landAreaUnit"
                        value={editForm.landAreaUnit}
                        onChange={(e) => setEditForm({ ...editForm, landAreaUnit: e.target.value })}
                      >
                        <option value="hektar">hektar</option>
                        <option value="Patok">Patok</option>
                        <option value="patok">patok</option>
                        <option value="tumbak">tumbak</option>
                        <option value="bata">bata</option>
                        <option value="meter persegi">meter persegi</option>
                      </Select>
                    </Field>
                  </div>
                  <Field label="Join Year (Koperasi Eptilu)" htmlFor="edit-joinYear">
                    <Input
                      id="edit-joinYear"
                      value={editForm.joinYear}
                      onChange={(e) => setEditForm({ ...editForm, joinYear: e.target.value })}
                      placeholder="e.g. 2021"
                    />
                  </Field>
                  <Field label="Avg Production / Season" htmlFor="edit-prod">
                    <Input
                      id="edit-prod"
                      value={editForm.averageProduction}
                      onChange={(e) => setEditForm({ ...editForm, averageProduction: e.target.value })}
                      placeholder="e.g. 5.0 Ton"
                    />
                  </Field>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <Button type="button" variant="outline" onClick={() => setEditUser(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" icon="check" touch>
                Save Changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        tone="danger"
        title="Delete user?"
        description={
          confirmDelete ? (
            <>
              Delete user <strong>{confirmDelete.name}</strong> ({ROLE_LABEL[confirmDelete.role]})? All sessions
              will be invalidated immediately.
            </>
          ) : null
        }
        confirmLabel="Yes, Delete"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />

      <IdCardModal
        data={idCardUser}
        open={idCardOpen}
        onClose={() => setIdCardOpen(false)}
      />
    </div>
  )
}
