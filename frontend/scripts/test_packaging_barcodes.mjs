import assert from 'node:assert/strict'
import { test } from 'node:test'
import { encodeCode128, encodeEAN13, validGTIN13 } from '../src/lib/barcodeEncoder.ts'

test('GTIN check digit preserves Excel data and rejects invalid entries', () => {
  for (let i = 0; i < 6; i++) assert.equal(validGTIN13(`899447709001${i}`), i === 0)
  for (const value of ['', '899447709001', '899447709001x']) assert.equal(validGTIN13(value), false)
})
test('EAN-13 encodes known symbol, guards, parity and quiet zones', () => {
  const bits = encodeEAN13('4006381333931')
  assert.equal(bits, '00000000000' + '101' + '0001101' + '0100111' + '0101111' + '0111101' + '0001001' + '0110011' + '01010' + '1000010' + '1000010' + '1000010' + '1110100' + '1000010' + '1100110' + '101' + '0000000')
  assert.equal(bits.length, 113)
  assert.throws(() => encodeEAN13('8994477090011'), /Invalid GTIN/)
})
test('Code128 B encodes an independent known checksum vector', () => {
  // Start B=104, A=33, B=34, checksum=(104+33+2*34)%103=102, stop=106.
  assert.equal(encodeCode128('AB'), '0000000000' + '11010010000' + '10100011000' + '10001011000' + '11110101110' + '1100011101011' + '0000000000')
  const bits = encodeCode128('EXP-20261115-0001')
  assert.match(bits, /^[01]+$/)
  assert.ok(bits.length * 2 <= 576, 'operational barcode exceeds printable 80 mm width')
  assert.throws(() => encodeCode128('\n'), /Invalid operational/)
})
