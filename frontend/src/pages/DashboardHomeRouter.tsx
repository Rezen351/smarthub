import { useAuth } from '../hooks/useAuth'
import DashboardHome from './DashboardHome'
import FarmerDashboardHome from './FarmerDashboardHome'
import AdminDashboardHome from './AdminDashboardHome'
import OperatorDashboardHome from './OperatorDashboardHome'

function DashboardHomeRouter() {
  const { user } = useAuth()

  switch (user?.role) {
    case 'FARMER':
      return <FarmerDashboardHome />
    case 'ADMIN':
      return <AdminDashboardHome />
    case 'OPERATOR':
      return <OperatorDashboardHome />
    default:
      return <DashboardHome />
  }
}

export default DashboardHomeRouter
