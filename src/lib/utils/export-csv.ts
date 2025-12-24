type CsvValue = string | number | boolean | null | undefined

interface ExportOptions<T> {
  data: T[]
  filename: string
  columns: {
    key: keyof T
    header: string
    format?: (value: T[keyof T]) => CsvValue
  }[]
}

function escapeCsvValue(value: CsvValue): string {
  if (value === null || value === undefined) {
    return ''
  }

  const stringValue = String(value)

  // If the value contains special characters, wrap in quotes and escape internal quotes
  if (
    stringValue.includes(',') ||
    stringValue.includes('"') ||
    stringValue.includes('\n') ||
    stringValue.includes('\r')
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }

  return stringValue
}

export function exportToCsv<T>({ data, filename, columns }: ExportOptions<T>): void {
  // Create header row
  const headers = columns.map((col) => escapeCsvValue(col.header))
  const headerRow = headers.join(',')

  // Create data rows
  const dataRows = data.map((item) => {
    return columns
      .map((col) => {
        const value = item[col.key]
        const formattedValue = col.format ? col.format(value) : value
        return escapeCsvValue(formattedValue)
      })
      .join(',')
  })

  // Combine all rows
  const csvContent = [headerRow, ...dataRows].join('\n')

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`
  link.style.display = 'none'

  document.body.appendChild(link)
  link.click()

  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Pre-configured export for inventory data
export function exportInventoryToCsv(items: {
  id: string
  sku: string
  title: string | null
  brand: string | null
  product_type?: string | null
  in_stock: number
  replenishment: number
  to_order: number
  oos: number
  price?: number | null
  cost_price?: number | null
  forecasted_lost_revenue: number | null
}[]): void {
  exportToCsv({
    data: items,
    filename: 'inventory-export',
    columns: [
      { key: 'sku', header: 'SKU' },
      { key: 'title', header: 'Title' },
      { key: 'brand', header: 'Brand' },
      { key: 'product_type', header: 'Product Type' },
      { key: 'in_stock', header: 'In Stock' },
      { key: 'replenishment', header: 'Replenishment' },
      { key: 'to_order', header: 'To Order' },
      { key: 'oos', header: 'Days OOS' },
      { key: 'price', header: 'Price', format: (v) => v ?? '' },
      { key: 'cost_price', header: 'Cost', format: (v) => v ?? '' },
      {
        key: 'forecasted_lost_revenue',
        header: 'Lost Revenue',
        format: (v) => v ?? '',
      },
    ],
  })
}

// Pre-configured export for forecast metrics
export function exportMetricsToCsv(metrics: {
  sku: string
  mape: number | null
  wape: number | null
  rmse: number | null
  bias: number | null
}[]): void {
  exportToCsv({
    data: metrics,
    filename: 'forecast-metrics-export',
    columns: [
      { key: 'sku', header: 'SKU' },
      {
        key: 'mape',
        header: 'MAPE (%)',
        format: (v) => (v !== null ? Number(v).toFixed(2) : ''),
      },
      {
        key: 'wape',
        header: 'WAPE (%)',
        format: (v) => (v !== null ? Number(v).toFixed(2) : ''),
      },
      {
        key: 'rmse',
        header: 'RMSE',
        format: (v) => (v !== null ? Number(v).toFixed(2) : ''),
      },
      {
        key: 'bias',
        header: 'Bias (%)',
        format: (v) => (v !== null ? Number(v).toFixed(2) : ''),
      },
    ],
  })
}
