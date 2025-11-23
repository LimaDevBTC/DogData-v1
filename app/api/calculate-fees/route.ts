import { NextRequest, NextResponse } from 'next/server';
import { redisClient } from '@/lib/upstash';

const SATOSHIS_PER_BTC = 100_000_000;
const MAX_FEES_TO_PROCESS = 50; // Processar até 50 fees por execução

interface BitcoinRPCResponse {
  result?: any;
  error?: { code: number; message: string };
}

async function bitcoinRPC(method: string, ...params: any[]): Promise<any> {
  const rpcUrl = process.env.BITCOIN_RPC_URL || 'http://127.0.0.1:8332';
  const rpcUser = process.env.BITCOIN_RPC_USER || '';
  const rpcPassword = process.env.BITCOIN_RPC_PASSWORD || '';

  if (!rpcUser || !rpcPassword) {
    throw new Error('Bitcoin RPC credentials not configured');
  }

  const auth = Buffer.from(`${rpcUser}:${rpcPassword}`).toString('base64');

  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method,
        params,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(30000), // 30s timeout
    });

    if (!response.ok) {
      throw new Error(`Bitcoin RPC error: ${response.status}`);
    }

    const data: BitcoinRPCResponse = await response.json();
    if (data.error) {
      throw new Error(`Bitcoin RPC error: ${data.error.message}`);
    }

    return data.result;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('Bitcoin RPC timeout');
    }
    throw error;
  }
}

async function calculateTransactionFee(txid: string): Promise<number | null> {
  try {
    // Obter transação decodificada
    const txData = await bitcoinRPC('getrawtransaction', txid, true);
    if (!txData) return null;

    // Calcular soma dos outputs
    let totalOutput = 0;
    const vout = txData.vout || [];
    for (const output of vout) {
      const valueBtc = output.value || 0;
      totalOutput += Math.round(valueBtc * SATOSHIS_PER_BTC);
    }

    // Calcular soma dos inputs
    let totalInput = 0;
    const vin = txData.vin || [];
    
    for (const input of vin) {
      if (input.txid && typeof input.vout === 'number') {
        const prevTx = await bitcoinRPC('getrawtransaction', input.txid, true);
        if (prevTx && prevTx.vout && input.vout < prevTx.vout.length) {
          const prevOutput = prevTx.vout[input.vout];
          const valueBtc = prevOutput.value || 0;
          totalInput += Math.round(valueBtc * SATOSHIS_PER_BTC);
        }
      }
    }

    // Fee = inputs - outputs
    if (totalInput > 0 && totalOutput >= 0) {
      const fee = totalInput - totalOutput;
      // Validar fee razoável (entre 1 sat e 0.1 BTC)
      if (fee >= 1 && fee <= 10_000_000) {
        return fee;
      }
    }

    return null;
  } catch (error: any) {
    console.warn(`⚠️ [FEES] Erro ao calcular fee para ${txid.substring(0, 8)}...:`, error.message);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Validar secret token
    const secret = request.nextUrl.searchParams.get('secret');
    const expectedSecret = process.env.UPDATE_SECRET || 'your-secret-token-here';

    if (secret !== expectedSecret) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid secret token' },
        { status: 401 }
      );
    }

    // Verificar se Bitcoin RPC está configurado
    if (!process.env.BITCOIN_RPC_USER || !process.env.BITCOIN_RPC_PASSWORD) {
      return NextResponse.json(
        { error: 'Bitcoin RPC not configured' },
        { status: 503 }
      );
    }

    console.log('🔄 [FEES] Iniciando cálculo de fees usando Bitcoin Core RPC...');

    // Buscar cache
    const existingRaw = await redisClient.get('dog:transactions');
    let cacheData: any = null;

    if (existingRaw) {
      if (typeof existingRaw === 'string') {
        try {
          cacheData = JSON.parse(existingRaw);
        } catch (err) {
          console.warn('⚠️ [FEES] Falha ao parsear cache:', err);
          return NextResponse.json({ error: 'Invalid cache data' }, { status: 500 });
        }
      } else {
        cacheData = existingRaw;
      }
    }

    if (!cacheData || !Array.isArray(cacheData.transactions)) {
      return NextResponse.json({ error: 'No transactions in cache' }, { status: 404 });
    }

    const transactions = cacheData.transactions;
    console.log(`📊 [FEES] Encontradas ${transactions.length} transações no cache`);

    // Filtrar transações das últimas 24h sem fees
    const now = Date.now();
    const threshold24h = now - 24 * 60 * 60 * 1000;

    const transactionsNeedingFees = transactions.filter((tx: any) => {
      try {
        const txTime = new Date(tx.timestamp).getTime();
        const is24h = !Number.isNaN(txTime) && txTime >= threshold24h;
        const needsFee = !tx.fee_sats || tx.fee_sats === 0;
        return is24h && needsFee;
      } catch {
        return false;
      }
    });

    if (transactionsNeedingFees.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All transactions in last 24h already have fees',
        fees_calculated: 0,
      });
    }

    console.log(`🔄 [FEES] Encontradas ${transactionsNeedingFees.length} transações das últimas 24h sem fees`);

    // Processar até MAX_FEES_TO_PROCESS transações
    const toProcess = transactionsNeedingFees.slice(0, MAX_FEES_TO_PROCESS);
    console.log(`💰 [FEES] Calculando fees para ${toProcess.length} transações...`);

    let feesCalculated = 0;
    let feesFailed = 0;

    for (let i = 0; i < toProcess.length; i++) {
      const tx = toProcess[i];
      const txid = tx.txid;
      
      console.log(`  [${i + 1}/${toProcess.length}] Calculando fee para ${txid.substring(0, 8)}...`);
      
      const fee = await calculateTransactionFee(txid);
      if (fee) {
        tx.fee_sats = fee;
        feesCalculated++;
        console.log(`    ✅ ${fee} sats`);
      } else {
        feesFailed++;
        console.log(`    ❌ Falhou`);
      }

      // Delay entre requests para não sobrecarregar Bitcoin Core
      if (i < toProcess.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
      }
    }

    // Atualizar cache
    if (feesCalculated > 0) {
      console.log(`💾 [FEES] Atualizando cache com ${feesCalculated} fees calculadas...`);
      cacheData.transactions = transactions;
      cacheData.last_update = new Date().toISOString();

      await redisClient.set('dog:transactions', JSON.stringify(cacheData));
      console.log(`✅ [FEES] Cache atualizado com sucesso!`);
    }

    const remaining = transactionsNeedingFees.length - MAX_FEES_TO_PROCESS;
    return NextResponse.json({
      success: true,
      message: 'Fees calculated successfully',
      fees_calculated: feesCalculated,
      fees_failed: feesFailed,
      remaining: remaining > 0 ? remaining : 0,
    });

  } catch (error: any) {
    console.error('❌ [FEES] Erro:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

