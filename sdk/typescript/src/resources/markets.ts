import type { DogData } from '../client.js';
import type { MarketData } from '../types.js';

export class MarketsResource {
  constructor(private client: DogData) {}

  async list(): Promise<MarketData[]> {
    return this.client.request<MarketData[]>('/api/markets');
  }

  async byExchange(exchange: string): Promise<MarketData> {
    const markets = await this.list();
    const market = markets.find(m => m.exchange.toLowerCase() === exchange.toLowerCase());
    if (!market) {
      throw new Error(`Exchange "${exchange}" not found`);
    }
    return market;
  }
}
