'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle,
  Circle,
  Upload,
  Database,
  BarChart3,
  ArrowRight,
  Loader2,
  AlertTriangle
} from 'lucide-react'

interface OnboardingStep {
  id: string
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'error'
  icon: React.ElementType
}

interface OnboardingWizardProps {
  onComplete?: () => void
  onDismiss?: () => void
}

export function OnboardingWizard({ onComplete, onDismiss }: OnboardingWizardProps) {
  const [steps, setSteps] = useState<OnboardingStep[]>([
    {
      id: 'connect',
      title: 'Connect Data Source',
      description: 'Upload JSON from Inventory Planner or configure webhook',
      status: 'pending',
      icon: Upload
    },
    {
      id: 'validate',
      title: 'Validate Data',
      description: 'Ensure required fields are present and properly formatted',
      status: 'pending',
      icon: Database
    },
    {
      id: 'calculate',
      title: 'Calculate Metrics',
      description: 'Generate forecast accuracy and inventory health scores',
      status: 'pending',
      icon: BarChart3
    }
  ])

  const [dataStatus, setDataStatus] = useState<{
    hasData: boolean
    variantCount: number
    hasForecasts: boolean
    loading: boolean
  }>({
    hasData: false,
    variantCount: 0,
    hasForecasts: false,
    loading: true
  })

  useEffect(() => {
    checkDataStatus()
  }, [])

  async function checkDataStatus() {
    try {
      const res = await fetch('/api/data-health')
      if (res.ok) {
        const health = await res.json()
        const hasData = health.components?.fieldCompleteness > 0
        const hasForecasts = health.components?.forecastDataCoverage > 50

        setDataStatus({
          hasData,
          variantCount: 0, // Would need separate API call
          hasForecasts,
          loading: false
        })

        // Update steps based on data status
        if (hasData) {
          setSteps(prev => prev.map(step => {
            if (step.id === 'connect') return { ...step, status: 'completed' }
            if (step.id === 'validate') return { ...step, status: hasForecasts ? 'completed' : 'in_progress' }
            if (step.id === 'calculate') return { ...step, status: hasForecasts ? 'completed' : 'pending' }
            return step
          }))

          if (hasForecasts) {
            onComplete?.()
          }
        }
      }
    } catch {
      setDataStatus(prev => ({ ...prev, loading: false }))
    }
  }

  const currentStep = steps.find(s => s.status === 'pending' || s.status === 'in_progress')
  const allComplete = steps.every(s => s.status === 'completed')

  const getStepIcon = (step: OnboardingStep) => {
    const Icon = step.icon
    switch (step.status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'in_progress':
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-red-600" />
      default:
        return <Circle className="h-5 w-5 text-gray-300" />
    }
  }

  if (dataStatus.loading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    )
  }

  if (allComplete) {
    return null // Don't show wizard when complete
  }

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Getting Started</CardTitle>
          {onDismiss && (
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              Dismiss
            </Button>
          )}
        </div>
        <p className="text-sm text-gray-600">
          Complete these steps to start using Inventory Intelligence
        </p>
      </CardHeader>
      <CardContent>
        {/* Steps Progress */}
        <div className="space-y-3 mb-6">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                step.status === 'in_progress' ? 'bg-white border border-blue-200' :
                step.status === 'completed' ? 'bg-green-50/50' :
                'bg-white/50'
              }`}
            >
              <div className="mt-0.5">{getStepIcon(step)}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${
                    step.status === 'completed' ? 'text-green-700' :
                    step.status === 'in_progress' ? 'text-blue-700' :
                    'text-gray-600'
                  }`}>
                    {step.title}
                  </span>
                  {step.status === 'in_progress' && (
                    <Badge className="bg-blue-100 text-blue-700 text-xs">Current</Badge>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Action Area */}
        {currentStep?.id === 'connect' && (
          <div className="bg-white rounded-lg border p-4">
            <h4 className="font-medium mb-2">Import Your Data</h4>
            <p className="text-sm text-gray-600 mb-4">
              Export variant data from Inventory Planner and upload it here, or configure
              the webhook for automatic syncing.
            </p>
            <div className="flex gap-3">
              <Button asChild>
                <a href="/admin">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload JSON
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href="/admin">
                  Configure Webhook
                  <ArrowRight className="h-4 w-4 ml-2" />
                </a>
              </Button>
            </div>
          </div>
        )}

        {currentStep?.id === 'validate' && (
          <div className="bg-white rounded-lg border p-4">
            <h4 className="font-medium mb-2">Data Validation in Progress</h4>
            <p className="text-sm text-gray-600 mb-4">
              Your data is being validated. Check the data health widget for any issues
              that need attention.
            </p>
            <Button variant="outline" asChild>
              <a href="/admin">
                View Data Health
                <ArrowRight className="h-4 w-4 ml-2" />
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
