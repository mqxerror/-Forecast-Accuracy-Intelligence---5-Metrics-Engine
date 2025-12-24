'use client'

import { useState, useEffect, useCallback } from 'react'

const ONBOARDING_KEY = 'inventory-intelligence-onboarding'

interface OnboardingState {
  dismissed: boolean
  completedAt: string | null
  dismissedAt: string | null
}

export function useOnboarding() {
  const [state, setState] = useState<OnboardingState>({
    dismissed: false,
    completedAt: null,
    dismissedAt: null
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(ONBOARDING_KEY)
      if (stored) {
        setState(JSON.parse(stored))
      }
    } catch {
      // Ignore localStorage errors
    }
    setIsLoading(false)
  }, [])

  const dismiss = useCallback(() => {
    const newState: OnboardingState = {
      ...state,
      dismissed: true,
      dismissedAt: new Date().toISOString()
    }
    setState(newState)
    try {
      localStorage.setItem(ONBOARDING_KEY, JSON.stringify(newState))
    } catch {
      // Ignore localStorage errors
    }
  }, [state])

  const complete = useCallback(() => {
    const newState: OnboardingState = {
      ...state,
      dismissed: true,
      completedAt: new Date().toISOString()
    }
    setState(newState)
    try {
      localStorage.setItem(ONBOARDING_KEY, JSON.stringify(newState))
    } catch {
      // Ignore localStorage errors
    }
  }, [state])

  const reset = useCallback(() => {
    const newState: OnboardingState = {
      dismissed: false,
      completedAt: null,
      dismissedAt: null
    }
    setState(newState)
    try {
      localStorage.removeItem(ONBOARDING_KEY)
    } catch {
      // Ignore localStorage errors
    }
  }, [])

  return {
    showOnboarding: !isLoading && !state.dismissed,
    isCompleted: !!state.completedAt,
    isDismissed: state.dismissed && !state.completedAt,
    isLoading,
    dismiss,
    complete,
    reset
  }
}
