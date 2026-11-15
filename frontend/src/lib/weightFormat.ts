const displayFormatters = new Map<number, Intl.NumberFormat>()

/** Display kilograms with a decimal comma and no thousands separator. */
export function formatWeight(value: number | string | undefined | null, decimals?: number): string {
  const number = value === undefined || value === null || value === '' ? 0 : Number(value)
  const finite = Number.isFinite(number) ? number : 0
  const precision = decimals ?? -1
  let formatter = displayFormatters.get(precision)
  if (!formatter) {
    formatter = new Intl.NumberFormat('id-ID', {
      useGrouping: false,
      minimumFractionDigits: decimals ?? 0,
      maximumFractionDigits: decimals ?? 3,
    })
    displayFormatters.set(precision, formatter)
  }
  const rounded = Number(finite.toFixed(decimals ?? 3))
  return formatter.format(rounded === 0 ? 0 : rounded)
}

/** Numeric inputs and API payloads retain dot-decimal values. */
export function weightInputValue(value: number): string {
  return Number.isFinite(value) ? Number(value.toFixed(3)).toString() : ''
}
