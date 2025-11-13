import { NextResponse } from 'next/server';

// Cache de 5 minutos com valor inicial
let cachedData: { total: number; timestamp: number } | null = {
  total: 2953886, // Valor inicial (atualizado 2025-11-03)
  timestamp: Date.now()
};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos
const UNISAT_API_TOKEN = process.env.UNISAT_API_TOKEN;

export async function GET() {
  try {
    // Verificar cache
    const now = Date.now();
    if (cachedData && (now - cachedData.timestamp) < CACHE_DURATION) {
      return NextResponse.json({ 
        total: cachedData.total,
        cached: true 
      });
    }

    if (!UNISAT_API_TOKEN) {
      console.error('❌ UNISAT_API_TOKEN não configurado.');
      return NextResponse.json(
        { error: 'Unisat API token not configured' },
        { status: 500 }
      );
    }

    // Buscar da Unisat API
    const response = await fetch(
      'https://open-api.unisat.io/v1/indexer/runes/event?rune=DOG%E2%80%A2GO%E2%80%A2TO%E2%80%A2THE%E2%80%A2MOON&start=0&limit=1',
      {
        headers: {
          Authorization: `Bearer ${UNISAT_API_TOKEN}`,
          'User-Agent': 'DogData Explorer/1.0'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Unisat API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.code !== 0) {
      throw new Error(`Unisat API error: ${data.msg}`);
    }

    const total = data.data.total;

    // Atualizar cache
    cachedData = {
      total,
      timestamp: now
    };

    return NextResponse.json({ 
      total,
      cached: false 
    });

  } catch (error) {
    console.error('Error fetching DOG events count:', error);
    
    // Se tiver cache, retornar mesmo que velho
    if (cachedData) {
      return NextResponse.json({ 
        total: cachedData.total,
        cached: true,
        stale: true
      });
    }

    return NextResponse.json(
      { error: 'Failed to fetch events count' },
      { status: 500 }
    );
  }
}




