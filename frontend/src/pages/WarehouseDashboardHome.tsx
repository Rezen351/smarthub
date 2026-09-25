import { useAuth } from '../hooks/useAuth'
import Card from '../components/shared/Card'

export default function WarehouseDashboardHome() {
  const { user } = useAuth()

  const stats = [
    { label: 'Total Stock', value: '2,340' },
    { label: 'Capacity', value: '78%' },
    { label: 'Pending', value: '3' },
  ]

  const quickActions = [
    { label: 'Stock In', path: '/dashboard/stock-in', icon: '📥' },
    { label: 'Stock Out', path: '/dashboard/stock-out', icon: '📤' },
    { label: 'Reports', path: '/dashboard/reports', icon: '📊' },
  ]

  const activities = [
    { time: '09:30', action: 'Stock In: +10 pouch Grade A (Kentang)', type: 'in' },
    { time: '08:45', action: 'Stock Out: -50 kg Packaging (Tomat)', type: 'out' },
    { time: '08:00', action: 'Capacity alert: 78% used', type: 'alert' },
  ]

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <p className="text-sm text-text-secondary mb-1">Welcome back,</p>
        <h1 className="text-2xl font-bold text-text">{user?.name}</h1>
      </div>

      <Card>
        <h3 className="card-title mb-4">Today's Overview</h3>
        <div className="grid grid-cols-3 gap-4">
          {stats.map((item) => (
            <div key={item.label} className="bg-background border border-border p-4 rounded-sm">
              <div className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">{item.label}</div>
              <div className="text-xl font-bold text-text">{item.value}</div>
            </div>
          ))}
        </div>
      </Card>

      <div>
        <h2 className="text-lg font-semibold text-text mb-3">Quick Actions</h2>
        <div className="grid grid-cols-3 gap-4">
          {quickActions.map((action) => (
            <a
              key={action.label}
              href={action.path}
              className="bg-surface border border-border rounded-sm p-4 text-center hover:border-primary transition-colors"
            >
              <div className="text-2xl mb-2">{action.icon}</div>
              <div className="text-sm font-medium text-text">{action.label}</div>
            </a>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-text mb-3">Recent Movements</h2>
        <Card>
          <div className="space-y-4">
            {activities.map((activity, i) => (
              <div key={i} className="flex items-center justify-between pb-4 border-b border-border last:border-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-background rounded-sm flex items-center justify-center text-lg">
                    {activity.type === 'in' ? '📥' : activity.type === 'out' ? '📤' : '⚠️'}
                  </div>
                  <div>
                    <div className="font-medium text-text text-sm">{activity.action}</div>
                    <div className="text-xs text-text-secondary">{activity.time}</div>
                  </div>
                </div>
                <div className={`px-2 py-1 text-xs rounded-sm ${activity.type === 'in' ? 'badge-success' : activity.type === 'out' ? 'badge-danger' : 'badge-warning'}`}>
                  {activity.type === 'in' ? 'In' : activity.type === 'out' ? 'Out' : 'Alert'}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
