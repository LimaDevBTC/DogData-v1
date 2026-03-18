import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerMarketReportPrompt(server: McpServer): void {
  server.prompt(
    "market-report",
    "Generate a comprehensive DOG market report covering price, volume, on-chain metrics, " +
      "holder distribution, and market sentiment indicators.",
    {},
    () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              "Generate a comprehensive DOG•GO•TO•THE•MOON market report.",
              "",
              "Use the following tools to gather data:",
              "",
              "1. **Price Data**: Call `get_dog_price` for current Kraken price and `get_market_data` for broader market metrics.",
              "",
              "2. **On-Chain Metrics**: Call `get_onchain_metrics` for holder count, UTXO distribution, concentration metrics, and MVRV ratio.",
              "",
              "3. **Holder Analysis**: Call `get_dog_holders` (page 1, limit 10) for top holders and their concentration.",
              "",
              "4. **Forensic Insights**: Call `get_forensic_profiles` with high diamond scores to assess holder conviction.",
              "",
              "5. **Bitcoin Network**: Call `get_bitcoin_network` for the underlying network status and fees.",
              "",
              "Structure your report as follows:",
              "",
              "## DOG Market Report",
              "",
              "### Price & Volume",
              "- Current price, 24h change, 24h high/low",
              "- Trading volume across exchanges",
              "- Market cap and FDV",
              "",
              "### On-Chain Health",
              "- Total holders and growth trend",
              "- UTXO distribution (age and size)",
              "- MVRV ratio interpretation",
              "- Short-term vs long-term holder balance",
              "",
              "### Whale Activity",
              "- Top 10 holder concentration",
              "- Any notable position changes",
              "",
              "### Sentiment Indicators",
              "- Diamond hands ratio",
              "- Retention rate from airdrop",
              "- Accumulation vs dumping ratio",
              "",
              "### Bitcoin Network Context",
              "- Current block height and fees",
              "- Mempool congestion level",
              "",
              "### Summary & Outlook",
              "- Key takeaways",
              "- Bullish/bearish signals",
            ].join("\n"),
          },
        },
      ],
    })
  );
}
