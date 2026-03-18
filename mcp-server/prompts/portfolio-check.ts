import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerPortfolioCheckPrompt(server: McpServer): void {
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
