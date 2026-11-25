import assert from 'node:assert/strict'
import { test } from 'node:test'
import { saveReceptionIntake, buildReceptionPrintJobs, printReceptionSession } from '../src/lib/receptionIntake.ts'

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
  assert.equal(request.requestId, draft.id)
  assert.equal(request.tareWeightKg, 0)
  assert.equal(request.netWeightKg, 12)
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

test('small positive scale weights are saved without a tare deduction', async () => {
  await saveReceptionIntake({ ...draft, weightKg: 0.5 }, async (request) => {
    assert.equal(request.grossWeightKg, 0.5)
    assert.equal(request.netWeightKg, 0.5)
    assert.equal(request.tareWeightKg, 0)
    return { id: 'small', code: 'WRG-SMALL' }
  })
})

test('ten bags save without printing and produce one receipt plus ten labels', async () => {
  const records = []
  const requests = []
  for (let index = 0; index < 10; index++) {
    records.push(await saveReceptionIntake({ ...draft, id: `draft-${index}`, weightKg: 25 }, async (body) => {
      requests.push(body)
      return { id: `saved-${index}`, code: `WRG-${index}` }
    }))
  }
  assert.equal(requests.length, 10)
  const jobs = buildReceptionPrintJobs(records)
  assert.equal(jobs.length, 11)
  assert.equal(jobs.filter((job) => job.type === 'receipt').length, 1)
  assert.equal(jobs[0].weightKg, 250)
  assert.equal(jobs[0].items.length, 10)
  assert.deepEqual(jobs.slice(1).map((job) => job.code), records.map((record) => record.waringCode))
  assert.ok(jobs.slice(1).every((job) => job.weightKg === 25 && job.type === 'waring'))
})

test('receipt total preserves gram precision', () => {
  const records = [0.1, 0.2, 1.005].map((weightKg, index) => ({
    ...draft, weightKg, waringCode: `WRG-${index}`,
  }))
  assert.equal(buildReceptionPrintJobs(records)[0].weightKg, 1.305)
})

test('cannot print empty, unsaved, duplicate, or mixed-farmer sessions', () => {
  const saved = { ...draft, waringCode: 'WRG-SAVED' }
  for (const records of [[], [draft], [saved, saved], [saved, { ...saved, waringCode: 'WRG-OTHER', farmerId: 'FMR-002' }]]) {
    assert.throws(() => buildReceptionPrintJobs(records))
  }
})

test('print failure resumes with the failed label without resending the receipt', async () => {
  const jobs = buildReceptionPrintJobs([1, 2, 3].map((weightKg, index) => ({
    ...draft, weightKg, waringCode: `WRG-${index}`,
  })))
  const sent = []
  let next = 0
  const pause = async () => {}
  await assert.rejects(printReceptionSession(jobs, 0, async ([job]) => {
    if (sent.length === 2) throw new Error('Printer offline')
    sent.push(job)
  }, (value) => { next = value }, pause), /Printer offline/)
  assert.equal(next, 2)
  await printReceptionSession(jobs, next, async ([job]) => { sent.push(job) }, (value) => { next = value }, pause)
  assert.equal(next, 4)
  assert.deepEqual(sent, jobs)
  await printReceptionSession(jobs, next, async () => assert.fail('Completed session resent'), () => {}, pause)
})

test('failed save retries use the same request identity', async () => {
  const requests = []
  const create = async (request) => {
    requests.push(request)
    if (requests.length === 1) throw new Error('Response lost')
    return { id: draft.id, code: 'WRG-RETRIED' }
  }
  await assert.rejects(saveReceptionIntake(draft, create), /Response lost/)
  await saveReceptionIntake(draft, create)
  assert.equal(requests[0].requestId, requests[1].requestId)
})

test('rejects invalid print progress and oversized sessions', async () => {
  const jobs = buildReceptionPrintJobs([{ ...draft, waringCode: 'WRG-SAVED' }])
  for (const progress of [-1, 0.5, NaN, 3]) {
    await assert.rejects(printReceptionSession(jobs, progress, async () => {
      assert.fail('Invalid print progress sent a job')
    }, () => {}, async () => {}), /Invalid print progress/)
  }
  assert.throws(() => buildReceptionPrintJobs(Array.from({ length: 501 }, (_, index) => ({
    ...draft, waringCode: `WRG-${index}`,
  }))), /500/)
})
