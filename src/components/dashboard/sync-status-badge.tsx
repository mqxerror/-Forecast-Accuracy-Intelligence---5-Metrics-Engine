import { Badge } from '@/components/ui/badge'
import { formatRelativeTime } from '@/lib/utils/format-date'
import { CheckCircle, XCircle, RefreshCw, Clock } from 'lucide-react'

interface SyncStatusBadgeProps {
  status: string | null
  lastSync: string | null
}

export function SyncStatusBadge({ status, lastSync }: SyncStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'completed':
        return {
          icon: CheckCircle,
          label: 'Synced',
          variant: 'default' as const,
          className: 'bg-green-100 text-green-800 hover:bg-green-100',
        }
      case 'running':
        return {
          icon: RefreshCw,
          label: 'Syncing...',
          variant: 'default' as const,
          className: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
          iconClass: 'animate-spin',
        }
      case 'failed':
        return {
          icon: XCircle,
          label: 'Failed',
          variant: 'destructive' as const,
          className: '',
        }
      default:
        return {
          icon: Clock,
          label: 'Unknown',
          variant: 'secondary' as const,
          className: '',
        }
    }
  }

  const config = getStatusConfig()
  const Icon = config.icon

  return (
    <div className="flex items-center gap-2">
      <Badge className={config.className}>
        <Icon className={`mr-1 h-3 w-3 ${config.iconClass || ''}`} />
        {config.label}
      </Badge>
      {lastSync && (
        <span className="text-xs text-gray-500">
          {formatRelativeTime(lastSync)}
        </span>
      )}
    </div>
  )
}
