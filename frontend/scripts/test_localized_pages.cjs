const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { MemoryRouter } = require('react-router-dom')
const root = path.resolve(__dirname, '../src')
const originalResolve = Module._resolveFilename
Module._resolveFilename = function (request, ...args) {
  return originalResolve.call(this, request.startsWith('@/') ? path.join(root, request.slice(2)) : request, ...args)
}
for (const extension of ['.tsx', '.ts']) {
  require.extensions[extension] = (module, filename) => {
    const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    })
    module._compile(outputText, filename)
  }
}
const storage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
global.window = { location: { origin: 'https://localhost:5173', href: 'https://localhost:5173/' } }
global.localStorage = storage
global.sessionStorage = storage
const auth = require('../src/hooks/useAuth.tsx')
let loginPage = false
auth.useAuth = () => ({ user: loginPage ? null : { id: 'test', name: 'Budi', email: 'uji@example.test', role: 'ADMIN' }, loading: false, logout: () => {} })
const { ToastProvider } = require('../src/components/feedback/Toast.tsx')
const { SessionContextProvider } = require('../src/hooks/useSessionContext.tsx')
const forbidden = /\b(?:save|settings|weight|grades?|warehouse|pallets?|farmers?|dashboard|print|loading|traceability|sorting|packaging|reception|dispatch|online|offline|checking|months?|select|scan|enter|back|proceed|continue|cancel|username|password|delete|retry|refresh|close|welcome|your|please|today|daily|weekly|available|completed|pending|source|preview|records|captured)\b/i
const pages = fs.readdirSync(path.join(root, 'pages')).filter((name) => name.endsWith('Page.tsx') || name.endsWith('Home.tsx'))
const failures = []
for (const filename of pages) {
  loginPage = filename === 'LoginPage.tsx'
  const Page = require(path.join(root, 'pages', filename)).default
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null,
    React.createElement(ToastProvider, null,
      React.createElement(SessionContextProvider, null, React.createElement(Page)))))
  const text = html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
  if (forbidden.test(text)) failures.push({ page: filename, words: [...new Set(text.match(new RegExp(forbidden.source, 'gi')))] })
  console.log(`${filename}: audited`)
}

assert.deepEqual(failures, [], 'Every page must render Indonesian UI text')
