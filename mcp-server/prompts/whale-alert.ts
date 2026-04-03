import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerWhaleAlertPrompt(server: McpServer): void {
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
      const chainFilter = chain ? ` on ${chain}` : " across Bitcoin L1, Stacks, and Solana";

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
}
