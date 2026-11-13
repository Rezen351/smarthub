export function resolveFarmerId(raw: any): string | undefined {
  const value = raw?.farmerId || raw?.farmerProfile?.code
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}
