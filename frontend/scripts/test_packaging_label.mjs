import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile, writeFile, unlink } from 'node:fs/promises'
import ts from 'typescript'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const componentURL = new URL('../.packaging-label-test.mjs', import.meta.url)
const encoderURL = new URL('../src/lib/barcodeEncoder.ts', import.meta.url).href
const source = await readFile(new URL('../src/components/operator/PackagingLabel.tsx', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source.replace("'../../lib/barcodeEncoder'", JSON.stringify(encoderURL)).replace("'../../lib/weightFormat'", JSON.stringify(new URL('../src/lib/weightFormat.ts', import.meta.url).href)), {
  compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
})
await writeFile(componentURL, outputText)
let PackagingLabel
try { PackagingLabel = (await import(componentURL.href)).default } finally { await unlink(componentURL) }
const product = { productNumber: '001', gtin: '8994477090010', brand: 'Eptilu Premium Potato', productName: 'Washed potatoes 10 kg', nominalWeightKg: 10, package: 'box', washDecision: 'WASHED', gtinValid: true }
const render = (props = {}) => renderToStaticMarkup(createElement(PackagingLabel, { code: 'EXP-20261115-0001', product, grade: 'A', weightKg: 10, date: '2026-11-15', ...props }))

test('saved Packaging label renders only weight, grade, and one GS1 barcode', () => {
  const html = render()
  assert.equal((html.match(/<svg /g) || []).length, 1)
  assert.ok(html.includes('ean13 8994477090010'))
  assert.ok(html.includes('Weight: 10,000 kg'))
  assert.ok(html.includes('Grade: A'))
  assert.ok(html.includes('GS1 Barcode'))
  assert.ok(!html.includes('Operational Barcode'))
  assert.ok(!html.includes(product.productName))
  assert.ok(!html.includes('PACKAGING LABEL'))
  assert.ok(!html.includes('QR'))
})
test('check-digit mismatch still renders one GS1 barcode as listed', () => {
  const html = render({ product: { ...product, gtin: '8994477090011', gtinValid: false } })
  assert.equal((html.match(/<svg /g) || []).length, 1)
  assert.ok(html.includes('aria-label="ean13 8994477090011'))
  assert.ok(!html.includes('Operational Barcode'))
})
test('missing product snapshot cannot render a GS1 symbol', () => {
  const html = render({ product: null })
  assert.equal((html.match(/<svg /g) || []).length, 0)
  assert.ok(!html.includes('aria-label="ean13'))
  assert.ok(html.includes('unavailable'))
})
test('GS1-only preview renders one barcode regardless of operational save state', () => {
  const html = render({ code: 'Assigned on save' })
  assert.equal((html.match(/<svg /g) || []).length, 1)
  assert.ok(html.includes('GS1 Barcode'))
})

test('printed weight uses a comma and distinguishes one from one thousand kilograms', () => {
  assert.ok(render({ weightKg: 1 }).includes('1,000 kg'))
  assert.ok(render({ weightKg: 1000 }).includes('1000,000 kg'))
  assert.ok(!render({ weightKg: 1 }).includes('1.000 kg'))
})
