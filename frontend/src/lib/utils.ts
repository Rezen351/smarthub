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

