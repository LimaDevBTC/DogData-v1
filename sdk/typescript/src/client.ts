import type { DogDataConfig, ApiError } from './types.js';
import { HoldersResource } from './resources/holders.js';
import { TransactionsResource } from './resources/transactions.js';
import { PriceResource } from './resources/price.js';
import { MetricsResource } from './resources/metrics.js';
import { ForensicResource } from './resources/forensic.js';
import { AirdropResource } from './resources/airdrop.js';
import { BitcoinResource } from './resources/bitcoin.js';
import { MarketsResource } from './resources/markets.js';
import { MultichainResource } from './resources/multichain.js';

export class DogDataError extends Error {
  public status: number;
  public code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'DogDataError';
    this.status = status;
    this.code = code;
  }
}

export class DogData {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeout: number;

  public readonly holders: HoldersResource;
  public readonly transactions: TransactionsResource;
  public readonly price: PriceResource;
  public readonly metrics: MetricsResource;
  public readonly forensic: ForensicResource;
  public readonly airdrop: AirdropResource;
  public readonly bitcoin: BitcoinResource;
  public readonly markets: MarketsResource;
  public readonly multichain: MultichainResource;

  constructor(config: DogDataConfig = {}) {
    this.baseUrl = (config.baseUrl || 'https://www.dogdata.xyz').replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 30000;

    this.holders = new HoldersResource(this);
    this.transactions = new TransactionsResource(this);
    this.price = new PriceResource(this);
    this.metrics = new MetricsResource(this);
    this.forensic = new ForensicResource(this);
    this.airdrop = new AirdropResource(this);
    this.bitcoin = new BitcoinResource(this);
    this.markets = new MarketsResource(this);
    this.multichain = new MultichainResource(this);
  }

  async request<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': '@dogdata/sdk/1.0.0',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        let errorBody: ApiError | null = null;
        try {
          errorBody = await response.json() as ApiError;
        } catch {}

        throw new DogDataError(
          errorBody?.message || `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          errorBody?.error || 'api_error',
        );
      }

      return await response.json() as T;
    } catch (error) {
      if (error instanceof DogDataError) throw error;

      if (error instanceof Error && error.name === 'AbortError') {
        throw new DogDataError('Request timed out', 408, 'timeout');
      }

      throw new DogDataError(
        error instanceof Error ? error.message : 'Unknown error',
        0,
        'network_error',
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
