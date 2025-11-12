import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { redisClient } from '@/lib/upstash';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    console.log('📡 [KV] Buscando transações do cache...');
    const summaryOnly = request.nextUrl.searchParams.get('summary');

    // Tentar ler do Vercel KV primeiro
    // Upstash Redis armazena JSON stringificado
    const cacheDataRaw = await redisClient.get('dog:transactions');
    let cacheData: any = null;

    if (cacheDataRaw) {
      if (typeof cacheDataRaw === 'string') {
        try {
          cacheData = JSON.parse(cacheDataRaw);
        } catch (parseError) {
          console.error('⚠️ [KV] Falha ao parsear JSON vindo do KV, retornando string bruta', parseError);
          cacheData = cacheDataRaw;
        }
      } else {
        cacheData = cacheDataRaw;
      }
    }

    // Fallback para JSON local se KV não disponível (desenvolvimento)
    if (!cacheData) {
      console.log('⚠️ [KV] KV vazio, usando fallback para JSON local');
      try {
        const filePath = join(process.cwd(), 'public', 'data', 'dog_transactions.json');
        const fileData = await readFile(filePath, 'utf-8');
        cacheData = JSON.parse(fileData);
      } catch (fileError) {
        console.error('❌ [KV] Erro ao ler JSON local:', fileError);
        return NextResponse.json(
          { error: 'No cached data available' },
          { status: 503 }
        );
      }
    }

    const totalTransactions = cacheData.total_transactions || (Array.isArray(cacheData.transactions) ? cacheData.transactions.length : 0);
    console.log(`✅ [KV] ${totalTransactions} transações carregadas`);

    const responsePayload = summaryOnly && ['1', 'true', 'summary'].includes(summaryOnly.toLowerCase())
      ? {
          total_transactions: totalTransactions,
          last_block: cacheData.last_block || 0,
          last_updated: cacheData.last_updated || null,
          metrics: cacheData.metrics || null,
        }
      : cacheData;

    return NextResponse.json(responsePayload, {
      headers: {
        'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=30'
      }
    });

  } catch (error: any) {
    console.error('❌ [KV] Erro ao buscar transações:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch transactions',
        message: error.message 
      },
      { status: 500 }
    );
  }
}

