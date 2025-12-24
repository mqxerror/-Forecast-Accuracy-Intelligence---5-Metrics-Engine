'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ForecastAccuracyChart } from '@/components/charts/forecast-accuracy-chart'
import { InventoryOverviewChart } from '@/components/charts/inventory-overview-chart'
import { useDashboard } from '@/hooks/use-dashboard'

export function DashboardCharts() {
  const { data, isLoading } = useDashboard()

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Inventory Health</CardTitle>
        </CardHeader>
        <CardContent>
          <InventoryOverviewChart
            stats={data?.stats}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Forecast Accuracy Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ForecastAccuracyChart
            distribution={data?.mapeDistribution}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>
    </div>
  )
}
