import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export { formatWeight } from './weightFormat'

/**
 * Safely parses any date string/number/Date without throwing RangeError or displaying "Invalid Date"
 */
export function formatSafeDate(val: any, fallback?: string): string {
  if (!val) return fallback ?? new Date().toISOString().slice(0, 10)
  const d = new Date(val)
  return isNaN(d.getTime()) ? (fallback ?? new Date().toISOString().slice(0, 10)) : d.toISOString().slice(0, 10)
}

export function formatSafeTime(val: any, fallback = '—'): string {
  if (!val) return fallback
  const d = new Date(val)
  return isNaN(d.getTime()) ? fallback : d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

export function formatSafeDateTime(val: any, fallback = '—'): string {
  if (!val) return fallback
  const d = new Date(val)
  return isNaN(d.getTime()) ? fallback : d.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
}

