import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { api } from '../services/api'
import Card from '../components/shared/Card'
import Button from '../components/shared/Button'
import Icon from '../components/shared/Icon'
import Badge from '../components/shared/Badge'
import { Field, Input } from '../components/shared/Form'
import PageHeader from '../components/shared/PageHeader'
import { useToast } from '../components/feedback/Toast'
import { IdCard, exportIdCardToPng, printIdCard, type IdCardData } from '../components/shared/IdCard'

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'System Administrator',
  OPERATOR: 'Plant Operator',
  FARMER: 'Registered Farmer',
}

export default function FarmerProfilePage() {
  const { user, refreshUser } = useAuth()
  const toast = useToast()

  // Profile Information State
  const [name, setName] = useState(user?.name || '')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [location, setLocation] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  // Password State
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [exportingCard, setExportingCard] = useState(false)

  useEffect(() => {
    if (user) {
      setName(user.name || '')
      const fp = user.farmerProfile
      if (fp) {
        if (fp.phone) setPhone(fp.phone)
        if (fp.address) setAddress(fp.address)
        if (fp.village) setLocation(fp.village)
      }
    }
  }, [user])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Full name is required.')
      return
    }

    try {
      setSavingProfile(true)
      await api.auth.updateProfile({
        name: name.trim(),
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        village: location.trim() || undefined,
      })
      await refreshUser()
      toast.success('Profile details updated successfully.')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update profile.')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentPassword) {
      toast.error('Current password is required.')
      return
    }
    if (!newPassword) {
      toast.error('New password is required.')
      return
    }
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match.')
      return
    }

    try {
      setSavingPassword(true)
      await api.auth.changePassword({
        currentPassword,
        newPassword,
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast.success('Password changed successfully.')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to change password. Please check your current password.')
    } finally {
      setSavingPassword(false)
    }
  }

  const isFarmer = user?.role === 'FARMER'

  const userCardData: IdCardData = {
    id: user?.id,
    name: name || user?.name || 'User Name',
    role: user?.role || 'OPERATOR',
    code: user?.farmerId || ((user as any)?.farmerProfile?.code) || (user?.role === 'ADMIN' ? 'ADM-001' : user?.role === 'OPERATOR' ? 'OPR-001' : 'USER-01'),
    domicile: location || address || (user?.role === 'FARMER' ? 'Garut, Jawa Barat' : 'SmartGeulis Facility'),
    email: user?.email,
    phone: phone,
  }

  return (
    <div className="stack stack-lg" style={{ maxWidth: 760 }}>
      <PageHeader
        title="Profile & Security"
        subtitle="Manage your personal details, farm records, and account credentials."
      />

      {/* Account Overview Header Card */}
      <Card>
        <div className="row gap-md flex-wrap items-center">
          <span className="avatar avatar-lg">{name.charAt(0)?.toUpperCase() || 'U'}</span>
          <div className="stack-xs min-w-0 flex-1">
            <p className="t-h3">{name || 'User Profile'}</p>
            <p className="t-small text-text-secondary">{user?.email}</p>
            <div className="row gap-xs items-center flex-wrap pt-1">
              <Badge tone="accent" icon="leaf">
                {user ? ROLE_LABEL[user.role] ?? user.role : 'User'}
              </Badge>
              {user?.farmerId && (
                <Badge tone="neutral">
                  ID: {user.farmerId}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Official ID Card Card */}
      <Card
        title="ID Card"
        subtitle="Digital ID card for station check-in and transaction verification."
        action={
          <div className="row gap-xs">
            <Button
              size="sm"
              variant="outline"
              icon="print"
              onClick={() => printIdCard(userCardData)}
            >
              Print Card
            </Button>
            <Button
              size="sm"
              variant="primary"
              icon="download"
              disabled={exportingCard}
              onClick={async () => {
                try {
                  setExportingCard(true)
                  await exportIdCardToPng(userCardData)
                } finally {
                  setExportingCard(false)
                }
              }}
            >
              {exportingCard ? 'Exporting...' : 'Export PNG'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col sm:flex-row items-center gap-6 justify-between p-2">
          <div className="shrink-0 flex justify-center w-full sm:w-auto">
            <IdCard data={userCardData} />
          </div>
          <div className="stack-sm text-xs text-text-secondary flex-1">
            <div className="bg-bg-alt p-3 rounded border border-border space-y-1">
              <div className="flex justify-between">
                <span className="font-medium text-text">Name:</span>
                <span className="font-semibold text-text">{userCardData.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-text">ID Code:</span>
                <span className="font-mono font-bold text-accent">{userCardData.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-text">Role:</span>
                <span className="font-semibold text-text capitalize">{userCardData.role?.toLowerCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-text">Domicile:</span>
                <span>{userCardData.domicile}</span>
              </div>
            </div>
            <div className="pt-1 flex flex-wrap gap-2">
              <Button size="sm" variant="primary" icon="print" onClick={() => printIdCard(userCardData)}>
                Print Card
              </Button>
              <Button
                size="sm"
                variant="outline"
                icon="download"
                disabled={exportingCard}
                onClick={async () => {
                  try {
                    setExportingCard(true)
                    await exportIdCardToPng(userCardData)
                  } finally {
                    setExportingCard(false)
                  }
                }}
              >
                {exportingCard ? 'Exporting...' : 'Export PNG'}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Account Information Form */}
      <Card title="Account Information" subtitle="Used across system records, labels, and receipts.">
        <form className="stack-md" onSubmit={handleUpdateProfile}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
            <Field label="Full name" htmlFor="profile-name" required>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                required
              />
            </Field>
            <Field label="Email Address" htmlFor="profile-email" hint="Contact system administrator to change email.">
              <Input
                id="profile-email"
                type="email"
                value={user?.email || ''}
                disabled
                className="bg-muted cursor-not-allowed opacity-80"
              />
            </Field>
            <Field label="Phone Number" htmlFor="profile-phone" hint="e.g. 08123456789">
              <Input
                id="profile-phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="08xxxxxxxxxx"
              />
            </Field>
            {isFarmer ? (
              <Field label="Farm Location / Village" htmlFor="profile-location" hint="Dieng, Kejajar, etc.">
                <Input
                  id="profile-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Village or farm area"
                />
              </Field>
            ) : (
              <Field label="Department / Role" htmlFor="profile-role">
                <Input
                  id="profile-role"
                  value={user ? ROLE_LABEL[user.role] ?? user.role : ''}
                  disabled
                  className="bg-muted cursor-not-allowed opacity-80"
                />
              </Field>
            )}
            <Field label="Address / Domicile" htmlFor="profile-address" className="sm:col-span-2">
              <Input
                id="profile-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Full address"
              />
            </Field>
          </div>

          <div className="row gap-sm pt-2">
            <Button type="submit" variant="primary" icon="check" disabled={savingProfile}>
              {savingProfile ? 'Saving...' : 'Save Profile Details'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Security & Password Change Card */}
      <Card
        title="Security & Password"
        subtitle="Change your login credentials to protect your account."
      >
        <form className="stack-md" onSubmit={handleChangePassword}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
            <Field
              label="Current Password"
              htmlFor="profile-current-password"
              className="sm:col-span-2"
              required
            >
              <Input
                id="profile-current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                required
              />
            </Field>
            <Field
              label="New Password"
              htmlFor="profile-new-password"
              hint="Minimum 6 characters"
              required
            >
              <Input
                id="profile-new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                required
              />
            </Field>
            <Field
              label="Confirm New Password"
              htmlFor="profile-confirm-password"
              required
            >
              <Input
                id="profile-confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                required
              />
            </Field>
          </div>

          <div className="row gap-sm pt-2">
            <Button
              type="submit"
              variant="primary"
              icon="lock"
              disabled={savingPassword}
            >
              {savingPassword ? 'Updating...' : 'Update Password'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Farmer Specific Notification */}
      {isFarmer && (
        <div className="alert alert-info">
          <Icon name="qr" size={16} />
          <span>Present your &quot;My QR&quot; page at the weighing station so potato batches are registered directly under your identity.</span>
        </div>
      )}
    </div>
  )
}
