export const RECEPTION_TARE_KG = 1.2
export const receptionKg = (value: number) => Math.round(value * 1000) / 1000

export interface ReceptionCapture {
  captureId: string
  grossWeightKg: number
  capturedAt: string
}

export interface ReceptionBatch {
  id: string
  code: string
  farmerCode: string
  farmerName: string
  createdAt: string
  items: (ReceptionCapture & {
    id: string
    code: string
    tareWeightKg: number
    netWeightKg: number
    cancelled?: boolean
  })[]
  grossWeightKg: number
  tareWeightKg: number
  netWeightKg: number
}

export interface ReceptionDraft {
  id: string
  farmerCode: string
  farmerName: string
  items: ReceptionCapture[]
  weight: string
  editingId?: string | null
  pending?: boolean
  saved?: ReceptionBatch
}

export const receptionDraftKey = (operatorId: string) => `smartgeulis.reception.${operatorId}`

export function readReceptionDraft(operatorId: string): ReceptionDraft | null {
  try {
    const raw = sessionStorage.getItem(receptionDraftKey(operatorId))
    if (!raw) return null
    const draft = JSON.parse(raw) as ReceptionDraft
    if (!draft.id || !draft.farmerCode || !draft.farmerName || !Array.isArray(draft.items) || typeof draft.weight !== 'string') return null
    if (draft.items.some((item) => !item.captureId || !Number.isFinite(item.grossWeightKg) || item.grossWeightKg <= RECEPTION_TARE_KG || !Number.isFinite(Date.parse(item.capturedAt)))) return null
    return draft
  } catch {
    return null
  }
}

export function appendReceptionWeight(draft: ReceptionDraft, weight: string, capacity: number, editingId?: string | null): ReceptionDraft {
  if (draft.pending || draft.saved) throw new Error('This session is already being saved.')
  const grossWeightKg = receptionKg(Number(weight))
  if (!weight.trim() || !Number.isFinite(grossWeightKg) || grossWeightKg <= RECEPTION_TARE_KG) {
    throw new Error('Gross weight must exceed 1.2 kg.')
  }
  if (!(capacity > 0) || grossWeightKg > capacity) throw new Error('Weight exceeds Reception scale capacity.')
  if (editingId && !draft.items.some((item) => item.captureId === editingId)) throw new Error('Waring no longer exists in this draft.')
  const item = { captureId: editingId || crypto.randomUUID(), grossWeightKg, capturedAt: new Date().toISOString() }
  return {
    ...draft,
    weight: '',
    editingId: null,
    items: editingId ? draft.items.map((current) => current.captureId === editingId ? item : current) : [...draft.items, item],
  }
}

export function receptionTotals(items: ReceptionCapture[]) {
  const grossWeightKg = receptionKg(items.reduce((total, item) => total + item.grossWeightKg, 0))
  const tareWeightKg = receptionKg(items.length * RECEPTION_TARE_KG)
  return { grossWeightKg, tareWeightKg, netWeightKg: receptionKg(grossWeightKg - tareWeightKg) }
}

/** One stable fill per empty-to-loaded scale cycle. Assign remains an operator action. */
export class ReceptionWeightCapture {
  waitingForEmpty = true
  private emptySamples = 0
  private stableSamples: number[] = []
  private filled = false

  disconnect() {
    this.waitingForEmpty = true
    this.emptySamples = 0
    this.stableSamples = []
  }

  accept(sample: { online?: boolean; isStable?: boolean; weightKg?: number; timestamp?: string }, capacity: number, toleranceGrams = 20): number | null {
    const value = Number(sample.weightKg)
    const at = Date.parse(sample.timestamp ?? '')
    const tolerance = Number.isFinite(toleranceGrams) && toleranceGrams > 0 ? toleranceGrams / 1000 : 0.02
    if (sample.online !== true || !Number.isFinite(value) || !Number.isFinite(at) || Math.abs(Date.now() - at) > 2500) {
      this.disconnect()
      return null
    }
    if (this.filled) return null
    if (this.waitingForEmpty) {
      this.emptySamples = Math.abs(value) <= tolerance ? this.emptySamples + 1 : 0
      if (this.emptySamples >= 2) this.waitingForEmpty = false
      return null
    }
    if (sample.isStable !== true || value <= RECEPTION_TARE_KG || value > capacity || !(capacity > 0)) {
      this.stableSamples = []
      return null
    }
    this.stableSamples.push(value)
    this.stableSamples = this.stableSamples.slice(-3)
    if (Math.max(...this.stableSamples) - Math.min(...this.stableSamples) > tolerance) {
      this.stableSamples = [value]
      return null
    }
    if (this.stableSamples.length < 3) return null
    this.filled = true
    return receptionKg(value)
  }
}
