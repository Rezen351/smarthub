import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile, writeFile, unlink } from 'node:fs/promises'
import ts from 'typescript'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const componentURL = new URL('../.packaging-label-test.mjs', import.meta.url)
const encoderURL = new URL('../src/lib/barcodeEncoder.ts', import.meta.url).href
const source = await readFile(new URL('../src/components/operator/PackagingLabel.tsx', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source.replace("'../../lib/barcodeEncoder'", JSON.stringify(encoderURL)), {
  compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
})
await writeFile(componentURL, outputText)
let PackagingLabel
try { PackagingLabel = (await import(componentURL.href)).default } finally { await unlink(componentURL) }
const product = { productNumber: '001', gtin: '8994477090010', brand: 'Eptilu Premium Potato', productName: 'Washed potatoes 10 kg', nominalWeightKg: 10, package: 'box', washDecision: 'WASHED', gtinValid: true }
const render = (props = {}) => renderToStaticMarkup(createElement(PackagingLabel, { code: 'EXP-20261115-0001', product, grade: 'A', weightKg: 10, date: '2026-11-15', ...props }))

test('saved Packaging label renders exactly two barcode symbols without QR', () => {
  const html = render()
  assert.equal((html.match(/<svg /g) || []).length, 2)
  assert.ok(html.includes('code128 EXP-20261115-0001'))
  assert.ok(html.includes('ean13 8994477090010'))
  assert.ok(html.includes(product.productName))
  assert.ok(!html.includes('QR'))
})
test('invalid and historical products cannot render a GS1 symbol', () => {
  for (const p of [null, { ...product, gtin: '8994477090011' }]) {
    const html = render({ product: p })
    assert.equal((html.match(/<svg /g) || []).length, 1)
    assert.ok(!html.includes('aria-label="ean13'))
    assert.ok(html.includes('blocked') || html.includes('Invalid GTIN'))
  }
})
test('unsaved preview never invents an operational barcode', () => {
  const html = render({ code: 'Assigned on save' })
  assert.equal((html.match(/<svg /g) || []).length, 1)
  assert.ok(html.includes('Assigned on save'))
})
