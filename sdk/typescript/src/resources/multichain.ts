import type { DogData } from '../client.js';
import type {
  Chain,
  MultichainHoldersResponse,
  MultichainTransactionsResponse,
  MultichainStatsResponse,
} from '../types.js';

export class MultichainResource {
  constructor(private client: DogData) {}

  async holders(options?: { chain?: Chain; limit?: number }): Promise<MultichainHoldersResponse> {
    return this.client.request<MultichainHoldersResponse>('/api/multichain/holders', {
      chain: options?.chain,
      limit: options?.limit,
    });
  }

  async transactions(options?: { chain?: Chain; limit?: number }): Promise<MultichainTransactionsResponse> {
    return this.client.request<MultichainTransactionsResponse>('/api/multichain/transactions', {
      chain: options?.chain,
      limit: options?.limit,
    });
  }

  async stats(): Promise<MultichainStatsResponse> {
    return this.client.request<MultichainStatsResponse>('/api/multichain/stats');
  }
}
