import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { encodeEAN13, validGTIN13 } from '../src/lib/ean13.ts'

test('encodes a known EAN-13 symbol with parity and quiet zones', () => {
  const expected = '00000000000' + '101' +
    '0001101' + '0100111' + '0101111' + '0111101' + '0001001' + '0110011' +
    '01010' + '1000010' + '1000010' + '1000010' + '1110100' + '1000010' + '1100110' +
    '101' + '0000000'
  assert.equal(encodeEAN13('4006381333931'), expected)
})

test('rejects invalid GTIN digits and lengths', () => {
  for (const value of ['', '8994477090011', '899447709001', '899447709001X']) {
    assert.equal(validGTIN13(value), false)
    assert.throws(() => encodeEAN13(value))
  }
})

test('all built-in Packaging variants carry valid GTIN-13 barcodes', () => {
  const source = readFileSync(new URL('../src/services/api.ts', import.meta.url), 'utf8')
  const codes = [...source.matchAll(/gtin: '(\d{13})'/g)].map(match => match[1])
  assert.ok(codes.length >= 14)
  for (const code of codes) {
    assert.equal(validGTIN13(code), true, code)
    assert.equal(encodeEAN13(code).length, 113)
  }
})
