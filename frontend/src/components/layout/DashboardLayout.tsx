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
    { label: 'Users', path: '/dashboard/users', icon: 'users' },
    { label: 'Reports', path: '/dashboard/reports', icon: 'reports' },
    { label: 'Settings', path: '/dashboard/settings', icon: 'settings' },
  ],
  WEIGHING_OPERATOR: [
    { label: 'Dashboard', path: '/dashboard', icon: 'dashboard', end: true },
    { label: 'Weighing', path: '/dashboard/weighing', icon: 'scale' },
    { label: 'Pallets', path: '/dashboard/pallets', icon: 'pallet' },
  ],
  SORTING_OPERATOR: [
    { label: 'Dashboard', path: '/dashboard', icon: 'dashboard', end: true },
    { label: 'Grading', path: '/dashboard/grading', icon: 'sortir' },
    { label: 'Labels', path: '/dashboard/labels', icon: 'label' },
  ],
  WAREHOUSE_OPERATOR: [
    { label: 'Dashboard', path: '/dashboard', icon: 'dashboard', end: true },
    { label: 'Stock In', path: '/dashboard/stock-in', icon: 'arrow-down' },
    { label: 'Stock Out', path: '/dashboard/stock-out', icon: 'arrow-up' },
  ],
  DELIVERY_OPERATOR: [
    { label: 'Dashboard', path: '/dashboard', icon: 'dashboard', end: true },
    { label: 'Packaging', path: '/dashboard/packaging', icon: 'package' },
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
    </div>
  )

  return (
    <div className="app-shell">
      {/* ── Navbar ── */}
      <header className="navbar">
        <button
          type="button"
          className="btn btn-ghost hide-desktop"
          style={{ padding: 8, minHeight: 40 }}
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          <Icon name={menuOpen ? 'close' : 'menu'} size={20} />
        </button>

        <Link to="/dashboard" className="flex items-center hide-mobile" aria-label="ENYX-Smart Hub home">
          <Logo className="h-7 w-auto" markOnly />
        </Link>
        <span className="navbar-title hide-mobile" style={{ borderLeft: '1px solid var(--color-border)', paddingLeft: 12 }}>
          {currentPage?.label ?? 'Dashboard'}
        </span>

        <Link to="/dashboard" className="hide-desktop flex items-center" aria-label="ENYX-Smart Hub home">
          <Logo className="h-6 w-auto" markOnly />
        </Link>
        <span className="navbar-title hide-desktop">{currentPage?.label ?? 'Dashboard'}</span>

        <div className="navbar-spacer" />

        <ConnectionBadge state={navigator.onLine ? 'connected' : 'disconnected'} label="Scale" />

        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: 6, minHeight: 40, gap: 6 }}
            onClick={() => setUserMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={userMenuOpen}
            aria-label="Account menu"
          >
            <span className="avatar avatar-sm">{user?.name?.charAt(0)?.toUpperCase() ?? 'U'}</span>
            <Icon name="chevron-down" size={14} />
          </button>
          {userMenuOpen && (
            <div
              className="card"
              role="menu"
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 6px)',
                width: 220,
                padding: 12,
                zIndex: 80,
                boxShadow: 'var(--shadow-lg)',
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

      <div className="app-body">
        {/* ── Sidebar ── */}
        <aside className={`sidebar ${menuOpen ? 'is-open' : ''}`} aria-label="Sidebar">
          <div className="sidebar-brand">
            <Logo className="h-7 w-auto" />
          </div>
          {navLinks}
          {userCard}
        </aside>
        {menuOpen && <div className="sidebar-overlay hide-desktop" onClick={() => setMenuOpen(false)} />}

        {/* ── Content ── */}
        <div className="min-w-0 flex-1 flex flex-col">
          <ContextBar />
          <main className="app-main">
            <Outlet />
          </main>
        </div>
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
