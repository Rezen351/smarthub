export interface NormalizedScaleEndpoint {
  host: string
  port: number
}

export function normalizeScaleEndpoint(host: unknown, port: unknown): NormalizedScaleEndpoint | null {
  const normalizedHost = typeof host === 'string' ? host.trim() : ''
  const normalizedPort = typeof port === 'number' || typeof port === 'string' ? Number(port) : NaN

  if (
    !normalizedHost ||
    !Number.isInteger(normalizedPort) ||
    normalizedPort < 1 ||
    normalizedPort > 65535
  ) {
    return null
  }

  return { host: normalizedHost, port: normalizedPort }
}
