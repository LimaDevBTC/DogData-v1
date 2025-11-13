import { NextResponse } from 'next/server';

const UNISAT_API_TOKEN = process.env.UNISAT_API_TOKEN;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const txid = searchParams.get('txid');

  if (!txid) {
    return NextResponse.json(
      { error: 'TXID is required' },
      { status: 400 }
    );
  }

  if (!UNISAT_API_TOKEN) {
    console.error('❌ UNISAT_API_TOKEN não configurado.');
    return NextResponse.json(
      { error: 'Unisat API token not configured' },
      { status: 500 }
    );
  }

  try {
    console.log(`🔍 Buscando TX ${txid} na Unisat...`);

    // Buscar eventos relacionados a este TXID
    const response = await fetch(
      `https://open-api.unisat.io/v1/indexer/runes/event?rune=DOG%E2%80%A2GO%E2%80%A2TO%E2%80%A2THE%E2%80%A2MOON&start=0&limit=100`,
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

    const events = data.data.detail;

    // Filtrar eventos deste TXID
    const txEvents = events.filter((e: any) => e.txid === txid);

    if (txEvents.length === 0) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Processar eventos em uma transação
    const sends = txEvents.filter((e: any) => e.event === 'send');
    const receives = txEvents.filter((e: any) => e.event === 'receive');

    const blockHeight = txEvents[0].blockHeight;
    const timestamp = txEvents[0].timestamp;

    // Processar senders
    const senders = [];
    let totalDogIn = 0;
    const senderAddresses = new Set();

    for (const send of sends) {
      const address = send.address;
      senderAddresses.add(address);
      const amount = parseInt(send.amount);
      const amountDog = amount / 100000;
      totalDogIn += amountDog;

      senders.push({
        address,
        amount,
        amount_dog: amountDog,
        has_dog: true
      });
    }

    // Processar receivers
    const receivers = [];
    let totalDogOut = 0;
    let totalToSelf = 0;

    for (const receive of receives) {
      const address = receive.address;
      const amount = parseInt(receive.amount);
      const amountDog = amount / 100000;
      totalDogOut += amountDog;

      const isChange = senderAddresses.has(address);
      if (isChange) {
        totalToSelf += amountDog;
      }

      receivers.push({
        address,
        amount,
        amount_dog: amountDog,
        has_dog: true,
        is_change: isChange
      });
    }

    // Calcular net transfer
    const netTransfer = totalDogOut - totalToSelf;

    // Determinar tipo
    let txType = 'transfer';
    if (senders.length === 0) {
      txType = 'receive_only';
    } else if (receivers.length === 0) {
      txType = 'burn';
    } else if (netTransfer < 0.00001) {
      if (senders.length > receivers.length) {
        txType = 'consolidation';
      } else {
        txType = 'split';
      }
    } else if (senders.length > 1 && receivers.length === 1) {
      txType = 'consolidation';
    }

    const transaction = {
      txid,
      block_height: blockHeight,
      timestamp,
      type: txType,
      senders,
      receivers,
      sender_count: senders.length,
      receiver_count: receivers.length,
      total_dog_in: Math.round(totalDogIn * 100000) / 100000,
      total_dog_out: Math.round(totalDogOut * 100000) / 100000,
      total_dog_moved: Math.round(totalDogOut * 100000) / 100000,
      net_transfer: Math.round(netTransfer * 100000) / 100000,
      change_amount: Math.round(totalToSelf * 100000) / 100000,
      has_change: totalToSelf > 0
    };

    console.log(`✅ TX encontrada: bloco ${blockHeight}`);

    return NextResponse.json(transaction);

  } catch (error: any) {
    console.error('Error searching transaction:', error);
    return NextResponse.json(
      { error: 'Failed to search transaction', details: error.message },
      { status: 500 }
    );
  }
}

