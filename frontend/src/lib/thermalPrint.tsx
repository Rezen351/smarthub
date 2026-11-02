import { api } from '../services/api'

export type ThermalPrinterStation = 'reception' | 'packaging'

export interface ThermalPrintJob {
  type: 'receipt' | 'waring' | 'pouch' | 'export'
  code: string
  farmerName?: string
  farmerId?: string
  grade?: 'A' | 'B' | 'C'
  weightKg?: number
  date?: string
  time?: string
  stationName?: string
}

export async function printThermal(
  jobs: ThermalPrintJob | ThermalPrintJob[],
  station: ThermalPrinterStation,
  onComplete?: (error?: unknown) => void,
) {
  try {
    await api.printers.print(station, Array.isArray(jobs) ? jobs : [jobs])
    onComplete?.()
  } catch (error) {
    console.error('Thermal print failed:', error)
    onComplete?.(error)
  }
}
