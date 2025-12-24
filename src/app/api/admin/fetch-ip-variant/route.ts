import { NextRequest, NextResponse } from 'next/server'

const IP_API_URL = process.env.IP_API_URL || 'https://app.inventory-planner.com/api/v1'
const IP_API_KEY = process.env.IP_API_KEY
const IP_ACCOUNT_ID = process.env.IP_ACCOUNT_ID

/**
 * GET /api/admin/fetch-ip-variant - Fetch a single variant from Inventory Planner API
 *
 * Query params:
 * - sku: The SKU to search for
 * - id: The variant ID (if known)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sku = searchParams.get('sku')
    const variantId = searchParams.get('id')

    if (!IP_API_KEY || !IP_ACCOUNT_ID) {
      return NextResponse.json({
        error: 'Inventory Planner API credentials not configured',
        configured: false,
        hint: 'Set IP_API_KEY and IP_ACCOUNT_ID in .env.local',
      }, { status: 500 })
    }

    if (!sku && !variantId) {
      return NextResponse.json({
        error: 'Either sku or id parameter is required',
      }, { status: 400 })
    }

    let url: string
    let variant: Record<string, unknown> | null = null

    // If we have an ID, fetch directly
    if (variantId) {
      url = `${IP_API_URL}/variants/${variantId}`
      console.log(`Fetching variant by ID: ${url}`)

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': IP_API_KEY,
          'Account': IP_ACCOUNT_ID,
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        variant = data.variant || data
      }
    }

    // If we have a SKU, search for it
    if (sku && !variant) {
      // Try searching by SKU filter
      url = `${IP_API_URL}/variants?sku=${encodeURIComponent(sku)}&limit=10`
      console.log(`Searching variant by SKU: ${url}`)

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': IP_API_KEY,
          'Account': IP_ACCOUNT_ID,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`IP API error: ${response.status} - ${errorText}`)
        return NextResponse.json({
          error: `Inventory Planner API error: ${response.status}`,
          details: errorText,
          apiUrl: url.replace(IP_API_KEY || '', '[REDACTED]'),
        }, { status: response.status })
      }

      const data = await response.json()
      const variants = data.variants || []

      // Find exact SKU match
      variant = variants.find((v: Record<string, unknown>) =>
        String(v.sku).toLowerCase() === sku.toLowerCase()
      ) || variants[0] || null

      if (!variant && variants.length > 0) {
        // Return partial matches if no exact match
        return NextResponse.json({
          variant: null,
          partialMatches: variants.slice(0, 5).map((v: Record<string, unknown>) => ({
            id: v.id,
            sku: v.sku,
            title: v.title,
          })),
          message: `No exact match for "${sku}", found ${variants.length} partial matches`,
        })
      }
    }

    if (!variant) {
      return NextResponse.json({
        variant: null,
        message: `No variant found for ${sku || variantId}`,
      })
    }

    // Return the raw variant data from Inventory Planner
    return NextResponse.json({
      variant,
      fetchedAt: new Date().toISOString(),
      source: 'inventory_planner_api',
    })
  } catch (error) {
    console.error('Fetch IP variant error:', error)
    return NextResponse.json({
      error: 'Failed to fetch from Inventory Planner',
      details: String(error),
    }, { status: 500 })
  }
}
