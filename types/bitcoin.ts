// Bitcoin Network Data Types
export interface BitcoinNetworkData {
  // Real-time Stats
  blockHeight: number;
  difficulty: number;
  hashrate: number;
  mempoolSize: number;
  mempoolVsize: number;
  mempoolTotalFee: number;
  
  // Price Data
  price: {
    usd: number;
    change24h: number;
  };
  
  // Fee Recommendations
  fees: {
    fastest: number;
    halfHour: number;
    hour: number;
    economy: number;
    minimum: number;
  };
  
  // Difficulty Adjustment
  difficultyAdjustment: {
    progressPercent: number;
    difficultyChange: number;
    estimatedRetargetDate: number;
    remainingBlocks: number;
    remainingTime: number;
    nextRetargetHeight: number;
  };
  
  // Mining Pools
  miningPools: {
    poolId: number;
    name: string;
    link: string;
    blockCount: number;
    rank: number;
    emptyBlocks: number;
    avgMatchRate: number;
    avgFeeDelta: string;
  }[];
  
  // Hashrate History (for charts)
  hashrateHistory: {
    timestamp: number;
    avgHashrate: number;
  }[];
  
  // Recent Blocks
  recentBlocks: {
    id: string;
    height: number;
    timestamp: number;
    txCount: number;
    size: number;
    weight: number;
    difficulty: number;
    reward: number;
  }[];
  
  // Mempool Fee Histogram (for charts)
  feeHistogram: [number, number][]; // [fee, count]
  
  // Network Health
  networkHealth: {
    status: 'excellent' | 'good' | 'warning' | 'critical';
    syncStatus: 'synced' | 'syncing' | 'behind';
    nodeCount: number;
    propagationTime: number;
    uptime: number;
  };
}

// Chart Data Types
export interface ChartDataPoint {
  timestamp: number;
  value: number;
  label?: string;
}

export interface HashrateChartData extends ChartDataPoint {
  hashrate: number;
}

export interface DifficultyChartData extends ChartDataPoint {
  difficulty: number;
}

export interface MempoolChartData extends ChartDataPoint {
  mempoolSize: number;
  mempoolVsize: number;
}

export interface FeeChartData extends ChartDataPoint {
  fee: number;
  count: number;
}

// API Response Types
export interface MempoolApiResponse {
  difficultyAdjustment: any;
  hashrate: any;
  mempool: any;
  fees: any;
  blocks: any[];
  pools: any[];
}

export interface CoinGeckoApiResponse {
  bitcoin: {
    usd: number;
    usd_24h_change: number;
  };
}


