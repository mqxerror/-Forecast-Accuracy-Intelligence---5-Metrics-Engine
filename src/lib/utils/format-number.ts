/**
 * Number formatting utilities
 */

const numberFormatter = new Intl.NumberFormat('en-US')

const percentFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/**
 * Format a number with thousands separators
 */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return numberFormatter.format(value)
}

/**
 * Format a number compactly (1.2K, 3.5M)
 */
export function formatNumberCompact(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`
  }

  return formatNumber(value)
}

/**
 * Format as percentage (expects decimal, e.g., 0.15 -> 15.0%)
 */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return percentFormatter.format(value)
}

/**
 * Format as percentage points (expects percentage value, e.g., 15.5 -> 15.5%)
 */
export function formatPercentage(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined) return '-'
  return `${value.toFixed(decimals)}%`
}

/**
 * Format change with sign and color class
 */
export function formatChange(value: number | null | undefined): {
  text: string
  colorClass: string
} {
  if (value === null || value === undefined) {
    return { text: '-', colorClass: 'text-gray-500' }
  }

  const formatted = formatNumber(Math.abs(value))

  if (value > 0) {
    return { text: `+${formatted}`, colorClass: 'text-green-600' }
  }
  if (value < 0) {
    return { text: `-${formatted}`, colorClass: 'text-red-600' }
  }
  return { text: formatted, colorClass: 'text-gray-500' }
}

/**
 * Format days (e.g., lead time)
 */
export function formatDays(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return `${value} ${value === 1 ? 'day' : 'days'}`
}
