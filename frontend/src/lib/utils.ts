import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats net weight in kg without misleading trailing zeroes.
 * Prevents "123" from displaying as "123.000" (which looks like 123,000 / thousands in Indonesian notation).
 * e.g. 123 -> "123", 123.5 -> "123.5", 1.002 -> "1.002"
 */
export function formatWeight(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === '') return '0'
  const num = typeof val === 'string' ? parseFloat(val) : val
  if (isNaN(num)) return '0'
  return parseFloat(num.toFixed(3)).toString()
}

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
  return isNaN(d.getTime()) ? fallback : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function formatSafeDateTime(val: any, fallback = '—'): string {
  if (!val) return fallback
  const d = new Date(val)
  return isNaN(d.getTime()) ? fallback : d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
}

