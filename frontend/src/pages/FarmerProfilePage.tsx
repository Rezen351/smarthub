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
import { translateStatus } from '../lib/i18n'

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrator Sistem',
  OPERATOR: 'Operator Rumah Kemas',
  FARMER: 'Petani Terdaftar',
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
      toast.error('Nama lengkap wajib diisi.')
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
      toast.success('Detail profil berhasil diperbarui.')
    } catch (err: any) {
      toast.error(err?.message || 'Gagal memperbarui profil.')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentPassword) {
      toast.error('Kata sandi saat ini wajib diisi.')
      return
    }
    if (!newPassword) {
      toast.error('Kata sandi baru wajib diisi.')
      return
    }
    if (newPassword.length < 6) {
      toast.error('Kata sandi baru minimal 6 karakter.')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Konfirmasi kata sandi baru tidak cocok.')
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
      toast.success('Kata sandi berhasil diubah.')
    } catch (err: any) {
      toast.error(err?.message || 'Gagal mengubah kata sandi. Periksa kata sandi saat ini.')
    } finally {
      setSavingPassword(false)
    }
  }

  const isFarmer = user?.role === 'FARMER'

  const userCardData: IdCardData = {
    id: user?.id,
    name: name || user?.name || 'Nama Pengguna',
    role: user?.role || 'OPERATOR',
    code: user?.farmerId || user?.farmerProfile?.code || user?.cardCode || (user?.role === 'ADMIN' ? 'ADM-001' : user?.role === 'OPERATOR' ? 'OPR-001' : 'USER-01'),
    domicile: location || address || user?.address || (user?.role === 'FARMER' ? 'Garut, Jawa Barat' : 'Fasilitas SmartGeulis'),
    email: user?.email,
    phone: phone,
  }

  return (
    <div className="stack stack-lg" style={{ maxWidth: 760 }}>
      <PageHeader
        title="Profil & Keamanan"
        subtitle="Kelola data pribadi, catatan kebun, dan kredensial akun Anda."
      />

      {/* Account Overview Header Card */}
      <Card>
        <div className="row gap-md flex-wrap items-center">
          <span className="avatar avatar-lg">{name.charAt(0)?.toUpperCase() || 'U'}</span>
          <div className="stack-xs min-w-0 flex-1">
            <p className="t-h3">{name || 'Profil Pengguna'}</p>
            <p className="t-small text-text-secondary">{user?.email}</p>
            <div className="row gap-xs items-center flex-wrap pt-1">
              <Badge tone="accent" icon="leaf">
                {user ? ROLE_LABEL[user.role] ?? translateStatus(user.role) : 'Pengguna'}
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
        title="Kartu Identitas"
        subtitle="Kartu identitas digital untuk check-in stasiun dan verifikasi transaksi."
        action={
          <div className="row gap-xs">
            <Button
              size="sm"
              variant="outline"
              icon="print"
              onClick={() => printIdCard(userCardData)}
            >
              Cetak Kartu
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
              {exportingCard ? 'Mengekspor...' : 'Ekspor PNG'}
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
                <span className="font-medium text-text">Nama:</span>
                <span className="font-semibold text-text">{userCardData.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-text">Kode ID:</span>
                <span className="font-mono font-bold text-accent">{userCardData.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-text">Peran:</span>
                <span className="font-semibold text-text">{ROLE_LABEL[userCardData.role] ?? translateStatus(userCardData.role)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-text">Domisili:</span>
                <span>{userCardData.domicile}</span>
              </div>
            </div>
            <div className="pt-1 flex flex-wrap gap-2">
              <Button size="sm" variant="primary" icon="print" onClick={() => printIdCard(userCardData)}>
                Cetak Kartu
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
                {exportingCard ? 'Mengekspor...' : 'Ekspor PNG'}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Account Information Form */}
      <Card title="Informasi Akun" subtitle="Digunakan pada catatan sistem, label, dan struk.">
        <form className="stack-md" onSubmit={handleUpdateProfile}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
            <Field label="Nama Lengkap" htmlFor="profile-name" required>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Masukkan nama lengkap Anda"
                required
              />
            </Field>
            <Field label="Alamat Email" htmlFor="profile-email" hint="Hubungi administrator sistem untuk mengubah email.">
              <Input
                id="profile-email"
                type="email"
                value={user?.email || ''}
                disabled
                className="bg-muted cursor-not-allowed opacity-80"
              />
            </Field>
            <Field label="Nomor Telepon" htmlFor="profile-phone" hint="Contoh: 08123456789">
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
              <Field label="Lokasi Kebun / Desa" htmlFor="profile-location" hint="Cikajang, Cisurupan, dll.">
                <Input
                  id="profile-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Desa atau area kebun"
                />
              </Field>
            ) : (
              <Field label="Departemen / Peran" htmlFor="profile-role">
                <Input
                  id="profile-role"
                  value={user ? ROLE_LABEL[user.role] ?? translateStatus(user.role) : ''}
                  disabled
                  className="bg-muted cursor-not-allowed opacity-80"
                />
              </Field>
            )}
            <Field label="Alamat / Domisili" htmlFor="profile-address" className="sm:col-span-2">
              <Input
                id="profile-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Alamat lengkap"
              />
            </Field>
          </div>

          <div className="row gap-sm pt-2">
            <Button type="submit" variant="primary" icon="check" disabled={savingProfile}>
              {savingProfile ? 'Menyimpan...' : 'Simpan Detail Profil'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Security & Password Change Card */}
      <Card
        title="Keamanan & Kata Sandi"
        subtitle="Ubah kredensial masuk untuk melindungi akun Anda."
      >
        <form className="stack-md" onSubmit={handleChangePassword}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
            <Field
              label="Kata Sandi Saat Ini"
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
                placeholder="Masukkan kata sandi saat ini"
                required
              />
            </Field>
            <Field
              label="Kata Sandi Baru"
              htmlFor="profile-new-password"
              hint="Minimal 6 karakter"
              required
            >
              <Input
                id="profile-new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Masukkan kata sandi baru"
                required
              />
            </Field>
            <Field
              label="Konfirmasi Kata Sandi Baru"
              htmlFor="profile-confirm-password"
              required
            >
              <Input
                id="profile-confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Masukkan ulang kata sandi baru"
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
              {savingPassword ? 'Memperbarui...' : 'Perbarui Kata Sandi'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Farmer Specific Notification */}
      {isFarmer && (
        <div className="alert alert-info">
          <Icon name="qr" size={16} />
          <span>Tunjukkan halaman &quot;QR Saya&quot; di stasiun penerimaan agar batch kentang langsung tercatat atas identitas Anda.</span>
        </div>
      )}
    </div>
  )
}
