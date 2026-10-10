import DashboardLayout from './components/layout/DashboardLayout'
import DashboardHomeRouter from './pages/DashboardHomeRouter'
import { Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import WeighingPage from './pages/WeighingPage'
import PalletsPage from './pages/PalletsPage'
import GradingPage from './pages/GradingPage'
import LabelsPage from './pages/LabelsPage'
import StockInPage from './pages/StockInPage'
import StockOutPage from './pages/StockOutPage'
import PackagingPage from './pages/PackagingPage'
import DeliveriesPage from './pages/DeliveriesPage'
import MyDeliveriesPage from './pages/MyDeliveriesPage'
import FarmerProfilePage from './pages/FarmerProfilePage'
import TraceabilityPage from './pages/TraceabilityPage'
import PublicTraceabilityPage from './pages/PublicTraceabilityPage'
import UsersPage from './pages/UsersPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'
import { useAuth } from './hooks/useAuth'
import Icon from './components/shared/Icon'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
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

  return <>{children}</>
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/traceability" element={<PublicTraceabilityPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardHomeRouter />} />
        <Route path="weighing" element={<WeighingPage />} />
        <Route path="pallets" element={<PalletsPage />} />
        <Route path="grading" element={<GradingPage />} />
        <Route path="labels" element={<LabelsPage />} />
        <Route path="stock-in" element={<StockInPage />} />
        <Route path="stock-out" element={<StockOutPage />} />
        <Route path="packaging" element={<PackagingPage />} />
        <Route path="deliveries" element={<DeliveriesPage />} />
        <Route path="my-deliveries" element={<MyDeliveriesPage />} />
        <Route path="profile" element={<FarmerProfilePage />} />
        <Route path="traceability" element={<TraceabilityPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
