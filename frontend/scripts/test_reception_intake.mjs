import assert from 'node:assert/strict'
import { test } from 'node:test'
import { saveReceptionIntake } from '../src/lib/receptionIntake.ts'

const draft = {
  id: 'draft-1',
  farmerId: 'FMR-001',
  farmerName: 'Farmer',
  weightKg: 12,
  status: 'PENDING',
}

test('uses server identity only after persistence completes', async () => {
  let finish
  let request
  const saving = saveReceptionIntake(draft, (body) => {
    request = body
    return new Promise((resolve) => { finish = resolve })
  })
  assert.equal(draft.status, 'PENDING')
  assert.equal(draft.waringCode, undefined)
  finish({ id: 'server-42', code: 'WRG-SERVER-42' })
  const saved = await saving
  assert.equal(saved.id, 'server-42')
  assert.equal(saved.waringCode, 'WRG-SERVER-42')
  assert.equal(saved.status, 'BUFFER_WAITING')
  assert.equal(request.grossWeightKg, 12)
  assert.equal(request.farmerCode, 'FMR-001')
  assert.equal(draft.id, 'draft-1')
})

test('failure retains the draft and a retry can save it', async () => {
  await assert.rejects(saveReceptionIntake(draft, async () => {
    throw new Error('Network unavailable')
  }), /Network unavailable/)
  assert.equal(draft.status, 'PENDING')
  const saved = await saveReceptionIntake(draft, async () => ({ id: 'retry', code: 'WRG-RETRY' }))
  assert.equal(saved.waringCode, 'WRG-RETRY')
})

test('reprinting a saved intake never creates another record', async () => {
  const saved = { ...draft, waringCode: 'WRG-SAVED', status: 'BUFFER_WAITING' }
  assert.equal(await saveReceptionIntake(saved, async () => { assert.fail('Unexpected create') }), saved)
})

test('rejects invalid weights before sending a request', async () => {
  for (const weightKg of [0, -1, NaN, Infinity]) {
    await assert.rejects(saveReceptionIntake({ ...draft, weightKg }, async () => {
      assert.fail('Invalid weight sent to server')
    }), /valid weight/)
  }
})

test('a malformed response cannot become a successful intake', async () => {
  await assert.rejects(saveReceptionIntake(draft, async () => ({ id: 'only-id' })), /did not confirm/)
})
