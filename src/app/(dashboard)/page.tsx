import { Suspense } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { KPICard } from '@/components/dashboard/kpi-card'
import { PriorityTable } from '@/components/dashboard/priority-table'
import { Header } from '@/components/layout/header'
import { KPIGridSkeleton, TableSkeleton } from '@/components/shared/loading-skeleton'
import { getBusinessSummary, getLatestSyncStatus } from '@/lib/supabase/queries/summary'
import { getInventoryStats, getTopPriorityItems, getOutOfStockItems } from '@/lib/supabase/queries/variants'
import { getAverageAccuracy } from '@/lib/supabase/queries/metrics'
import { formatCurrency, formatCurrencyCompact } from '@/lib/utils/format-currency'
import { formatNumber, formatPercentage } from '@/lib/utils/format-number'
import { Package, AlertTriangle, TrendingUp, DollarSign } from 'lucide-react'

async function DashboardKPIs() {
  const [stats, accuracyResult] = await Promise.all([
    getInventoryStats(),
    getAverageAccuracy(),
  ])

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <KPICard
        title="Total SKUs"
        value={formatNumber(stats.totalSkus)}
        subtitle="Active products"
        icon={Package}
        variant="default"
      />
      <KPICard
        title="Inventory Value"
        value={formatCurrencyCompact(stats.totalValue)}
        subtitle="At cost"
        icon={DollarSign}
        variant="success"
      />
      <KPICard
        title="Needs Reorder"
        value={formatNumber(stats.reorderCount)}
        subtitle="Items below threshold"
        icon={AlertTriangle}
        variant="warning"
      />
      <KPICard
        title="Forecast Accuracy"
        value={
          accuracyResult.avgMape !== null
            ? formatPercentage(100 - accuracyResult.avgMape, 1)
            : '-'
        }
        subtitle={`Based on ${accuracyResult.count} SKUs`}
        icon={TrendingUp}
        variant={
          accuracyResult.avgMape !== null && accuracyResult.avgMape < 20
            ? 'success'
            : 'warning'
        }
      />
    </div>
  )
}

async function PriorityTables() {
  const [reorderResult, oosResult] = await Promise.all([
    getTopPriorityItems(10),
    getOutOfStockItems(10),
  ])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Priority Items</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="reorder">
          <TabsList>
            <TabsTrigger value="reorder">
              Needs Reorder ({reorderResult.items.length})
            </TabsTrigger>
            <TabsTrigger value="oos">
              Out of Stock ({oosResult.items.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="reorder" className="mt-4">
            <PriorityTable items={reorderResult.items} type="reorder" />
          </TabsContent>
          <TabsContent value="oos" className="mt-4">
            <PriorityTable items={oosResult.items} type="oos" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

async function SyncStatus() {
  const { sync } = await getLatestSyncStatus()
  return {
    status: sync?.status || null,
    lastSync: sync?.completed_at || sync?.started_at || null,
  }
}

export default async function DashboardPage() {
  const syncStatus = await SyncStatus()

  return (
    <div className="flex flex-col">
      <Header
        title="Executive Dashboard"
        subtitle="Real-time inventory intelligence"
        syncStatus={syncStatus}
      />

      <div className="space-y-6 p-6">
        <Suspense fallback={<KPIGridSkeleton />}>
          <DashboardKPIs />
        </Suspense>

        <Suspense
          fallback={
            <Card>
              <CardHeader>
                <CardTitle>Priority Items</CardTitle>
              </CardHeader>
              <CardContent>
                <TableSkeleton rows={10} />
              </CardContent>
            </Card>
          }
        >
          <PriorityTables />
        </Suspense>
      </div>
    </div>
  )
}
