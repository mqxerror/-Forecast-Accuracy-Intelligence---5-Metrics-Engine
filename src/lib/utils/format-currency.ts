/**
 * Currency formatting utilities
 */

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const currencyFormatterWithCents = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * Format a number as currency (USD)
 * @param value - The number to format
 * @param showCents - Whether to show cents (default: false for large numbers)
 */
export function formatCurrency(
  value: number | null | undefined,
  showCents = false
): string {
  if (value === null || value === undefined) return '-'

  if (showCents) {
    return currencyFormatterWithCents.format(value)
  }

  return currencyFormatter.format(value)
}

/**
 * Format a large currency value with abbreviations
 * e.g., $1.2M, $450K
 */
export function formatCurrencyCompact(
  value: number | null | undefined
): string {
  if (value === null || value === undefined) return '-'

  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`
  }

  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`
  }

  return formatCurrency(value)
}

/**
 * Format value change with sign
 * e.g., +$1,234 or -$567
 */
export function formatCurrencyChange(
  value: number | null | undefined
): string {
  if (value === null || value === undefined) return '-'

  const formatted = formatCurrency(Math.abs(value))
  if (value > 0) return `+${formatted}`
  if (value < 0) return `-${formatted}`
  return formatted
}
