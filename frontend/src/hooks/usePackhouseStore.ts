import { useState, useEffect, useCallback } from 'react'
import { api } from '../services/api'

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

const STORAGE_KEY = 'enyx_packhouse_store_v2'

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
        bufferWarings: parsed.bufferWarings || [],
        sortedBatches: parsed.sortedBatches || [],
        finishedStock: parsed.finishedStock || [],
        deliveries: parsed.deliveries || [],
      }
    }
  } catch {
    // fallback
  }
  return {
    bufferWarings: [],
    sortedBatches: [],
    finishedStock: [],
    deliveries: [],
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

  // Sync with backend API on mount
  const syncWithBackend = useCallback(async () => {
    try {
      const [waringsRes, batchesRes, packagingRes, deliveriesRes] = await Promise.allSettled([
        api.weighing.list(),
        api.sorting.batches(),
        api.packaging.records(),
        api.deliveries.list(),
      ])

      const nextStore: StoreData = {
        bufferWarings: [],
        sortedBatches: [],
        finishedStock: [],
        deliveries: [],
      }

      if (waringsRes.status === 'fulfilled' && Array.isArray(waringsRes.value)) {
        nextStore.bufferWarings = waringsRes.value.map((w: any) => ({
          id: w.id,
          code: w.code,
          farmerId: w.farmer?.id,
          farmerName: w.farmer?.name || 'Ahmad Santoso',
          farmerVillage: w.farmer?.village || 'Desa Sumber Brantas',
          grossWeightKg: Number(w.grossWeightKg),
          intakeTime: new Date(w.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          date: new Date(w.createdAt).toISOString().slice(0, 10),
          status: w.status === 'SORTED' ? 'SORTED' : 'BUFFER_WAITING',
        }))
      }

      if (batchesRes.status === 'fulfilled' && Array.isArray(batchesRes.value)) {
        nextStore.sortedBatches = batchesRes.value.map((b: any) => ({
          id: b.id,
          palletCode: b.pallets?.[0]?.code || b.batchCode,
          waringCode: b.waring?.code || '',
          farmerName: b.waring?.farmer?.name || 'Ahmad Santoso',
          farmerVillage: b.waring?.farmer?.village || 'Desa Sumber Brantas',
          grossIntakeKg: Number(b.grossWeightKg),
          washingRecord: b.washingRecord,
          gradeAKg: Number(b.gradeAKg),
          gradeAPalletQr: b.pallets?.find((p: any) => p.grade?.code === 'A')?.code || 'PLT-GRD-A',
          gradeBKg: Number(b.gradeBKg),
          gradeBPalletQr: b.pallets?.find((p: any) => p.grade?.code === 'B')?.code || 'PLT-GRD-B',
          gradeCKg: Number(b.gradeCKg),
          gradeCPalletQr: b.pallets?.find((p: any) => p.grade?.code === 'C')?.code || 'PLT-GRD-C',
          totalGradedKg: Number(b.totalGradedKg),
          shrinkageKg: Number(b.shrinkageKg),
          shrinkagePct: Number(b.shrinkagePct),
          timestamp: new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }))
      }

      if (packagingRes.status === 'fulfilled' && Array.isArray(packagingRes.value)) {
        nextStore.finishedStock = packagingRes.value.map((p: any) => ({
          id: p.id,
          code: p.unitCode,
          packageType: (p.packageType?.name || '1 kg Pouch') as any,
          mode: p.packageType?.category === 'BULK' ? 'BULK_EXPORT' : 'RETAIL_POUCH',
          grade: (p.pallet?.grade?.code || 'A') as any,
          units: 1,
          weightKg: Number(p.netWeightKg),
          totalWeightKg: Number(p.netWeightKg),
          packedTime: new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          storageLocation: p.storageLocation || 'Finished Goods Bay',
        }))
      }

      if (deliveriesRes.status === 'fulfilled' && Array.isArray(deliveriesRes.value)) {
        nextStore.deliveries = deliveriesRes.value.map((d: any) => ({
          id: d.id,
          truckPlate: d.truckPlate,
          destination: d.destination,
          driver: d.driverName,
          units: d.items?.reduce((acc: number, it: any) => acc + (it.quantity || 1), 0) || 0,
          grade: 'A',
          status: d.status,
          time: new Date(d.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          date: new Date(d.createdAt).toISOString().slice(0, 10),
        }))
      }

      persist(nextStore)
    } catch {
      // Backend offline or unreachable: keep local store
    }
  }, [persist])

  useEffect(() => {
    syncWithBackend()
  }, [syncWithBackend])

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

      // Backend sync
      api.weighing
        .create({
          farmerCode: waring.farmerId || 'FMR-001',
          grossWeightKg: waring.grossWeightKg,
        })
        .catch(() => {})

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
      const updatedWarings = store.bufferWarings.map((item) =>
        item.code === batch.waringCode ? { ...item, status: 'SORTED' as const } : item,
      )
      persist({
        ...store,
        bufferWarings: updatedWarings,
        sortedBatches: [newBatch, ...store.sortedBatches],
      })

      // Backend sync
      api.sorting
        .process({
          waringCode: batch.waringCode,
          washingRecord: batch.washingRecord,
          grades: [
            { gradeCode: 'A', weightKg: batch.gradeAKg, palletCode: batch.gradeAPalletQr },
            { gradeCode: 'B', weightKg: batch.gradeBKg, palletCode: batch.gradeBPalletQr },
            { gradeCode: 'C', weightKg: batch.gradeCKg, palletCode: batch.gradeCPalletQr },
          ].filter((g) => g.weightKg > 0),
        })
        .catch(() => {})

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

      // Backend sync
      api.packaging
        .pack({
          palletCode: pkg.code,
          packageTypeCode: pkg.mode === 'BULK_EXPORT' ? 'CARTON-10KG' : 'POUCH-1KG',
          quantity: pkg.units,
          totalNetWeightKg: pkg.totalWeightKg,
          storageLocation: pkg.storageLocation,
        })
        .catch(() => {})

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
      bufferWarings: [],
      sortedBatches: [],
      finishedStock: [],
      deliveries: [],
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
    syncWithBackend,
  }
}
