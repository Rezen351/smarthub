import { normalizeScaleEndpoint } from './scales.validation'

describe('normalizeScaleEndpoint', () => {
  it('trims a valid host and converts a numeric string port', () => {
    expect(normalizeScaleEndpoint('  scale-01.local ', '502')).toEqual({
      host: 'scale-01.local',
      port: 502,
    })
  })

  it('rejects missing hosts and ports outside the TCP range', () => {
    expect(normalizeScaleEndpoint('', 502)).toBeNull()
    expect(normalizeScaleEndpoint('192.168.1.100', 0)).toBeNull()
    expect(normalizeScaleEndpoint('192.168.1.100', 65536)).toBeNull()
    expect(normalizeScaleEndpoint('192.168.1.100', 502.5)).toBeNull()
  })
})
