const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const ts = require('typescript')
const jsx = require('react/jsx-runtime')

const source = fs.readFileSync(path.join(__dirname, '../src/pages/FarmerDashboardHome.tsx'), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText

// Exercise the dashboard effect with controlled requests and browser events.
function dashboard(load, farmerId = 'FMR-002') {
  const state = []
  let cursor = 0
  let effect
  let interval
  let cleanup
  const events = new Map()
  const browser = {
    visibilityState: 'visible',
    setInterval: (callback, ms) => { assert.equal(ms, 5000); interval = callback; return 1 },
    clearInterval: () => { interval = undefined },
    addEventListener: (event, callback) => events.set(event, callback),
    removeEventListener: (event, callback) => {
      assert.equal(events.get(event), callback)
      events.delete(event)
    },
  }
  const moduleExports = {}
  vm.runInNewContext(compiled, {
    exports: moduleExports,
    AbortController,
    document: browser,
    window: browser,
    require: (name) => {
      if (name === 'react/jsx-runtime') return jsx
      if (name === 'react') return {
        useState: (initial) => {
          const slot = cursor++
          if (!(slot in state)) state[slot] = initial
          return [state[slot], (value) => { state[slot] = value }]
        },
        useEffect: (callback) => { effect = callback },
      }
      if (name.endsWith('/useAuth')) return { useAuth: () => ({ user: { farmerId, name: 'Farmer' } }) }
      if (name.endsWith('/services/api')) return { api: { farmers: { summary: load } } }
      if (name.endsWith('/indonesian')) return { idText: (value) => value }
      return { __esModule: true, default: () => null, Link: 'a', Skeleton: () => null }
    },
  })
  const render = () => { cursor = 0; return moduleExports.default() }
  render()
  cleanup = effect()
  return {
    state,
    browser,
    render,
    tick: () => interval?.(),
    event: (name) => events.get(name)?.(),
    stop: () => cleanup?.(),
    eventCount: () => events.size,
  }
}

const settle = () => new Promise((resolve) => setImmediate(resolve))
const summary = (total) => ({ farmerId: 'FMR-002', farmerName: 'Farmer', totalDeposited: total, commodities: [] })

test('loads the linked farmer, refreshes reception totals, and retains totals on errors', async () => {
  let total = 10
  let fail = false
  const calls = []
  const view = dashboard(async (id, signal) => {
    calls.push({ id, signal })
    if (fail) throw new Error('Network unavailable')
    return summary(total)
  })
  await settle()
  assert.equal(calls[0].id, 'FMR-002')
  assert.equal(view.state[0].totalDeposited, 10)
  total = 25
  view.tick()
  await settle()
  assert.equal(view.state[0].totalDeposited, 25)
  fail = true
  view.tick()
  await settle()
  assert.equal(view.state[0].totalDeposited, 25)
  assert.match(view.state[2], /Could not update/)
  fail = false
  total = 30
  view.event('focus')
  await settle()
  assert.equal(view.state[0].totalDeposited, 30)
  assert.equal(view.state[2], '')
  view.browser.visibilityState = 'hidden'
  const before = calls.length
  view.tick()
  await settle()
  assert.equal(calls.length, before)
  view.browser.visibilityState = 'visible'
  view.event('visibilitychange')
  await settle()
  assert.equal(calls.length, before + 1)
  view.stop()
  assert.equal(view.eventCount(), 0)
  assert.equal(calls[0].signal.aborted, true)
  view.tick()
  assert.equal(calls.length, before + 1)
})

test('prevents overlapping requests and ignores responses after unmount', async () => {
  let finish
  let calls = 0
  const view = dashboard(() => {
    calls++
    return new Promise((resolve) => { finish = resolve })
  })
  view.tick()
  view.event('focus')
  assert.equal(calls, 1)
  view.stop()
  finish(summary(50))
  await settle()
  assert.equal(view.state[0], null)
})

test('an account without a farmer profile never requests a fallback farmer', () => {
  const view = dashboard(() => assert.fail('Unexpected farmer request'), null)
  assert.equal(view.state[0], null)
  assert.equal(view.state[1], false)
  assert.match(view.state[2], /No farmer profile/)
  assert.equal(view.eventCount(), 0)
})

test('a failed first load is not represented as a zero deposit', async () => {
  const view = dashboard(async () => { throw new Error('Network unavailable') })
  await settle()
  assert.equal(view.state[0], null)
  assert.equal(view.state[1], false)
  const text = JSON.stringify(view.render())
  assert.match(text, /Reception totals are unavailable/)
  assert.doesNotMatch(text, /0 kg/)
  view.stop()
})
