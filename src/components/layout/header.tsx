'use client'

import { SyncStatusBadge } from '@/components/dashboard/sync-status-badge'
import { DataImport } from '@/components/dashboard/data-import'

interface HeaderProps {
  title: string
  subtitle?: string
  syncStatus?: {
    status: string | null
    lastSync: string | null
  }
  showSyncButton?: boolean
}

export function Header({
  title,
  subtitle,
  syncStatus,
  showSyncButton = true,
}: HeaderProps) {
  return (
    <header className="relative z-10 flex h-16 items-center justify-between border-b bg-white px-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        {subtitle && (
          <p className="text-sm text-gray-500">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-4">
        {syncStatus && (
          <SyncStatusBadge
            status={syncStatus.status}
            lastSync={syncStatus.lastSync}
          />
        )}

        {showSyncButton && (
          <DataImport syncStatus={syncStatus} />
        )}
      </div>
    </header>
  )
}
