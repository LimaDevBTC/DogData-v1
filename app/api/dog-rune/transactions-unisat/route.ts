import { NextRequest, NextResponse } from 'next/server';

interface UnisatEvent {
  type: 'send' | 'receive';
  address: string;
  amount: string;
  height: number;
  txidx: number;
  txid: string;
  timestamp: number;
  vout: number;
}

// Cache de transações já processadas (evitar reprocessamento)
const processedTxIds = new Set<string>();

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const offset = parseInt(searchParams.get('offset') || '0');
  const limit = 100; // Reduzido para melhor performance (era 500)
  
  try {
    console.log(`🔍 Buscando eventos Unisat: offset=${offset}, limit=${limit}`);
    
    // Buscar eventos da Unisat (com timeout)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout
    
    const response = await fetch(
      `https://open-api.unisat.io/v1/indexer/runes/event?rune=DOG%E2%80%A2GO%E2%80%A2TO%E2%80%A2THE%E2%80%A2MOON&start=${offset}&limit=${limit}`,
      {
        headers: {
          'Authorization': 'Bearer 4478b2eaea855f5077a91089130f495d226935eccd4477be5340f01ec59db008',
          'User-Agent': 'DogData Explorer/1.0'
        },
        signal: controller.signal
      }
    );
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Unisat API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.code !== 0) {
      throw new Error(`Unisat API error: ${data.msg}`);
    }

    const events: UnisatEvent[] = data.data.detail;
    
    // Agrupar eventos por TXID
    const txGroups = new Map<string, UnisatEvent[]>();
    
    for (const event of events) {
      if (!txGroups.has(event.txid)) {
        txGroups.set(event.txid, []);
      }
      txGroups.get(event.txid)!.push(event);
    }

    // Processar cada transação
    const transactions: ReturnType<typeof processTransaction>[] = [];
    
    for (const [txid, txEvents] of Array.from(txGroups.entries())) {
      // Skip se já processamos
      if (processedTxIds.has(txid)) {
        continue;
      }
      
      const tx = processTransaction(txid, txEvents);
      transactions.push(tx);
      processedTxIds.add(txid);
    }

    // Ordenar por bloco (mais recente primeiro)
    transactions.sort((a, b) => b.block_height - a.block_height);

    console.log(`✅ Processadas ${transactions.length} transações (${events.length} eventos)`);

    return NextResponse.json({
      transactions,
      hasMore: events.length === limit,
      nextOffset: offset + limit,
      totalEvents: data.data.total
    });

  } catch (error: any) {
    console.error('❌ Error fetching Unisat transactions:', error);
    console.error('❌ Error details:', error.message || error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch transactions',
        details: error.message || String(error),
        offset,
        limit
      },
      { status: 500 }
    );
  }
}

function processTransaction(txid: string, events: UnisatEvent[]) {
  const sends = events.filter((e: UnisatEvent) => e.type === 'send');
  const receives = events.filter((e: UnisatEvent) => e.type === 'receive');
  
  const firstEvent = events[0];
  const DOG_DIVISIBILITY = 5;
  
  // Processar senders
  const senderAddresses = new Set<string>();
  const senders = sends.map((e: UnisatEvent) => {
    const amount_dog = parseInt(e.amount) / (10 ** DOG_DIVISIBILITY);
    senderAddresses.add(e.address);
    return {
      address: e.address,
      input: `${txid}:${e.vout}`,
      amount: parseInt(e.amount),
      amount_dog,
      has_dog: true
    };
  });
  
  const totalIn = senders.reduce((sum, s) => sum + s.amount_dog, 0);
  
  // Processar receivers
  let totalToSelf = 0;
  const receivers = receives.map((e: UnisatEvent) => {
    const amount_dog = parseInt(e.amount) / (10 ** DOG_DIVISIBILITY);
    const isChange = senderAddresses.has(e.address);
    
    if (isChange) {
      totalToSelf += amount_dog;
    }
    
    return {
      address: e.address,
      vout: e.vout,
      amount: parseInt(e.amount),
      amount_dog,
      is_change: isChange
    };
  });
  
  const totalOut = receivers.reduce((sum, r) => sum + r.amount_dog, 0);
  const netTransfer = totalOut - totalToSelf;
  
  // Determinar tipo
  let type = 'transfer';
  if (sends.length === 0) {
    type = 'receive_only';
  } else if (receives.length === 0) {
    type = 'burn';
  } else if (sends.length > 1 && receives.length === 1) {
    type = 'consolidation';
  }
  
  return {
    txid,
    block_height: firstEvent.height,
    timestamp: new Date(firstEvent.timestamp * 1000).toISOString(),
    type,
    senders,
    receivers,
    total_dog_moved: Math.round(totalOut * 100000) / 100000,
    total_dog_in: Math.round(totalIn * 100000) / 100000,
    total_dog_out: Math.round(totalOut * 100000) / 100000,
    net_transfer: Math.round(netTransfer * 100000) / 100000,
    change_amount: Math.round(totalToSelf * 100000) / 100000,
    has_change: totalToSelf > 0,
    sender_count: senders.length,
    receiver_count: receivers.length
  };
}




