import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    
    // Ler o arquivo de holders
    const holdersPath = path.join(process.cwd(), 'data', 'dog_holders.json')
    
    if (!fs.existsSync(holdersPath)) {
      return NextResponse.json(
        { error: 'Holders data not found' },
        { status: 404 }
      )
    }
    
    const data = JSON.parse(fs.readFileSync(holdersPath, 'utf-8'))
    
    // Calcular paginação
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedHolders = data.holders.slice(startIndex, endIndex)
    
    return NextResponse.json({
      holders: paginatedHolders,
      pagination: {
        total: data.holders.length,
        page,
        limit,
        totalPages: Math.ceil(data.holders.length / limit)
      },
      lastUpdate: data.lastUpdate
    })
    
  } catch (error) {
    console.error('Error loading holders:', error)
    return NextResponse.json(
      { error: 'Failed to load holders data' },
      { status: 500 }
    )
  }
}

