import type { DogData } from '../client.js';
import type { PaginationParams, PaginatedResponse, AirdropSummary, AirdropRecipient } from '../types.js';

export class AirdropResource {
  constructor(private client: DogData) {}

  async summary(): Promise<AirdropSummary> {
    return this.client.request<AirdropSummary>('/api/airdrop/summary');
  }

  async recipients(params?: PaginationParams): Promise<PaginatedResponse<AirdropRecipient>> {
    return this.client.request<PaginatedResponse<AirdropRecipient>>('/api/airdrop/recipients', {
      page: params?.page,
      limit: params?.limit,
    });
  }

  async recipient(address: string): Promise<AirdropRecipient> {
    return this.client.request<AirdropRecipient>('/api/airdrop/recipients', {
      address,
    });
  }
}
