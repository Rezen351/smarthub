import dictionary from './indonesianMessages.json'
import templates from './indonesianTemplates.json'

const messages: Record<string, string> = dictionary
const normalized = new Map(Object.entries(messages).map(([key, value]) => [key.toLowerCase(), value]))
const statusValues = new Set(['ONLINE', 'OFFLINE', 'CHECKING', 'CONNECTED', 'DISCONNECTED', 'RECONNECTING', 'AVAILABLE', 'IN_USE', 'READY', 'LOADING', 'DEPARTED', 'DELIVERED', 'DEPLETED', 'STORED', 'SORTED', 'PENDING', 'APPROVED', 'FARMER', 'OPERATOR', 'ADMIN'])
const patterns = templates.map(({ pattern, parts }) => ({ regex: new RegExp(pattern), parts }))

/** Translate presentation text only; API values and form state retain their original values. */
export function translateText(text: string): string {
  const key = text.replace(/\s+/g, ' ').trim()
  const exact = messages[key] ?? normalized.get(key.toLowerCase()) ?? messages[key.replace(/ /g, '_')]
  if (exact !== undefined) return exact
  for (const { regex, parts } of patterns) {
    const match = regex.exec(text)
    if (match) {
      return parts.map((part, index) => {
        const value = match[index + 1] ?? ''
        const displayValue = statusValues.has(value.toUpperCase())
          ? (messages[value] ?? normalized.get(value.toLowerCase()) ?? value)
          : value
        return part + displayValue
      }).join('')
    }
  }
  return text
}

/** Keep React elements, numbers, identifiers, and event handlers intact. */
export function idText<T>(value: T): T {
  if (typeof value === 'string') return translateText(value) as T
  if (Array.isArray(value)) return value.map((item) => idText(item)) as T
  return value
}

/** Unknown server messages stay out of the UI; the response body itself is untouched. */
export function translateApiError(message: string, status: number): string {
  const translated = translateText(message)
  if (translated !== message) return translated
  const fallback: Record<number, string> = {
    400: 'Data tidak valid. Periksa isian Anda.',
    401: 'Email atau kata sandi salah, atau sesi telah berakhir.',
    403: 'Anda tidak memiliki akses untuk tindakan ini.',
    404: 'Data tidak ditemukan.',
    409: 'Data sedang digunakan atau sudah terdaftar.',
    422: 'Data belum lengkap atau tidak valid.',
    429: 'Terlalu banyak permintaan. Coba lagi nanti.',
  }
  return fallback[status] ?? (status >= 500
    ? 'Terjadi gangguan server. Coba lagi nanti.'
    : 'Permintaan gagal. Periksa data dan coba lagi.')
}
