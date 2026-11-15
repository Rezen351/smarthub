import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ReceptionWeightCapture, appendReceptionWeight, receptionTotals, readReceptionDraft, receptionDraftKey } from '../src/lib/receptionSession.ts'

const sample = (weightKg, changes = {}) => ({ weightKg, isStable: true, online: true, timestamp: new Date().toISOString(), ...changes })
const empty = (capture) => { capture.accept(sample(0), 150); capture.accept(sample(0), 150) }
const fresh = () => ({ id: 'session-1', farmerCode: 'FMR-001', farmerName: 'Farmer', items: [], weight: '' })

test('fills once after three stable samples; Assign remains separate', () => {
  const capture = new ReceptionWeightCapture()
  empty(capture)
  assert.equal(capture.accept(sample(40), 150), null)
  assert.equal(capture.accept(sample(40.01), 150), null)
  assert.equal(capture.accept(sample(40), 150), 40)
  for (let i = 0; i < 5; i++) assert.equal(capture.accept(sample(40), 150), null)
  assert.equal(fresh().items.length, 0)
})

test('the next cycle requires empty scale and permits identical waring weights', () => {
  for (let waring = 0; waring < 2; waring++) {
    const capture = new ReceptionWeightCapture()
    for (let i = 0; i < 4; i++) assert.equal(capture.accept(sample(40), 150), null)
    empty(capture)
    assert.equal(capture.accept(sample(40), 150), null)
    assert.equal(capture.accept(sample(40), 150), null)
    assert.equal(capture.accept(sample(40), 150), 40)
  }
})

test('rejects unstable, missing stability, stale, offline, nonfinite, overweight and tare-only readings', () => {
  for (const invalid of [sample(40, { isStable: false }), sample(40, { isStable: undefined }), sample(40, { online: false }), sample(40, { timestamp: '2000-01-01' }), sample(NaN), sample(151), sample(1.2)]) {
    const capture = new ReceptionWeightCapture()
    empty(capture)
    for (let i = 0; i < 4; i++) assert.equal(capture.accept(invalid, 150), null)
  }
})

test('weight variation must settle within configured tolerance', () => {
  const capture = new ReceptionWeightCapture()
  empty(capture)
  for (const weight of [40, 40.1, 40.2, 40.3]) assert.equal(capture.accept(sample(weight), 150, 20), null)
  assert.equal(capture.accept(sample(40.3), 150), null)
  assert.equal(capture.accept(sample(40.3), 150), 40.3)
})

test('a reconnect cannot refill a loaded scale', () => {
  const capture = new ReceptionWeightCapture()
  empty(capture)
  capture.accept(sample(40), 150)
  capture.accept(sample(40, { online: false }), 150)
  for (let i = 0; i < 5; i++) assert.equal(capture.accept(sample(40), 150), null)
  empty(capture)
  capture.accept(sample(40), 150)
  capture.accept(sample(40), 150)
  assert.equal(capture.accept(sample(40), 150), 40)
})

test('Next Waring consumes the field, prevents double Assign and retains the farmer', () => {
  const next = appendReceptionWeight({ ...fresh(), weight: '40' }, '40', 150)
  assert.equal(next.items.length, 1)
  assert.equal(next.weight, '')
  assert.equal(next.farmerCode, 'FMR-001')
  assert.throws(() => appendReceptionWeight(next, next.weight, 150), /exceed/)
  assert.equal(next.items.length, 1)
})

test('manual weights, edits, and receipt totals use numeric gram precision', () => {
  let draft = fresh()
  for (const weight of ['40', '50', '60']) draft = appendReceptionWeight(draft, weight, 150)
  assert.deepEqual(receptionTotals(draft.items), { grossWeightKg: 150, tareWeightKg: 3.6, netWeightKg: 146.4 })
  const edited = appendReceptionWeight(draft, '45.123', 150, draft.items[0].captureId)
  assert.equal(edited.items.length, 3)
  assert.equal(edited.items[0].grossWeightKg, 45.123)
  for (const weight of ['1.2', '0', '-1', 'NaN', 'Infinity', '151', '40,1']) assert.throws(() => appendReceptionWeight(draft, weight, 150))
})

test('a pending or saved snapshot cannot gain another last waring on retry', () => {
  const draft = appendReceptionWeight(fresh(), '60', 150)
  assert.throws(() => appendReceptionWeight({ ...draft, pending: true }, '60', 150), /already/)
  assert.throws(() => appendReceptionWeight({ ...draft, saved: {} }, '60', 150), /already/)
})

test('draft restoration is scoped by operator and rejects malformed data', () => {
  const values = new Map()
  globalThis.sessionStorage = { getItem: (key) => values.get(key) ?? null }
  const draft = appendReceptionWeight(fresh(), '40', 150)
  values.set(receptionDraftKey('operator-a'), JSON.stringify(draft))
  assert.deepEqual(readReceptionDraft('operator-a'), draft)
  assert.equal(readReceptionDraft('operator-b'), null)
  values.set(receptionDraftKey('operator-a'), '{bad')
  assert.equal(readReceptionDraft('operator-a'), null)
})
