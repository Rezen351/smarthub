import { useState, useEffect, useCallback } from 'react'

export interface BufferWaringItem {
  id: string
  code: string
  farmerId?: string
  farmerName: string
  farmerVillage?: string
  grossWeightKg: number
  intakeTime: string
  date: string
  status: 'BUFFER_WAITING' | 'SORTED'
}

export interface GradedBatchRecord {
  id: string
  palletCode: string
  waringCode: string
  farmerName: string
  farmerVillage?: string
  grossIntakeKg: number
  washingRecord: 'WASHED' | 'UNWASHED'
  gradeAKg: number
  gradeAPalletQr: string
  gradeBKg: number
  gradeBPalletQr: string
  gradeCKg: number
  gradeCPalletQr: string
  totalGradedKg: number
  shrinkageKg: number
  shrinkagePct: number
  timestamp: string
}

export interface FinishedStockItem {
  id: string
  code: string
  packageType: '1 kg Pouch' | '10 kg Export Carton' | '50 kg Export Carton'
  mode: 'RETAIL_POUCH' | 'BULK_EXPORT'
  grade: 'A' | 'B' | 'C'
  units: number
  weightKg: number
  totalWeightKg: number
  packedTime: string
  storageLocation: string
}

export interface DeliveryRecord {
  id: string
  truckPlate: string
  destination: string
  driver: string
  units: number
  grade?: string
  status: 'LOADING' | 'READY' | 'DEPARTED' | 'DELIVERED'
  time: string
  date: string
}

const STORAGE_KEY = 'enyx_packhouse_store'

const SEED_BUFFER_WARINGS: BufferWaringItem[] = [
  {
    id: 'w-1',
    code: 'WRG-20261026-0001',
    farmerId: 'farmer-1',
    farmerName: 'Ahmad Santoso',
    farmerVillage: 'Dieng, Wonosobo',
    grossWeightKg: 45.5,
    intakeTime: '08:15',
    date: '2026-10-26',
    status: 'BUFFER_WAITING',
  },
  {
    id: 'w-2',
    code: 'WRG-20261026-0002',
    farmerId: 'farmer-1',
    farmerName: 'Ahmad Santoso',
    farmerVillage: 'Dieng, Wonosobo',
    grossWeightKg: 48.0,
    intakeTime: '08:25',
    date: '2026-10-26',
    status: 'BUFFER_WAITING',
  },
  {
    id: 'w-3',
    code: 'WRG-20261026-0003',
    farmerId: 'farmer-2',
    farmerName: 'Budi Prasetyo',
    farmerVillage: 'Berastagi, Karo',
    grossWeightKg: 52.2,
    intakeTime: '08:40',
    date: '2026-10-26',
    status: 'BUFFER_WAITING',
  },
  {
    id: 'w-4',
    code: 'WRG-20261026-0004',
    farmerId: 'farmer-3',
    farmerName: 'Siti Rahayu',
    farmerVillage: 'Pangalengan, Bandung',
    grossWeightKg: 41.0,
    intakeTime: '09:05',
    date: '2026-10-26',
    status: 'BUFFER_WAITING',
  },
]

const SEED_GRADED_BATCHES: GradedBatchRecord[] = [
  {
    id: 'b-1',
    palletCode: 'PLT-20261026-0001',
    waringCode: 'WRG-20261025-0001',
    farmerName: 'Ahmad Santoso',
    farmerVillage: 'Dieng, Wonosobo',
    grossIntakeKg: 50.0,
    washingRecord: 'WASHED',
    gradeAKg: 22.5,
    gradeAPalletQr: 'PLT-GRD-A-01',
    gradeBKg: 15.0,
    gradeBPalletQr: 'PLT-GRD-B-01',
    gradeCKg: 8.5,
    gradeCPalletQr: 'PLT-GRD-C-01',
    totalGradedKg: 46.0,
    shrinkageKg: 4.0,
    shrinkagePct: 8.0,
    timestamp: '09:30',
  },
]

const SEED_FINISHED_STOCK: FinishedStockItem[] = [
  {
    id: 'f-1',
    code: 'PCH-20261026-0001',
    packageType: '1 kg Pouch',
    mode: 'RETAIL_POUCH',
    grade: 'A',
    units: 120,
    weightKg: 1.0,
    totalWeightKg: 120.0,
    packedTime: '10:05',
    storageLocation: 'Rack A-01',
  },
  {
    id: 'f-2',
    code: 'EXP-20261026-0001',
    packageType: '10 kg Export Carton',
    mode: 'BULK_EXPORT',
    grade: 'A',
    units: 15,
    weightKg: 10.0,
    totalWeightKg: 150.0,
    packedTime: '10:20',
    storageLocation: 'Pallet Bay 03',
  },
  {
    id: 'f-3',
    code: 'PCH-20261026-0002',
    packageType: '1 kg Pouch',
    mode: 'RETAIL_POUCH',
    grade: 'B',
    units: 85,
    weightKg: 1.0,
    totalWeightKg: 85.0,
    packedTime: '10:45',
    storageLocation: 'Rack B-02',
  },
]

const SEED_DELIVERIES: DeliveryRecord[] = [
  {
    id: 'd-1',
    truckPlate: 'B 1234 XYZ',
    destination: 'Jakarta Central Distribution Hub',
    driver: 'Ahmad Subandi',
    units: 40,
    grade: 'A',
    status: 'LOADING',
    time: '10:15',
    date: '2026-10-26',
  },
  {
    id: 'd-2',
    truckPlate: 'B 5678 ABC',
    destination: 'Surabaya Wholesale Mart',
    driver: 'Budi Santoso',
    units: 20,
    grade: 'A',
    status: 'READY',
    time: '09:40',
    date: '2026-10-26',
  },
  {
    id: 'd-3',
    truckPlate: 'B 9012 DEF',
    destination: 'Semarang Cold Storage',
    driver: 'Citra Permata',
    units: 30,
    grade: 'B',
    status: 'DEPARTED',
    time: '08:50',
    date: '2026-10-26',
  },
]

interface StoreData {
  bufferWarings: BufferWaringItem[]
  sortedBatches: GradedBatchRecord[]
  finishedStock: FinishedStockItem[]
  deliveries: DeliveryRecord[]
}

function loadInitialStore(): StoreData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoreData>
      return {
        bufferWarings: parsed.bufferWarings?.length ? parsed.bufferWarings : SEED_BUFFER_WARINGS,
        sortedBatches: parsed.sortedBatches?.length ? parsed.sortedBatches : SEED_GRADED_BATCHES,
        finishedStock: parsed.finishedStock?.length ? parsed.finishedStock : SEED_FINISHED_STOCK,
        deliveries: parsed.deliveries?.length ? parsed.deliveries : SEED_DELIVERIES,
      }
    }
  } catch {
    // fallback
  }
  return {
    bufferWarings: SEED_BUFFER_WARINGS,
    sortedBatches: SEED_GRADED_BATCHES,
    finishedStock: SEED_FINISHED_STOCK,
    deliveries: SEED_DELIVERIES,
  }
}

export function usePackhouseStore() {
  const [store, setStore] = useState<StoreData>(() => loadInitialStore())

  const persist = useCallback((next: StoreData) => {
    setStore(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // storage quota or private mode
    }
  }, [])

  // Listen to cross-tab/window storage events
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          setStore(JSON.parse(e.newValue))
        } catch {
          // ignore
        }
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  /* ── 1. Reception / Intake Actions ── */
  const addBufferWaring = useCallback(
    (waring: Omit<BufferWaringItem, 'id'>) => {
      const newItem: BufferWaringItem = {
        ...waring,
        id: `w-${Date.now()}`,
      }
      persist({
        ...store,
        bufferWarings: [newItem, ...store.bufferWarings],
      })
      return newItem
    },
    [persist, store],
  )

  /* ── 2. Sorting Actions ── */
  const markWaringSorted = useCallback(
    (waringCode: string) => {
      const updated = store.bufferWarings.map((item) =>
        item.code === waringCode ? { ...item, status: 'SORTED' as const } : item,
      )
      persist({
        ...store,
        bufferWarings: updated,
      })
    },
    [persist, store],
  )

  const addSortedBatch = useCallback(
    (batch: Omit<GradedBatchRecord, 'id'>) => {
      const newBatch: GradedBatchRecord = {
        ...batch,
        id: `b-${Date.now()}`,
      }
      // Also mark waring as sorted if code matches
      const updatedWarings = store.bufferWarings.map((item) =>
        item.code === batch.waringCode ? { ...item, status: 'SORTED' as const } : item,
      )
      persist({
        ...store,
        bufferWarings: updatedWarings,
        sortedBatches: [newBatch, ...store.sortedBatches],
      })
      return newBatch
    },
    [persist, store],
  )

  /* ── 3. Packaging Actions ── */
  const addFinishedPackage = useCallback(
    (pkg: Omit<FinishedStockItem, 'id'>) => {
      const newPkg: FinishedStockItem = {
        ...pkg,
        id: `f-${Date.now()}`,
      }
      persist({
        ...store,
        finishedStock: [newPkg, ...store.finishedStock],
      })
      return newPkg
    },
    [persist, store],
  )

  /* ── 4. Delivery & Dispatch Actions ── */
  const addDelivery = useCallback(
    (delivery: Omit<DeliveryRecord, 'id'>) => {
      const newDelivery: DeliveryRecord = {
        ...delivery,
        id: `d-${Date.now()}`,
      }
      persist({
        ...store,
        deliveries: [newDelivery, ...store.deliveries],
      })
      return newDelivery
    },
    [persist, store],
  )

  const departDelivery = useCallback(
    (deliveryId: string) => {
      const target = store.deliveries.find((d) => d.id === deliveryId)
      if (!target) return

      const updatedDeliveries = store.deliveries.map((d) =>
        d.id === deliveryId ? { ...d, status: 'DEPARTED' as const } : d,
      )

      // Deduct target units from first available finished stock matching grade
      let remainingDeduct = target.units
      const updatedStock = store.finishedStock
        .map((stock) => {
          if (remainingDeduct <= 0) return stock
          const matchGrade = !target.grade || stock.grade === target.grade
          if (!matchGrade) return stock

          const deduct = Math.min(stock.units, remainingDeduct)
          remainingDeduct -= deduct
          const newUnits = stock.units - deduct
          return {
            ...stock,
            units: newUnits,
            totalWeightKg: Number((newUnits * stock.weightKg).toFixed(1)),
          }
        })
        .filter((stock) => stock.units > 0)

      persist({
        ...store,
        deliveries: updatedDeliveries,
        finishedStock: updatedStock,
      })
    },
    [persist, store],
  )

  const markDeliveryReady = useCallback(
    (deliveryId: string) => {
      const updatedDeliveries = store.deliveries.map((d) =>
        d.id === deliveryId ? { ...d, status: 'READY' as const } : d,
      )
      persist({
        ...store,
        deliveries: updatedDeliveries,
      })
    },
    [persist, store],
  )

  /* Reset all to clean defaults */
  const resetToDefaults = useCallback(() => {
    persist({
      bufferWarings: SEED_BUFFER_WARINGS,
      sortedBatches: SEED_GRADED_BATCHES,
      finishedStock: SEED_FINISHED_STOCK,
      deliveries: SEED_DELIVERIES,
    })
  }, [persist])

  return {
    bufferWarings: store.bufferWarings,
    waitingWarings: store.bufferWarings.filter((w) => w.status === 'BUFFER_WAITING'),
    sortedBatches: store.sortedBatches,
    finishedStock: store.finishedStock,
    deliveries: store.deliveries,
    addBufferWaring,
    markWaringSorted,
    addSortedBatch,
    addFinishedPackage,
    addDelivery,
    markDeliveryReady,
    departDelivery,
    resetToDefaults,
  }
}
