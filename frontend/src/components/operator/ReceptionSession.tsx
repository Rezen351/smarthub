import { useEffect, useRef, useState } from 'react'
import Button from '../shared/Button'
import ScaleWeightInput from './ScaleWeightInput'
import LabelPreview from './LabelPreview'
import { api, APIError } from '../../services/api'
import { appendReceptionWeight, readReceptionDraft, receptionDraftKey, receptionTotals, receptionKg, type ReceptionDraft } from '../../lib/receptionSession'
import { formatWeight } from '../../lib/utils'

interface Props {
  operatorId: string
  farmer: { id: string; name: string }
  capacityKg: number
  initialBatchId?: string
  onFinished: () => void
  onNextFarmer: () => void
  onSaved: () => void
}

export default function ReceptionSession({ operatorId, farmer, capacityKg, initialBatchId, onFinished, onNextFarmer, onSaved }: Props) {
  const [draft, setDraft] = useState<ReceptionDraft>(() => {
    const restored = readReceptionDraft(operatorId)
    if (!initialBatchId && restored?.farmerCode === farmer.id) return restored
    return { id: initialBatchId || crypto.randomUUID(), farmerCode: farmer.id, farmerName: farmer.name, items: [], weight: '' }
  })
  const draftRef = useRef(draft)
  const [paused, setPaused] = useState(() => Boolean(readReceptionDraft(operatorId)))
  const [cycle, setCycle] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(draft.editingId || null)
  const editRef = useRef<string | null>(draft.editingId || null)
  const [busy, setBusy] = useState(initialBatchId ? 'loading' : '')
  const busyRef = useRef(Boolean(initialBatchId))
  const [error, setError] = useState('')
  const [printNote, setPrintNote] = useState(draft.saved ? 'Saved. Select a document to print.' : '')
  const [selectedLabel, setSelectedLabel] = useState('')

  const persist = (next: ReceptionDraft) => {
    try {
      sessionStorage.setItem(receptionDraftKey(operatorId), JSON.stringify(next))
      draftRef.current = next
      setDraft(next)
      return true
    } catch {
      setPaused(true)
      setError('Draft could not be stored. Free browser storage before continuing.')
      return false
    }
  }

  useEffect(() => {
    if (!initialBatchId) return
    let active = true
    api.weighing.getBatch(initialBatchId).then((batch) => {
      if (!active) return
      persist({ id: batch.id, farmerCode: batch.farmerCode, farmerName: batch.farmerName, items: batch.items, weight: '', saved: batch })
      setPrintNote('Saved. Select a document to print.')
    }).catch((err) => { if (active) setError(err instanceof Error ? err.message : 'Could not load Reception.') })
      .finally(() => { if (active) { busyRef.current = false; setBusy('') } })
    return () => { active = false }
  }, [initialBatchId, operatorId])

  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if (!draftRef.current.saved && (draftRef.current.items.length || draftRef.current.weight)) { event.preventDefault(); event.returnValue = '' }
    }
    window.addEventListener('beforeunload', protect)
    return () => window.removeEventListener('beforeunload', protect)
  }, [])

  const totals = receptionTotals(draft.items)
  const numericWeight = Number(draft.weight)
  const validWeight = draft.weight.trim() !== '' && Number.isFinite(numericWeight) && receptionKg(numericWeight) > 1.2 && receptionKg(numericWeight) <= capacityKg
  const frozen = Boolean(draft.pending || draft.saved || busy || initialBatchId)

  const nextWaring = () => {
    if (busyRef.current || draftRef.current.pending || draftRef.current.saved) return
    try {
      const next = appendReceptionWeight(draftRef.current, draftRef.current.weight, capacityKg, editRef.current)
      if (!persist(next)) return
      editRef.current = null
      setEditingId(null)
      setError('')
      setCycle((value) => value + 1)
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not assign weight.') }
  }

  const deliver = async (id: string, document: 'all' | 'receipt' | 'label', waringId?: string) => {
    setBusy('printing')
    setPrintNote('Sending to printer…')
    try {
      await api.weighing.printBatch(id, document, waringId)
      setPrintNote('Sent to printer.')
    } catch (err) {
      setPrintNote('Saved. Check the printer before reprinting.')
      setError(err instanceof Error ? err.message : 'Print failed. Reception is saved.')
    }
  }

  const finish = async () => {
    if (busyRef.current || draftRef.current.saved || initialBatchId) return
    setError('')
    let snapshot = draftRef.current
    try {
      if (!snapshot.pending && snapshot.weight.trim()) snapshot = appendReceptionWeight(snapshot, snapshot.weight, capacityKg, editRef.current)
      if (!snapshot.items.length) throw new Error('Assign at least one waring.')
      snapshot = { ...snapshot, weight: '', pending: true }
      if (!persist(snapshot)) return
    } catch (err) { setError(err instanceof Error ? err.message : 'Check the weight.'); return }
    busyRef.current = true
    setBusy('saving')
    setPaused(true)
    editRef.current = null
    setEditingId(null)
    try {
      const saved = await api.weighing.saveBatch({ id: snapshot.id, farmerCode: snapshot.farmerCode, items: snapshot.items })
      if (!persist({ ...snapshot, pending: false, saved })) {
        draftRef.current = { ...snapshot, pending: false, saved }
        setDraft(draftRef.current)
      }
      onSaved()
      onFinished()
      await deliver(saved.id, 'all')
    } catch (err) {
      if (err instanceof APIError && (err.status === 400 || err.status === 404)) persist({ ...snapshot, pending: false })
      setError(err instanceof Error ? err.message : 'Could not save Reception. Retry Finish.')
    } finally { busyRef.current = false; setBusy('') }
  }

  const reprint = async (document: 'all' | 'receipt' | 'label') => {
    if (busyRef.current || !draftRef.current.saved) return
    busyRef.current = true
    setError('')
    try { await deliver(draftRef.current.saved.id, document, selectedLabel || draftRef.current.saved.items.find((item) => !item.cancelled)?.id) }
    finally { busyRef.current = false; setBusy('') }
  }

  const nextFarmer = () => {
    if (busyRef.current) return
    try { sessionStorage.removeItem(receptionDraftKey(operatorId)) }
    catch { setError('Could not clear the saved session.'); return }
    onNextFarmer()
  }

  const saved = draft.saved
  const previewLabel = saved?.items.find((item) => item.id === selectedLabel) || saved?.items[0]
  return (
    <section className="station-step bg-card border border-border rounded-none p-4 sm:p-6 space-y-5" aria-label="Reception session">
      <header className="flex items-center justify-between gap-3 flex-wrap border-b border-border pb-3">
        <div><h2 className="text-xl font-bold">{saved ? 'Receipt & Labels' : 'Weigh Warings'}</h2><p className="text-sm">{draft.farmerName} · {draft.farmerCode}</p></div>
        {!saved && !draft.items.length && !draft.weight && !draft.pending && !initialBatchId && <Button disabled={Boolean(busy)} onClick={nextFarmer}><span>Change Farmer</span></Button>}
      </header>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {busy === 'loading' && <p role="status">Loading Reception…</p>}
      {!saved && !initialBatchId && <>
        {paused && !draft.pending && <div className="flex items-center justify-between gap-3 border border-border p-3"><span>Auto-fill paused.</span><Button disabled={Boolean(busy)} onClick={() => { setPaused(false); setCycle((value) => value + 1) }}><span>Resume</span></Button></div>}
        {draft.pending && <p role="status" className="text-sm">Save pending. Retry Finish to confirm this session.</p>}
        <fieldset disabled={frozen} className="min-w-0">
          <ScaleWeightInput key={cycle} stationId="01" label="Gross weight (kg)" capacityKg={capacityKg} value={draft.weight}
            autoFill autoFillPaused={paused || frozen || Boolean(editingId)}
            onChange={(weight) => { if (!draftRef.current.pending && !draftRef.current.saved && !busyRef.current) { persist({ ...draftRef.current, weight }); setError('') } }} />
        </fieldset>
      </>}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border border-border p-3 text-sm" aria-label="Reception totals">
        <div>Warings<strong className="block text-xl">{(saved?.items || draft.items).length}</strong></div>
        <div>Gross<strong className="block">{formatWeight(saved?.grossWeightKg ?? totals.grossWeightKg)} kg</strong></div>
        <div>Tare<strong className="block">{formatWeight(saved?.tareWeightKg ?? totals.tareWeightKg)} kg</strong></div>
        <div>Net<strong className="block">{formatWeight(saved?.netWeightKg ?? totals.netWeightKg)} kg</strong></div>
      </div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">Waring weights</caption>
        <thead><tr className="border-b border-border text-left"><th className="p-2">Waring</th><th>Gross (kg)</th><th>Tare (kg)</th><th>Net (kg)</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{(saved?.items || draft.items).map((item, index) => <tr key={item.captureId} className="border-b border-border">
          <td className="p-2 font-mono">{saved ? saved.items[index].code : index + 1}{saved?.items[index].cancelled && ' · Cancelled'}</td><td>{formatWeight(item.grossWeightKg)}</td><td>1.2</td><td>{formatWeight(receptionKg(item.grossWeightKg - 1.2))}</td>
          <td>{!frozen && <div className="flex gap-2 justify-end"><Button size="sm" disabled={Boolean(draft.weight)} onClick={() => { editRef.current = item.captureId; setEditingId(item.captureId); setPaused(true); persist({ ...draftRef.current, editingId: item.captureId, weight: String(item.grossWeightKg) }) }}><span>Edit</span></Button>
            <Button size="sm" disabled={Boolean(draft.weight)} onClick={() => persist({ ...draftRef.current, items: draftRef.current.items.filter((row) => row.captureId !== item.captureId) })}><span>Remove</span></Button></div>}</td>
        </tr>)}</tbody></table></div>
      {!saved && !initialBatchId && <div className="grid grid-cols-2 gap-3" aria-label="Weighing actions">
        <Button touch variant="outline" className="w-full" disabled={frozen || !validWeight} onClick={nextWaring}><span>Next Waring</span></Button>
        <Button touch variant="primary" className="w-full" loading={Boolean(busy)} disabled={Boolean(busy) || (!draft.pending && (draft.weight.trim() ? !validWeight : !draft.items.length))} onClick={() => void finish()}><span>Finish</span></Button>
      </div>}
      {saved && <>
        <p role="status" className="text-sm">{printNote || 'Reception saved.'}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
          <div className="bg-white text-black border border-gray-400 p-3 text-xs font-mono space-y-2" aria-label="Receipt preview">
            <header className="text-center border-b border-dashed border-gray-400 pb-2"><strong>SMARTGEULIS</strong><div>RECEIVING RECEIPT</div></header>
            <p>Farmer: {saved.farmerName}<br />Farmer ID: {saved.farmerCode}<br />Commodity: Potatoes</p>
            <p>Warings: {saved.items.length}</p>
            {saved.items.map((item, index) => <div key={item.id}>{index + 1}. {item.code}<br />Gross {item.grossWeightKg.toFixed(3)} · Tare {item.tareWeightKg.toFixed(3)} kg<br />Net {item.netWeightKg.toFixed(3)} kg</div>)}
            <p className="border-t border-dashed border-gray-400 pt-2">Total gross: {saved.grossWeightKg.toFixed(3)} kg<br />Total tare: {saved.tareWeightKg.toFixed(3)} kg<br />Total net: {saved.netWeightKg.toFixed(3)} kg</p>
            <p className="text-center">{saved.code}<br />{saved.createdAt.slice(0, 10)} {saved.createdAt.slice(11, 19)}<br />BUFFER_WAITING</p>
          </div>
          {previewLabel && <div className="space-y-2"><label className="text-sm block" htmlFor="reception-label">Waring label</label>
            <select id="reception-label" className="input w-full" value={selectedLabel || previewLabel.id} onChange={(event) => setSelectedLabel(event.target.value)}>{saved.items.map((item) => <option key={item.id} value={item.id} disabled={item.cancelled}>{item.code}{item.cancelled ? ' · Cancelled' : ''}</option>)}</select>
            <LabelPreview type="waring" code={previewLabel.code} farmerName={saved.farmerName} farmerId={saved.farmerCode} weightKg={previewLabel.grossWeightKg} date={previewLabel.capturedAt.slice(0, 10)} time={previewLabel.capturedAt.slice(11, 19)} screenFit />
          </div>}
        </div>
        <div className="flex flex-wrap gap-2"><Button disabled={Boolean(busy)} onClick={() => void reprint('receipt')}><span>Print Receipt</span></Button><Button disabled={Boolean(busy) || !previewLabel || previewLabel.cancelled} onClick={() => void reprint('label')}><span>Print Label</span></Button><Button disabled={Boolean(busy)} onClick={() => void reprint('all')}><span>Print All</span></Button><Button variant="primary" disabled={Boolean(busy)} onClick={nextFarmer}><span>Next Farmer</span></Button></div>
      </>}
      {initialBatchId && !saved && !busy && <Button onClick={onNextFarmer}><span>Back</span></Button>}
    </section>
  )
}
