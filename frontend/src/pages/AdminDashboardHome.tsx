import { useAuth } from '../hooks/useAuth'
import Card from '../components/shared/Card'

export default function AdminDashboardHome() {
  const { user } = useAuth()

  const stats = [
    { label: 'Total Users', value: '24' },
    { label: 'Active Today', value: '18' },
    { label: 'System Status', value: 'Online' },
  ]

  const quickActions = [
    { label: 'Manage Users', path: '/dashboard/users', icon: '👥' },
    { label: 'View Reports', path: '/dashboard/reports', icon: '📊' },
    { label: 'Settings', path: '/dashboard/settings', icon: '⚙️' },
  ]

  const activities = [
    { time: '10:30', action: 'New user registered: operator@enyx.local', type: 'user' },
    { time: '09:15', action: 'System backup completed', type: 'system' },
    { time: '08:00', action: 'Daily report generated', type: 'report' },
  ]

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <p className="text-sm text-text-secondary mb-1">Welcome back,</p>
        <h1 className="text-2xl font-bold text-text">{user?.name}</h1>
      </div>

      <Card>
        <h3 className="card-title mb-4">System Overview</h3>
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
        <h2 className="text-lg font-semibold text-text mb-3">Recent Activity</h2>
        <Card>
          <div className="space-y-4">
            {activities.map((activity, i) => (
              <div key={i} className="flex items-center justify-between pb-4 border-b border-border last:border-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-background rounded-sm flex items-center justify-center text-lg">
                    {activity.type === 'user' ? '👤' : activity.type === 'system' ? '⚙️' : '📊'}
                  </div>
                  <div>
                    <div className="font-medium text-text text-sm">{activity.action}</div>
                    <div className="text-xs text-text-secondary">{activity.time}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
