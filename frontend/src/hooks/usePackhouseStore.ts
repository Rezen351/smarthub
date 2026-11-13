import { useState, useEffect, useCallback } from 'react'
import { api } from '../services/api'
import { formatSafeDate, formatSafeTime } from '../lib/utils'

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
  date?: string
}

export interface FinishedStockItem {
  id: string
  code: string
  sourcePalletCode?: string
  packageType: '1 kg Pouch' | '10 kg Export Carton' | '50 kg Export Carton'
  mode: 'RETAIL_POUCH' | 'BULK_EXPORT'
  grade: 'A' | 'B' | 'C'
  units: number
  weightKg: number
  totalWeightKg: number
  packedTime: string
  date?: string
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

const STORAGE_KEY = 'smartgeulis_packhouse_store_v2'

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
          farmerId: w.farmerCode || w.farmer?.code || w.farmerId,
          farmerName: w.farmerName || w.farmer?.name || 'Farmer',
          farmerVillage: w.farmerVillage || w.farmer?.village || '',
          grossWeightKg: Number(w.grossWeightKg),
          intakeTime: formatSafeTime(w.createdAt || w.approvedAt),
          date: formatSafeDate(w.createdAt || w.approvedAt),
          status: w.status === 'SORTED' ? 'SORTED' : 'BUFFER_WAITING',
        }))
      }

      if (batchesRes.status === 'fulfilled' && Array.isArray(batchesRes.value)) {
        nextStore.sortedBatches = batchesRes.value.map((b: any) => {
          const gA = Number(b.gradeA_Kg ?? b.gradeAKg ?? 0)
          const gB = Number(b.gradeB_Kg ?? b.gradeBKg ?? 0)
          const gC = Number(b.gradeC_Kg ?? b.gradeCKg ?? 0)
          const totalGraded = b.totalGradedKg ? Number(b.totalGradedKg) : gA + gB + gC

          const pA = b.gradeA_PalletCode || (Array.isArray(b.pallets) && b.pallets[0]) || (gA > 0 ? 'PLT-001' : '')
          const pB = b.gradeB_PalletCode || (Array.isArray(b.pallets) && b.pallets[1]) || (gB > 0 ? 'PLT-002' : '')
          const pC = b.gradeC_PalletCode || (Array.isArray(b.pallets) && b.pallets[2]) || (gC > 0 ? 'PLT-003' : '')

          const combinedPallets = [pA, pB, pC].filter(Boolean)

          return {
            id: b.id,
            palletCode: combinedPallets.length > 0 ? combinedPallets.join(', ') : ((Array.isArray(b.pallets) && b.pallets.length > 0 ? b.pallets.join(', ') : b.batchCode) || 'PLT-BATCH'),
            waringCode: b.waringCode || b.waring?.code || '',
            farmerName: b.farmerName || b.waring?.farmer?.name || 'Farmer',
            farmerVillage: b.farmerVillage || b.waring?.farmer?.village || '',
            grossIntakeKg: Number(b.grossWeightKg),
            washingRecord: b.washDecision || b.washingRecord || 'WASHED',
            gradeAKg: gA,
            gradeAPalletQr: pA || 'PLT-001',
            gradeBKg: gB,
            gradeBPalletQr: pB || 'PLT-002',
            gradeCKg: gC,
            gradeCPalletQr: pC || 'PLT-003',
            totalGradedKg: totalGraded,
            shrinkageKg: Number(b.shrinkageKg ?? 0),
            shrinkagePct: Number(b.shrinkagePct ?? 0),
            timestamp: formatSafeTime(b.createdAt || b.sortedAt),
            date: formatSafeDate(b.createdAt || b.sortedAt),
          }
        })
      }

      if (packagingRes.status === 'fulfilled' && Array.isArray(packagingRes.value)) {
        nextStore.finishedStock = packagingRes.value.map((p: any) => ({
          id: p.id,
          code: p.code || p.unitCode,
          packageType: (p.format?.includes('Carton') || p.format === 'EXPORT_CARTON' ? '10 kg Export Carton' : '1 kg Pouch') as any,
          mode: p.format?.includes('Carton') || p.format === 'EXPORT_CARTON' ? 'BULK_EXPORT' : 'RETAIL_POUCH',
          grade: (p.grade || 'A') as any,
          units: 1,
          weightKg: Number(p.weightKg || p.netWeightKg || 1),
          totalWeightKg: Number(p.weightKg || p.netWeightKg || 1),
          packedTime: formatSafeTime(p.createdAt),
          date: formatSafeDate(p.createdAt),
          storageLocation: p.storageLocation || 'Finished Goods Bay',
        }))
      }

      if (deliveriesRes.status === 'fulfilled' && Array.isArray(deliveriesRes.value)) {
        nextStore.deliveries = deliveriesRes.value.map((d: any) => ({
          id: d.id,
          truckPlate: d.truckPlate,
          destination: d.destination,
          driver: d.driverName,
          units: Number(d.units || 0),
          grade: 'A',
          status: d.status,
          time: formatSafeTime(d.createdAt || d.departedAt),
          date: formatSafeDate(d.createdAt || d.departedAt),
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

  /* ── Sorting Actions ── */
  const addSortedBatch = useCallback(
    async (batch: Omit<GradedBatchRecord, 'id'>) => {
      const saved = await api.sorting.process({
        waringCode: batch.waringCode,
        washingRecord: batch.washingRecord,
        grades: [
          { gradeCode: 'A', weightKg: batch.gradeAKg, palletCode: batch.gradeAPalletQr },
          { gradeCode: 'B', weightKg: batch.gradeBKg, palletCode: batch.gradeBPalletQr },
          { gradeCode: 'C', weightKg: batch.gradeCKg, palletCode: batch.gradeCPalletQr },
        ].filter((g) => g.weightKg > 0),
      })
      if (!saved?.batchId) throw new Error('The server did not confirm the sorting batch.')
      const newBatch: GradedBatchRecord = {
        ...batch,
        id: saved.batchId,
        date: batch.date ?? new Date().toISOString().slice(0, 10),
      }
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

  return {
    bufferWarings: store.bufferWarings,
    waitingWarings: store.bufferWarings.filter((w) => w.status === 'BUFFER_WAITING'),
    sortedBatches: store.sortedBatches,
    finishedStock: store.finishedStock,
    deliveries: store.deliveries,
    addSortedBatch,
    syncWithBackend,
  }
}
