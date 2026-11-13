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
import type { ConnectionState } from './ConnectionBadge'

interface MenuItem {
  label: string
  path: string
  icon: IconName
  end?: boolean
  external?: boolean
}

const roleMenu: Record<string, MenuItem[]> = {
  ADMIN: [
    { label: 'Dashboard', path: '/dashboard', icon: 'dashboard', end: true },
    { label: 'Station 1: Reception', path: '/dashboard/weighing', icon: 'scale' },
    { label: 'Station 2: Sorting', path: '/dashboard/sorting', icon: 'sortir' },
    { label: 'Station 3: Packaging', path: '/dashboard/packaging', icon: 'package' },
    { label: 'Warehouse Ledger', path: '/dashboard/warehouse', icon: 'box' },
    { label: 'Deliveries', path: '/dashboard/deliveries', icon: 'truck' },
    { label: 'Users', path: '/dashboard/users', icon: 'users' },
    { label: 'Reports', path: '/dashboard/reports', icon: 'reports' },
    { label: 'Settings', path: '/dashboard/settings', icon: 'settings' },
    { label: 'OpenAPI Docs', path: '/docs', icon: 'clipboard', external: true },
  ],
  OPERATOR: [
    { label: 'Workstation Hub', path: '/dashboard', icon: 'dashboard', end: true },
    { label: 'Station 1: Reception', path: '/dashboard/weighing', icon: 'scale' },
    { label: 'Station 2: Sorting', path: '/dashboard/sorting', icon: 'sortir' },
    { label: 'Station 3: Packaging', path: '/dashboard/packaging', icon: 'package' },
    { label: 'Warehouse Ledger', path: '/dashboard/warehouse', icon: 'box' },
    { label: 'Deliveries', path: '/dashboard/deliveries', icon: 'truck' },
    { label: 'Settings', path: '/dashboard/settings', icon: 'settings' },
  ],
  FARMER: [
    { label: 'Dashboard', path: '/dashboard', icon: 'dashboard', end: true },
    { label: 'My Deposits', path: '/dashboard/my-deliveries', icon: 'clipboard' },
    { label: 'My Farmer QR', path: '/dashboard/farmer-qr', icon: 'qr' },
    { label: 'Profile', path: '/dashboard/profile', icon: 'user' },
  ],
}

const roleLabel: Record<string, string> = {
  ADMIN: 'System Admin',
  OPERATOR: 'Plant Operator',
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
  const [serverState, setServerState] = useState<ConnectionState>('reconnecting')

  const menu = user ? roleMenu[user.role] ?? [] : []
  const currentPage =
    menu.find((item) => (item.end ? location.pathname === item.path : location.pathname.startsWith(item.path))) ??
    menu[0]

  /* Check the API rather than treating browser connectivity as server health. */
  useEffect(() => {
    let active = true
    let pending = false
    let controller: AbortController | undefined
    const check = async () => {
      if (pending) return
      pending = true
      controller = new AbortController()
      const timeout = window.setTimeout(() => controller?.abort(), 5000)
      try {
        const response = await fetch('/api/v1/health', { signal: controller.signal, cache: 'no-store' })
        const payload = await response.json()
        if (!response.ok || payload?.status !== 'ok' || payload?.database !== 'connected') throw new Error('Server unavailable')
        if (active) {
          setServerState('connected')
          setOffline(false)
        }
      } catch {
        if (active) {
          setServerState('disconnected')
          setOffline(true)
        }
      } finally {
        window.clearTimeout(timeout)
        pending = false
      }
    }
    const offline = () => {
      controller?.abort()
      setServerState('disconnected')
      setOffline(true)
    }
    void check()
    const timer = window.setInterval(check, 15000)
    window.addEventListener('online', check)
    window.addEventListener('offline', offline)
    return () => {
      active = false
      controller?.abort()
      window.clearInterval(timer)
      window.removeEventListener('online', check)
      window.removeEventListener('offline', offline)
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

  const requestLogout = () => {
    setMenuOpen(false)
    setUserMenuOpen(false)
    setLogoutOpen(true)
  }

  const confirmLogout = () => {
    setLogoutOpen(false)
    logout()
    navigate('/login')
  }

  const navLinks = (
        <nav className="sidebar-nav" aria-label="Main navigation">
          <p className="sidebar-section">{user ? roleLabel[user.role] ?? 'Menu' : 'Menu'}</p>
          {menu.map((item) =>
            item.external ? (
              <a
                key={item.path}
                href={item.path}
                target="_blank"
                rel="noopener noreferrer"
                className="sidebar-link"
              >
                <span className="sidebar-link-icon">
                  <Icon name={item.icon} size={17} />
                </span>
                <span className="flex-1">{item.label}</span>
                <span className="text-[10px] text-text-light font-mono">↗</span>
              </a>
            ) : (
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
            )
          )}
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
      <Button variant="outline" size="sm" icon="logout" block onClick={requestLogout}>
        Log Out
      </Button>
      <Link to="/traceability" className="t-caption text-text-secondary hover:text-text flex items-center gap-1">
        <Icon name="search" size={12} />
        Public traceability
      </Link>
      <div className="pt-2 border-t border-border flex flex-col gap-0.5 text-text-light font-mono text-[11px]">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-text">SmartGeulis</span>
          <span className="bg-bg-alt px-1.5 py-0.5 rounded-none text-[9px] font-mono tracking-wider">TRACEABILITY</span>
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
            className="flex items-center gap-3 text-inherit group"
            style={{ textDecoration: 'none' }}
            aria-label="SmartGeulis home"
          >
            <Logo className="h-8 w-auto" markOnly />
            <div className="min-w-0">
              <div className="font-display text-xl leading-none tracking-wider text-text flex items-center gap-1.5">
                SmartGeulis
              </div>
              <div className="font-mono-custom text-[9px] text-text-light tracking-[0.22em] uppercase mt-0.5 hidden xs:block sm:block">
                <span className="hidden sm:inline">TRACEABILITY SYSTEM</span>
                <span className="sm:hidden">TRACE</span>
              </div>
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
            className="hide-desktop flex items-center gap-2 text-inherit group min-w-0"
            style={{ textDecoration: 'none' }}
            aria-label="SmartGeulis home"
          >
            <Logo className="h-6 w-auto shrink-0" markOnly />
            <div className="min-w-0">
              <div className="font-display text-sm leading-none tracking-wider text-text truncate">
                SmartGeulis
              </div>
              <div className="font-mono-custom text-[7.5px] text-text-light tracking-[0.16em] uppercase truncate">
                TRACEABILITY
              </div>
            </div>
          </Link>

          {/* On desktop: show only current page title (brand is in sidebar) */}
          <span className="navbar-title hide-mobile font-semibold text-base text-text">
            {currentPage?.label ?? 'Dashboard'}
          </span>

          <div className="navbar-spacer" />

          <ConnectionBadge state={serverState} label="Server" />

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
                  <Link to="/dashboard/profile" className="sidebar-link" role="menuitem">
                    <span className="sidebar-link-icon">
                      <Icon name="user" size={16} />
                    </span>
                    Profile & Security
                  </Link>
                  <Link to="/traceability" className="sidebar-link" role="menuitem">
                    <span className="sidebar-link-icon">
                      <Icon name="search" size={16} />
                    </span>
                    Public traceability
                  </Link>
                  <a href="/docs" target="_blank" rel="noopener noreferrer" className="sidebar-link" role="menuitem">
                    <span className="sidebar-link-icon">
                      <Icon name="clipboard" size={16} />
                    </span>
                    OpenAPI Documentation ↗
                  </a>
                  <button
                    type="button"
                    className="sidebar-link"
                    role="menuitem"
                    style={{ color: 'var(--color-danger)', width: '100%', background: 'none', border: 'none', fontFamily: 'inherit', cursor: 'pointer' }}
                    onClick={requestLogout}
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

        {serverState === 'disconnected' && (
          <div role="status" className="alert alert-warning rounded-none">
            Server offline. Check your connection before saving.
          </div>
        )}
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
