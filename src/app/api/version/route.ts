import { NextResponse } from 'next/server'

// Build timestamp to verify deployment
const BUILD_VERSION = '2025-12-25T01:50:00-v2'

export async function GET() {
  return NextResponse.json({
    version: BUILD_VERSION,
    timestamp: new Date().toISOString()
  })
}
