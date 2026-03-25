import { NextRequest, NextResponse } from 'next/server';
import { redisClient } from '@/lib/upstash';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── Types ────────────────────────────────────────────────────────

interface TxParticipant {
  address: string;
  amount: number;
  amount_dog: number;
  has_dog: boolean;
  is_change?: boolean;
}

interface Transaction {
  txid: string;
  block_height: number;
  timestamp: string;
  type: string;
  senders: TxParticipant[];
  receivers: TxParticipant[];
  sender_count: number;
  receiver_count: number;
  total_dog_in: number;
  total_dog_out: number;
  total_dog_moved: number;
  net_transfer: number;
  change_amount: number;
  has_change: boolean;
  fee_sats?: number;
}

interface WhaleAlert {
  txid: string;
  txid_short: string;
  total_dog_moved: number;
  total_dog_formatted: string;
  usd_value: string;
  usd_value_raw: number;
  type: string;
  classification: string;
  severity: 'MEGA' | 'HIGH' | 'MEDIUM' | 'ALERT';
  senders: { address: string; address_short: string; amount_dog: number; amount_formatted: string }[];
  receivers: { address: string; address_short: string; amount_dog: number; amount_formatted: string; is_change: boolean }[];
  sender_count: number;
  receiver_count: number;
  net_transfer: number;
  net_transfer_formatted: string;
  block_height: number;
  timestamp: string;
  time_ago: string;
  dogdata_url: string;
  context: string;
  tweet: string;
}

// ─── Helpers ──────────────────────────────────────────────────────

function formatDogAmount(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
  return amount.toFixed(2);
}

function formatUSD(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return `$${amount.toFixed(2)}`;
}

function shortenAddress(address: string): string {
  if (address.length <= 16) return address;
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function classifyTransaction(tx: Transaction): string {
  if (tx.type === 'consolidation') return 'Consolidation';
  if (tx.type === 'split') return 'Split / Distribution';

  const receivers = tx.receivers || [];
  const senders = tx.senders || [];

  // Round numbers suggest exchange deposit/withdrawal or OTC
  const hasRoundReceiver = receivers.some(r => {
    const dog = r.amount_dog;
    return dog >= 100_000 && (dog % 1_000_000 === 0 || dog % 500_000 === 0 || dog % 100_000 === 0);
  });

  if (senders.length > 1 && receivers.length <= 2) return 'Consolidation';
  if (senders.length === 1 && receivers.length > 3) return 'Distribution';
  if (hasRoundReceiver) return 'Possible Exchange / OTC';
  if (tx.net_transfer > 0 && senders.length === 1 && receivers.length <= 2) return 'Direct Transfer';

  return 'Transfer';
}

function getSeverity(dogAmount: number): WhaleAlert['severity'] {
  if (dogAmount >= 100_000_000) return 'MEGA';    // 100M+
  if (dogAmount >= 10_000_000) return 'HIGH';      // 10M+
  if (dogAmount >= 5_000_000) return 'MEDIUM';     // 5M+
  return 'ALERT';                                   // 1M+ (default threshold)
}

function buildContext(tx: Transaction, classification: string): string {
  const parts: string[] = [];
  const senders = tx.senders || [];
  const receivers = tx.receivers || [];

  if (senders.length > 1) {
    parts.push(`${senders.length} wallets consolidated`);
  }
  if (receivers.length > 1) {
    const nonChange = receivers.filter(r => !r.is_change);
    parts.push(`sent to ${nonChange.length} recipient${nonChange.length > 1 ? 's' : ''}`);
  }
  if (classification.includes('Exchange') || classification.includes('OTC')) {
    const roundReceiver = receivers.find(r => {
      const dog = r.amount_dog;
      return dog >= 100_000 && (dog % 1_000_000 === 0 || dog % 500_000 === 0 || dog % 100_000 === 0);
    });
    if (roundReceiver) {
      parts.push(`round amount ${formatDogAmount(roundReceiver.amount_dog)} DOG (likely exchange or OTC)`);
    }
  }
  if (tx.has_change) {
    parts.push(`${formatDogAmount(tx.change_amount)} DOG returned as change`);
  }

  return parts.length > 0 ? parts.join('. ') + '.' : `${classification} of ${formatDogAmount(tx.total_dog_moved)} DOG.`;
}

function buildTweet(alert: Omit<WhaleAlert, 'tweet'>): string {
  const emoji = alert.severity === 'MEGA' ? '🔴'
    : alert.severity === 'HIGH' ? '🟠'
    : alert.severity === 'MEDIUM' ? '🟡'
    : '⚪';

  const lines = [
    `${emoji} DOG WHALE ALERT ${emoji}`,
    '',
    `${alert.total_dog_formatted} DOG (${alert.usd_value}) transferred`,
    '',
  ];

  // Show flow
  if (alert.sender_count === 1 && alert.receiver_count === 1) {
    lines.push(`${alert.senders[0].address_short} → ${alert.receivers[0].address_short}`);
  } else {
    lines.push(`${alert.sender_count} sender${alert.sender_count > 1 ? 's' : ''} → ${alert.receiver_count} receiver${alert.receiver_count > 1 ? 's' : ''}`);
  }

  if (alert.classification !== 'Transfer' && alert.classification !== 'Direct Transfer') {
    lines.push(`Type: ${alert.classification}`);
  }

  lines.push('');
  lines.push(`Block ${alert.block_height.toLocaleString()} | ${alert.time_ago}`);
  lines.push(alert.dogdata_url);
  lines.push('');
  lines.push('Powered by DOG DATA | dogdata.xyz');

  return lines.join('\n');
}

// ─── Fetch price ──────────────────────────────────────────────────

async function getDogPrice(): Promise<number> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const res = await fetch(`${baseUrl}/api/price/kraken`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      return parseFloat(data.price || data.last_price || '0');
    }
  } catch {}
  return 0;
}

// ─── Main handler ─────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const threshold = parseInt(url.searchParams.get('threshold') || '1000000', 10);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
    const format = url.searchParams.get('format') || 'full'; // full | tweet | compact

    // Fetch transactions from Redis
    const cacheDataRaw = await redisClient.get('dog:transactions');
    let txData: any = null;

    if (cacheDataRaw) {
      txData = typeof cacheDataRaw === 'string' ? JSON.parse(cacheDataRaw) : cacheDataRaw;
    }

    if (!txData || !txData.transactions) {
      return NextResponse.json(
        { error: 'Transaction data not available', status: 503 },
        { status: 503 }
      );
    }

    // Get current price for USD conversion
    const dogPrice = await getDogPrice();

    // Filter transactions above threshold
    const transactions: Transaction[] = txData.transactions;
    const whaleTransactions = transactions
      .filter(tx => tx.total_dog_moved >= threshold)
      .sort((a, b) => b.total_dog_moved - a.total_dog_moved)
      .slice(0, limit);

    // Build alerts
    const alerts: WhaleAlert[] = whaleTransactions.map(tx => {
      const classification = classifyTransaction(tx);
      const severity = getSeverity(tx.total_dog_moved);
      const usdValueRaw = tx.total_dog_moved * dogPrice;
      const dogdataUrl = `https://www.dogdata.xyz/transactions?search=${tx.txid}`;

      const senders = (tx.senders || []).map(s => ({
        address: s.address,
        address_short: shortenAddress(s.address),
        amount_dog: s.amount_dog,
        amount_formatted: `${formatDogAmount(s.amount_dog)} DOG`,
      }));

      const receivers = (tx.receivers || []).map(r => ({
        address: r.address,
        address_short: shortenAddress(r.address),
        amount_dog: r.amount_dog,
        amount_formatted: `${formatDogAmount(r.amount_dog)} DOG`,
        is_change: r.is_change || false,
      }));

      const alertBase = {
        txid: tx.txid,
        txid_short: `${tx.txid.slice(0, 8)}...${tx.txid.slice(-6)}`,
        total_dog_moved: tx.total_dog_moved,
        total_dog_formatted: `${formatDogAmount(tx.total_dog_moved)}`,
        usd_value: dogPrice > 0 ? formatUSD(usdValueRaw) : 'N/A',
        usd_value_raw: Math.round(usdValueRaw * 100) / 100,
        type: tx.type,
        classification,
        severity,
        senders,
        receivers,
        sender_count: tx.sender_count,
        receiver_count: tx.receiver_count,
        net_transfer: tx.net_transfer,
        net_transfer_formatted: `${formatDogAmount(tx.net_transfer)} DOG`,
        block_height: tx.block_height,
        timestamp: tx.timestamp,
        time_ago: timeAgo(tx.timestamp),
        dogdata_url: dogdataUrl,
        context: buildContext(tx, classification),
      };

      return {
        ...alertBase,
        tweet: buildTweet(alertBase),
      };
    });

    // Response based on format
    const response = {
      service: 'DOG DATA Whale Alerts',
      threshold: `${formatDogAmount(threshold)} DOG`,
      threshold_raw: threshold,
      dog_price_usd: dogPrice,
      total_alerts: alerts.length,
      scanned_transactions: transactions.length,
      last_block: txData.last_block || null,
      timestamp: new Date().toISOString(),
      alerts: format === 'tweet'
        ? alerts.map(a => ({ txid: a.txid, severity: a.severity, tweet: a.tweet, dogdata_url: a.dogdata_url }))
        : format === 'compact'
          ? alerts.map(a => ({
              txid_short: a.txid_short,
              amount: a.total_dog_formatted,
              usd: a.usd_value,
              severity: a.severity,
              classification: a.classification,
              time_ago: a.time_ago,
              dogdata_url: a.dogdata_url,
            }))
          : alerts,
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        'Access-Control-Allow-Origin': '*',
        'X-Whale-Count': String(alerts.length),
        'X-Threshold': String(threshold),
      },
    });
  } catch (error: any) {
    console.error('Whale alerts error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch whale alerts', message: error.message },
      { status: 500 }
    );
  }
}
