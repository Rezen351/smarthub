/**
 * Weighing — Receiving Intake Station.
 *
 * Implements the revised pure intake weighing workflow with Focus Mode (Full Screen):
 *   Sequential 3-step workflow:
 *     1. Step 1: Farmer Identification (Scan barcode)
 *     2. Step 2: Harvest Weighing (Live gross scale reading via Modbus TCP RS485 indicator)
 *     3. Step 3: Save & Next Bag, or Finish & Print one receipt and all Waring labels.
 *
 * Weight transmitter network settings are managed in Settings.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import Icon from '../components/shared/Icon'
import { Input } from '../components/shared/Form'
import DataTable, { type Column } from '../components/shared/DataTable'
import PageHeader from '../components/shared/PageHeader'
import { useToast } from '../components/feedback/Toast'
import ScaleWeightInput from '../components/operator/ScaleWeightInput'
import LabelPreview from '../components/operator/LabelPreview'
import { saveReceptionIntake, buildReceptionPrintJobs, printReceptionSession } from '../lib/receptionIntake'
import { useSessionContext } from '../hooks/useSessionContext'
import { formatWeight, formatSafeDate, formatSafeTime } from '../lib/utils'
import { usePackhouseStore } from '../hooks/usePackhouseStore'
import { useAuth } from '../hooks/useAuth'
import { api, type Commodity, DEFAULT_COMMODITIES, getCommodityFamilyCode, getGeneralCommodityName } from '../services/api'
import CameraScannerModal from '../components/shared/CameraScannerModal'
import CancelTransactionModal from '../components/admin/CancelTransactionModal'

type WeighingStatus = 'PENDING' | 'BUFFER_WAITING'

type WeighingRecord = {
  id: string
  farmerId: string
  farmerName: string
  farmerVillage?: string
  commodityCode?: string
  commodityName?: string
  weightKg: number
  depositDate: string
  time: string
  status: WeighingStatus
  waringCode?: string
}

const FARMERS: any[] = []

const today = () => new Date().toISOString().slice(0, 10)

type ReceptionSession = { records: WeighingRecord[]; nextPrintJob: number; closed: boolean; draft?: WeighingRecord }
const emptySession = (): ReceptionSession => ({ records: [], nextPrintJob: 0, closed: false })
function readReceptionSession(key: string): ReceptionSession {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) || 'null')
    if (saved && Array.isArray(saved.records) && typeof saved.closed === 'boolean' &&
      Number.isInteger(saved.nextPrintJob) && saved.nextPrintJob >= 0 && saved.nextPrintJob <= saved.records.length + 1) {
      if (saved.records.length) buildReceptionPrintJobs(saved.records)
      return saved
    }
  } catch {
    // Saved intake records remain available in the ledger.
  }
  return emptySession()
}

const statusTone: Record<WeighingStatus, 'success' | 'warning'> = {
  BUFFER_WAITING: 'success',
  PENDING: 'warning',
}

const STEPS = [
  { id: 1, label: 'Farmer ID' },
  { id: 2, label: 'Weigh Harvest' },
  { id: 3, label: 'Review & Print' },
] as const

export default function WeighingPage() {
  const toast = useToast()
  const { farmer, active, startScan } = useSessionContext()
  const { syncWithBackend } = usePackhouseStore()
  const { user } = useAuth()
  const storageKey = `smartgeulis.reception-session.${user?.id || 'operator'}`
  const [receptionSession, setReceptionSession] = useState(() => readReceptionSession(storageKey))
  const sessionRef = useRef(receptionSession)
  const printingRef = useRef(false)
  const updateReceptionSession = (next: ReceptionSession) => {
    sessionRef.current = next
    setReceptionSession(next)
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(next))
    } catch {
      toast.warning('Session recovery is unavailable. Keep this page open until printing finishes.')
    }
  }
  const sessionTotalKg = receptionSession.records.reduce((sum, record) => sum + Math.round(record.weightKg * 1000), 0) / 1000
  const sessionPrinted = receptionSession.closed && receptionSession.records.length > 0 &&
    receptionSession.nextPrintJob === receptionSession.records.length + 1

  /* ── Mode State ── */
  const [focusMode, setFocusMode] = useState(false)
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(() => receptionSession.records.length || receptionSession.draft ? 3 : 1)

  /* ── Step 1: Scan & Farmer Identification + Commodity Context ── */
  const [scanFarmerId, setScanFarmerId] = useState('')
  const [manualSearch, setManualSearch] = useState('')
  const [scanError, setScanError] = useState('')
  const scanInputRef = useRef<HTMLInputElement>(null)
  const [commoditiesList, setCommoditiesList] = useState<Commodity[]>(DEFAULT_COMMODITIES)
  const [selectedCommodityCode, setSelectedCommodityCode] = useState<string>(
    () => receptionSession.records[0]?.commodityCode || receptionSession.draft?.commodityCode || '001',
  )

  useEffect(() => {
    let activeFlag = true
    api.commodities
      .list()
      .then((list) => {
        if (!activeFlag || !Array.isArray(list) || list.length === 0) return
        setCommoditiesList(list)
        if (!list.some((c) => c.code === selectedCommodityCode)) {
          setSelectedCommodityCode(list[0].code)
        }
      })
      .catch(() => { })
    return () => {
      activeFlag = false
    }
  }, [selectedCommodityCode])

  const rawActiveCommodity =
    commoditiesList.find((c) => c.code === selectedCommodityCode) ||
    DEFAULT_COMMODITIES.find((c) => c.code === selectedCommodityCode) ||
    DEFAULT_COMMODITIES[0]
  const activeCommodity = {
    ...rawActiveCommodity,
    name: getGeneralCommodityName(rawActiveCommodity),
  }
  const commodityLocked = receptionSession.records.length > 0 || Boolean(receptionSession.draft)

  /* ── Camera Scanner State ── */
  const [cameraModalOpen, setCameraModalOpen] = useState(false)
  const openCameraModal = () => setCameraModalOpen(true)
  const closeCameraModal = useCallback(() => setCameraModalOpen(false), [])

  /* ── Step 2: Weighing Form ── */
  const [weightKg, setWeightKg] = useState('')
  const [editingSessionBagId, setEditingSessionBagId] = useState<string | null>(null)
  const [scaleCapacityKg, setScaleCapacityKg] = useState<number | null>(null)
  const [scaleOnline, setScaleOnline] = useState(false)
  const [scaleEndpoint, setScaleEndpoint] = useState('Not configured')
  const [printerOnline, setPrinterOnline] = useState(false)
  const [printerEndpoint, setPrinterEndpoint] = useState('Not configured')
  const [formError, setFormError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  /* ── Step 3: Approval & Print State ── */
  const [confirmApprove, setConfirmApprove] = useState<WeighingRecord | null>(() => receptionSession.draft || null)
  const [printModalRecord, setPrintModalRecord] = useState<WeighingRecord | null>(null)
  const [approvedSuccessRecord, setApprovedSuccessRecord] = useState<WeighingRecord | null>(() => receptionSession.draft ? null : receptionSession.records[receptionSession.records.length - 1] || null)
  const [isPrinting, setIsPrinting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const savingRef = useRef(false)
  const [saveError, setSaveError] = useState('')
  const [printStatus, setPrintStatus] = useState(() => sessionPrinted
    ? 'Receipt and labels sent to printer'
    : receptionSession.closed ? `${receptionSession.nextPrintJob} tickets sent. Continue printing below.` : 'Not sent to printer')

  /* ── User & Admin Cancellation ── */
  const [cancelModalRecord, setCancelModalRecord] = useState<WeighingRecord | null>(null)

  /* ── Records Ledger ── */
  const [records, setRecords] = useState<WeighingRecord[]>([])
  const [farmersList, setFarmersList] = useState(FARMERS)

  const refreshRecords = useCallback(() => {
    api.weighing
      .list()
      .then((list) => {
        if (Array.isArray(list)) {
          setRecords(
            list.map((w: any) => ({
              id: w.id,
              farmerId: w.farmerCode || w.farmerId || 'FMR-001',
              farmerName: w.farmerName || 'Ahmad Santoso',
              farmerVillage: w.farmerVillage || 'Desa Sumber Brantas',
              weightKg: Number(w.grossWeightKg),
              depositDate: formatSafeDate(w.createdAt || w.approvedAt),
              time: formatSafeTime(w.createdAt || w.approvedAt),
              status: 'BUFFER_WAITING',
              waringCode: w.code,
            }))
          )
        }
      })
      .catch(() => { })
  }, [])

  useEffect(() => {
    api.scales
      .getWeight('01')
      .then((scale) => {
        setScaleCapacityKg(Number(scale?.capacityKg) || null)
        setScaleOnline(scale?.online === true)
        setScaleEndpoint(scale?.ip && scale?.port ? `${scale.ip}:${scale.port}` : 'Not configured')
      })
      .catch(() => {
        setScaleCapacityKg(null)
        setScaleOnline(false)
      })
  }, [])

  useEffect(() => {
    let active = true
    let consecutiveFails = 0
    const checkPrinter = () => {
      api.printers
        .test('reception')
        .then((result) => {
          if (!active) return
          if (result?.online === true) {
            consecutiveFails = 0
            setPrinterOnline(true)
          } else {
            consecutiveFails++
            if (consecutiveFails >= 2) {
              setPrinterOnline(false)
            }
          }
        })
        .catch(() => {
          if (!active) return
          consecutiveFails++
          if (consecutiveFails >= 2) {
            setPrinterOnline(false)
          }
        })
    }
    checkPrinter()
    const timer = window.setInterval(checkPrinter, 5000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    api.printers
      .get()
      .then((printers) => {
        const printer = Array.isArray(printers) ? printers.find((item: any) => item.station === 'RECEPTION') : null
        if (printer?.ip && printer?.port) setPrinterEndpoint(`${printer.ip}:${printer.port}`)
      })
      .catch(() => setPrinterEndpoint('Not configured'))
  }, [])

  /* Fetch live farmers and historical warings from database */
  useEffect(() => {
    api.farmers
      .list()
      .then((list) => {
        if (Array.isArray(list) && list.length > 0) {
          setFarmersList(
            list.map((f: any) => ({
              id: f.code || f.id,
              code: f.code || f.id,
              name: f.name,
              village: f.village || 'Desa Sumber Brantas',
            }))
          )
        }
      })
      .catch(() => { })

    refreshRecords()
  }, [refreshRecords])

  /* Auto-focus scanner input in Step 1 */
  useEffect(() => {
    if (activeStep === 1) {
      const timer = window.setTimeout(() => {
        scanInputRef.current?.focus()
      }, 100)
      return () => window.clearTimeout(timer)
    }
  }, [activeStep, focusMode])

  /* Fullscreen & Esc handler */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && focusMode) {
        setFocusMode(false)
        if (document.fullscreenElement) {
          document.exitFullscreen?.().catch(() => { })
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [focusMode])

  const enterFocusMode = () => {
    setFocusMode(true)
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => { })
    }
  }

  const exitFocusMode = () => {
    setFocusMode(false)
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => { })
    }
  }

  /* ── Step 1: Handle Farmer Identification ── */
  const selectFarmer = (targetFarmer: { id: string; code?: string; name: string; village: string }) => {
    if (sessionRef.current.records.length || sessionRef.current.draft) return
    setScanError('')
    startScan({ id: targetFarmer.id, name: targetFarmer.name })
    setScanFarmerId(targetFarmer.code || targetFarmer.id)
    toast.success(`Farmer verified: ${targetFarmer.name} (${targetFarmer.code || targetFarmer.id})`)
    setActiveStep(2)
  }

  const handleScanSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setScanError('')
    const query = (manualSearch || scanFarmerId).trim()
    if (!query) {
      setScanError('Please scan or type a Farmer ID / Barcode / Name.')
      return
    }

    const normalize = (s: string) => s.replace(/[\r\n\t\s]/g, '').toLowerCase()
    const queryNorm = normalize(query)
    const matched = farmersList.find((f) => {
      const candidates = [f.code, f.id, f.name, f.village].filter(Boolean).map((v) => normalize(String(v)))
      if (candidates.includes(queryNorm)) return true
      if ((f.code || f.id) && queryNorm.includes(normalize(f.code || f.id))) return true
      if (normalize(f.name).includes(queryNorm) || queryNorm.includes(normalize(f.name))) return true
      return false
    })

    if (matched) {
      selectFarmer(matched)
      setManualSearch('')
      setScanFarmerId('')
    } else {
      setScanError('Unregistered Farmer: ID or Barcode not found in packhouse directory.')
      toast.error(`Unregistered Farmer: "${query}". Please select an authorized farmer or register them first.`)
      setManualSearch(query)
      setScanFarmerId(query)
      if (scanInputRef.current) {
        scanInputRef.current.focus()
        scanInputRef.current.select?.()
      }
    }
  }

  const handleVerifyScannedCode = (code: string) => {
    const rawText = code.trim()
    if (!rawText) return
    // Extract farmer code pattern
    const m = rawText.match(/(FMR|FRM)-?\d{3,}/i)
    const query = m ? m[0].toUpperCase().replace(/FRM/i, 'FMR').replace(/FMR(\d)/, 'FMR-$1') : rawText.replace(/[\r\n\t\s]/g, '')
    setScanError('')
    const normalize = (s: string) => s.replace(/[\r\n\t\s]/g, '').toLowerCase()
    const queryNorm = normalize(query)
    const matched = farmersList.find((f) => {
      const candidates = [f.code, f.id, f.name].filter(Boolean).map((v) => normalize(String(v)))
      if (candidates.includes(queryNorm)) return true
      if ((f.code || f.id) && queryNorm.includes(normalize(f.code || f.id))) return true
      return false
    })
    if (matched) {
      selectFarmer(matched)
      closeCameraModal()
    } else {
      setScanError('Unregistered Farmer: ID or Barcode not found in packhouse directory.')
      toast.error(`Unregistered Farmer: "${query}". Please select an authorized farmer or register them first.`)
      setScanFarmerId(query)
      setManualSearch(query)
      closeCameraModal()
      if (activeStep === 1 && scanInputRef.current) {
        scanInputRef.current.focus()
        scanInputRef.current.select?.()
      }
    }
  }


  /* ── Step 2: Handle Weight Commitment ── */
  const handleProceedToApproval = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setFormError('')

    const sessionFarmer = sessionRef.current.records[0] || sessionRef.current.draft
    if (sessionRef.current.closed || sessionRef.current.records.length >= 500) return
    if ((!active || !farmer) && !sessionFarmer) {
      setFormError('Farmer context is required. Please go back to Step 1.')
      setActiveStep(1)
      return
    }

    const numericWeight = Number(weightKg)
    if (!Number.isFinite(numericWeight) || numericWeight < 0.001) {
      setFormError('Weight must be greater than 0 kg.')
      return
    }
    if (scaleCapacityKg !== null && numericWeight > scaleCapacityKg) {
      setFormError(`Weight exceeds scale capacity of ${scaleCapacityKg} kg.`)
      return
    }

    const farmerId = sessionFarmer?.farmerId || farmer!.id
    const activeFarmerObj = farmersList.find((f) => f.id === farmerId)
    const sessionCommodityCode = sessionFarmer?.commodityCode || activeCommodity.code
    const sessionCommodityName = sessionFarmer?.commodityName
      ? getGeneralCommodityName({ code: sessionCommodityCode, name: sessionFarmer.commodityName })
      : activeCommodity.name
    const payload: WeighingRecord = {
      id: editingId ?? crypto.randomUUID(),
      farmerId,
      farmerName: sessionFarmer?.farmerName || farmer!.name || '',
      farmerVillage: activeFarmerObj?.village || '',
      commodityCode: sessionCommodityCode,
      commodityName: sessionCommodityName,
      weightKg: Number(numericWeight.toFixed(3)),
      depositDate: today(),
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      status: 'PENDING',
    }

    if (editingId) {
      setRecords((current) => current.map((item) => (item.id === editingId ? payload : item)))
      setEditingId(null)
    } else {
      setRecords((current) => [payload, ...current])
    }

    setConfirmApprove(payload)
    updateReceptionSession({ ...sessionRef.current, draft: payload })
    setActiveStep(3)
  }

  /* ── Step 3: Handle Approval & Print ── */
  const handleApproveCommit = async (): Promise<WeighingRecord | null> => {
    if (!confirmApprove || savingRef.current || printingRef.current || sessionRef.current.closed) return null
    savingRef.current = true
    setIsSaving(true)
    setSaveError('')
    try {
      const updatedRecord = await saveReceptionIntake(confirmApprove, api.weighing.create)
      const assignedCode = updatedRecord.waringCode!
      if (!sessionRef.current.records.some((record) => record.id === updatedRecord.id)) {
        updateReceptionSession({ ...sessionRef.current, draft: undefined, records: [...sessionRef.current.records, updatedRecord] })
      }

      setRecords((current) =>
        current.map((item) => (item.id === confirmApprove.id ? updatedRecord : item)),
      )

      // Synchronize to cross-station store for Station 02 and Warehouse
      void syncWithBackend()

      toast.success(`Intake saved: ${assignedCode}`)
      setConfirmApprove(updatedRecord)
      setApprovedSuccessRecord(updatedRecord)
      setPrintModalRecord(updatedRecord)
      return updatedRecord
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save intake.'
      setSaveError(message)
      toast.error(message)
      return null
    } finally {
      savingRef.current = false
      setIsSaving(false)
    }
  }

  /* Reset for next farmer weighing */
  const handleNextWeighing = (force = false) => {
    if ((!force && !sessionPrinted && receptionSession.records.length > 0) || isPrinting) return
    updateReceptionSession(emptySession())
    setSaveError('')
    setPrintStatus('Not sent to printer')
    setWeightKg('')
    setFormError('')
    setScanError('')
    setManualSearch('')
    setScanFarmerId('')
    setConfirmApprove(null)
    setApprovedSuccessRecord(null)
    setPrintModalRecord(null)
    setActiveStep(1)
    toast.info('Ready for the next farmer.')
  }

  const handleNextBag = async () => {
    if (sessionRef.current.closed || isSaving || isPrinting) return
    if (!approvedSuccessRecord && !(await handleApproveCommit())) return
    setWeightKg('')
    setFormError('')
    setConfirmApprove(null)
    setApprovedSuccessRecord(null)
    setPrintModalRecord(null)
    setActiveStep(2)
  }

  /* Add & save current bag directly on Step 2 for fast multi-bag weighing */
  const handleAddBagOnStep2 = async () => {
    if (savingRef.current || printingRef.current || sessionRef.current.closed) return
    const numericWeight = Number(weightKg)
    if (!Number.isFinite(numericWeight) || numericWeight < 0.001) {
      setFormError('Weighing cannot be zero. Place a bag on the scale first.')
      return
    }
    if (scaleCapacityKg !== null && numericWeight > scaleCapacityKg) {
      setFormError(`Weight exceeds scale capacity of ${scaleCapacityKg} kg.`)
      return
    }
    const sessionFarmer = sessionRef.current.records[0] || sessionRef.current.draft
    const farmerId = sessionFarmer?.farmerId || farmer?.id || ''
    if (!farmerId) {
      setFormError('Select a valid farmer before saving.')
      return
    }
    const activeFarmerObj = farmersList.find((f) => f.id === farmerId)
    const sessionCommodityCode = sessionFarmer?.commodityCode || activeCommodity.code
    const sessionCommodityName = sessionFarmer?.commodityName
      ? getGeneralCommodityName({ code: sessionCommodityCode, name: sessionFarmer.commodityName })
      : activeCommodity.name

    const payload: WeighingRecord = {
      id: editingId ?? crypto.randomUUID(),
      farmerId,
      farmerName: sessionFarmer?.farmerName || farmer!.name || '',
      farmerVillage: activeFarmerObj?.village || '',
      commodityCode: sessionCommodityCode,
      commodityName: sessionCommodityName,
      weightKg: Number(numericWeight.toFixed(3)),
      depositDate: today(),
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      status: 'PENDING',
    }

    savingRef.current = true
    setIsSaving(true)
    setFormError('')
    setSaveError('')
    try {
      if (editingSessionBagId) {
        const rounded = Number(numericWeight.toFixed(3))
        await api.weighing.updateWeight(editingSessionBagId, rounded)
        const nextRecords = sessionRef.current.records.map((r) =>
          r.id === editingSessionBagId ? { ...r, weightKg: rounded } : r,
        )
        updateReceptionSession({
          ...sessionRef.current,
          draft: undefined,
          records: nextRecords,
        })
        setRecords((current) =>
          current.map((item) => (item.id === editingSessionBagId ? { ...item, weightKg: rounded } : item)),
        )
        setEditingSessionBagId(null)
        setWeightKg('')
        void syncWithBackend()
        toast.success(`Berat karung diperbarui: ${formatWeight(rounded)} kg`)
        return
      }

      const updatedRecord = await saveReceptionIntake(payload, api.weighing.create)
      const assignedCode = updatedRecord.waringCode!
      if (!sessionRef.current.records.some((record) => record.id === updatedRecord.id)) {
        updateReceptionSession({
          ...sessionRef.current,
          draft: undefined,
          records: [...sessionRef.current.records, updatedRecord],
        })
      }
      setRecords((current) => [updatedRecord, ...current.filter((item) => item.id !== updatedRecord.id)])
      setEditingId(null)
      setWeightKg('')
      void syncWithBackend()
      toast.success(`Karung ${sessionRef.current.records.length} ditambahkan: ${assignedCode}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menyimpan karung.'
      setFormError(message)
      toast.error(message)
    } finally {
      savingRef.current = false
      setIsSaving(false)
    }
  }

  /* Correction: return to Step 2 with the recorded weight */
  const handleKoreksi = (record: WeighingRecord) => {
    setSaveError('')
    setEditingId(record.id)
    setWeightKg(String(record.weightKg))
    setConfirmApprove(null)
    setApprovedSuccessRecord(null)
    setPrintModalRecord(null)
    if (sessionRef.current.draft) {
      updateReceptionSession({ ...sessionRef.current, draft: undefined })
    }
    setActiveStep(2)
    toast.warning('Record loaded back for re-weighing.')
  }

  /* ── Thermal Print Actions ── */
  const getPrintRecord = (override?: WeighingRecord | null) => {
    return override ?? approvedSuccessRecord ?? confirmApprove ?? printModalRecord
  }

  const triggerPrintBoth = async (recordOverride?: WeighingRecord | null, reprint = false) => {
    const rec = getPrintRecord(recordOverride)
    if (!rec?.waringCode || printingRef.current || savingRef.current) return
    const current = sessionRef.current
    const isSession = current.records.some((record) => record.id === rec.id)
    const batch = isSession ? current.records : [rec]
    printingRef.current = true
    setIsPrinting(true)
    setPrintStatus('Sending receipt and labels to printer...')
    let nextPrintJob = isSession && !reprint ? current.nextPrintJob : 0
    if (isSession) updateReceptionSession({ ...current, closed: true, nextPrintJob })
    try {
      await printReceptionSession(buildReceptionPrintJobs(batch), nextPrintJob,
        (jobs) => api.printers.print('reception', jobs),
        (next) => {
          nextPrintJob = next
          if (isSession) updateReceptionSession({ ...sessionRef.current, nextPrintJob: next })
        },
        () => new Promise((resolve) => window.setTimeout(resolve, 600)))
      setPrintStatus('Receipt and labels sent to printer')
      toast.success(`Receipt and ${batch.length} Waring labels sent to printer.`)
    } catch (error) {
      setPrintStatus(`Print failed. Intake is saved. ${nextPrintJob}/${batch.length + 1} tickets sent. Retry below.`)
      toast.error(error instanceof Error ? error.message : 'Check the Reception printer.')
    } finally {
      printingRef.current = false
      setIsPrinting(false)
    }
  }

  /* ── Columns for History Table ── */
  const columns: Column<WeighingRecord>[] = [
    {
      key: 'farmerName',
      label: 'Farmer',
      priority: true,
      render: (row) => (
        <div>
          <span className="font-semibold block text-foreground">{row.farmerName}</span>
          <span className="font-mono text-xs text-muted-foreground">{row.farmerId}</span>
        </div>
      ),
    },
    {
      key: 'weightKg',
      label: 'Weight (kg)',
      priority: true,
      align: 'right',
      render: (row) => (
        <span className="font-mono font-bold text-base text-foreground">
          {formatWeight(row.weightKg)} kg
        </span>
      ),
    },
    {
      key: 'depositDate',
      label: 'Deposit Time',
      priority: true,
      render: (row) => (
        <div>
          <span className="font-mono text-xs block text-foreground">{row.depositDate}</span>
          <span className="text-xs text-muted-foreground">{row.time}</span>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      priority: true,
      render: (row) => (
        <Badge tone={statusTone[row.status]} dot>
          {row.status === 'BUFFER_WAITING' ? 'BUFFER_WAITING' : row.status === 'PENDING' ? 'PENDING' : row.status}
        </Badge>
      ),
    },
    {
      key: 'waringCode',
      label: 'Waring Code',
      priority: true,
      render: (row) =>
        row.waringCode ? (
          <span className="font-mono font-medium tabular-nums text-foreground break-all">{row.waringCode}</span>
        ) : (
          <span className="text-xs text-muted-foreground italic">Assigned after saving</span>
        ),
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="flex items-center gap-1.5 justify-end">
          {row.status === 'PENDING' ? (
            <>
              <Button
                size="sm"
                variant="primary"
                icon="check"
                onClick={() => {
                  setConfirmApprove(row)
                  setApprovedSuccessRecord(null)
                  setActiveStep(3)
                  document.getElementById('weighing-stepper')?.scrollIntoView({ behavior: 'smooth' })
                }}
              >
                Approve
              </Button>
              <Button size="sm" variant="outline" icon="refresh" onClick={() => handleKoreksi(row)}>
                Correct Weight
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              icon="print"
              disabled={isSaving || isPrinting || receptionSession.records.length > 0 || !!receptionSession.draft}
              onClick={() => {
                setConfirmApprove(row)
                setPrintModalRecord(row)
                setApprovedSuccessRecord(row)
                setActiveStep(3)
                document.getElementById('weighing-stepper')?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              Reprint
            </Button>
          )}
          {user?.role === 'ADMIN' && (
            <Button
              size="sm"
              variant="outline"
              icon="trash"
              className="text-destructive hover:bg-destructive/10 border-destructive/30"
              disabled={isSaving || isPrinting || receptionSession.records.some((record) => record.id === row.id)}
              onClick={() => setCancelModalRecord(row)}
            >
              Cancel
            </Button>
          )}
        </div>
      ),
    },
  ]

  const pendingCount = records.filter((item) => item.status === 'PENDING').length
  const approvedToday = records.filter((item) => item.status === 'BUFFER_WAITING').length
  const previewRecords = confirmApprove && !confirmApprove.waringCode
    ? [...receptionSession.records, confirmApprove]
    : receptionSession.records.length ? receptionSession.records : approvedSuccessRecord ? [approvedSuccessRecord] : []
  const previewTotalKg = previewRecords.reduce((sum, record) => sum + Math.round(record.weightKg * 1000), 0) / 1000

  /* ─────────────────────────────────────────────────────────────
     STEPPER PROGRESS BAR COMPONENT
  ───────────────────────────────────────────────────────────── */
  const renderStepperBar = () => (
    <nav className="flex items-center gap-1 sm:gap-3 bg-muted/40 p-2 sm:px-4 sm:py-2.5 border border-border overflow-x-auto scrollbar-none" aria-label="Weighing steps">
      {STEPS.map((step, idx) => {
        const isCurrent = activeStep === step.id
        const isDone = activeStep > step.id || (step.id === 3 && approvedSuccessRecord !== null)
        const compactLabel = step.id === 1 ? 'Farmer' : step.id === 2 ? 'Weigh' : 'Print'

        return (
          <div key={step.id} className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <button
              type="button"
              disabled={isSaving || isPrinting}
              onClick={() => {
                if (receptionSession.closed || receptionSession.records.length || receptionSession.draft) return
                if (step.id < activeStep || approvedSuccessRecord) {
                  setActiveStep(step.id as 1 | 2 | 3)
                }
              }}
              className={`flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer ${isCurrent
                  ? 'text-primary'
                  : isDone
                    ? 'text-emerald-700 dark:text-emerald-400 hover:text-emerald-900'
                    : 'text-muted-foreground'
                }`}
            >
              <span
                className={`w-5 h-5 flex items-center justify-center text-[11px] font-mono font-bold ${isCurrent
                    ? 'bg-primary text-primary-foreground'
                    : isDone
                      ? 'bg-emerald-600 text-white'
                      : 'bg-muted border border-border text-muted-foreground'
                  }`}
              >
                {isDone ? '✓' : step.id}
              </span>
              <span className="sm:hidden">{compactLabel}</span>
              <span className="hidden sm:inline">{step.label}</span>
            </button>
            {idx < STEPS.length - 1 && <span className="text-muted-foreground/40 text-xs mx-0.5 sm:mx-1">/</span>}
          </div>
        )
      })}
    </nav>
  )

  /* ═══════════════════════════════════════════════════════════════════
     RENDER: Focus Mode & Sequential Stepper Content
     ═══════════════════════════════════════════════════════════════════ */
  const renderFocusContent = () => (
    <div className="station-workflow space-y-6">
      {receptionSession.records.length > 0 && <div className="border border-border bg-muted/30 p-3 space-y-2">
        <div className="flex justify-between gap-2 font-semibold text-sm">
          <span>{receptionSession.records.length} bags saved</span><span>{formatWeight(sessionTotalKg)} kg total</span>
        </div>
        <div className="max-h-40 overflow-y-auto text-xs space-y-1" aria-label="Saved bags">
          {receptionSession.records.map((record, index) => <div key={record.id} className="flex justify-between gap-3 font-mono">
            <span className="break-all">{index + 1}. {record.waringCode}</span><span className="shrink-0">{formatWeight(record.weightKg)} kg</span>
          </div>)}
        </div>
      </div>}
      {/* ── STEP 1: Farmer Identification ── */}
      {activeStep === 1 && (
        <div className="station-step bg-card border border-border rounded-none p-6 shadow-sm space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-2">
            <div>
              <span className="text-xs uppercase font-mono font-semibold tracking-wider text-muted-foreground" data-step="Step 1 of 3">
                Step 1 of 3
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-foreground mt-0.5" data-title="Scan Farmer Card">
                Scan Farmer Card
              </h2>
            </div>
            <Badge tone="accent" icon="scan">
              Awaiting Scan
            </Badge>
          </div>

          {/* Commodity Selector (1 Farmer + 1 Commodity per Reception session) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Commodity (1 per session)
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {(commoditiesList.length > 0 ? commoditiesList : DEFAULT_COMMODITIES).map((item) => {
                const isSelected = item.code === activeCommodity.code
                return (
                  <button
                    key={item.code}
                    type="button"
                    disabled={commodityLocked}
                    onClick={() => setSelectedCommodityCode(item.code)}
                    className={`p-3 border text-left transition-colors rounded-none ${isSelected
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border bg-card text-muted-foreground hover:border-foreground/40'
                      } ${commodityLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <div className="font-mono text-xs font-bold text-muted-foreground">{getCommodityFamilyCode(item.code)}</div>
                    <div className="text-sm font-semibold mt-1 text-foreground">{getGeneralCommodityName(item)}</div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="station-scan-box p-8 border-2 border-dashed border-border rounded-none bg-card text-center space-y-4">
            <div className="inline-flex p-3 bg-muted border border-border text-muted-foreground mx-auto">
              <Icon name="scan" size={28} />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">
                2D Scanner and Camera
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Scan the barcode on the farmer ID card with a USB 2D hardware scanner or device camera.
              </p>
            </div>

            <form onSubmit={handleScanSubmit} className="max-w-md mx-auto flex flex-col sm:flex-row gap-2">
              <Input
                ref={scanInputRef}
                value={manualSearch}
                onChange={(e) => {
                  setManualSearch(e.target.value)
                  setScanError('')
                }}
                placeholder="Scan 2D barcode or enter name / ID..."
                className="font-mono text-sm py-2.5 flex-1 min-w-0"
                autoFocus
              />
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Button type="submit" variant="primary" icon="check" className="w-full sm:w-auto">
                  Verifikasi
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  icon="scan"
                  onClick={openCameraModal}
                  title="Buka Kamera Scanner"
                  className="w-full sm:w-auto"
                >
                  Kamera
                </Button>
              </div>
            </form>

            {scanError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-left flex items-start gap-2.5 max-w-md mx-auto animate-in fade-in">
                <Icon name="alert-triangle" size={16} className="text-destructive shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-destructive">Verification Rejected</p>
                  <p className="text-xs text-destructive/90">{scanError}</p>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ── STEP 2: Harvest Weighing ── */}
      {activeStep === 2 && (
        <div className="station-step bg-card border border-border rounded-none p-6 shadow-sm space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-2">
            <div>
              <span className="text-xs uppercase font-mono font-semibold tracking-wider text-muted-foreground" data-step="Step 2 of 3">
                Step 2 of 3
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-foreground mt-0.5" data-title="Weigh Harvest">
                Weigh Harvest
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="success" dot>
                Farmer: {receptionSession.records[0]?.farmerName || receptionSession.draft?.farmerName || farmer?.name}
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                icon="edit"
                disabled={isSaving || (receptionSession.records.length > 0 && !sessionPrinted)}
                onClick={() => {
                  if (sessionPrinted) {
                    handleNextWeighing()
                    return
                  }
                  if (sessionRef.current.draft) {
                    updateReceptionSession({ ...sessionRef.current, draft: undefined })
                  }
                  setActiveStep(1)
                }}
              >
                Ganti Petani
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2 space-y-4">
              <ScaleWeightInput
                id="focus-weighing-weight"
                stationId="01"
                label="Weight (kg)"
                value={weightKg}
                onChange={(val) => {
                  setWeightKg(val)
                  setFormError('')
                }}
                capacityKg={scaleCapacityKg ?? 0}
                hideTare
              />
              {formError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-none flex items-center gap-2 font-medium">
                  <Icon name="alert" size={16} />
                  <span>{formError}</span>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="station-secondary-panel p-4 bg-muted/30 border border-border rounded-none space-y-3">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  <Icon name="info" size={14} /> Intake Metadata
                </span>
                <div className="space-y-2 text-sm pt-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Farmer:</span>
                    <span className="font-semibold text-foreground">{receptionSession.records[0]?.farmerName || receptionSession.draft?.farmerName || farmer?.name}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Commodity:</span>
                    <span className="font-semibold text-foreground text-right">
                      {getGeneralCommodityName({
                        code: receptionSession.records[0]?.commodityCode || receptionSession.draft?.commodityCode || activeCommodity.code,
                        name: receptionSession.records[0]?.commodityName || receptionSession.draft?.commodityName || activeCommodity.name,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Deposit Date:</span>
                    <span className="font-mono font-semibold text-foreground flex items-center gap-1">
                      {today()} <Badge tone="accent">Auto</Badge>
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Waring Code:</span>
                    <span className="font-mono text-xs font-semibold text-foreground">
                      Assigned after saving
                    </span>
                  </div>
                </div>
              </div>

              {receptionSession.records.length > 0 && (
                <div className="p-3 bg-card border border-border rounded-none space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold gap-2 flex-wrap">
                    <span className="text-muted-foreground uppercase tracking-wider">Karung Tersimpan</span>
                    <Badge tone="success">
                      {receptionSession.records.length} karung · {formatWeight(receptionSession.records.reduce((s, r) => s + r.weightKg, 0))} kg
                    </Badge>
                  </div>
                  <div className="max-h-40 overflow-y-auto divide-y divide-border text-xs font-mono">
                    {receptionSession.records.map((r, idx) => (
                      <div key={r.id} className="py-1.5 flex items-center justify-between gap-2">
                        <span className="text-muted-foreground truncate">#{idx + 1} {r.waringCode}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-bold text-foreground">{formatWeight(r.weightKg)} kg</span>
                          {!receptionSession.closed && (
                            <Button
                              size="sm"
                              variant={editingSessionBagId === r.id ? 'primary' : 'outline'}
                              onClick={() => {
                                setEditingSessionBagId(r.id)
                                setWeightKg(String(r.weightKg))
                                setFormError('')
                              }}
                            >
                              Ubah
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>

          {editingSessionBagId && (
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs flex items-center justify-between gap-2">
              <span className="font-medium text-amber-900 dark:text-amber-200">
                Mode Ubah Berat: sesuaikan berat pada timbangan lalu klik <strong>Simpan Perubahan</strong>.
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditingSessionBagId(null)
                  setWeightKg('')
                  setFormError('')
                }}
              >
                Batal
              </Button>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border pt-4 flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={isSaving || (receptionSession.records.length > 0 && !sessionPrinted)}
              title={receptionSession.records.length > 0 && !sessionPrinted ? 'Selesaikan & cetak karung petani saat ini terlebih dahulu' : undefined}
              onClick={() => {
                if (sessionPrinted) {
                  handleNextWeighing()
                  return
                }
                if (sessionRef.current.draft) {
                  updateReceptionSession({ ...sessionRef.current, draft: undefined })
                }
                setActiveStep(1)
              }}
            >
              Kembali ke Scan
            </Button>
            <div className="flex items-center gap-2 flex-wrap">
              {!receptionSession.closed && receptionSession.records.length < 500 && (
                <Button
                  variant={editingSessionBagId ? 'primary' : 'outline'}
                  icon={editingSessionBagId ? 'check' : 'plus'}
                  loading={isSaving}
                  disabled={!(Number(weightKg) > 0) || isSaving}
                  onClick={() => void handleAddBagOnStep2()}
                >
                  {editingSessionBagId ? 'Simpan Perubahan' : 'Tambahkan'}
                </Button>
              )}
              {receptionSession.records.length > 0 && !(Number(weightKg) > 0) && !editingSessionBagId ? (
                <Button
                  variant="primary"
                  icon="print"
                  touch
                  disabled={isSaving}
                  onClick={() => {
                    const last = receptionSession.records[receptionSession.records.length - 1]
                    setConfirmApprove(last)
                    setApprovedSuccessRecord(last)
                    setActiveStep(3)
                  }}
                >
                  Selesai &amp; Cetak
                </Button>
              ) : (
                <Button
                  variant="primary"
                  icon="check"
                  touch
                  disabled={!(Number(weightKg) > 0) || isSaving || Boolean(editingSessionBagId)}
                  onClick={handleProceedToApproval}
                >
                  Tinjau Berat
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 3: Approve & Print Label ── */}
      {activeStep === 3 && (
        <div className="station-step bg-card border border-border rounded-none p-4 shadow-sm space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-border pb-2 flex-wrap gap-2 no-print">
            <div>
              <span className="text-[10px] uppercase font-mono font-semibold tracking-wider text-muted-foreground" data-step="Step 3 of 3">
                Step 3 of 3
              </span>
              <h2 className="text-xl font-bold tracking-tight text-foreground" data-title="Approve & Print">
                Review & Print
              </h2>
            </div>
            {approvedSuccessRecord ? (
              <Badge tone="success" dot>
                Intake Saved
              </Badge>
            ) : (
              <Badge tone="warning" dot>
                Status: PENDING OPERATOR APPROVAL
              </Badge>
            )}
          </div>

          {/* Intake Verification Box */}
          <div className="p-3 bg-muted/30 border border-border rounded-none grid grid-cols-1 sm:grid-cols-4 gap-2 no-print">
            <div>
              <span className="text-xs text-muted-foreground block font-medium">Farmer</span>
              <span className="font-semibold text-base text-foreground block">
                {confirmApprove?.farmerName ?? approvedSuccessRecord?.farmerName ?? farmer?.name}
              </span>
              <span className="font-mono text-xs text-muted-foreground block">
                {confirmApprove?.farmerId ?? approvedSuccessRecord?.farmerId ?? farmer?.id}
              </span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block font-medium">Captured Weight</span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 block tracking-tight">
                {formatWeight(confirmApprove?.weightKg ?? approvedSuccessRecord?.weightKg ?? weightKg)}
                <span className="text-sm font-normal text-muted-foreground ml-1">kg</span>
              </span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block font-medium">Deposit Date</span>
              <span className="font-mono font-semibold text-foreground block">{today()}</span>
              <span className="text-xs text-muted-foreground block">System timestamped</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block font-medium">Assigned Waring ID</span>
              <span className="font-mono font-bold text-base text-primary block break-all">
                {approvedSuccessRecord?.waringCode ?? confirmApprove?.waringCode ?? 'Assigned after saving'}
              </span>
              <span className="text-xs text-muted-foreground block">QR Waring Label</span>
            </div>
          </div>

          {/* Print Previews */}
          <div>
            <div className="station-preview-grid grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Receipt Preview */}
              <LabelPreview
                type="receipt"
                code={receptionSession.records[0]?.waringCode ?? approvedSuccessRecord?.waringCode ?? ''}
                farmerName={previewRecords[0]?.farmerName ?? farmer?.name}
                farmerId={previewRecords[0]?.farmerId ?? farmer?.id}
                commodity={getGeneralCommodityName({
                  code: previewRecords[0]?.commodityCode || activeCommodity.code,
                  name: previewRecords[0]?.commodityName || activeCommodity.name,
                })}
                weightKg={previewTotalKg}
                items={previewRecords.map((record, index) => ({ code: record.waringCode || `Bag ${index + 1} (unsaved)`, weightKg: record.weightKg }))}
                time={confirmApprove?.time ?? 'Live'}
                date={today()}
                screenFit
              />

              {/* Waring Label Preview */}
              <LabelPreview
                type="waring"
                code={approvedSuccessRecord?.waringCode ?? confirmApprove?.waringCode ?? ''}
                farmerName={confirmApprove?.farmerName ?? approvedSuccessRecord?.farmerName ?? farmer?.name}
                farmerId={confirmApprove?.farmerId ?? approvedSuccessRecord?.farmerId ?? farmer?.id}
                weightKg={confirmApprove?.weightKg ?? approvedSuccessRecord?.weightKg ?? Number(weightKg)}
                date={today()}
                screenFit
              />
            </div>
          </div>

          {saveError && <p role="alert" className="alert alert-danger">
            {saveError} Your weight is retained. Retry saving below.
          </p>}
          <p role="status" className={printStatus.includes('failed') ? 'alert alert-warning' : 'text-sm text-muted-foreground'}>
            {isSaving ? 'Saving intake...' : printStatus}
          </p>
          <div className="flex items-center justify-between border-t border-border pt-3 flex-wrap gap-2 no-print">
            {!approvedSuccessRecord && <Button variant="outline" icon="refresh" disabled={isSaving || isPrinting}
              onClick={() => confirmApprove && handleKoreksi(confirmApprove)}>Koreksi Berat</Button>}
            {!receptionSession.closed && receptionSession.records.length < 500 && <Button variant="outline" icon="check"
              loading={isSaving} disabled={isPrinting} onClick={() => void handleNextBag()}>
              {saveError ? 'Coba Simpan Lagi' : 'Simpan & Karung Berikutnya'}
            </Button>}
            <Button variant="primary" icon="print" touch loading={isPrinting || isSaving}
              onClick={async () => {
                const saved = approvedSuccessRecord || await handleApproveCommit()
                if (saved) void triggerPrintBoth(saved, sessionPrinted)
              }}>
              {sessionPrinted ? 'Cetak Lagi' : printStatus.includes('failed') || receptionSession.closed ? 'Cetak Ulang' : 'Selesai & Cetak'}
            </Button>
            {(sessionPrinted || (approvedSuccessRecord && !receptionSession.records.length)) ? (
              <Button variant="primary" icon="check" touch disabled={isPrinting} onClick={() => handleNextWeighing()}>
                {sessionPrinted ? 'Petani Berikutnya' : 'Kembali Menimbang'}
              </Button>
            ) : receptionSession.closed && (
              <Button
                variant="outline"
                icon="arrow-right"
                disabled={isPrinting}
                onClick={() => handleNextWeighing(true)}
              >
                Petani Berikutnya (Lewati Cetak)
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════════════
         FULLSCREEN FOCUS MODE OVERLAY
         ═══════════════════════════════════════════════════════════════════ */}
      {focusMode && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-y-auto" role="dialog" aria-modal="true" aria-label="Weighing Focus Mode">
          <header className="sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-3 sm:px-6 sm:py-4 bg-card/95 backdrop-blur border-b border-border shadow-sm">
            <div className="min-w-0 max-w-[48%] font-mono text-[9px] sm:text-[10px] leading-tight text-muted-foreground tracking-[0.16em] sm:tracking-[0.2em] uppercase">
              STATION 01 · RECEPTION
            </div>

            {/* Stepper Progress */}
            <div className="hidden md:flex">
              {renderStepperBar()}
            </div>

            {/* Controls */}
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm" icon="close" onClick={exitFocusMode} className="whitespace-nowrap">
                Exit Focus Mode
              </Button>
            </div>
          </header>

          <main className="station-focus-main flex-1 p-4 md:p-8 max-w-5xl w-full mx-auto space-y-6">
            <div className="md:hidden">
              {renderStepperBar()}
            </div>
            {renderFocusContent()}
          </main>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
         STANDARD DASHBOARD VIEW (Non-focus mode)
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="station-page space-y-6">
        <div className="no-print">
          <PageHeader
            title="Station 01: Reception"
            subtitle="Farmer verification, intake weighing, and buffer queue."
            actions={
              <Button
                variant="outline"
                size="sm"
                icon="history"
                onClick={() => document.getElementById('weighing-records')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Records ({records.length})
              </Button>
            }
          />
        </div>

        {/* Quick Stats Grid */}
        <div className="station-quick-stats grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
          <div className="bg-card border border-border rounded-none p-4 shadow-sm space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Pending Approval</p>
            <p className="text-2xl font-bold tracking-tight text-foreground">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">Requires verification</p>
          </div>
          <div className="bg-card border border-border rounded-none p-4 shadow-sm space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Saved Records</p>
            <p className="text-2xl font-bold tracking-tight text-foreground">{approvedToday}</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              Ready for Sorting
            </p>
          </div>
          <div className="bg-card border border-border rounded-none p-4 shadow-sm space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Scale</p>
            <p className={`text-2xl font-bold tracking-tight ${scaleOnline ? 'text-emerald-600' : 'text-amber-600'}`}>{scaleOnline ? 'Online' : 'Offline'}</p>
            <p className="text-xs text-muted-foreground font-mono">{scaleEndpoint}</p>
          </div>
          <div className="bg-card border border-border rounded-none p-4 shadow-sm space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Reception Printer</p>
            <p className={`text-2xl font-bold tracking-tight ${printerOnline ? 'text-emerald-600' : 'text-amber-600'}`}>{printerOnline ? 'Online' : 'Offline'}</p>
            <p className="text-xs text-muted-foreground font-mono">{printerEndpoint}</p>
          </div>
        </div>

        {/* Sequential Stepper in Standard View */}
        <div id="weighing-stepper" className="station-stepper-shell bg-card border border-border rounded-none p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-2 no-print">
            <span className="font-semibold text-base text-foreground">Reception Workflow</span>
            <Button size="sm" variant="outline" icon="expand" onClick={enterFocusMode}>
              Focus Mode
            </Button>
          </div>

          {/* Stepper Navigation Bar */}
          <div className="no-print">
            {renderStepperBar()}
          </div>

          {/* Embed the same sequential step logic */}
          {renderFocusContent()}
        </div>

        {/* ── Today's Harvest Weighing Records Ledger ── */}
        <div id="weighing-records" className="space-y-3 no-print">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight text-foreground">Reception Records</h2>
            <span className="text-xs text-muted-foreground font-mono">
              {pendingCount} pending · {approvedToday} saved
            </span>
          </div>
          <DataTable
            columns={columns}
            data={records}
            rowKey={(row) => row.id}
            emptyTitle="No Reception records."
            emptyDescription="Verify a farmer and weigh the first bag."
          />
        </div>
      </div>

      {/* ── Universal Camera Barcode/QR Scanner Modal ── */}
      <CameraScannerModal
        isOpen={cameraModalOpen}
        onClose={closeCameraModal}
        onScan={handleVerifyScannedCode}
        title="Scan Farmer ID Card · Station 01 Reception"
        subtitle="Align the QR code or 1D barcode on the farmer ID card within the camera viewport."
        manualPlaceholder="Scan barcode or enter farmer ID / name..."
      />

      {/* ── Admin Transaction Cancellation Modal ── */}
      <CancelTransactionModal
        open={!!cancelModalRecord}
        waringCode={cancelModalRecord?.waringCode || cancelModalRecord?.id}
        waringId={cancelModalRecord?.id}
        farmerName={cancelModalRecord?.farmerName}
        onClose={() => setCancelModalRecord(null)}
        onSuccess={() => {
          setCancelModalRecord(null)
          refreshRecords()
        }}
      />
    </>
  )
}
