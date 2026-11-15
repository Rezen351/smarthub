const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const { webcrypto } = require('node:crypto')
const ts = require('typescript')
const jsx = require('react/jsx-runtime')

function compile(file, dependencies, globals = {}) {
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText
  vm.runInNewContext(code, { exports, require: dependencies, crypto: webcrypto, ...globals })
  return exports
}
function scenario({ failSave = false, failPrint = false, restored } = {}) {
  const storage = new Map()
  const sessionStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) }
  const helpers = compile('lib/receptionSession.ts', () => assert.fail('Unexpected import'), { sessionStorage })
  if (restored) sessionStorage.setItem(helpers.receptionDraftKey('op'), JSON.stringify(restored))
  const slots = []
  let cursor = 0
  const effects = []
  const saves = [], prints = []
  const behavior = { failSave, failPrint }
  let phase = 0
  class APIError extends Error {}
  const api = { weighing: {
    saveBatch: async (input) => {
      saves.push(JSON.parse(JSON.stringify(input)))
      if (behavior.failSave) throw new Error('Network unavailable')
      return { ...input, code: 'RCV-001', farmerName: 'Farmer', createdAt: new Date().toISOString(), ...helpers.receptionTotals(input.items), items: input.items.map((item, index) => ({ ...item, id: `w-${index}`, code: `WRG-${index}`, tareWeightKg: 1.2, netWeightKg: helpers.receptionKg(item.grossWeightKg - 1.2) })) }
    },
    printBatch: async (...args) => { prints.push(args); if (behavior.failPrint) throw new Error('Printer offline'); return { jobs: 4 } },
  } }
  const component = compile('components/operator/ReceptionSession.tsx', (name) => {
    if (name === 'react/jsx-runtime') return jsx
    if (name === 'react') return {
      useState: (initial) => { const id = cursor++; if (!(id in slots)) slots[id] = typeof initial === 'function' ? initial() : initial; return [slots[id], (value) => { slots[id] = typeof value === 'function' ? value(slots[id]) : value }] },
      useRef: (initial) => { const id = cursor++; if (!(id in slots)) slots[id] = { current: initial }; return slots[id] },
      useEffect: (effect, deps) => { const id = cursor++; const last = slots[id]; if (!last || deps.some((value, index) => value !== last[index])) { slots[id] = deps; effects.push(effect) } },
    }
    if (name.endsWith('/services/api')) return { api, APIError }
    if (name.endsWith('/receptionSession')) return helpers
    if (name.endsWith('/utils')) return { formatWeight: (value) => String(value) }
    return { __esModule: true, default: name.split('/').pop() }
  }, { sessionStorage, window: { addEventListener() {}, removeEventListener() {} } }).default
  const props = { operatorId: 'op', farmer: { id: 'FMR-001', name: 'Farmer' }, capacityKg: 150, onFinished: () => phase++, onSaved() {}, onNextFarmer() {} }
  function render() { cursor = 0; const tree = component(props); while (effects.length) effects.shift()(); return tree }
  function nodes(node) { return !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)] }
  function text(node) { return node == null || typeof node === 'boolean' ? '' : typeof node !== 'object' ? String(node) : Array.isArray(node) ? node.map(text).join('') : text(node.props?.children) }
  const button = (label) => { const result = nodes(render()).find((node) => node.type === 'Button' && text(node) === label); assert.ok(result, `Missing ${label}`); return result.props }
  const weight = (value) => { const node = nodes(render()).find((node) => node.type === 'ScaleWeightInput'); assert.ok(node); node.props.onChange(value) }
  render()
  return { button, weight, saves, prints, behavior, storage, helpers, render, phase: () => phase,
    actionLayout: () => nodes(render()).find((node) => node.props?.['aria-label'] === 'Weighing actions') }
}
const settle = () => new Promise((resolve) => setImmediate(resolve))

test('Next Waring and Finish are adjacent; Finish assigns the last weight and prints immediately', async () => {
  const view = scenario()
  const actions = view.actionLayout()
  assert.match(actions.props.className, /grid-cols-2/)
  assert.equal(actions.props.children.length, 2)
  view.weight('40'); view.button('Next Waring').onClick()
  view.weight('50'); view.button('Next Waring').onClick()
  assert.equal(view.saves.length, 0)
  view.weight('60'); view.button('Finish').onClick(); view.button('Finish').onClick()
  await settle()
  assert.equal(view.saves.length, 1)
  assert.equal(view.saves[0].items.length, 3)
  assert.deepEqual(view.saves[0].items.map((item) => item.grossWeightKg), [40, 50, 60])
  assert.equal(view.prints.length, 1)
  assert.equal(view.prints[0][1], 'all')
  assert.equal(view.phase(), 1)
})

test('Finish accepts an empty field after Next Waring and blocks invalid or empty sessions', async () => {
  const view = scenario()
  assert.equal(view.button('Finish').disabled, true)
  view.weight('1.2'); assert.equal(view.button('Finish').disabled, true)
  view.weight('40'); view.button('Next Waring').onClick()
  assert.equal(view.button('Finish').disabled, false)
  view.button('Finish').onClick(); await settle()
  assert.equal(view.saves[0].items.length, 1)
})

test('a lost save response freezes the same snapshot and retry does not duplicate the final waring', async () => {
  const view = scenario({ failSave: true })
  view.weight('40'); view.button('Finish').onClick(); await settle()
  assert.equal(view.prints.length, 0)
  assert.equal(view.button('Next Waring').disabled, true)
  view.behavior.failSave = false
  view.button('Finish').onClick(); await settle()
  assert.equal(view.saves.length, 2)
  assert.deepEqual(view.saves[0], view.saves[1])
  assert.equal(view.prints.length, 1)
})

test('printer failure retains saved data; receipt retry does not save another batch', async () => {
  const view = scenario({ failPrint: true })
  view.weight('40'); view.button('Finish').onClick(); await settle()
  assert.equal(view.saves.length, 1)
  view.behavior.failPrint = false
  view.button('Print Receipt').onClick(); await settle()
  assert.equal(view.saves.length, 1)
  assert.equal(view.prints.length, 2)
  assert.equal(view.prints[1][1], 'receipt')
})

test('a restored draft is paused and Finish preserves all previous assignments', async () => {
  const restored = { id: 'restored', farmerCode: 'FMR-001', farmerName: 'Farmer', items: [{ captureId: 'first', grossWeightKg: 40, capturedAt: new Date().toISOString() }], weight: '50' }
  const view = scenario({ restored })
  assert.ok(view.button('Resume'))
  view.button('Finish').onClick(); await settle()
  assert.equal(view.saves[0].items.length, 2)
  assert.equal(view.saves[0].id, 'restored')
})

test('restoring an edit updates the existing waring instead of adding it again', async () => {
  const restored = { id: 'restored-edit', farmerCode: 'FMR-001', farmerName: 'Farmer', editingId: 'first', items: [{ captureId: 'first', grossWeightKg: 40, capturedAt: new Date().toISOString() }], weight: '45' }
  const view = scenario({ restored })
  view.button('Finish').onClick(); await settle()
  assert.equal(view.saves[0].items.length, 1)
  assert.equal(view.saves[0].items[0].grossWeightKg, 45)
})
