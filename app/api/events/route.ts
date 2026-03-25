import { NextRequest } from 'next/server';
import { redisClient } from '@/lib/upstash';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const AVAILABLE_EVENT_TYPES = [
  'heartbeat',
  'new_transaction',
  'whale_alert',
  'price_update',
  'scanner_update',
] as const;

type EventType = (typeof AVAILABLE_EVENT_TYPES)[number];

interface SSEEvent {
  type: EventType;
  data: any;
  timestamp: string;
}

function formatSSE(event: SSEEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  const url = new URL(request.url);

  // Parse requested event types from query param
  const eventsParam = url.searchParams.get('events');
  const requestedTypes: Set<string> = eventsParam
    ? new Set(eventsParam.split(',').map(e => e.trim()).filter(e => AVAILABLE_EVENT_TYPES.includes(e as EventType)))
    : new Set(AVAILABLE_EVENT_TYPES);

  // Configurable whale threshold (default: 1M DOG)
  const whaleThreshold = parseInt(url.searchParams.get('whale_threshold') || '1000000', 10);

  // Always include heartbeat
  requestedTypes.add('heartbeat');

  let heartbeatInterval: NodeJS.Timeout | null = null;
  let transactionPollInterval: NodeJS.Timeout | null = null;
  let pricePollInterval: NodeJS.Timeout | null = null;
  let lastKnownTxId: string | null = null;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const enqueue = (event: SSEEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(formatSSE(event)));
        } catch {
          cleanup();
        }
      };

      const cleanup = () => {
        closed = true;
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }
        if (transactionPollInterval) {
          clearInterval(transactionPollInterval);
          transactionPollInterval = null;
        }
        if (pricePollInterval) {
          clearInterval(pricePollInterval);
          pricePollInterval = null;
        }
        try {
          controller.close();
        } catch {
          // Stream already closed
        }
      };

      // Send initial connection event
      try {
        const connectMsg = `data: ${JSON.stringify({
          type: 'connected',
          timestamp: new Date().toISOString(),
          available_events: Array.from(AVAILABLE_EVENT_TYPES),
          subscribed_events: Array.from(requestedTypes),
        })}\n\n`;
        controller.enqueue(encoder.encode(connectMsg));
      } catch {
        cleanup();
        return;
      }

      // Heartbeat every 30 seconds
      heartbeatInterval = setInterval(() => {
        enqueue({
          type: 'heartbeat',
          data: { status: 'alive' },
          timestamp: new Date().toISOString(),
        });
      }, 30000);

      // Poll Redis for new transactions every 30 seconds
      if (requestedTypes.has('new_transaction') || requestedTypes.has('whale_alert')) {
        const pollTransactions = async () => {
          if (closed) return;
          try {
            const txData = await redisClient.get('dog:transactions:latest');
            if (txData && typeof txData === 'object') {
              const tx = txData as any;
              const txId = tx.txid || tx.id || JSON.stringify(tx).slice(0, 32);

              if (lastKnownTxId !== null && txId !== lastKnownTxId) {
                // New transaction detected
                if (requestedTypes.has('new_transaction')) {
                  enqueue({
                    type: 'new_transaction',
                    data: tx,
                    timestamp: new Date().toISOString(),
                  });
                }

                // Check for whale alert (configurable threshold, default 1M DOG)
                const amount = parseFloat(tx.total_dog_moved || tx.amount || tx.value || '0');
                if (requestedTypes.has('whale_alert') && amount >= whaleThreshold) {
                  const formatDog = (n: number) =>
                    n >= 1e9 ? `${(n / 1e9).toFixed(2)}B`
                    : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M`
                    : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K`
                    : n.toFixed(2);
                  const severity =
                    amount >= 100_000_000 ? 'MEGA'
                    : amount >= 10_000_000 ? 'HIGH'
                    : amount >= 5_000_000 ? 'MEDIUM'
                    : 'ALERT';
                  enqueue({
                    type: 'whale_alert',
                    data: {
                      ...tx,
                      severity,
                      total_dog_formatted: `${formatDog(amount)} DOG`,
                      threshold_used: whaleThreshold,
                      dogdata_url: `https://www.dogdata.xyz/transactions?search=${tx.txid || ''}`,
                    },
                    timestamp: new Date().toISOString(),
                  });
                }
              }

              lastKnownTxId = txId;
            }
          } catch {
            // Redis poll failed silently — will retry next interval
          }
        };

        // Initial poll to set baseline
        pollTransactions();
        transactionPollInterval = setInterval(pollTransactions, 30000);
      }

      // Poll price every 60 seconds
      if (requestedTypes.has('price_update')) {
        const pollPrice = async () => {
          if (closed) return;
          try {
            const priceData = await redisClient.get('dog:price:current');
            if (priceData) {
              enqueue({
                type: 'price_update',
                data: priceData,
                timestamp: new Date().toISOString(),
              });
            }
          } catch {
            // Price poll failed silently — will retry next interval
          }
        };

        // Delay first price poll by 5s to avoid burst on connect
        setTimeout(() => {
          if (!closed) {
            pollPrice();
            pricePollInterval = setInterval(pollPrice, 60000);
          }
        }, 5000);
      }

      // Cleanup on connection abort
      request.signal.addEventListener('abort', cleanup);
    },
    cancel() {
      closed = true;
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
      if (transactionPollInterval) {
        clearInterval(transactionPollInterval);
        transactionPollInterval = null;
      }
      if (pricePollInterval) {
        clearInterval(pricePollInterval);
        pricePollInterval = null;
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no',
    },
  });
}
