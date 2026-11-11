import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('resolves the canonical farmer ID from current and legacy auth responses', async () => {
  const source = await readFile(new URL('../src/lib/authUser.ts', import.meta.url), 'utf8')
  assert.match(source, /raw\?\.farmerId \|\| raw\?\.farmerProfile\?\.code/)
  assert.match(source, /value\.trim\(\)/)
})

test('renders and identifies the Farmer ID QR for display and download', async () => {
  const page = await readFile(new URL('../src/pages/FarmerQRPage.tsx', import.meta.url), 'utf8')
  const qr = await readFile(new URL('../src/components/shared/OfflineQrCode.tsx', import.meta.url), 'utf8')
  assert.match(page, /const farmerId = farmerData\?\.code \|\| user\?\.farmerId/)
  assert.match(page, /value=\{farmerId\}/)
  assert.match(page, /dataAttribute="true"/)
  assert.match(qr, /data-farmer-qr=\{dataAttribute\}/)
})
