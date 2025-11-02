import { BitcoinNetworkData, MempoolApiResponse, CoinGeckoApiResponse } from '@/types/bitcoin';

// Cache para evitar muitas requisições
let cache: {
  data: BitcoinNetworkData | null;
  timestamp: number;
} = {
  data: null,
  timestamp: 0
};

const CACHE_DURATION = 30000; // 30 segundos

interface ApiResponse {
  difficultyAdjustment: any;
  hashrate: any;
  mempool: any;
  fees: any;
  blocks: any[];
  pools: any;
  price: any;
}

export class BitcoinApiService {
  private static async fetchAllData(): Promise<ApiResponse> {
    try {
      const response = await fetch('/api/bitcoin', {
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching Bitcoin data from API:', error);
      throw error;
    }
  }

  private static transformApiData(data: ApiResponse): Partial<BitcoinNetworkData> {
    const latestBlock = data.blocks[0];
    const latestHashrate = data.hashrate.hashrates[data.hashrate.hashrates.length - 1];

    return {
      blockHeight: latestBlock?.height || 0,
      difficulty: latestBlock?.difficulty || 0,
      hashrate: latestHashrate?.avgHashrate || 0,
      mempoolSize: data.mempool.count || 0,
      mempoolVsize: data.mempool.vsize || 0,
      mempoolTotalFee: data.mempool.total_fee || 0,
      
      fees: {
        fastest: data.fees.fastestFee || 0,
        halfHour: data.fees.halfHourFee || 0,
        hour: data.fees.hourFee || 0,
        economy: data.fees.economyFee || 0,
        minimum: data.fees.minimumFee || 0,
      },
      
      difficultyAdjustment: {
        progressPercent: data.difficultyAdjustment.progressPercent || 0,
        difficultyChange: data.difficultyAdjustment.difficultyChange || 0,
        estimatedRetargetDate: data.difficultyAdjustment.estimatedRetargetDate || 0,
        remainingBlocks: data.difficultyAdjustment.remainingBlocks || 0,
        remainingTime: data.difficultyAdjustment.remainingTime || 0,
        nextRetargetHeight: data.difficultyAdjustment.nextRetargetHeight || 0,
      },
      
      miningPools: data.pools.pools?.slice(0, 10).map((pool: any) => ({
        poolId: pool.poolId,
        name: pool.name,
        link: pool.link,
        blockCount: pool.blockCount,
        rank: pool.rank,
        emptyBlocks: pool.emptyBlocks,
        avgMatchRate: pool.avgMatchRate,
        avgFeeDelta: pool.avgFeeDelta,
      })) || [],
      
      hashrateHistory: data.hashrate.hashrates?.map((point: any) => ({
        timestamp: point.timestamp * 1000, // Convert to milliseconds
        avgHashrate: point.avgHashrate,
      })) || [],
      
      recentBlocks: data.blocks?.slice(0, 10).map((block: any) => ({
        id: block.id,
        height: block.height,
        timestamp: block.timestamp * 1000,
        txCount: block.tx_count,
        size: block.size,
        weight: block.weight,
        difficulty: block.difficulty,
        reward: block.extras?.reward || 0,
      })) || [],
      
      feeHistogram: data.mempool.fee_histogram || [],
      
      networkHealth: {
        status: 'excellent' as const,
        syncStatus: 'synced' as const,
        nodeCount: 15000,
        propagationTime: 2.5,
        uptime: 99.98,
      }
    };
  }

  public static async getBitcoinNetworkData(): Promise<BitcoinNetworkData> {
    // Check cache first
    const now = Date.now();
    if (cache.data && (now - cache.timestamp) < CACHE_DURATION) {
      return cache.data;
    }

    try {
      // Fetch all data from our API route
      const apiData = await this.fetchAllData();

      // Transform and merge data
      const transformedData: BitcoinNetworkData = {
        ...this.transformApiData(apiData),
        price: {
          usd: apiData.price?.bitcoin?.usd || 108000,
          change24h: apiData.price?.bitcoin?.usd_24h_change || 0,
        }
      } as BitcoinNetworkData;

      // Update cache
      cache = {
        data: transformedData,
        timestamp: now
      };

      return transformedData;
    } catch (error) {
      console.error('Error fetching Bitcoin network data:', error);
      
      // Return cached data if available, otherwise throw
      if (cache.data) {
        return cache.data;
      }
      
      throw new Error('Failed to fetch Bitcoin network data');
    }
  }

  // Utility methods for specific data
  public static formatHashRate(hashRate: number): string {
    if (hashRate >= 1e18) return `${(hashRate / 1e18).toFixed(1)} EH/s`;
    if (hashRate >= 1e15) return `${(hashRate / 1e15).toFixed(1)} PH/s`;
    if (hashRate >= 1e12) return `${(hashRate / 1e12).toFixed(1)} TH/s`;
    return `${hashRate.toFixed(0)} H/s`;
  }

  public static formatDifficulty(difficulty: number): string {
    if (difficulty >= 1e12) return `${(difficulty / 1e12).toFixed(1)}T`;
    if (difficulty >= 1e9) return `${(difficulty / 1e9).toFixed(1)}B`;
    if (difficulty >= 1e6) return `${(difficulty / 1e6).toFixed(1)}M`;
    return difficulty.toFixed(0);
  }

  public static formatNumber(num: number): string {
    return new Intl.NumberFormat('en-US', {
      notation: 'standard',
      maximumFractionDigits: 0
    }).format(num);
  }

  public static formatPrice(price: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  }

  public static formatPercentage(percentage: number): string {
    const sign = percentage >= 0 ? '+' : '';
    return `${sign}${percentage.toFixed(2)}%`;
  }
}
