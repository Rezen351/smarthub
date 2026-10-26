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

type Role = 'ADMIN' | 'OPERATOR' | 'FARMER'

type User = {
  id: string
  name: string
  email: string
  role: Role
  status: 'ACTIVE' | 'INVITED'
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
  const [form, setForm] = useState({ name: '', email: '', role: 'OPERATOR' as Role })
  const [formOpen, setFormOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<User | null>(null)

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
      })
      setUsers((prev) => [...prev, created])
      setForm({ name: '', email: '', role: form.role })
      setFormOpen(false)
      toast.success('User account created in database.')
    } catch (err: any) {
      toast.error(err.message || 'Failed to create user account.')
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
      key: 'status',
      label: 'Status',
      render: (row) => <Badge tone={row.status === 'ACTIVE' ? 'success' : 'warning'} dot>{row.status}</Badge>,
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (row) => (
        <Button size="sm" variant="danger-soft" icon="trash" onClick={() => setConfirmDelete(row)}>
          Delete
        </Button>
      ),
    },
  ]

  return (
    <div className="stack stack-lg">
      <PageHeader
        title="Users"
        subtitle="Manage accounts and roles for the whole facility."
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
          <p className="stat-sub">Across 6 roles</p>
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-md">
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
                  placeholder="nina@enyx.local"
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
              placeholder="Search name, email or role"
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
    </div>
  )
}
