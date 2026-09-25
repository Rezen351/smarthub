import { useState } from 'react'
import Card from '../components/shared/Card'

export default function UsersPage() {
  const [users] = useState([
    { id: '1', name: 'Admin', email: 'admin@enyx.local', role: 'ADMIN' },
    { id: '2', name: 'Weighing Operator', email: 'weighing@enyx.local', role: 'WEIGHING_OPERATOR' },
    { id: '3', name: 'Sorting Operator', email: 'sorting@enyx.local', role: 'SORTING_OPERATOR' },
    { id: '4', name: 'Warehouse Operator', email: 'warehouse@enyx.local', role: 'WAREHOUSE_OPERATOR' },
    { id: '5', name: 'Delivery Operator', email: 'delivery@enyx.local', role: 'DELIVERY_OPERATOR' },
    { id: '6', name: 'Farmer', email: 'farmer@enyx.local', role: 'FARMER' },
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Users</h1>
        <p className="text-text-secondary mt-1">Manage system users and roles</p>
      </div>

      <Card>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className="badge badge-info">{u.role}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
