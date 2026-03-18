import type { DogData } from '../client.js';
import type { BitcoinStatus } from '../types.js';

export class BitcoinResource {
  constructor(private client: DogData) {}

  async status(): Promise<BitcoinStatus> {
    return this.client.request<BitcoinStatus>('/api/bitcoin');
  }

  async blockHeight(): Promise<number> {
    const status = await this.status();
    return status.block_height;
  }

  async fees(): Promise<BitcoinStatus['fee_rate']> {
    const status = await this.status();
    return status.fee_rate;
  }
}
