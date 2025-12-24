'use client'

import { useState, useEffect, useCallback } from 'react'

const WATCH_LIST_KEY = 'inventory-watch-list'

export function useWatchList() {
  const [watchedSkus, setWatchedSkus] = useState<Set<string>>(new Set())

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(WATCH_LIST_KEY)
      if (stored) {
        setWatchedSkus(new Set(JSON.parse(stored)))
      }
    } catch {
      // Ignore parsing errors
    }
  }, [])

  // Save to localStorage when changed
  const saveToStorage = useCallback((skus: Set<string>) => {
    try {
      localStorage.setItem(WATCH_LIST_KEY, JSON.stringify([...skus]))
    } catch {
      // Ignore storage errors
    }
  }, [])

  const toggleWatch = useCallback((sku: string, watched: boolean) => {
    setWatchedSkus((prev) => {
      const next = new Set(prev)
      if (watched) {
        next.add(sku)
      } else {
        next.delete(sku)
      }
      saveToStorage(next)
      return next
    })
  }, [saveToStorage])

  const isWatched = useCallback((sku: string) => {
    return watchedSkus.has(sku)
  }, [watchedSkus])

  const clearWatchList = useCallback(() => {
    setWatchedSkus(new Set())
    saveToStorage(new Set())
  }, [saveToStorage])

  return {
    watchedSkus: [...watchedSkus],
    isWatched,
    toggleWatch,
    clearWatchList,
    watchCount: watchedSkus.size,
  }
}
