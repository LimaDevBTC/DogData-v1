import type { DogData } from '../client.js';
import type { PaginationParams, PaginatedResponse, ForensicProfile, ForensicSummary } from '../types.js';

export class ForensicResource {
  constructor(private client: DogData) {}

  async profiles(params?: PaginationParams): Promise<PaginatedResponse<ForensicProfile>> {
    return this.client.request<PaginatedResponse<ForensicProfile>>('/api/forensic/profiles', {
      page: params?.page,
      limit: params?.limit,
    });
  }

  async profile(address: string): Promise<ForensicProfile> {
    return this.client.request<ForensicProfile>('/api/forensic/profiles', {
      address,
    });
  }

  async summary(): Promise<ForensicSummary> {
    return this.client.request<ForensicSummary>('/api/forensic/summary');
  }

  async byCategory(category: string, params?: PaginationParams): Promise<PaginatedResponse<ForensicProfile>> {
    return this.client.request<PaginatedResponse<ForensicProfile>>('/api/forensic/profiles', {
      category,
      page: params?.page,
      limit: params?.limit,
    });
  }

  async diamondHands(params?: PaginationParams): Promise<PaginatedResponse<ForensicProfile>> {
    return this.byCategory('diamond_hands', params);
  }

  async paperHands(params?: PaginationParams): Promise<PaginatedResponse<ForensicProfile>> {
    return this.byCategory('paper_hands', params);
  }
}
