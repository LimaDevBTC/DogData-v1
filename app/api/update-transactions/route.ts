import { NextRequest, NextResponse } from 'next/server';
import { redisClient } from '@/lib/upstash';

const UNISAT_API_URL = 'https://open-api.unisat.io/v1/indexer/runes/event';
const RUNE_NAME = 'DOG•GO•TO•THE•MOON';
const DOG_RUNE_ID = '840000:3';
const DOG_DIVISIBILITY = 5;
const DOG_FACTOR = 10 ** DOG_DIVISIBILITY; // 5 casas decimais
const MAX_TRANSACTIONS = parseInt(process.env.DOG_MAX_TRANSACTIONS || '500', 10);
const HOLDER_RANK_HASH = 'dog:holders:ranks';
const XVERSE_API_BASE = process.env.XVERSE_API_BASE || 'https://api.secretkeylabs.io';
const XVERSE_API_KEY = process.env.XVERSE_API_KEY || '';
const XVERSE_ACTIVITY_LIMIT = 25;
const XVERSE_MAX_PAGES = Number(process.env.XVERSE_ACTIVITY_MAX_PAGES || 160);
const XVERSE_EXISTING_BREAK_THRESHOLD = Number(process.env.XVERSE_ACTIVITY_BREAK_THRESHOLD || 180);
const XVERSE_RATE_LIMIT_DELAY_MS = Number(process.env.XVERSE_ACTIVITY_DELAY_MS || 1000);
const XVERSE_FEE_DELAY_MS = Number(process.env.XVERSE_FEE_DELAY_MS || 800);
const XVERSE_FETCH_FEES = (process.env.XVERSE_FETCH_FEES ?? 'true') !== 'false';
const SATOSHIS_PER_BTC = 100_000_000;

interface XverseActivityItem {
  blockHeight: number;
  blockTime: string;
  txid: string;
  index: number;
  type: string;
  amount: string;
  address: string | null;
}

interface XverseActivityResponse {
  offset: number;
  limit: number;
  items: XverseActivityItem[];
}

interface GroupedActivity {
  blockHeight: number;
  blockTime: string;
  inputs: XverseActivityItem[];
  outputs: XverseActivityItem[];
  others: XverseActivityItem[];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Limite máximo razoável: 21 bilhões de Bitcoin * 10^8 sats * 10^5 divisibility = 2.1e15
// Mas considerando que DOG é um rune, vamos ser mais conservadores: 1 trilhão de unidades brutas
const MAX_RAW_AMOUNT = 1_000_000_000_000_000; // 1 quadrilhão (1e15)

const safeInt = (value: string | number | null | undefined): number => {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return 0;
    // Limitar valores muito grandes que podem ser erros
    if (value > MAX_RAW_AMOUNT) {
      console.warn(`[safeInt] Valor muito grande ignorado: ${value}`);
      return 0;
    }
    return Math.trunc(value);
  }
  if (typeof value === 'string') {
    // Remover espaços e caracteres não numéricos (exceto sinal negativo)
    const cleaned = value.trim().replace(/[^\d-]/g, '');
    if (!cleaned || cleaned === '-') return 0;
    
    // Usar BigInt para valores muito grandes e depois converter
    try {
      // Tentar como número normal primeiro
      const parsed = Number.parseInt(cleaned, 10);
      if (!Number.isFinite(parsed) || parsed < 0) return 0;
      if (parsed > MAX_RAW_AMOUNT) {
        console.warn(`[safeInt] String com valor muito grande ignorado: ${value} (${parsed})`);
        return 0;
      }
      return parsed;
    } catch (e) {
      console.warn(`[safeInt] Erro ao parsear valor: ${value}`, e);
      return 0;
    }
  }
  return 0;
};

const toDogAmount = (raw: number): number => {
  if (!Number.isFinite(raw) || raw < 0) return 0;
  const result = Number((raw / DOG_FACTOR).toFixed(DOG_DIVISIBILITY));
  // Limite máximo de DOG razoável: 100 bilhões (considerando o supply total)
  const MAX_DOG_AMOUNT = 100_000_000_000;
  if (result > MAX_DOG_AMOUNT) {
    console.warn(`[toDogAmount] Valor de DOG muito grande ignorado: ${raw} -> ${result}`);
    return 0;
  }
  return result;
};

const normalizeTimestamp = (value: string | number | undefined): string => {
  if (!value) {
    return new Date().toISOString();
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
};

function buildTransactionFromActivity(txid: string, grouped: GroupedActivity): Transaction {
  // Deduplicar inputs por endereço+índice para evitar contar o mesmo input múltiplas vezes
  // Se a API retornar múltiplos eventos para o mesmo input, manteremos o maior valor
  const inputMap = new Map<string, { address: string; amount: number; amount_dog: number }>();
  for (const item of grouped.inputs) {
    if (!item.address) continue;
    const key = `${item.address}:${item.index}`;
    const amount = safeInt(item.amount);
    const amountDog = toDogAmount(amount);
    
    // Se já existe, manter o maior valor (não somar, pois são eventos duplicados do mesmo UTXO)
    const existing = inputMap.get(key);
    if (existing) {
      if (amount > existing.amount) {
        existing.amount = amount;
        existing.amount_dog = amountDog;
      }
    } else {
      inputMap.set(key, { address: item.address, amount, amount_dog: amountDog });
    }
  }

  const senders = Array.from(inputMap.values()).map(({ address, amount, amount_dog }) => ({
    address,
    amount,
    amount_dog,
    has_dog: amount_dog > 0
  }));

  const senderAddresses = new Set(senders.map((sender) => sender.address).filter(Boolean));

  // Deduplicar outputs por endereço+índice para evitar contar o mesmo output múltiplas vezes
  // Se a API retornar múltiplos eventos para o mesmo output, manteremos o maior valor
  const outputMap = new Map<string, { address: string; amount: number; amount_dog: number; is_change: boolean }>();
  for (const item of grouped.outputs) {
    if (!item.address) continue;
    const key = `${item.address}:${item.index}`;
    const amount = safeInt(item.amount);
    const amountDog = toDogAmount(amount);
    const isChange = senderAddresses.has(item.address);
    
    // Se já existe, manter o maior valor (não somar, pois são eventos duplicados do mesmo UTXO)
    const existing = outputMap.get(key);
    if (existing) {
      if (amount > existing.amount) {
        existing.amount = amount;
        existing.amount_dog = amountDog;
      }
    } else {
      outputMap.set(key, { address: item.address, amount, amount_dog: amountDog, is_change: isChange });
    }
  }

  const receivers = Array.from(outputMap.values()).map(({ address, amount, amount_dog, is_change }) => ({
    address,
    amount,
    amount_dog,
    has_dog: amount_dog > 0,
    is_change
  }));

  const totalDogOut = receivers.reduce((sum, receiver) => sum + receiver.amount_dog, 0);
  const totalChange = receivers
    .filter((receiver) => receiver.is_change)
    .reduce((sum, receiver) => sum + receiver.amount_dog, 0);
  const totalDogIn = senders.reduce((sum, sender) => sum + sender.amount_dog, 0) || totalDogOut;
  const netTransfer = Math.max(totalDogOut - totalChange, 0);

  // Validação final: garantir que os valores não excedam limites razoáveis
  const MAX_DOG_AMOUNT = 100_000_000_000; // 100 bilhões de DOG
  
  if (totalDogOut > MAX_DOG_AMOUNT || totalDogIn > MAX_DOG_AMOUNT || netTransfer > MAX_DOG_AMOUNT) {
    console.error(`⚠️ [buildTransaction] TX ${txid} com valores inválidos:`, {
      totalDogOut,
      totalDogIn,
      netTransfer,
      inputs: grouped.inputs.map(i => ({ amount: i.amount, address: i.address })),
      outputs: grouped.outputs.map(o => ({ amount: o.amount, address: o.address }))
    });
    // Retornar valores zerados para esta transação problemática
    return {
      txid,
      block_height: grouped.blockHeight,
      timestamp: normalizeTimestamp(grouped.blockTime),
      senders: [],
      receivers: [],
      sender_count: 0,
      receiver_count: 0,
      total_dog_in: 0,
      total_dog_out: 0,
      total_dog_moved: 0,
      net_transfer: 0,
      change_amount: 0,
      has_change: false
    };
  }

  // total_dog_moved deve usar net_transfer (excluindo change), não total_dog_out
  // Isso representa o volume REAL movido na transação
  const total_dog_moved = netTransfer;

  return {
    txid,
    block_height: grouped.blockHeight,
    timestamp: normalizeTimestamp(grouped.blockTime),
    senders,
    receivers,
    sender_count: senders.length,
    receiver_count: receivers.length,
    total_dog_in: Number(totalDogIn.toFixed(5)),
    total_dog_out: Number(totalDogOut.toFixed(5)),
    total_dog_moved: Number(total_dog_moved.toFixed(5)),
    net_transfer: Number(netTransfer.toFixed(5)),
    change_amount: Number(totalChange.toFixed(5)),
    has_change: totalChange > 0
  };
}

async function fetchXverseActivityPage(offset: number): Promise<XverseActivityResponse> {
  if (!XVERSE_API_KEY) {
    throw new Error('Missing XVERSE_API_KEY environment variable');
  }

  const url = new URL(`/v1/runes/${DOG_RUNE_ID}/activity`, XVERSE_API_BASE);
  url.searchParams.set('offset', offset.toString());

  const response = await fetch(url.toString(), {
    headers: {
      'x-api-key': XVERSE_API_KEY,
      'User-Agent': 'DogData Explorer/1.0',
      Accept: 'application/json'
    },
    cache: 'no-store',
    next: { revalidate: 0 }
  });

  if (!response.ok) {
    throw new Error(`Xverse activity request failed with status ${response.status}`);
  }

  const data = (await response.json()) as XverseActivityResponse;
  return {
    offset: data?.offset ?? offset,
    limit: data?.limit ?? XVERSE_ACTIVITY_LIMIT,
    items: Array.isArray(data?.items) ? data.items : []
  };
}

async function fetchTransactionBtcTotals(txid: string): Promise<{ inSats: number; outSats: number } | null> {
  if (!XVERSE_API_KEY) {
    return null;
  }

  try {
    const inputsUrl = new URL(`/v1/ordinals/tx/${txid}/inputs`, XVERSE_API_BASE);
    const inputsResponse = await fetch(inputsUrl.toString(), {
      headers: {
        'x-api-key': XVERSE_API_KEY,
        'User-Agent': 'DogData Explorer/1.0',
        Accept: 'application/json'
      },
      cache: 'no-store',
      next: { revalidate: 0 }
    });

    if (!inputsResponse.ok) {
      throw new Error(`inputs status ${inputsResponse.status}`);
    }

    const inputsJson = await inputsResponse.json();
    const inSats = Array.isArray(inputsJson?.items)
      ? inputsJson.items.reduce((sum: number, item: any) => sum + safeInt(item?.value), 0)
      : 0;

    if (XVERSE_FEE_DELAY_MS > 0) {
      await sleep(XVERSE_FEE_DELAY_MS);
    }

    const outputsUrl = new URL(`/v1/ordinals/tx/${txid}/outputs`, XVERSE_API_BASE);
    const outputsResponse = await fetch(outputsUrl.toString(), {
      headers: {
        'x-api-key': XVERSE_API_KEY,
        'User-Agent': 'DogData Explorer/1.0',
        Accept: 'application/json'
      },
      cache: 'no-store',
      next: { revalidate: 0 }
    });

    if (!outputsResponse.ok) {
      throw new Error(`outputs status ${outputsResponse.status}`);
    }

    const outputsJson = await outputsResponse.json();
    const outSats = Array.isArray(outputsJson?.items)
      ? outputsJson.items.reduce((sum: number, item: any) => sum + safeInt(item?.value), 0)
      : 0;

    return { inSats, outSats };
  } catch (error) {
    console.warn(`⚠️ [UPDATE] Falha ao obter dados BTC para ${txid}:`, error);
    return null;
  }
}

async function fetchTransactionsFromXverse(existingMap: Map<string, Transaction>): Promise<Transaction[]> {
  const grouped = new Map<string, GroupedActivity>();
  const existingHits = new Set<string>();

  let offset = 0;
  let pages = 0;

  let rateLimitHits = 0;

  while (grouped.size < MAX_TRANSACTIONS && pages < XVERSE_MAX_PAGES) {
    let page: XverseActivityResponse;
    try {
      page = await fetchXverseActivityPage(offset);
      rateLimitHits = 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isRateLimit = message.includes('status 429');
      if (isRateLimit) {
        rateLimitHits += 1;
        const backoffMs = Math.max(XVERSE_RATE_LIMIT_DELAY_MS, 1000) * Math.min(2 ** (rateLimitHits - 1), 8);
        console.warn(`⚠️ [UPDATE] Xverse rate limit atingido (${rateLimitHits}). Aguardando ${backoffMs}ms antes da nova tentativa.`);
        await sleep(backoffMs);
        if (rateLimitHits > 5) {
          console.error('❌ [UPDATE] Múltiplos rate limits consecutivos da Xverse. Abortando tentativa.');
          throw error;
        }
        continue;
      }
      throw error;
    }

    const items = page.items;

    if (!items.length) {
      break;
    }

    for (const item of items) {
      if (!item?.txid) continue;

      const txid = item.txid;
      let entry = grouped.get(txid);

      if (!entry) {
        entry = {
          blockHeight: item.blockHeight ?? 0,
          blockTime: item.blockTime,
          inputs: [],
          outputs: [],
          others: []
        };
        grouped.set(txid, entry);
      } else {
        // Atualiza metadados se ainda não definidos
        if (!entry.blockHeight && item.blockHeight) {
          entry.blockHeight = item.blockHeight;
        }
        if (!entry.blockTime && item.blockTime) {
          entry.blockTime = item.blockTime;
        }
      }

      const type = (item.type || '').toLowerCase();
      if (type === 'input') {
        entry.inputs.push(item);
      } else if (type === 'output' || type === 'mint') {
        entry.outputs.push(item);
      } else {
        entry.others.push(item);
      }

      if (existingMap.has(txid)) {
        existingHits.add(txid);
      }
    }

    offset += page.limit || XVERSE_ACTIVITY_LIMIT;
    pages += 1;

    const shouldBreak =
      existingMap.size > 0 &&
      existingHits.size >= Math.min(existingMap.size, XVERSE_EXISTING_BREAK_THRESHOLD);

    if (shouldBreak) {
      break;
    }

    if (XVERSE_RATE_LIMIT_DELAY_MS > 0) {
      await sleep(XVERSE_RATE_LIMIT_DELAY_MS);
    }
  }

  const transactions = Array.from(grouped.entries())
    .map(([txid, activity]) => buildTransactionFromActivity(txid, activity))
    .sort((a, b) => {
      if (b.block_height !== a.block_height) return b.block_height - a.block_height;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

  const trimmed = transactions.slice(0, MAX_TRANSACTIONS);

  if (XVERSE_FETCH_FEES) {
    for (const tx of trimmed) {
      const existing = existingMap.get(tx.txid);
      if (existing?.fee_sats !== undefined) {
        tx.fee_sats = existing.fee_sats;
        continue;
      }

      const totals = await fetchTransactionBtcTotals(tx.txid);
      if (totals) {
        tx.fee_sats = Math.max(totals.inSats - totals.outSats, 0);
      }

      if (XVERSE_FEE_DELAY_MS > 0) {
        await sleep(XVERSE_FEE_DELAY_MS);
      }
    }
  }

  return trimmed;
}

interface UnisatEvent {
  txid: string;
  height: number;
  timestamp: number;
  event?: string;
  type?: string;
  address: string;
  amount: string;
}

interface Transaction {
  txid: string;
  block_height: number;
  timestamp: string;
  type?: string;
  senders: Array<{
    address: string;
    amount: number;
    amount_dog: number;
    has_dog: boolean;
  }>;
  receivers: Array<{
    address: string;
    amount: number;
    amount_dog: number;
    has_dog: boolean;
    is_change?: boolean;
  }>;
  sender_count: number;
  receiver_count: number;
  total_dog_in: number;
  total_dog_out: number;
  total_dog_moved: number;
  net_transfer?: number;
  change_amount?: number;
  has_change?: boolean;
  fee_sats?: number;
}

interface TransactionsMetrics {
  last24h: {
    txCount: number;
    totalDogMoved: number;
    blockCount: number;
    avgTxPerBlock: number;
    avgDogPerTx: number;
    activeWalletCount: number;
    volumeWalletCount: number;
    topActiveWallet: { address: string; txCount: number; holderRank?: number | null } | null;
    topVolumeWallet: { address: string; dogMoved: number; direction: 'IN' | 'OUT'; holderRank?: number | null } | null;
    topOutWallet: { address: string; dogMoved: number; holderRank?: number | null } | null;
    topInWallet: { address: string; dogMoved: number; holderRank?: number | null } | null;
    topOutWallets: { address: string; dogMoved: number; rank: number; holderRank?: number | null }[];
    topInWallets: { address: string; dogMoved: number; rank: number; holderRank?: number | null }[];
    feesSats: number;
    feesBtc: number;
    seriesPerBlock: Array<{ block: number; txCount: number; dogMoved: number }>;
  };
}

// Função para buscar eventos da Unisat
async function fetchUnisatEvents(limit = 600): Promise<UnisatEvent[]> {
  const params = new URLSearchParams({
    rune: RUNE_NAME,
    start: '0',
    limit: limit.toString()
  });

  const apiKey = process.env.UNISAT_API_TOKEN;

  const response = await fetch(`${UNISAT_API_URL}?${params}`, {
    headers: {
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      'User-Agent': 'DogData Explorer/1.0'
    },
    next: { revalidate: 0 } // Sempre buscar dados frescos
  });

  if (!response.ok) {
    throw new Error(`Unisat API error: ${response.status}`);
  }

  const data = await response.json();
  
  if (data.code !== 0) {
    throw new Error(`Unisat API error: ${data.msg}`);
  }

  return data.data.detail || [];
}

// Função para processar eventos em transações
function processEvents(events: UnisatEvent[]): Transaction[] {
  const txMap = new Map<string, UnisatEvent[]>();

  // Agrupar eventos por TXID
  for (const event of events) {
    if (!txMap.has(event.txid)) {
      txMap.set(event.txid, []);
    }
    txMap.get(event.txid)!.push(event);
  }

  const transactions: Transaction[] = [];

  for (const [txid, txEvents] of Array.from(txMap.entries())) {
    const sends = txEvents.filter((e: UnisatEvent) => e.event === 'send' || e.type === 'send');
    const receives = txEvents.filter((e: UnisatEvent) => e.event === 'receive' || e.type === 'receive');

    if (sends.length === 0 && receives.length === 0) continue;

    // Metadados da transação
    const firstEvent = txEvents[0];
    const block_height = firstEvent.height;
    const timestamp = new Date(firstEvent.timestamp * 1000).toISOString();

    // Processar senders
    const senderAddresses = new Set<string>();
    const senders = sends.map((send: UnisatEvent) => {
      senderAddresses.add(send.address);
      const amountRaw = safeInt(send.amount);
      const amount_dog = toDogAmount(amountRaw);
      return {
        address: send.address,
        amount: amountRaw,
        amount_dog,
        has_dog: amount_dog > 0
      };
    });

    const total_dog_in = senders.reduce((sum, sender) => sum + sender.amount_dog, 0);

    // Processar receivers
    let total_to_self = 0;
    const receivers = receives.map((receive: UnisatEvent) => {
      const amountRaw = safeInt(receive.amount);
      const amount_dog = toDogAmount(amountRaw);
      const is_change = senderAddresses.has(receive.address);
      if (is_change) total_to_self += amount_dog;
      return {
        address: receive.address,
        amount: amountRaw,
        amount_dog,
        has_dog: amount_dog > 0,
        is_change
      };
    });

    const total_dog_out = receivers.reduce((sum, receiver) => sum + receiver.amount_dog, 0);
    const net_transfer = Math.max(total_dog_out - total_to_self, 0);

    // Validação final: garantir que os valores não excedam limites razoáveis
    const MAX_DOG_AMOUNT = 100_000_000_000; // 100 bilhões de DOG
    
    if (total_dog_out > MAX_DOG_AMOUNT || total_dog_in > MAX_DOG_AMOUNT || net_transfer > MAX_DOG_AMOUNT) {
      console.error(`⚠️ [processEvents] TX ${txid} com valores inválidos (Unisat):`, {
        totalDogOut: total_dog_out,
        totalDogIn: total_dog_in,
        netTransfer: net_transfer,
        sends: sends.map(s => ({ amount: s.amount, address: s.address })),
        receives: receives.map(r => ({ amount: r.amount, address: r.address }))
      });
      // Pular esta transação problemática
      continue;
    }

    // total_dog_moved deve usar net_transfer (excluindo change), não total_dog_out
    // Isso representa o volume REAL movido na transação
    const total_dog_moved = net_transfer;

    transactions.push({
      txid,
      block_height,
      timestamp,
      senders,
      receivers,
      sender_count: senders.length,
      receiver_count: receivers.length,
      total_dog_in: Number(total_dog_in.toFixed(5)),
      total_dog_out: Number(total_dog_out.toFixed(5)),
      total_dog_moved: Number(total_dog_moved.toFixed(5)),
      net_transfer: Number(net_transfer.toFixed(5)),
      change_amount: Number(total_to_self.toFixed(5)),
      has_change: total_to_self > 0
    });
  }

  transactions.sort((a, b) => b.block_height - a.block_height || (new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));

  return transactions;
}

function sanitizeTransaction(tx: any): Transaction {
  const senders = Array.isArray(tx?.senders) ? tx.senders.map((sender: any) => {
    const amount = Number(sender?.amount) || 0;
    const amount_dog = typeof sender?.amount_dog === 'number' ? sender.amount_dog : Number(sender?.amount_dog) || 0;
    return {
      address: sender?.address || '',
      amount,
      amount_dog,
      has_dog: Boolean(sender?.has_dog)
    };
  }) : [];

  const receivers = Array.isArray(tx?.receivers) ? tx.receivers.map((receiver: any) => {
    const amount = Number(receiver?.amount) || 0;
    const amount_dog = typeof receiver?.amount_dog === 'number' ? receiver.amount_dog : Number(receiver?.amount_dog) || 0;
    return {
      address: receiver?.address || '',
      amount,
      amount_dog,
      has_dog: Boolean(receiver?.has_dog),
      is_change: Boolean(receiver?.is_change)
    };
  }) : [];

  const net_transfer = typeof tx?.net_transfer === 'number' ? tx.net_transfer : Number(tx?.net_transfer) || 0;
  const change_amount = typeof tx?.change_amount === 'number' ? tx.change_amount : Number(tx?.change_amount) || 0;

  // Sanitizar valores de amount_dog para garantir limites razoáveis
  const MAX_DOG_AMOUNT = 100_000_000_000; // 100 bilhões de DOG
  const sanitizeDogAmount = (val: number): number => {
    if (!Number.isFinite(val) || val < 0 || val > MAX_DOG_AMOUNT) return 0;
    return val;
  };

  // Sanitizar senders e receivers
  const sanitizedSenders = senders.map((s: { address: string; amount: number; amount_dog: number; has_dog: boolean }) => ({
    ...s,
    amount_dog: sanitizeDogAmount(s.amount_dog)
  }));

  const sanitizedReceivers = receivers.map((r: { address: string; amount: number; amount_dog: number; has_dog: boolean; is_change: boolean }) => ({
    ...r,
    amount_dog: sanitizeDogAmount(r.amount_dog)
  }));

  const total_dog_in = typeof tx?.total_dog_in === 'number' ? sanitizeDogAmount(tx.total_dog_in) : sanitizeDogAmount(Number(tx?.total_dog_in) || 0);
  const total_dog_out = typeof tx?.total_dog_out === 'number' ? sanitizeDogAmount(tx.total_dog_out) : sanitizeDogAmount(Number(tx?.total_dog_out) || 0);
  const total_dog_moved = typeof tx?.total_dog_moved === 'number' ? sanitizeDogAmount(tx.total_dog_moved) : sanitizeDogAmount(Number(tx?.total_dog_moved) || 0);
  const sanitized_net_transfer = sanitizeDogAmount(net_transfer);
  const sanitized_change_amount = sanitizeDogAmount(change_amount);

  // Se valores são inválidos, zerar a transação
  if (total_dog_in > MAX_DOG_AMOUNT || total_dog_out > MAX_DOG_AMOUNT || sanitized_net_transfer > MAX_DOG_AMOUNT) {
    console.warn(`⚠️ [sanitizeTransaction] TX ${tx?.txid} com valores inválidos sendo zerada:`, {
      total_dog_in,
      total_dog_out,
      net_transfer: sanitized_net_transfer
    });
    return {
      txid: tx?.txid || '',
      block_height: Number(tx?.block_height) || 0,
      timestamp: typeof tx?.timestamp === 'string' ? tx.timestamp : new Date(tx?.timestamp || Date.now()).toISOString(),
      senders: [],
      receivers: [],
      sender_count: 0,
      receiver_count: 0,
      total_dog_in: 0,
      total_dog_out: 0,
      total_dog_moved: 0,
      net_transfer: 0,
      change_amount: 0,
      has_change: false,
      fee_sats: typeof tx?.fee_sats === 'number' && Number.isFinite(tx.fee_sats) ? tx.fee_sats : undefined
    };
  }

  return {
    txid: tx?.txid || '',
    block_height: Number(tx?.block_height) || 0,
    timestamp: typeof tx?.timestamp === 'string' ? tx.timestamp : new Date(tx?.timestamp || Date.now()).toISOString(),
    senders: sanitizedSenders,
    receivers: sanitizedReceivers,
    sender_count: Number(tx?.sender_count) || sanitizedSenders.length,
    receiver_count: Number(tx?.receiver_count) || sanitizedReceivers.length,
    total_dog_in: Number(total_dog_in.toFixed(5)),
    total_dog_out: Number(total_dog_out.toFixed(5)),
    total_dog_moved: Number(total_dog_moved.toFixed(5)),
    net_transfer: Number(sanitized_net_transfer.toFixed(5)),
    change_amount: Number(sanitized_change_amount.toFixed(5)),
    has_change: Boolean(tx?.has_change),
    fee_sats: typeof tx?.fee_sats === 'number' && Number.isFinite(tx.fee_sats) ? tx.fee_sats : undefined
  };
}

function computeMetrics(transactions: Transaction[]): TransactionsMetrics {
  const now = Date.now();
  const threshold = now - 24 * 60 * 60 * 1000;

  const windowTxs = transactions.filter((tx) => {
    const ts = new Date(tx.timestamp).getTime();
    return !Number.isNaN(ts) && ts >= threshold;
  });

  const txCount = windowTxs.length;
  let totalDogMoved = 0;
  const senderCount = new Map<string, number>();
  const senderVolume = new Map<string, number>();
  const receiverVolume = new Map<string, number>();
  const activeWalletSet = new Set<string>();
  const volumeWalletSet = new Set<string>();
  const blockStats = new Map<number, { txCount: number; dogMoved: number }>();
  let totalFeesSats = 0;

  for (const tx of windowTxs) {
    const volume = typeof tx.net_transfer === 'number'
      ? tx.net_transfer
      : (typeof tx.total_dog_moved === 'number' ? tx.total_dog_moved : 0);

    totalDogMoved += volume;
    if (typeof tx.fee_sats === 'number' && Number.isFinite(tx.fee_sats)) {
      totalFeesSats += tx.fee_sats;
    }

    if (!blockStats.has(tx.block_height)) {
      blockStats.set(tx.block_height, { txCount: 0, dogMoved: 0 });
    }
    const stats = blockStats.get(tx.block_height)!;
    stats.txCount += 1;
    stats.dogMoved += volume;

    const txSenderAmounts = new Map<string, number>();
    const txSenderAddresses = new Set<string>();
    let txSenderTotal = 0;

    for (const sender of tx.senders) {
      const address = sender.address;
      if (!address) continue;
      const amountDog = typeof sender.amount_dog === 'number'
        ? sender.amount_dog
        : Number(sender.amount_dog) || 0;

      txSenderAmounts.set(address, (txSenderAmounts.get(address) || 0) + amountDog);
      txSenderTotal += amountDog;

      if (!txSenderAddresses.has(address)) {
        txSenderAddresses.add(address);
        activeWalletSet.add(address);
        senderCount.set(address, (senderCount.get(address) || 0) + 1);
      }
    }

    for (const receiver of tx.receivers) {
      if (!receiver.address || receiver.is_change) continue;
      const amountDog = typeof receiver.amount_dog === 'number'
        ? receiver.amount_dog
        : Number(receiver.amount_dog) || 0;

      receiverVolume.set(receiver.address, (receiverVolume.get(receiver.address) || 0) + amountDog);
      volumeWalletSet.add(receiver.address);
    }

    if (volume > 0 && txSenderAddresses.size > 0) {
      if (txSenderTotal > 0) {
        for (const [address, amountDog] of Array.from(txSenderAmounts.entries())) {
          const share = (amountDog / txSenderTotal) * volume;
          senderVolume.set(address, (senderVolume.get(address) || 0) + share);
          volumeWalletSet.add(address);
        }
      } else {
        const equalShare = volume / txSenderAddresses.size;
        for (const address of Array.from(txSenderAddresses)) {
          senderVolume.set(address, (senderVolume.get(address) || 0) + equalShare);
          volumeWalletSet.add(address);
        }
      }
    }
  }

  const blockCount = blockStats.size;
  const avgTxPerBlock = blockCount > 0 ? txCount / blockCount : 0;
  const avgDogPerTx = txCount > 0 ? totalDogMoved / txCount : 0;

  const topActiveEntry = Array.from(senderCount.entries()).sort((a, b) => b[1] - a[1])[0];
  const sortedOutEntries = Array.from(senderVolume.entries()).sort((a, b) => b[1] - a[1]);
  const sortedInEntries = Array.from(receiverVolume.entries()).sort((a, b) => b[1] - a[1]);

  const topOutEntry = sortedOutEntries[0];
  const topInEntry = sortedInEntries[0];

  const topOutWallets = sortedOutEntries.slice(0, 5).map(([address, amount], index) => ({
    address,
    dogMoved: Number(amount.toFixed(5)),
    rank: index + 1,
    holderRank: null,
  }));

  const topInWallets = sortedInEntries.slice(0, 5).map(([address, amount], index) => ({
    address,
    dogMoved: Number(amount.toFixed(5)),
    rank: index + 1,
    holderRank: null,
  }));

  const topOutWallet = topOutEntry ? { address: topOutEntry[0], dogMoved: Number(topOutEntry[1].toFixed(5)), holderRank: null } : null;
  const topInWallet = topInEntry ? { address: topInEntry[0], dogMoved: Number(topInEntry[1].toFixed(5)), holderRank: null } : null;

  const topActiveWallet = topActiveEntry ? { address: topActiveEntry[0], txCount: topActiveEntry[1], holderRank: null } : null;

  let topVolumeEntry: { address: string; amount: number; direction: 'IN' | 'OUT' } | null = null;
  if (topOutEntry && (!topInEntry || topOutEntry[1] >= (topInEntry?.[1] || 0))) {
    topVolumeEntry = { address: topOutEntry[0], amount: topOutEntry[1], direction: 'OUT' }
  } else if (topInEntry) {
    topVolumeEntry = { address: topInEntry[0], amount: topInEntry[1], direction: 'IN' }
  }

  const seriesPerBlock = Array.from(blockStats.entries())
    .map(([block, stats]) => ({
      block,
      txCount: stats.txCount,
      dogMoved: Number(stats.dogMoved.toFixed(5)),
    }))
    .sort((a, b) => a.block - b.block);

  return {
    last24h: {
      txCount,
      totalDogMoved: Number(totalDogMoved.toFixed(5)),
      blockCount,
      avgTxPerBlock: Number(avgTxPerBlock.toFixed(2)),
      avgDogPerTx: Number(avgDogPerTx.toFixed(5)),
      activeWalletCount: activeWalletSet.size,
      volumeWalletCount: volumeWalletSet.size,
      topActiveWallet,
      topVolumeWallet: topVolumeEntry
        ? { address: topVolumeEntry.address, dogMoved: Number(topVolumeEntry.amount.toFixed(5)), direction: topVolumeEntry.direction, holderRank: null }
        : null,
      topOutWallet,
      topInWallet,
      topOutWallets,
      topInWallets,
      feesSats: Math.round(totalFeesSats),
      feesBtc: Number((totalFeesSats / SATOSHIS_PER_BTC).toFixed(8)),
      seriesPerBlock,
    },
  };
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

    console.log('🔄 [UPDATE] Iniciando atualização de transações...');

    // Buscar cache existente no Upstash
    const existingRaw = await redisClient.get('dog:transactions');
    let existingData: any = null;

    if (existingRaw) {
      if (typeof existingRaw === 'string') {
        try {
          existingData = JSON.parse(existingRaw);
        } catch (err) {
          console.warn('⚠️ [UPDATE] Falha ao parsear cache existente, sobrescrevendo...', err);
        }
      } else {
        existingData = existingRaw;
      }
    }

    const existingTransactions: Transaction[] = Array.isArray(existingData?.transactions)
      ? existingData.transactions.map(sanitizeTransaction)
      : [];

    const existingTxMap = new Map(existingTransactions.map((tx) => [tx.txid, tx]));

    let freshTransactions: Transaction[] = [];
    let source: 'xverse' | 'unisat' = 'xverse';

    try {
      freshTransactions = await fetchTransactionsFromXverse(existingTxMap);
      console.log(`✅ [UPDATE] ${freshTransactions.length} transações processadas via Xverse`);
    } catch (error) {
      source = 'unisat';
      console.error('⚠️ [UPDATE] Falha ao usar Xverse, acionando fallback Unisat:', error);
    }

    if (source === 'unisat') {
      const events = await fetchUnisatEvents(MAX_TRANSACTIONS);
      console.log(`✅ [UPDATE] ${events.length} eventos recebidos da Unisat`);

      if (!events.length && !existingTransactions.length) {
        return NextResponse.json({
          success: false,
          message: 'Nenhum evento encontrado',
          timestamp: new Date().toISOString()
        });
      }

      freshTransactions = processEvents(events);
      console.log(`✅ [UPDATE] ${freshTransactions.length} transações processadas via fallback Unisat`);
    }

    if (!freshTransactions.length && existingTransactions.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Nenhuma transação disponível no momento',
        timestamp: new Date().toISOString()
      });
    }

    // Mesclar e remover duplicatas (novas primeiro)
    const mergedMap = new Map<string, Transaction>();
    for (const tx of [...freshTransactions, ...existingTransactions]) {
      if (!tx.txid) continue;
      const normalized = sanitizeTransaction(tx);
      const current = mergedMap.get(tx.txid);
      if (!current || current.block_height < normalized.block_height) {
        mergedMap.set(tx.txid, normalized);
      }
    }

    const merged = Array.from(mergedMap.values());
    
    // FILTRO CRÍTICO: Remover transações com valores impossíveis ANTES de salvar no cache
    // Isso previne que transações inválidas sejam persistidas e apareçam no frontend
    const MAX_DOG_AMOUNT = 100_000_000_000; // 100 bilhões de DOG
    
    // Lista de transações conhecidas como problemáticas (a serem removidas)
    const KNOWN_PROBLEMATIC_TXIDS = new Set([
      '14f96ee20dd3a27878012c2909a82fdae5542d30f2213ff28a89f073f2f7b82d'
    ]);
    
    const validTransactions = merged.filter((tx) => {
      // Remover transações conhecidas como problemáticas
      if (KNOWN_PROBLEMATIC_TXIDS.has(tx.txid)) {
        console.warn(`🚫 [BACKEND FILTER] Removendo TX ${tx.txid} - transação conhecida como problemática`);
        return false;
      }
      
      // Validar total_dog_moved
      const volume = typeof tx.net_transfer === 'number' ? tx.net_transfer : (tx.total_dog_moved || 0);
      if (!Number.isFinite(volume) || volume < 0 || volume > MAX_DOG_AMOUNT) {
        console.warn(`🚫 [BACKEND FILTER] Removendo TX ${tx.txid} com volume inválido: ${volume}`);
        return false;
      }
      
      // Validar total_dog_out e total_dog_in
      if ((typeof tx.total_dog_out === 'number' && (tx.total_dog_out < 0 || tx.total_dog_out > MAX_DOG_AMOUNT)) ||
          (typeof tx.total_dog_in === 'number' && (tx.total_dog_in < 0 || tx.total_dog_in > MAX_DOG_AMOUNT))) {
        console.warn(`🚫 [BACKEND FILTER] Removendo TX ${tx.txid} com total_dog_out/in inválido`);
        return false;
      }
      
      // Validar senders
      const hasInvalidSender = tx.senders?.some((s: any) => {
        const amt = s.amount_dog || 0;
        return !Number.isFinite(amt) || amt < 0 || amt > MAX_DOG_AMOUNT;
      });
      
      // Validar receivers
      const hasInvalidReceiver = tx.receivers?.some((r: any) => {
        const amt = r.amount_dog || 0;
        return !Number.isFinite(amt) || amt < 0 || amt > MAX_DOG_AMOUNT;
      });
      
      if (hasInvalidSender || hasInvalidReceiver) {
        console.warn(`🚫 [BACKEND FILTER] Removendo TX ${tx.txid} com sender/receiver inválido`);
        return false;
      }
      
      // Validar consistência: se há receivers vazios mas senders com valores
      if (tx.receivers?.length === 0 && tx.senders?.length > 0 && tx.senders.some((s: any) => (s.amount_dog || 0) > 0)) {
        console.warn(`🚫 [BACKEND FILTER] Removendo TX ${tx.txid} - tem senders mas nenhum receiver`);
        return false;
      }
      
      // Validar se há duplicações suspeitas de outputs (mesmo endereço com valores muito similares)
      if (tx.receivers && tx.receivers.length > 1) {
        const receiverKeys = new Set<string>();
        for (const receiver of tx.receivers) {
          // Usar address + amount_dog como chave para detectar duplicações
          const key = `${receiver.address}:${receiver.amount_dog || 0}`;
          if (receiverKeys.has(key)) {
            console.warn(`🚫 [BACKEND FILTER] Removendo TX ${tx.txid} - outputs duplicados detectados`);
            return false;
          }
          receiverKeys.add(key);
        }
      }
      
      return true;
    });
    
    const removedCount = merged.length - validTransactions.length;
    if (removedCount > 0) {
      console.warn(`⚠️ [BACKEND FILTER] ${removedCount} transações inválidas removidas antes de salvar no cache`);
    }
    
    validTransactions.sort((a, b) => b.block_height - a.block_height || (new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    const trimmed = validTransactions.slice(0, MAX_TRANSACTIONS);
    const lastBlock = trimmed[0]?.block_height || existingData?.last_block || 0;

    const metrics = computeMetrics(trimmed);

    const payload = {
      timestamp: new Date().toISOString(),
      total_transactions: trimmed.length, // Usar trimmed.length ao invés de mergedMap.size
      last_block: lastBlock,
      last_update: new Date().toISOString(),
      transactions: trimmed, // Usar trimmed (transações válidas filtradas) ao invés de merged
      metrics,
    };

    if (payload.metrics?.last24h) {
      await attachHolderRanks(payload.metrics.last24h);
    }

    await redisClient.set('dog:transactions', JSON.stringify(payload));
    const filterMessage = removedCount > 0 ? `${removedCount} inválidas removidas` : 'todas válidas';
    console.log(`✅ [UPDATE] Cache salvo no Upstash - ${trimmed.length} TXs válidas (${filterMessage}), bloco ${lastBlock}`);

    return NextResponse.json({
      success: true,
      message: 'Transações atualizadas com sucesso',
      data: payload
    });

  } catch (error: any) {
    console.error('❌ [UPDATE] Erro:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error.message 
      },
      { status: 500 }
    );
  }
}

async function attachHolderRanks(metrics: TransactionsMetrics['last24h']) {
  const enrichList = async <T extends { address: string; holderRank?: number | null }>(list: T[]): Promise<T[]> => {
    if (!list || list.length === 0) return list;
    return Promise.all(
      list.map(async (item) => {
        try {
          const rank = await redisClient.hget<string | null>(HOLDER_RANK_HASH, item.address);
          return {
            ...item,
            holderRank: rank != null ? Number(rank) : item.holderRank ?? null,
          };
        } catch (err) {
          console.warn('⚠️ Failed to fetch holder rank for address:', item.address, err);
          return item;
        }
      })
    );
  };

  metrics.topInWallets = await enrichList(metrics.topInWallets || []);
  metrics.topOutWallets = await enrichList(metrics.topOutWallets || []);

  const singleRankLookup = async (address?: string | null) => {
    if (!address) return null;
    try {
      const rank = await redisClient.hget<string | null>(HOLDER_RANK_HASH, address);
      return rank != null ? Number(rank) : null;
    } catch (err) {
      console.warn('⚠️ Failed to fetch holder rank for address:', address, err);
      return null;
    }
  };

  if (metrics.topInWallet) {
    metrics.topInWallet.holderRank = metrics.topInWallets?.find((w) => w.address === metrics.topInWallet?.address)?.holderRank
      ?? await singleRankLookup(metrics.topInWallet.address);
  }

  if (metrics.topOutWallet) {
    metrics.topOutWallet.holderRank = metrics.topOutWallets?.find((w) => w.address === metrics.topOutWallet?.address)?.holderRank
      ?? await singleRankLookup(metrics.topOutWallet.address);
  }

  if (metrics.topActiveWallet) {
    metrics.topActiveWallet.holderRank = await singleRankLookup(metrics.topActiveWallet.address)
  }

  if (metrics.topVolumeWallet) {
    metrics.topVolumeWallet.holderRank = await singleRankLookup(metrics.topVolumeWallet.address)
  }
}

