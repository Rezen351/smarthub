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

export const myDeliveries: Delivery[] = []

