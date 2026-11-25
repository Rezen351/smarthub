export interface IntakeDraft {
  id: string
  farmerId: string
  farmerName: string
  commodityCode?: string
  commodityName?: string
  weightKg: number
  status: 'PENDING' | 'BUFFER_WAITING'
  waringCode?: string
}

interface IntakeRequest {
  requestId: string
  farmerCode: string
  commodityCode?: string
  grossWeightKg: number
  tareWeightKg: number
  netWeightKg: number
  notes: string
}

export async function saveReceptionIntake<T extends IntakeDraft>(
  draft: T,
  create: (request: IntakeRequest) => Promise<{ id: string; code: string; commodityCode?: string; commodityName?: string }>,
): Promise<T> {
  if (draft.waringCode) return draft
  if (!Number.isFinite(draft.weightKg) || draft.weightKg <= 0) {
    throw new Error('Capture a valid weight before saving.')
  }
  const saved = await create({
    requestId: draft.id,
    farmerCode: draft.farmerId,
    ...(draft.commodityCode ? { commodityCode: draft.commodityCode } : {}),
    grossWeightKg: draft.weightKg,
    tareWeightKg: 0,
    netWeightKg: draft.weightKg,
    notes: 'Station 01 Reception weighing',
  })
  if (!saved?.id || !saved?.code) throw new Error('The server did not confirm the saved record.')
  return {
    ...draft,
    id: saved.id,
    waringCode: saved.code,
    commodityCode: saved.commodityCode || draft.commodityCode,
    commodityName: saved.commodityName || draft.commodityName,
    status: 'BUFFER_WAITING',
  }
}

export interface ReceptionPrintJob {
  type: 'receipt' | 'waring'
  code: string
  farmerName: string
  farmerId: string
  commodity?: string
  weightKg: number
  date?: string
  time?: string
  items?: { code: string; weightKg: number }[]
}

export function buildReceptionPrintJobs(
  records: (IntakeDraft & { depositDate?: string; time?: string })[],
): ReceptionPrintJob[] {
  if (!records.length || records.length > 500) throw new Error('Print between 1 and 500 saved bags.')
  const first = records[0]
  const codes = new Set<string>()
  for (const record of records) {
    if (!record.waringCode || codes.has(record.waringCode) || record.farmerId !== first.farmerId ||
      (first.commodityCode && record.commodityCode && record.commodityCode !== first.commodityCode) ||
      !Number.isFinite(record.weightKg) || record.weightKg <= 0) {
      throw new Error('Print only saved bags from the same farmer and commodity.')
    }
    codes.add(record.waringCode)
  }
  const labels: ReceptionPrintJob[] = records.map((record) => ({
    type: 'waring', code: record.waringCode!, farmerName: record.farmerName,
    farmerId: record.farmerId, weightKg: record.weightKg,
    date: record.depositDate, time: record.time,
  }))
  return [{
    ...labels[0], type: 'receipt',
    ...(first.commodityName ? { commodity: first.commodityName } : {}),
    weightKg: Math.round(records.reduce((sum, record) => sum + Math.round(record.weightKg * 1000), 0)) / 1000,
    items: labels.map(({ code, weightKg }) => ({ code, weightKg })),
  }, ...labels]
}

export async function printReceptionSession(
  jobs: ReceptionPrintJob[],
  nextJob: number,
  send: (jobs: ReceptionPrintJob[]) => Promise<unknown>,
  onProgress: (nextJob: number) => void,
  pause: () => Promise<void>,
): Promise<void> {
  if (!Number.isInteger(nextJob) || nextJob < 0 || nextJob > jobs.length) {
    throw new Error('Invalid print progress.')
  }
  for (let index = nextJob; index < jobs.length; index++) {
    if (index > 0) await pause()
    await send([jobs[index]])
    onProgress(index + 1)
  }
}
