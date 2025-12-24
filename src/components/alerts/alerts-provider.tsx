'use client'

import { Toaster } from 'sonner'
import { useAlerts } from '@/hooks/use-alerts'

export function AlertsProvider({ children }: { children: React.ReactNode }) {
  // Initialize the alerts hook to enable automatic alerting
  useAlerts()

  return (
    <>
      {children}
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          style: {
            background: 'white',
          },
          classNames: {
            error: 'border-red-500',
            warning: 'border-yellow-500',
            success: 'border-green-500',
            info: 'border-blue-500',
          },
        }}
      />
    </>
  )
}
