import type { DogData } from '../client.js';
import type { PaginationParams, PaginatedResponse, Transaction } from '../types.js';

export class TransactionsResource {
  constructor(private client: DogData) {}

  async list(params?: PaginationParams): Promise<PaginatedResponse<Transaction>> {
    return this.client.request<PaginatedResponse<Transaction>>('/api/dog-rune/transactions-kv', {
      page: params?.page,
      limit: params?.limit,
    });
  }

  async get(txid: string): Promise<Transaction> {
    return this.client.request<Transaction>('/api/dog-rune/transactions-kv', {
      txid,
    });
  }

  async recent(limit: number = 20): Promise<Transaction[]> {
    const result = await this.list({ page: 1, limit });
    return result.data;
  }

  async byAddress(address: string, params?: PaginationParams): Promise<PaginatedResponse<Transaction>> {
    return this.client.request<PaginatedResponse<Transaction>>('/api/dog-rune/transactions-kv', {
      address,
      page: params?.page,
      limit: params?.limit,
    });
  }
}
