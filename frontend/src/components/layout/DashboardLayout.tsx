import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import Logo from '../shared/Logo'

const roleMenu: Record<string, { label: string; path: string }[]> = {
  ADMIN: [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Users', path: '/dashboard/users' },
    { label: 'Reports', path: '/dashboard/reports' },
    { label: 'Settings', path: '/dashboard/settings' },
  ],
  WEIGHING_OPERATOR: [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Weighing', path: '/dashboard/weighing' },
    { label: 'Pallets', path: '/dashboard/pallets' },
  ],
  SORTING_OPERATOR: [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Grading', path: '/dashboard/grading' },
    { label: 'Labels', path: '/dashboard/labels' },
  ],
  WAREHOUSE_OPERATOR: [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Stock In', path: '/dashboard/stock-in' },
    { label: 'Stock Out', path: '/dashboard/stock-out' },
  ],
  DELIVERY_OPERATOR: [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Packaging', path: '/dashboard/packaging' },
    { label: 'Deliveries', path: '/dashboard/deliveries' },
  ],
  FARMER: [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'My Deliveries', path: '/dashboard/my-deliveries' },
    { label: 'Profile', path: '/dashboard/profile' },
    { label: 'My QR', path: '/dashboard/traceability' },
  ],
}

export default function DashboardLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const menu = user ? roleMenu[user.role] || [] : []

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-surface border-b border-border flex items-center justify-between px-4 z-50">
        <Logo className="h-8 w-auto" />
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-text hover:text-text-secondary transition-colors"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-[240px] bg-background border-r border-border
        transform transition-transform duration-200 ease-in-out
        lg:translate-x-0 lg:static lg:flex lg:flex-col
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-16 border-b border-border">
            <Logo className="h-8 w-auto" />
          </div>

          {/* Menu Items */}
          <nav className="flex-1 overflow-y-auto py-4 px-3">
            {menu.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `block px-3 py-2.5 mb-1 rounded text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-background text-text font-semibold'
                      : 'text-text-secondary hover:bg-background hover:text-text'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Bottom Section */}
          <div className="border-t border-border p-3">
            <div className="mb-2 px-3 py-2">
              <div className="text-sm font-medium text-text">{user?.name}</div>
              <div className="text-xs text-text-secondary">{user?.role.replace('_', ' ')}</div>
            </div>
            <NavLink
              to="/dashboard/profile"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `block px-3 py-2.5 mb-1 rounded text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-background text-text font-semibold'
                    : 'text-text-secondary hover:bg-background hover:text-text'
                }`
              }
            >
              Account
            </NavLink>
            <button
              onClick={() => {
                setMobileMenuOpen(false)
                handleLogout()
              }}
              className="w-full text-left px-3 py-2.5 rounded text-sm font-medium text-danger hover:bg-background transition-colors"
            >
              Log Out
            </button>
            <div className="text-center px-3 py-3 text-xs text-text-light">
              by Almuzky
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/20 z-30"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-y-auto pt-14 lg:pt-0">
        <div className="p-4 sm:p-6 lg:p-8 max-w-4xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
