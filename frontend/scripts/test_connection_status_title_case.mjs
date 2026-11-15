import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'

const messages = JSON.parse(await readFile(new URL('../src/lib/indonesianMessages.json', import.meta.url), 'utf8'))

test('connection status translations use title case', () => {
  for (const key of ['Online', 'ONLINE', 'connected', 'online']) assert.equal(messages[key], 'Terhubung')
  for (const key of ['Offline', 'OFFLINE', 'disconnected', 'offline']) assert.equal(messages[key], 'Terputus')
  for (const key of ['Checking', 'CHECKING']) assert.equal(messages[key], 'Memeriksa')
})

test('device connection status captions keep title case', () => {
  for (const key of ['Scale Online', 'Printer Offline', 'Printer Online (']) {
    assert.match(messages[key], /(?:Terhubung|Terputus)/)
  }
})
