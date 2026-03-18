import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { loadTransactions } from "../utils/data-loader.js";
import { toolResult } from "../utils/formatters.js";

export function registerTransactionTools(server: McpServer): void {
  // -----------------------------------------------------------------------
  // get_recent_transactions — from Redis dog:transactions
  // -----------------------------------------------------------------------
  server.tool(
    "get_recent_transactions",
    "Get recent DOG token transactions from the live transaction feed. " +
      "Supports filtering by transaction type and minimum amount.",
    {
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(20)
        .describe("Number of transactions to return (max 100)"),
      type: z
        .string()
        .optional()
        .describe("Filter by transaction type (e.g., 'transfer', 'mint')"),
      min_amount: z
        .number()
        .optional()
        .describe("Minimum DOG amount to include"),
    },
    async ({ limit, type, min_amount }) => {
      let transactions = await loadTransactions();

      if (type) {
        transactions = transactions.filter(
          (tx) => tx.type?.toLowerCase() === type.toLowerCase()
        );
      }

      if (min_amount !== undefined) {
        transactions = transactions.filter((tx) => tx.amount >= min_amount);
      }

      const recent = transactions.slice(0, limit);

      return toolResult({
        count: recent.length,
        total_available: transactions.length,
        transactions: recent,
      });
    }
  );

  // -----------------------------------------------------------------------
  // search_transaction — search by txid
  // -----------------------------------------------------------------------
  server.tool(
    "search_transaction",
    "Search for a specific DOG transaction by transaction ID (txid). " +
      "Returns full transaction details if found.",
    {
      txid: z.string().describe("Transaction ID to search for"),
    },
    async ({ txid }) => {
      const transactions = await loadTransactions();
      const tx = transactions.find(
        (t) => t.txid?.toLowerCase() === txid.toLowerCase()
      );

      if (!tx) {
        return toolResult({
          found: false,
          txid,
          message:
            "Transaction not found in the recent transaction feed. " +
            "It may be older than the cached window or not yet indexed.",
        });
      }

      return toolResult({
        found: true,
        transaction: tx,
      });
    }
  );
}
