'use client'

import { SWRConfig } from 'swr'
import { ReactNode } from 'react'

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.')
    throw error
  }
  return res.json()
}

interface SWRProviderProps {
  children: ReactNode
}

export function SWRProvider({ children }: SWRProviderProps) {
  return (
    <SWRConfig
      value={{
        fetcher,
        revalidateOnFocus: false,
        revalidateIfStale: true,
        dedupingInterval: 5000, // Dedupe requests within 5 seconds
        focusThrottleInterval: 30000, // Throttle focus revalidation
        errorRetryCount: 3,
        errorRetryInterval: 5000,
        shouldRetryOnError: true,
      }}
    >
      {children}
    </SWRConfig>
  )
}
