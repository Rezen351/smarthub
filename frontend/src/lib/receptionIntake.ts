export interface IntakeDraft {
  id: string
  farmerId: string
  farmerName: string
  weightKg: number
  status: 'PENDING' | 'BUFFER_WAITING'
  waringCode?: string
}

interface IntakeRequest {
  farmerCode: string
  grossWeightKg: number
  tareWeightKg: number
  netWeightKg: number
  notes: string
}

export async function saveReceptionIntake<T extends IntakeDraft>(
  draft: T,
  create: (request: IntakeRequest) => Promise<{ id: string; code: string }>,
): Promise<T> {
  if (draft.waringCode) return draft
  if (!Number.isFinite(draft.weightKg) || draft.weightKg <= 0) {
    throw new Error('Capture a valid weight before saving.')
  }
  const saved = await create({
    farmerCode: draft.farmerId,
    grossWeightKg: draft.weightKg,
    tareWeightKg: 1.2,
    netWeightKg: Math.max(0, draft.weightKg - 1.2),
    notes: 'Station 01 Reception weighing',
  })
  if (!saved?.id || !saved?.code) throw new Error('The server did not confirm the saved record.')
  return { ...draft, id: saved.id, waringCode: saved.code, status: 'BUFFER_WAITING' }
}
