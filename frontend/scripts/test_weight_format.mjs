import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatWeight, weightInputValue } from '../src/lib/weightFormat.ts'

test('weight display uses comma decimals without thousands separators', () => {
  for (const [value, expected] of [[1, '1'], [1.2, '1,2'], [1.005, '1,005'], [1000, '1000'], [1000.125, '1000,125'], [-1.25, '-1,25'], [-0.0001, '0']]) {
    assert.equal(formatWeight(value), expected)
  }
  assert.equal(formatWeight(1, 3), '1,000')
  assert.equal(formatWeight(1000, 3), '1000,000')
  assert.equal(formatWeight(1.2, 3), '1,200')
  assert.equal(formatWeight(12.5, 2), '12,50')
})
test('invalid or missing display values safely become zero', () => {
  for (const value of [null, undefined, '', NaN, Infinity, 'bad', '1,2']) assert.equal(formatWeight(value), '0')
  assert.equal(formatWeight('12.125', 3), '12,125')
})
test('scale captures remain valid dot-decimal input and API numbers', () => {
  for (const value of [1, 1.2, 1.005, 1000.125]) {
    const input = weightInputValue(value)
    assert.ok(!input.includes(','))
    assert.equal(Number(input), value)
    assert.equal(JSON.parse(JSON.stringify({ weightKg: Number(input) })).weightKg, value)
  }
  assert.equal(weightInputValue(1.23456), '1.235')
  assert.equal(weightInputValue(NaN), '')
})
