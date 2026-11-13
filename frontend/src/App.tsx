import DashboardLayout from './components/layout/DashboardLayout'
import DashboardHomeRouter from './pages/DashboardHomeRouter'
import { Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import WeighingPage from './pages/WeighingPage'
import SortingPage from './pages/SortingPage'
import WarehousePage from './pages/WarehousePage'
import PackagingPage from './pages/PackagingPage'
import DeliveriesPage from './pages/DeliveriesPage'
import MyDeliveriesPage from './pages/MyDeliveriesPage'
import FarmerProfilePage from './pages/FarmerProfilePage'
import FarmerQRPage from './pages/FarmerQRPage'
import TraceabilityPage from './pages/TraceabilityPage'
import PublicTraceabilityPage from './pages/PublicTraceabilityPage'
import UsersPage from './pages/UsersPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'
import { useAuth } from './hooks/useAuth'
import Icon from './components/shared/Icon'

function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode
  allowedRoles?: ('ADMIN' | 'OPERATOR' | 'FARMER')[]
}) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
        <Icon name="leaf" size={28} className="text-accent" />
        <p className="t-small text-text-secondary">Loading workspace…</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/traceability" element={<PublicTraceabilityPage />} />
      <Route path="/traceability/:code" element={<PublicTraceabilityPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardHomeRouter />} />
        <Route
          path="weighing"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'OPERATOR']}>
              <WeighingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="pallets"
          element={<Navigate to="/dashboard/settings?section=pallets" replace />}
        />
        <Route
          path="sorting"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'OPERATOR']}>
              <SortingPage />
            </ProtectedRoute>
          }
        />
        <Route path="grading" element={<Navigate to="/dashboard/sorting" replace />} />
        <Route
          path="warehouse"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'OPERATOR']}>
              <WarehousePage />
            </ProtectedRoute>
          }
        />
        <Route path="labels" element={<Navigate to="/dashboard/packaging" replace />} />
        <Route path="stock-in" element={<Navigate to="/dashboard/warehouse?zone=buffer" replace />} />
        <Route path="stock-out" element={<Navigate to="/dashboard/warehouse?zone=finished" replace />} />
        <Route
          path="packaging"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'OPERATOR']}>
              <PackagingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="deliveries"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'OPERATOR']}>
              <DeliveriesPage />
            </ProtectedRoute>
          }
        />
        <Route path="my-deliveries" element={<MyDeliveriesPage />} />
        <Route path="profile" element={<FarmerProfilePage />} />
        <Route path="farmer-qr" element={<FarmerQRPage />} />
        <Route path="traceability" element={<TraceabilityPage />} />
        <Route
          path="users"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="reports"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <ReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="settings"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'OPERATOR']}>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
