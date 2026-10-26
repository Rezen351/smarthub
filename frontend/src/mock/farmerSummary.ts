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
  farmerId: 'FMR-001',
  farmerName: 'Ahmad Santoso',
  totalDeposited: 0,
  commodities: [
    {
      commodityId: 'cmd-001',
      commodityName: 'Kentang Granola',
      commodityCode: '001',
      unit: 'kg',
      totalKg: 0,
    },
  ],
}

