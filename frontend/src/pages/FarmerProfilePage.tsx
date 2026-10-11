import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import Card from '../components/shared/Card'
import Button from '../components/shared/Button'
import Icon from '../components/shared/Icon'
import Badge from '../components/shared/Badge'
import { Field, Input } from '../components/shared/Form'
import PageHeader from '../components/shared/PageHeader'
import { useToast } from '../components/feedback/Toast'

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Admin',
  WEIGHING_OPERATOR: 'Weighing Operator',
  SORTING_OPERATOR: 'Sorting Operator',
  PACKAGING_OPERATOR: 'Packaging Operator',
  WAREHOUSE_OPERATOR: 'Warehouse Operator',
  DELIVERY_OPERATOR: 'Delivery Operator',
  FARMER: 'Farmer',
}

export default function FarmerProfilePage() {
  const { user } = useAuth()
  const toast = useToast()
  const [name, setName] = useState(user?.name || '')
  const [phone, setPhone] = useState('081234567890')
  const [address, setAddress] = useState('Jl. Pertanian No. 1')
  const [location, setLocation] = useState('Jakarta')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword && newPassword !== confirmPassword) {
      toast.error('New passwords do not match.')
      return
    }

    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    toast.success('Profile changes saved.')
  }

  return (
    <div className="stack stack-lg" style={{ maxWidth: 720 }}>
      <PageHeader title="My Profile" subtitle="Account information, farm location and security." />

      <Card>
        <div className="row gap-md flex-wrap">
          <span className="avatar avatar-lg">{name.charAt(0)?.toUpperCase() || 'F'}</span>
          <div className="stack-xs min-w-0">
            <p className="t-h3">{name || 'Farmer'}</p>
            <p className="t-small text-text-secondary">{user?.email}</p>
            <Badge tone="accent" icon="leaf">
              {user ? ROLE_LABEL[user.role] ?? user.role : 'Farmer'}
            </Badge>
          </div>
        </div>
      </Card>

      <Card title="Account information" subtitle="Used on labels and delivery documents.">
        <form className="stack-md" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
            <Field label="Full name" htmlFor="profile-name">
              <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Phone" htmlFor="profile-phone">
              <Input
                id="profile-phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
            <Field label="Address" htmlFor="profile-address" className="sm:col-span-2">
              <Input id="profile-address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </Field>
            <Field label="Farm location" htmlFor="profile-location" className="sm:col-span-2">
              <Input
                id="profile-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Dieng, Wonosobo"
              />
            </Field>
          </div>

          <div className="divider" />

          <h2 className="section-title">Change password</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
            <Field label="Current password" htmlFor="profile-current" className="sm:col-span-2">
              <Input
                id="profile-current"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </Field>
            <Field label="New password" htmlFor="profile-new">
              <Input
                id="profile-new"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </Field>
            <Field label="Confirm new password" htmlFor="profile-confirm">
              <Input
                id="profile-confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </Field>
          </div>

          <div className="row gap-sm">
            <Button type="submit" variant="primary" icon="check" touch>
              Save Changes
            </Button>
            <span className="t-caption text-text-light">Fields marked optional can be left empty.</span>
          </div>
        </form>
      </Card>

      <div className="alert alert-info">
        <Icon name="qr" size={16} />
        <span>Share your "My QR" page with the weighing operator so deposits are linked to your ID.</span>
      </div>
    </div>
  )
}
