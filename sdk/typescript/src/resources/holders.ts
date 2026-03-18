import type { DogData } from '../client.js';
import type { PaginationParams, PaginatedResponse, Holder, HolderDetail } from '../types.js';

export class HoldersResource {
  constructor(private client: DogData) {}

  async list(params?: PaginationParams): Promise<PaginatedResponse<Holder>> {
    return this.client.request<PaginatedResponse<Holder>>('/api/dog-rune/holders', {
      page: params?.page,
      limit: params?.limit,
    });
  }

  async get(address: string): Promise<HolderDetail> {
    return this.client.request<HolderDetail>(`/api/dog-rune/holders`, {
      address,
    });
  }

  async count(): Promise<{ total: number }> {
    return this.client.request<{ total: number }>('/api/dog-rune/holders', {
      count: true,
    });
  }

  async top(limit: number = 100): Promise<Holder[]> {
    const result = await this.list({ page: 1, limit });
    return result.data;
  }
}
