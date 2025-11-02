import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    // Ler o arquivo de holders para estatísticas
    const holdersPath = path.join(process.cwd(), 'data', 'dog_holders.json')
    
    if (!fs.existsSync(holdersPath)) {
      return NextResponse.json(
        { error: 'Holders data not found' },
        { status: 404 }
      )
    }
    
    const data = JSON.parse(fs.readFileSync(holdersPath, 'utf-8'))
    
    // Calcular estatísticas
    const totalHolders = data.holders.length
    const totalSupply = 100000000000 // 100 bilhões DOG
    
    let circulatingSupply = 0
    data.holders.forEach((holder: any) => {
      circulatingSupply += holder.balance || 0
    })
    
    // Top holders
    const top10Holders = data.holders.slice(0, 10)
    
    return NextResponse.json({
      totalHolders,
      totalSupply,
      circulatingSupply,
      top10Holders,
      lastUpdate: data.lastUpdate
    })
    
  } catch (error) {
    console.error('Error loading stats:', error)
    return NextResponse.json(
      { error: 'Failed to load stats data' },
      { status: 500 }
    )
  }
}

