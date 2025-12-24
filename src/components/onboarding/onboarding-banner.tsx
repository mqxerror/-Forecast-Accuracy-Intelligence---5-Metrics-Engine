'use client'

import { useOnboarding } from '@/hooks/use-onboarding'
import { OnboardingWizard } from './onboarding-wizard'

export function OnboardingBanner() {
  const { showOnboarding, dismiss, complete } = useOnboarding()

  if (!showOnboarding) {
    return null
  }

  return (
    <OnboardingWizard
      onComplete={complete}
      onDismiss={dismiss}
    />
  )
}
