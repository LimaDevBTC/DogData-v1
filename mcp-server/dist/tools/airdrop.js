import { z } from "zod";
import { loadAirdropData } from "../utils/data-loader.js";
import { toolResult } from "../utils/formatters.js";
export function registerAirdropTools(server) {
    // -----------------------------------------------------------------------
    // get_airdrop_analysis — from airdrop_analytics.json
    // -----------------------------------------------------------------------
    server.tool("get_airdrop_analysis", "Get comprehensive analysis of the DOG airdrop including summary statistics, " +
        "retention rates, category breakdown (accumulated, holding, partial_sold, sold_all), " +
        "and individual recipient details with current balances.", {
        page: z.number().int().min(1).default(1).describe("Page number (starts at 1)"),
        limit: z
            .number()
            .int()
            .min(1)
            .max(100)
            .default(20)
            .describe("Recipients per page (max 100)"),
        status: z
            .enum(["accumulated", "holding", "partial_sold", "sold_all"])
            .optional()
            .describe("Filter recipients by status category"),
        sort: z
            .enum(["rank", "airdrop_amount", "current_balance", "receive_count"])
            .default("rank")
            .describe("Sort field"),
        order: z.enum(["asc", "desc"]).default("asc").describe("Sort order"),
    }, async ({ page, limit, status, sort, order }) => {
        const data = await loadAirdropData();
        let recipients = [...data.analytics.recipients];
        // Filter by status
        if (status) {
            recipients = recipients.filter((r) => r.status.toLowerCase() === status.toLowerCase());
        }
        // Sort
        recipients.sort((a, b) => {
            const aVal = a[sort];
            const bVal = b[sort];
            return order === "desc" ? bVal - aVal : aVal - bVal;
        });
        const totalPages = Math.ceil(recipients.length / limit);
        const start = (page - 1) * limit;
        const pageRecipients = recipients.slice(start, start + limit);
        return toolResult({
            summary: data.analytics.summary,
            by_category: data.analytics.by_category,
            page,
            limit,
            total_results: recipients.length,
            total_pages: totalPages,
            recipients: pageRecipients,
            data_timestamp: data.timestamp,
        });
    });
}
//# sourceMappingURL=airdrop.js.map