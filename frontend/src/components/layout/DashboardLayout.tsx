import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useSessionContext } from '../../hooks/useSessionContext'
import Icon, { type IconName } from '../shared/Icon'
import Logo from '../shared/Logo'
import Button from '../shared/Button'
import ConfirmDialog from '../feedback/ConfirmDialog'
import ContextBar from './ContextBar'
import ConnectionBadge from './ConnectionBadge'

interface MenuItem {
  label: string
  path: string
  icon: IconName
  end?: boolean
}

const roleMenu: Record<string, MenuItem[]> = {
  ADMIN: [
    { label: 'Dashboard', path: '/dashboard', icon: 'dashboard', end: true },
    { label: 'Weighing', path: '/dashboard/weighing', icon: 'scale' },
    { label: 'Sorting', path: '/dashboard/sorting', icon: 'sortir' },
    { label: 'Packaging', path: '/dashboard/packaging', icon: 'package' },
    { label: 'Users', path: '/dashboard/users', icon: 'users' },
    { label: 'Reports', path: '/dashboard/reports', icon: 'reports' },
    { label: 'Settings', path: '/dashboard/settings', icon: 'settings' },
  ],
  WEIGHING_OPERATOR: [
    { label: 'Dashboard', path: '/dashboard', icon: 'dashboard', end: true },
    { label: 'Weighing', path: '/dashboard/weighing', icon: 'scale' },
    { label: 'Pallet Register', path: '/dashboard/pallets', icon: 'pallet' },
    { label: 'Configuration', path: '/dashboard/settings', icon: 'settings' },
  ],
  SORTING_OPERATOR: [
    { label: 'Dashboard', path: '/dashboard', icon: 'dashboard', end: true },
    { label: 'Sorting', path: '/dashboard/sorting', icon: 'sortir' },
  ],
  PACKAGING_OPERATOR: [
    { label: 'Dashboard', path: '/dashboard', icon: 'dashboard', end: true },
    { label: 'Packaging', path: '/dashboard/packaging', icon: 'package' },
    { label: 'Configuration', path: '/dashboard/settings', icon: 'settings' },
  ],
  WAREHOUSE_OPERATOR: [
    { label: 'Dashboard', path: '/dashboard', icon: 'dashboard', end: true },
    { label: 'Stock In', path: '/dashboard/stock-in', icon: 'arrow-down' },
    { label: 'Stock Out', path: '/dashboard/stock-out', icon: 'arrow-up' },
  ],
  DELIVERY_OPERATOR: [
    { label: 'Dashboard', path: '/dashboard', icon: 'dashboard', end: true },
    { label: 'Deliveries', path: '/dashboard/deliveries', icon: 'truck' },
  ],
  FARMER: [
    { label: 'Dashboard', path: '/dashboard', icon: 'dashboard', end: true },
    { label: 'My Deposits', path: '/dashboard/my-deliveries', icon: 'clipboard' },
    { label: 'My QR', path: '/dashboard/traceability', icon: 'qr' },
    { label: 'Profile', path: '/dashboard/profile', icon: 'user' },
  ],
}

const roleLabel: Record<string, string> = {
  ADMIN: 'Admin',
  WEIGHING_OPERATOR: 'Weighing Operator',
  SORTING_OPERATOR: 'Sorting Operator',
  PACKAGING_OPERATOR: 'Packaging Operator',
  WAREHOUSE_OPERATOR: 'Warehouse Operator',
  DELIVERY_OPERATOR: 'Delivery Operator',
  FARMER: 'Farmer',
}

export default function DashboardLayout() {
  const { user, logout } = useAuth()
  const { setOffline } = useSessionContext()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  const menu = user ? roleMenu[user.role] ?? [] : []
  const currentPage =
    menu.find((item) => (item.end ? location.pathname === item.path : location.pathname.startsWith(item.path))) ??
    menu[0]

  /* Real-time connection indicator (WebSocket layer is wired later) */
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [setOffline])

  /* Close the drawer whenever the route changes */
  useEffect(() => {
    setMenuOpen(false)
    setUserMenuOpen(false)
  }, [location.pathname])

  /* Click-outside for the user menu */
  useEffect(() => {
    if (!userMenuOpen) return
    const onClick = (event: MouseEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [userMenuOpen])

  const confirmLogout = () => {
    setLogoutOpen(false)
    logout()
    navigate('/login')
  }

  const navLinks = (
        <nav className="sidebar-nav" aria-label="Main navigation">
          <p className="sidebar-section">{user ? roleLabel[user.role] ?? 'Menu' : 'Menu'}</p>
          {menu.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) => `sidebar-link ${isActive ? 'is-active' : ''}`}
            >
              <span className="sidebar-link-icon">
                <Icon name={item.icon} size={17} />
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>
  )

  const userCard = (
    <div className="sidebar-footer stack-sm">
      <div className="flex items-center gap-2">
        <span className="avatar">{user?.name?.charAt(0)?.toUpperCase() ?? 'U'}</span>
        <div className="min-w-0 flex-1">
          <p className="t-small font-semibold text-truncate">{user?.name}</p>
          <p className="t-caption text-text-secondary text-truncate">
            {user ? roleLabel[user.role] ?? user.role : ''}
          </p>
        </div>
      </div>
      <Button variant="outline" size="sm" icon="logout" block onClick={() => setLogoutOpen(true)}>
        Log Out
      </Button>
      <Link to="/traceability" className="t-caption text-text-secondary hover:text-text flex items-center gap-1">
        <Icon name="search" size={12} />
        Public traceability
      </Link>
      <div className="pt-2 border-t border-border flex flex-col gap-0.5 text-text-light font-mono text-[11px]">
        <div className="flex items-center justify-between">
          <span>ENYX Enterprise</span>
          <span className="bg-bg-alt px-1.5 py-0.5 rounded text-[10px]">enyx-enterprise</span>
        </div>
        <span className="text-[10px]">Traceability System v1.0.0</span>
      </div>
    </div>
  )

  return (
    <div className="app-shell">
      {/* ── Sidebar (Persistent on desktop, drawer on mobile) ── */}
      <aside className={`sidebar ${menuOpen ? 'is-open' : ''}`} aria-label="Sidebar">
        <div className="sidebar-brand">
          <Link
            to="/dashboard"
            className="flex items-center gap-2.5 text-inherit"
            style={{ textDecoration: 'none' }}
            aria-label="ENYX Traceability System home"
          >
            <Logo className="h-7 w-auto" markOnly />
            <div className="min-w-0">
              <span className="font-semibold text-sm tracking-tight block leading-tight text-text">Traceability System</span>
              <span className="text-[11px] text-text-light block leading-none mt-0.5 font-mono">ENYX Enterprise</span>
            </div>
          </Link>
        </div>
        {navLinks}
        {userCard}
      </aside>
      {menuOpen && <div className="sidebar-overlay hide-desktop" onClick={() => setMenuOpen(false)} />}

      {/* ── Main content column ── */}
      <div className="app-main-column">
        {/* ── Navbar ── */}
        <header className="navbar">
          <Button
            variant="ghost"
            size="sm"
            className="hide-desktop p-2 min-h-[40px] text-foreground"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            <Icon name={menuOpen ? 'close' : 'menu'} size={20} />
          </Button>

          {/* On mobile: show product brand in navbar because sidebar is off-canvas */}
          <Link
            to="/dashboard"
            className="hide-desktop flex items-center gap-2 text-inherit"
            style={{ textDecoration: 'none' }}
            aria-label="ENYX Traceability System home"
          >
            <Logo className="h-6 w-auto" markOnly />
            <div className="flex flex-col">
              <span className="font-semibold text-xs tracking-tight leading-tight text-text">Traceability System</span>
              <span className="text-[9px] text-text-light leading-none font-mono">ENYX Enterprise</span>
            </div>
          </Link>

          {/* On desktop: show only current page title (brand is in sidebar) */}
          <span className="navbar-title hide-mobile font-semibold text-base text-text">
            {currentPage?.label ?? 'Dashboard'}
          </span>

          <div className="navbar-spacer" />

          <ConnectionBadge state={navigator.onLine ? 'connected' : 'disconnected'} label="Scale" />

          <div className="relative" ref={userMenuRef}>
            <Button
              variant="ghost"
              size="sm"
              className="p-1.5 min-h-[40px] gap-1.5"
              onClick={() => setUserMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
              aria-label="Account menu"
            >
              <span className="avatar avatar-sm">{user?.name?.charAt(0)?.toUpperCase() ?? 'U'}</span>
              <Icon name="chevron-down" size={14} />
            </Button>
            {userMenuOpen && (
              <div
                className="rounded-lg border border-border bg-card p-3 shadow-lg"
                role="menu"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 6px)',
                  width: 220,
                  zIndex: 80,
                }}
              >
                <div className="stack stack-xs" style={{ marginBottom: 10 }}>
                  <p className="t-small font-semibold">{user?.name}</p>
                  <p className="t-caption text-text-secondary">{user?.email}</p>
                </div>
                <div className="divider" style={{ margin: '8px 0' }} />
                <div className="stack-xs">
                  {user?.role === 'FARMER' && (
                    <Link to="/dashboard/profile" className="sidebar-link" role="menuitem">
                      <span className="sidebar-link-icon">
                        <Icon name="user" size={16} />
                      </span>
                      Profile
                    </Link>
                  )}
                  <Link to="/traceability" className="sidebar-link" role="menuitem">
                    <span className="sidebar-link-icon">
                      <Icon name="search" size={16} />
                    </span>
                    Public traceability
                  </Link>
                  <button
                    type="button"
                    className="sidebar-link"
                    role="menuitem"
                    style={{ color: 'var(--color-danger)', width: '100%', background: 'none', border: 'none', fontFamily: 'inherit', cursor: 'pointer' }}
                    onClick={() => {
                      setUserMenuOpen(false)
                      setLogoutOpen(true)
                    }}
                  >
                    <span className="sidebar-link-icon">
                      <Icon name="logout" size={16} />
                    </span>
                    Log Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        <ContextBar />
        <main className="app-main">
          <Outlet />
        </main>
      </div>

      <ConfirmDialog
        open={logoutOpen}
        tone="danger"
        title="Log out?"
        description="You will need to sign in again to continue working."
        confirmLabel="Yes, Log Out"
        onConfirm={confirmLogout}
        onCancel={() => setLogoutOpen(false)}
      />
    </div>
  )
}
