// ─── Common ──────────────────────────────────────────────────────
export {
  PaginationSchema,
  MetadataSchema,
  ErrorDetailSchema,
  ErrorResponseSchema,
  createAgentResponseSchema,
} from './common';
export type { Pagination, Metadata, ErrorResponse } from './common';

// ─── Holders ─────────────────────────────────────────────────────
export {
  HolderSchema,
  HolderDetailSchema,
  HolderListResponseSchema,
  HolderDetailResponseSchema,
  HolderSnapshotSchema,
  HolderSnapshotResponseSchema,
} from './holder';
export type {
  Holder,
  HolderDetail,
  HolderListResponse,
  HolderDetailResponse,
  HolderSnapshot,
  HolderSnapshotResponse,
} from './holder';

// ─── Transactions ────────────────────────────────────────────────
export {
  TxParticipantSchema,
  TransactionSchema,
  TransactionListResponseSchema,
  TransactionSummarySchema,
  TransactionSummaryResponseSchema,
  HeatmapBucketSchema,
  HeatmapResponseSchema,
} from './transaction';
export type {
  TxParticipant,
  Transaction,
  TransactionListResponse,
  TransactionSummary,
  TransactionSummaryResponse,
  HeatmapBucket,
  HeatmapResponse,
} from './transaction';

// ─── Price ───────────────────────────────────────────────────────
export {
  PriceSchema,
  PriceResponseSchema,
  ExchangePriceSchema,
  MultiPriceSchema,
  MultiPriceResponseSchema,
} from './price';
export type {
  Price,
  PriceResponse,
  ExchangePrice,
  MultiPrice,
  MultiPriceResponse,
} from './price';

// ─── Metrics ─────────────────────────────────────────────────────
export {
  UtxoDistributionSchema,
  UtxoMetricsSchema,
  UtxoMetricsResponseSchema,
  HodlWaveSchema,
  UtxoAgeSchema,
  UtxoAgeResponseSchema,
  ConcentrationSchema,
  ConcentrationResponseSchema,
  RealizedCapSchema,
  RealizedCapResponseSchema,
  SupplyProfitLossSchema,
  SupplyProfitLossResponseSchema,
  MetricsHistoryPointSchema,
  MetricsHistorySchema,
  MetricsHistoryResponseSchema,
  OnchainMetricsSchema,
  OnchainMetricsResponseSchema,
} from './metrics';
export type {
  UtxoDistribution,
  UtxoMetrics,
  UtxoMetricsResponse,
  HodlWave,
  UtxoAge,
  UtxoAgeResponse,
  Concentration,
  ConcentrationResponse,
  RealizedCap,
  RealizedCapResponse,
  SupplyProfitLoss,
  SupplyProfitLossResponse,
  MetricsHistoryPoint,
  MetricsHistory,
  MetricsHistoryResponse,
  OnchainMetrics,
  OnchainMetricsResponse,
} from './metrics';

// ─── Forensic ────────────────────────────────────────────────────
export {
  ForensicProfileSchema,
  ForensicProfileListResponseSchema,
  ForensicCategoryBreakdownSchema,
  ForensicSummarySchema,
  ForensicSummaryResponseSchema,
} from './forensic';
export type {
  ForensicProfile,
  ForensicProfileListResponse,
  ForensicCategoryBreakdown,
  ForensicSummary,
  ForensicSummaryResponse,
} from './forensic';

// ─── Airdrop ─────────────────────────────────────────────────────
export {
  AirdropRecipientSchema,
  AirdropRecipientListSchema,
  AirdropRecipientListResponseSchema,
  AirdropCategoryBreakdownSchema,
  AirdropSummarySchema,
  AirdropSummaryResponseSchema,
} from './airdrop';
export type {
  AirdropRecipient,
  AirdropRecipientList,
  AirdropRecipientListResponse,
  AirdropCategoryBreakdown,
  AirdropSummary,
  AirdropSummaryResponse,
} from './airdrop';

// ─── Bitcoin ─────────────────────────────────────────────────────
export {
  BitcoinFeesSchema,
  BitcoinMempoolSchema,
  BitcoinBlockSchema,
  DifficultyAdjustmentSchema,
  HashratePointSchema,
  MiningPoolSchema,
  BitcoinPriceSchema,
  BitcoinNetworkSchema,
  BitcoinNetworkResponseSchema,
} from './bitcoin';
export type {
  BitcoinFees,
  BitcoinMempool,
  BitcoinBlock,
  DifficultyAdjustment,
  HashratePoint,
  MiningPool,
  BitcoinPrice,
  BitcoinNetwork,
  BitcoinNetworkResponse,
} from './bitcoin';

// ─── Markets ─────────────────────────────────────────────────────
export {
  MarketTickerSchema,
  MarketDataSchema,
  MarketsSchema,
  MarketsResponseSchema,
} from './markets';
export type {
  MarketTicker,
  MarketData,
  Markets,
  MarketsResponse,
} from './markets';
