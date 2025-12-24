'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Activity, AlertTriangle, CheckCircle, XCircle, ArrowRight } from 'lucide-react'
import type { DataHealthScore } from '@/lib/utils/data-health'

interface DataHealthWidgetProps {
  compact?: boolean
}

export function DataHealthWidget({ compact = false }: DataHealthWidgetProps) {
  const [health, setHealth] = useState<DataHealthScore | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchHealth() {
      try {
        const res = await fetch('/api/data-health')
        if (!res.ok) throw new Error('Failed to fetch')
        const data = await res.json()
        setHealth(data)
      } catch (err) {
        setError('Failed to load data health')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchHealth()
  }, [])

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="animate-pulse flex items-center gap-4">
            <div className="w-16 h-16 bg-gray-200 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-24" />
              <div className="h-3 bg-gray-200 rounded w-32" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !health) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-gray-500">
          {error || 'Unable to calculate data health'}
        </CardContent>
      </Card>
    )
  }

  const scoreColor = health.overall >= 80 ? 'text-green-600'
    : health.overall >= 60 ? 'text-yellow-600'
    : 'text-red-600'

  const gradeBgColor = health.grade === 'A' ? 'bg-green-100 text-green-800'
    : health.grade === 'B' ? 'bg-blue-100 text-blue-800'
    : health.grade === 'C' ? 'bg-yellow-100 text-yellow-800'
    : health.grade === 'D' ? 'bg-orange-100 text-orange-800'
    : 'bg-red-100 text-red-800'

  const criticalCount = health.issues.filter(i => i.severity === 'critical').length
  const warningCount = health.issues.filter(i => i.severity === 'warning').length

  if (compact) {
    return (
      <Link href="/admin" className="block">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`text-2xl font-bold ${scoreColor}`}>
                  {health.overall.toFixed(0)}%
                </div>
                <Badge className={gradeBgColor}>{health.grade}</Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                {criticalCount > 0 && (
                  <span className="flex items-center gap-1 text-red-600">
                    <XCircle className="h-4 w-4" />
                    {criticalCount}
                  </span>
                )}
                {warningCount > 0 && (
                  <span className="flex items-center gap-1 text-yellow-600">
                    <AlertTriangle className="h-4 w-4" />
                    {warningCount}
                  </span>
                )}
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Data Health
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-4">
          <div className={`text-4xl font-bold ${scoreColor}`}>
            {health.overall.toFixed(0)}%
          </div>
          <Badge className={`text-lg px-3 py-1 ${gradeBgColor}`}>
            Grade {health.grade}
          </Badge>
        </div>

        {/* Issues */}
        {health.issues.length > 0 && (
          <div className="space-y-2 mb-4">
            {health.issues.slice(0, 3).map((issue, i) => (
              <Alert
                key={i}
                variant={issue.severity === 'critical' ? 'destructive' : 'default'}
                className="py-2"
              >
                <div className="flex items-start gap-2">
                  {issue.severity === 'critical' ? (
                    <XCircle className="h-4 w-4 mt-0.5 text-red-600" />
                  ) : issue.severity === 'warning' ? (
                    <AlertTriangle className="h-4 w-4 mt-0.5 text-yellow-600" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mt-0.5 text-blue-600" />
                  )}
                  <div className="flex-1">
                    <AlertDescription className="text-sm">
                      {issue.message}
                    </AlertDescription>
                    <p className="text-xs text-gray-500 mt-1">{issue.action}</p>
                  </div>
                </div>
              </Alert>
            ))}
          </div>
        )}

        {/* Recommendations */}
        {health.recommendations.length > 0 && (
          <div className="border-t pt-3">
            <p className="text-sm font-medium mb-2">Recommendations</p>
            <ul className="text-sm text-gray-600 space-y-1">
              {health.recommendations.slice(0, 2).map((rec, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-blue-500">→</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Link
          href="/admin"
          className="text-sm text-blue-600 hover:underline mt-4 inline-block"
        >
          View detailed report →
        </Link>
      </CardContent>
    </Card>
  )
}
