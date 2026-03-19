import type { DogData } from '../client.js';
import type { PriceData, AggregatedPrice } from '../types.js';

export type Exchange = 'kraken' | 'gateio' | 'mexc' | 'bitget' | 'bitflow' | 'dogswap';

export class PriceResource {
  constructor(private client: DogData) {}

  async current(): Promise<AggregatedPrice> {
    return this.client.request<AggregatedPrice>('/api/price/kraken');
  }

  async fromExchange(exchange: Exchange): Promise<PriceData> {
    return this.client.request<PriceData>(`/api/price/${exchange}`);
  }

  async all(): Promise<PriceData[]> {
    const exchanges: Exchange[] = ['kraken', 'gateio', 'mexc', 'bitget', 'bitflow', 'dogswap'];
    const results = await Promise.allSettled(
      exchanges.map(exchange => this.fromExchange(exchange))
    );
    return results
      .filter((r): r is PromiseFulfilledResult<PriceData> => r.status === 'fulfilled')
      .map(r => r.value);
  }

  async kraken(): Promise<PriceData> {
    return this.fromExchange('kraken');
  }

  async gateio(): Promise<PriceData> {
    return this.fromExchange('gateio');
  }

  async mexc(): Promise<PriceData> {
    return this.fromExchange('mexc');
  }

  async bitget(): Promise<PriceData> {
    return this.fromExchange('bitget');
  }

  async bitflow(): Promise<PriceData> {
    return this.fromExchange('bitflow');
  }

  async dogswap(): Promise<PriceData> {
    return this.fromExchange('dogswap');
  }
}
