export interface Delivery {
  id: string
  date: string
  truckPlate: string
  destination: string
  status: 'In Transit' | 'Delivered'
  commodityId?: string
  driverName?: string
  departedAt?: string
  createdAt: string
}

export const myDeliveries: Delivery[] = [
  {
    id: 'delivery-1',
    date: '2026-09-14',
    truckPlate: 'B1234XYZ',
    destination: 'Jakarta',
    status: 'In Transit',
    commodityId: 'commodity-1',
    driverName: 'Budi Santoso',
    departedAt: '2026-09-14T08:00:00.000Z',
    createdAt: '2026-09-14T08:00:00.000Z',
  },
  {
    id: 'delivery-2',
    date: '2026-09-13',
    truckPlate: 'B5678ABC',
    destination: 'Surabaya',
    status: 'Delivered',
    commodityId: 'commodity-2',
    driverName: 'Siti Aminah',
    departedAt: '2026-09-13T07:30:00.000Z',
    createdAt: '2026-09-13T07:30:00.000Z',
  },
  {
    id: 'delivery-3',
    date: '2026-09-12',
    truckPlate: 'B9012DEF',
    destination: 'Bandung',
    status: 'Delivered',
    commodityId: 'commodity-3',
    driverName: 'Ahmad Rizki',
    departedAt: '2026-09-12T09:15:00.000Z',
    createdAt: '2026-09-12T09:15:00.000Z',
  },
]
