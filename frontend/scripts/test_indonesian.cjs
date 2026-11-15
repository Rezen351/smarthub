const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const source = fs.readFileSync(path.join(root, 'src/lib/indonesian.ts'), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText
const exportsObject = {}
vm.runInNewContext(compiled, {
  exports: exportsObject,
  require: (file) => require(path.join(root, 'src/lib', file)),
})
const { idText, translateText, translateApiError } = exportsObject

for (const [english, indonesian] of [
  ['Sign In', 'Masuk'],
  ['Capture Weight', 'Ambil Bobot'],
  ['Grade A', 'Mutu A'],
  ['IN_USE', 'Digunakan'],
  ['BUFFER_WAITING', 'Menunggu Pemilahan'],
  ['FARMER', 'Petani'],
  ['EXPORT_CARTON', 'Karton Ekspor'],
  ['Weight Start Register', 'Register Awal Bobot'],
  ['Dismiss notification', 'Tutup notifikasi'],
  ['TRACEABILITY SYSTEM', 'SISTEM KETERTELUSURAN'],
]) {
  assert.equal(translateText(english), indonesian)
  assert.equal(translateText(indonesian), indonesian)
}

// Presentation must not mutate business objects, numbers, identifiers, URLs, or handlers.
const payload = { status: 'IN_USE', grade: 'A', weightKg: 12.5, code: 'PLT-001' }
const before = JSON.stringify(payload)
assert.equal(idText(payload), payload)
assert.equal(JSON.stringify(payload), before)
for (const value of [0, 12.5, null, undefined, 'PLT-GRD-A-001', 'FMR-001', 'WRG-001', 'PCH-001', '/api/v1/scales', 'https://localhost:5173/']) {
  assert.equal(idText(value), value)
}
const handler = () => payload
assert.equal(idText(handler), handler)
assert.equal(translateText('Scanned: PLT-001'), 'Dipindai: PLT-001')
assert.doesNotMatch(translateText('Server status: Online'), /Online/i)
assert.equal(translateText('Grade A'), 'Mutu A')
assert.equal(idText(['FARMER', 12.5, payload])[0], 'Petani')
assert.equal(translateApiError('Invalid credentials', 401), 'Email atau kata sandi salah')
assert.equal(translateApiError('Unknown server validation wording', 400), 'Data tidak valid. Periksa isian Anda.')
assert.equal(translateApiError('Unknown server failure', 503), 'Terjadi gangguan server. Coba lagi nanti.')
assert.match(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /lang="id"/)
assert.match(fs.readFileSync(path.join(root, 'src/components/shared/IdCard.tsx'), 'utf8'), />SISTEM KETERTELUSURAN</)
console.log('Indonesian UI, status labels, errors, print text, and API value preservation verified.')
