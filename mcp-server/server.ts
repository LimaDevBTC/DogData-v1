import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Tools
import { registerHolderTools } from "./tools/holders.js";
import { registerTransactionTools } from "./tools/transactions.js";
import { registerPriceTools } from "./tools/price.js";
import { registerMetricsTools } from "./tools/metrics.js";
import { registerForensicTools } from "./tools/forensic.js";
import { registerAirdropTools } from "./tools/airdrop.js";
import { registerBitcoinTools } from "./tools/bitcoin.js";
import { registerMarketTools } from "./tools/markets.js";
import { registerMultichainTools } from "./tools/multichain.js";

// Resources
import { registerStatsResource } from "./resources/stats.js";
import { registerTopHoldersResource } from "./resources/top-holders.js";
import { registerSupplyResource } from "./resources/supply.js";
import { registerNetworkResource } from "./resources/network.js";
import { registerPriceSummaryResource } from "./resources/price-summary.js";
import { registerForensicSummaryResource } from "./resources/forensic-summary.js";
import { registerUtxoDistributionResource } from "./resources/utxo-distribution.js";
import { registerAirdropSummaryResource } from "./resources/airdrop-summary.js";

// Prompts
import { registerAnalyzeHolderPrompt } from "./prompts/analyze-holder.js";
import { registerMarketReportPrompt } from "./prompts/market-report.js";
import { registerWhaleAlertPrompt } from "./prompts/whale-alert.js";
import { registerPortfolioCheckPrompt } from "./prompts/portfolio-check.js";

/**
 * Create and configure the DOG DATA MCP Server.
 * Registers all tools, resources, and prompts.
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: "dogdata",
    version: "1.0.0",
    description:
      "DOG DATA — Real-time on-chain data, analytics, and forensic intelligence " +
      "for the DOG•GO•TO•THE•MOON Bitcoin rune token. Provides holder data, " +
      "transaction feeds, price information, UTXO analysis, airdrop forensics, " +
      "and market metrics for AI agents.",
  });

  // Register 17 tools
  registerHolderTools(server);       // get_dog_holders, search_holder
  registerTransactionTools(server);  // get_recent_transactions, search_transaction
  registerPriceTools(server);        // get_dog_price, get_multi_exchange_prices, get_solana_dex_prices
  registerMetricsTools(server);      // get_onchain_metrics, get_metrics_history
  registerForensicTools(server);     // get_forensic_profiles, get_diamond_scores
  registerAirdropTools(server);      // get_airdrop_analysis
  registerBitcoinTools(server);      // get_bitcoin_network
  registerMarketTools(server);       // get_market_data
  registerMultichainTools(server);   // get_multichain_holders, get_multichain_transactions, get_multichain_stats

  // Register 8 resources
  registerStatsResource(server);             // dog://stats
  registerTopHoldersResource(server);        // dog://top-holders
  registerSupplyResource(server);            // dog://supply-info
  registerNetworkResource(server);           // dog://bitcoin-network
  registerPriceSummaryResource(server);      // dog://price-summary
  registerForensicSummaryResource(server);   // dog://forensic-summary
  registerUtxoDistributionResource(server);  // dog://utxo-distribution
  registerAirdropSummaryResource(server);    // dog://airdrop-summary

  // Register 4 prompts
  registerAnalyzeHolderPrompt(server);   // analyze-holder
  registerMarketReportPrompt(server);    // market-report
  registerWhaleAlertPrompt(server);      // whale-alert
  registerPortfolioCheckPrompt(server);  // portfolio-check

  return server;
}
