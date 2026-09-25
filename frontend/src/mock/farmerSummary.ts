export interface FarmerSummary {
  farmerId: string
  farmerName: string
  totalDeposited: number
  commodities: {
    commodityId: string
    commodityName: string
    commodityCode: string
    unit: string
    totalKg: number
  }[]
}

export const farmerSummary: FarmerSummary = {
  farmerId: 'farmer-1',
  farmerName: 'Farmer',
  totalDeposited: 1245,
  commodities: [
    {
      commodityId: 'commodity-1',
      commodityName: 'Kentang',
      commodityCode: '001',
      unit: 'kg',
      totalKg: 780,
    },
    {
      commodityId: 'commodity-2',
      commodityName: 'Tomat',
      commodityCode: '002',
      unit: 'kg',
      totalKg: 315,
    },
    {
      commodityId: 'commodity-3',
      commodityName: 'Cabai',
      commodityCode: '003',
      unit: 'kg',
      totalKg: 150,
    },
  ],
}
