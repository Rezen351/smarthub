import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, extname, sep } from 'node:path'
import { spawn } from 'node:child_process'
import { setTimeout as pause } from 'node:timers/promises'

// Exercise the production bundle through Chrome's built-in DevTools protocol.
const root = resolve(import.meta.dirname, '../dist')
const profile = await mkdtemp(join(tmpdir(), 'reception-browser-'))
const state = { records: [], attempts: [], printed: [], failSave: true, failPrint: true }
const server = createServer(async (req, res) => {
  const reply = (data, status = 200) => {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(data))
  }
  if (req.url.startsWith('/api/')) {
    let raw = ''
    for await (const chunk of req) raw += chunk
    const body = raw ? JSON.parse(raw) : {}
    if (req.url.endsWith('/health')) return reply({ status: 'ok', database: 'connected' })
    if (req.method === 'POST' && req.url.endsWith('/weighing')) {
      state.attempts.push(body)
      if (state.failSave) return reply({ error: { message: 'Save unavailable' } }, 500)
      let saved = state.records.find((record) => record.id === body.requestId)
      if (!saved) {
        saved = { ...body, id: body.requestId, code: `WRG-20261125-${body.requestId.replaceAll('-', '')}`,
          farmerName: 'Test Farmer', status: 'PENDING', createdAt: new Date().toISOString() }
        state.records.push(saved)
      }
      return reply({ success: true, data: saved }, 201)
    }
    if (req.method === 'POST' && req.url.endsWith('/print')) {
      if (state.failPrint && state.printed.length === 4) return reply({ error: { message: 'Printer offline' } }, 502)
      state.printed.push(...body.jobs)
      return reply({ success: true, data: {} })
    }
    let data = []
    if (req.url.endsWith('/farmers')) data = [{ code: 'FMR-001', name: 'Test Farmer', village: 'Test Village' }]
    if (req.url.endsWith('/weighing')) data = state.records
    if (req.url.endsWith('/weight')) data = { online: true, isStable: true, weightKg: 25, capacityKg: 150 }
    if (req.url.endsWith('/test')) data = { online: true }
    return reply({ success: true, data })
  }
  try {
    let file = join(root, decodeURIComponent(req.url.split('?')[0]))
    if (!file.startsWith(root)) { res.writeHead(403); res.end(); return }
    if (!extname(file)) file = join(root, 'index.html')
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }
    const contents = await readFile(file)
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' })
    res.end(contents)
  } catch { res.writeHead(404); res.end() }
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' })
let socket
try {
  let port
  for (let index = 0; index < 150; index++) {
    try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break } catch { await pause(100) }
  }
  assert.ok(port, 'Chrome did not start')
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  socket = new WebSocket(tabs.find((tab) => tab.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }))
  let id = 0
  const pending = new Map()
  socket.addEventListener('message', ({ data }) => {
    const result = JSON.parse(data)
    const request = pending.get(result.id)
    if (!request) return
    pending.delete(result.id)
    if (result.error) request.reject(new Error(JSON.stringify(result.error)))
    else request.resolve(result.result)
  })
  const cdp = (method, params = {}) => new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
  const js = async (expression) => {
    const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
    return result.result.value
  }
  const wait = async (expression) => {
    for (let index = 0; index < 200; index++) {
      if (await js(expression)) return
      await pause(100)
    }
    throw new Error(`Timed out: ${expression}\n${await js('document.body.innerText')}`)
  }
  const click = async (label) => {
    await wait(`[...document.querySelectorAll('button')].some(b => b.textContent.trim() === ${JSON.stringify(label)} && !b.disabled && b.getClientRects().length)`)
    await js(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)} && !b.disabled && b.getClientRects().length).click()`)
  }
  const input = async (selector, value) => {
    await js(`(() => { const i = document.querySelector(${JSON.stringify(selector)});
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ${JSON.stringify(value)});
      i.dispatchEvent(new Event('input', { bubbles: true })); })()`)
  }
  await cdp('Page.enable')
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source:
    'localStorage.setItem("user", JSON.stringify({id:"test-operator",name:"Operator",role:"OPERATOR"}));' })
  await cdp('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/dashboard/weighing` })
  await wait('!!document.querySelector("input[placeholder*=barcode]")')
  await input('input[placeholder*=barcode]', 'FMR-001')
  await click('Verify')
  for (let bag = 1; bag <= 10; bag++) {
    await click('Capture Weight')
    assert.equal(await js('document.getElementById("focus-weighing-weight").value'), '25')
    assert.equal(await js('document.body.innerText.includes("Tare (Offset)")'), false)
    await click('Review Weight')
    if (bag === 1) {
      await click('Save & Next Bag')
      await wait('document.body.innerText.includes("Retry Save & Next Bag")')
      assert.equal(state.printed.length, 0)
      state.failSave = false
      await click('Retry Save & Next Bag')
      assert.equal(state.attempts[0].requestId, state.attempts[1].requestId)
    } else if (bag < 10) await click('Save & Next Bag')
    else await click('Finish & Print')
    await wait(`document.querySelector('[aria-label="Saved bags"]')?.children.length === ${bag}`)
    if (bag < 10) assert.equal(state.printed.length, 0, 'Weighing must not print')
    if (bag === 5) {
      await cdp('Page.reload')
      await wait('document.querySelector("[aria-label=\\"Saved bags\\"]")?.children.length === 5')
      await click('Save & Next Bag')
    }
  }
  await wait('document.body.innerText.includes("Print failed. Intake is saved.")')
  assert.equal(state.records.length, 10)
  assert.equal(state.printed.length, 4)
  assert.equal(state.printed[0].type, 'receipt')
  assert.equal(state.printed[0].items.length, 10)
  assert.equal(state.printed[0].weightKg, 250)
  assert.ok(state.records.every((record) => record.tareWeightKg === 0 && record.netWeightKg === 25))
  await cdp('Page.reload')
  await wait('document.body.innerText.includes("Retry Print")')
  state.failPrint = false
  await click('Retry Print')
  await wait('document.body.innerText.includes("Receipt and labels sent to printer")')
  assert.equal(state.records.length, 10, 'Print retry created another bag')
  assert.equal(state.printed.length, 11, 'Print retry duplicated completed tickets')
  assert.equal(state.printed.filter((job) => job.type === 'receipt').length, 1)
  for (const width of [360, 768, 1440]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false })
    await pause(100)
    assert.ok(await js('document.documentElement.scrollWidth <= innerWidth'), `Overflow at ${width}: ${JSON.stringify(await js(
      '[...document.querySelectorAll(".station-page *")].filter(e => e.getBoundingClientRect().right > innerWidth + 1).slice(0, 8).map(e => ({tag:e.tagName, cls:e.className, text:e.textContent.slice(0,80),right:e.getBoundingClientRect().right}))'))}`)
  }
  await click('Next Farmer')
  await wait('!!document.querySelector("input[placeholder*=barcode]")')
  assert.equal(await js('document.querySelector("[aria-label=\\"Saved bags\\"]")'), null)
  console.log('PASS: 10 bags, zero tare, no per-bag printing, save retry, reload recovery, one receipt, 10 labels, print resume, and responsive widths.')
} finally {
  socket?.close()
  chrome.kill()
  server.closeAllConnections()
  await new Promise((resolve) => server.close(resolve))
  await pause(500)
  assert.ok(resolve(profile).startsWith(resolve(tmpdir()) + sep), 'Browser profile must stay inside the temporary directory')
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}
