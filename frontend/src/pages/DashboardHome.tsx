import Card from '../components/shared/Card'

export default function DashboardHome() {
  const stats = [
    { label: 'Active Pallets', value: '24', change: '+3 today' },
    { label: "Today's Weighing", value: '156', change: 'kg processed' },
    { label: 'Pending Deliveries', value: '5', change: '2 urgent' },
    { label: 'Warehouse Capacity', value: '78%', change: '2,340 kg used' },
  ]

  const activities = [
    { time: '10:30', action: 'Pallet PLT-20260914-0001 created by Ahmad' },
    { time: '10:15', action: 'Weighing recorded: 45.5 kg - Grade A' },
    { time: '09:45', action: 'Pouch PCH-PLT-20260914-0001-001 created' },
    { time: '09:30', action: 'Warehouse stock updated: +10 pouch Grade A' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Dashboard</h1>
        <p className="text-text-secondary mt-1">Overview of your operations</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <div className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">{stat.label}</div>
            <div className="text-2xl font-bold text-text mb-1">{stat.value}</div>
            <div className="text-xs text-text-secondary">{stat.change}</div>
          </Card>
        ))}
      </div>

      <Card title="Recent Activity">
        <div className="space-y-3">
          {activities.map((activity, i) => (
            <div key={i} className="flex items-start gap-3 pb-3 border-b border-border last:border-0">
              <div className="text-xs text-text-secondary w-12 pt-0.5">{activity.time}</div>
              <div className="text-sm text-text">{activity.action}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
