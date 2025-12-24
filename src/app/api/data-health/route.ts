import { NextResponse } from 'next/server'
import { calculateDataHealth, getQuickHealthCheck } from '@/lib/utils/data-health'

/**
 * GET /api/data-health - Get comprehensive data health score
 *
 * Query params:
 * - quick=true: Returns only score, grade, and issue counts
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const quick = searchParams.get('quick') === 'true'

    if (quick) {
      const health = await getQuickHealthCheck()
      return NextResponse.json(health)
    }

    const health = await calculateDataHealth()
    return NextResponse.json(health)
  } catch (error) {
    console.error('Data health calculation failed:', error)
    return NextResponse.json(
      { error: 'Failed to calculate data health', details: String(error) },
      { status: 500 }
    )
  }
}
