import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * Register all DOG DATA MCP prompts. These are pure prompt-text generators
 * (no data access) — ported verbatim from the standalone mcp-server.
 */
export function registerPrompts(server: McpServer): void {
  // -----------------------------------------------------------------------
  // analyze-holder
  // -----------------------------------------------------------------------
  server.prompt(
    "analyze-holder",
    "Analyze a specific DOG holder address. Provides a structured prompt to investigate " +
      "the holder's position, forensic behavioral profile, and trading patterns.",
    {
      address: z.string().describe("Bitcoin address of the DOG holder to analyze"),
    },
    ({ address }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              `Analyze the DOG•GO•TO•THE•MOON holder at address: ${address}`,
              "",
              "Please perform the following analysis:",
              "",
              "1. **Current Position**: Use the `search_holder` tool to look up this address. Report their rank, total DOG balance, UTXO count, and percentage of total supply.",
              "",
              "2. **Behavioral Profile**: If forensic data is available, analyze their behavior pattern, diamond score, retention rate, and whether they are accumulating or dumping.",
              "",
              "3. **Airdrop History**: Check if this address was an airdrop recipient using `get_airdrop_analysis`. Report their original airdrop amount and current status.",
              "",
              "4. **Classification**: Based on the data, classify this holder as one of:",
              "   - **Whale**: Top 100 holder with significant supply percentage",
              "   - **Diamond Hands**: High diamond score (80+), still holding most of airdrop",
              "   - **Accumulator**: Currently buying more DOG beyond their airdrop",
              "   - **Paper Hands**: Sold most or all of their position",
              "   - **Regular Holder**: Mid-range position with stable behavior",
              "",
              "5. **Risk Assessment**: Provide a risk assessment if this holder were to sell their entire position, including estimated price impact based on their supply percentage.",
              "",
              "Format your response with clear sections and include all relevant numbers.",
            ].join("\n"),
          },
        },
      ],
    })
  );

  // -----------------------------------------------------------------------
  // market-report
  // -----------------------------------------------------------------------
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
              "4. **Forensic Insights**: Call `get_diamond_scores` to assess holder conviction.",
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

  // -----------------------------------------------------------------------
  // whale-alert
  // -----------------------------------------------------------------------
  server.prompt(
    "whale-alert",
    "Detect and analyze whale activity in DOG token across Bitcoin L1, Stacks, " +
      "and Solana. Identifies large holders, recent large transactions, and potential market impact.",
    {
      threshold_dog: z
        .string()
        .default("100000000")
        .describe("Minimum DOG amount to consider as whale activity (default: 100M)"),
      chain: z
        .string()
        .optional()
        .describe("Filter by chain: bitcoin, stacks, or solana. Omit for all chains."),
    },
    ({ threshold_dog, chain }) => {
      const threshold = parseInt(threshold_dog, 10) || 100_000_000;
      const chainFilter = chain
        ? ` on ${chain}`
        : " across Bitcoin L1, Stacks, and Solana";

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: [
                `Perform a whale analysis for DOG•GO•TO•THE•MOON${chainFilter} with a threshold of ${threshold.toLocaleString()} DOG.`,
                "",
                "Execute the following steps:",
                "",
                `1. **Identify Whales**: Call \`get_dog_holders\` (Bitcoin L1) and \`get_multichain_holders\`${chain ? ` with chain=${chain}` : ""} (Stacks/Solana). Filter for holders with more than ${threshold.toLocaleString()} DOG. List each whale with their chain, rank, balance, and supply percentage.`,
                "",
                `2. **Recent Whale Transactions**: Call \`get_recent_transactions\` (Bitcoin L1) and \`get_multichain_transactions\`${chain ? ` with chain=${chain}` : ""} (Stacks/Solana) to find recent large movements above ${threshold.toLocaleString()} DOG.`,
                "",
                "3. **Whale Forensics**: For the top 5 Bitcoin L1 whales, call `search_holder` to get their forensic profiles. Determine if they are:",
                "   - Accumulating (buying more)",
                "   - Holding steady (diamond hands)",
                "   - Distributing (selling gradually)",
                "   - Dumping (selling aggressively)",
                "",
                "4. **Cross-Chain Analysis**: Compare whale activity across chains. Look for:",
                "   - Large bridge transfers (Bitcoin ↔ Stacks/Solana)",
                "   - DEX swaps on Stacks/Solana indicating selling pressure",
                "   - Concentration differences between chains",
                "",
                "5. **Concentration Risk**: Calculate the combined supply held by identified whales per chain and overall. Assess the centralization risk.",
                "",
                "6. **Market Impact Assessment**: For each identified whale, estimate the potential price impact if they were to sell their entire position, assuming:",
                "   - Current 24h volume from `get_dog_price` and `get_multichain_stats`",
                "   - Linear price impact model (2% impact per 1% of daily volume sold)",
                "",
                "Format your response as a multi-chain whale alert report with clear severity indicators:",
                "- HIGH RISK: Whale showing dumping behavior with large position",
                "- MEDIUM RISK: Large holder with unclear intentions or cross-chain movement",
                "- LOW RISK: Diamond hands whale with stable position",
                "",
                "Group findings by chain (Bitcoin L1, Stacks, Solana) for clarity.",
              ].join("\n"),
            },
          },
        ],
      };
    }
  );

  // -----------------------------------------------------------------------
  // portfolio-check
  // -----------------------------------------------------------------------
  server.prompt(
    "portfolio-check",
    "Check a Bitcoin address to see their DOG holdings, value, rank among holders, " +
      "and behavioral classification.",
    {
      address: z.string().describe("Bitcoin address to check DOG portfolio for"),
    },
    ({ address }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              `Check the DOG•GO•TO•THE•MOON portfolio for address: ${address}`,
              "",
              "Please do the following:",
              "",
              "1. **Look Up Holdings**: Call `search_holder` with this address to find their DOG balance and rank.",
              "",
              "2. **Current Value**: Call `get_dog_price` to get the current price, then calculate:",
              "   - Total USD value of their DOG holdings",
              "   - Percentage of total DOG supply they hold",
              "",
              "3. **Holder Profile**: If forensic data exists, report:",
              "   - Behavior pattern and category",
              "   - Diamond score",
              "   - Whether they received the original airdrop",
              "   - How their position has changed since the airdrop",
              "",
              "4. **Position Summary**: Create a clean portfolio summary card:",
              "   ```",
              `   Address: ${address}`,
              "   DOG Balance: [amount] DOG",
              "   USD Value: $[value]",
              "   Rank: #[rank] of [total] holders",
              "   Supply %: [percentage]%",
              "   Behavior: [pattern]",
              "   Diamond Score: [score]/100",
              "   ```",
              "",
              "5. **Context**: Compare this holder to averages:",
              "   - Are they above or below average DOG holdings?",
              "   - How does their diamond score compare to the median?",
              "   - Are they in the top 1%, 5%, 10%, or bottom 50% of holders?",
            ].join("\n"),
          },
        },
      ],
    })
  );
}
