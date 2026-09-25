import Card from '../components/shared/Card'

export default function ReportsPage() {
  const stats = [
    { label: 'Total Farmers', value: '128' },
    { label: 'Total Pallets', value: '1,245' },
    { label: 'Total Weighing (kg)', value: '45,670' },
    { label: 'Total Deliveries', value: '89' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Reports</h1>
        <p className="text-text-secondary mt-1">System-wide statistics and reports</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <div className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">{stat.label}</div>
            <div className="text-2xl font-bold text-text">{stat.value}</div>
          </Card>
        ))}
      </div>

      <Card>
        <h3 className="card-title mb-4">Weekly Weighing Report</h3>
        <div className="h-64 flex items-center justify-center border border-border rounded-sm bg-background">
          <p className="text-text-secondary text-sm">Chart placeholder - integrate chart library here</p>
        </div>
      </Card>
    </div>
  )
}
