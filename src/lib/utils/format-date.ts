import { format, formatDistanceToNow, parseISO } from 'date-fns'

/**
 * Format a date string or Date object
 */
export function formatDate(
  date: string | Date | null | undefined,
  formatStr = 'MMM d, yyyy'
): string {
  if (!date) return '-'

  const dateObj = typeof date === 'string' ? parseISO(date) : date
  return format(dateObj, formatStr)
}

/**
 * Format date with time
 */
export function formatDateTime(
  date: string | Date | null | undefined
): string {
  return formatDate(date, 'MMM d, yyyy h:mm a')
}

/**
 * Format as relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(
  date: string | Date | null | undefined
): string {
  if (!date) return '-'

  const dateObj = typeof date === 'string' ? parseISO(date) : date
  return formatDistanceToNow(dateObj, { addSuffix: true })
}

/**
 * Format for sync status display
 */
export function formatSyncTime(
  date: string | Date | null | undefined
): string {
  if (!date) return 'Never synced'

  const dateObj = typeof date === 'string' ? parseISO(date) : date
  const relative = formatDistanceToNow(dateObj, { addSuffix: true })

  return `Last synced ${relative}`
}

/**
 * Format month key from orders_by_month (e.g., "2024-01" -> "Jan 2024")
 */
export function formatMonthKey(key: string): string {
  const [year, month] = key.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1)
  return format(date, 'MMM yyyy')
}

/**
 * Get current month key for orders_by_month format
 */
export function getCurrentMonthKey(): string {
  return format(new Date(), 'yyyy-MM')
}

/**
 * Get previous N months as keys
 */
export function getPreviousMonthKeys(n: number): string[] {
  const keys: string[] = []
  const now = new Date()

  for (let i = 0; i < n; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    keys.push(format(date, 'yyyy-MM'))
  }

  return keys
}
