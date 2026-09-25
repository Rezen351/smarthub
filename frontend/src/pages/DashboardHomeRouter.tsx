import { useAuth } from '../hooks/useAuth'
import DashboardHome from './DashboardHome'
import FarmerDashboardHome from './FarmerDashboardHome'
import AdminDashboardHome from './AdminDashboardHome'
import WeighingDashboardHome from './WeighingDashboardHome'
import SortingDashboardHome from './SortingDashboardHome'
import WarehouseDashboardHome from './WarehouseDashboardHome'
import DeliveryDashboardHome from './DeliveryDashboardHome'

function DashboardHomeRouter() {
  const { user } = useAuth()

  switch (user?.role) {
    case 'FARMER':
      return <FarmerDashboardHome />
    case 'ADMIN':
      return <AdminDashboardHome />
    case 'WEIGHING_OPERATOR':
      return <WeighingDashboardHome />
    case 'SORTING_OPERATOR':
      return <SortingDashboardHome />
    case 'WAREHOUSE_OPERATOR':
      return <WarehouseDashboardHome />
    case 'DELIVERY_OPERATOR':
      return <DeliveryDashboardHome />
    default:
      return <DashboardHome />
  }
}

export default DashboardHomeRouter
