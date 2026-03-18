import { z } from "zod";
import { loadForensicData } from "../utils/data-loader.js";
import { toolResult } from "../utils/formatters.js";
export function registerForensicTools(server) {
    // -----------------------------------------------------------------------
    // get_forensic_profiles — paginated forensic behavioral profiles
    // -----------------------------------------------------------------------
    server.tool("get_forensic_profiles", "Get forensic behavioral analysis profiles of DOG airdrop recipients. " +
        "Each profile includes behavior pattern, diamond score, retention rate, " +
        "accumulation rate, and whether the holder is dumping. " +
        "Supports filtering by behavior pattern and minimum diamond score.", {
        page: z.number().int().min(1).default(1).describe("Page number (starts at 1)"),
        limit: z
            .number()
            .int()
            .min(1)
            .max(100)
            .default(20)
            .describe("Profiles per page (max 100)"),
        pattern: z
            .string()
            .optional()
            .describe("Filter by behavior pattern (e.g., 'diamond_paws', 'paper_hands', " +
            "'dog_legend', 'hodl_hero', 'profit_taker', 'panic_seller', 'rune_master')"),
        min_diamond_score: z
            .number()
            .int()
            .min(0)
            .max(100)
            .optional()
            .describe("Minimum diamond score to include (0-100)"),
        sort: z
            .enum(["diamond_score", "airdrop_rank", "retention_rate", "current_balance"])
            .default("diamond_score")
            .describe("Sort field"),
        order: z.enum(["asc", "desc"]).default("desc").describe("Sort order"),
    }, async ({ page, limit, pattern, min_diamond_score, sort, order }) => {
        const data = await loadForensicData();
        let profiles = [...data.all_profiles];
        // Filters
        if (pattern) {
            profiles = profiles.filter((p) => p.behavior_pattern.toLowerCase() === pattern.toLowerCase());
        }
        if (min_diamond_score !== undefined) {
            profiles = profiles.filter((p) => p.diamond_score >= min_diamond_score);
        }
        // Sort
        profiles.sort((a, b) => {
            const aVal = a[sort];
            const bVal = b[sort];
            return order === "desc" ? bVal - aVal : aVal - bVal;
        });
        const totalPages = Math.ceil(profiles.length / limit);
        const start = (page - 1) * limit;
        const pageProfiles = profiles.slice(start, start + limit);
        return toolResult({
            statistics: data.statistics,
            page,
            limit,
            total_results: profiles.length,
            total_pages: totalPages,
            profiles: pageProfiles,
            data_timestamp: data.timestamp,
        });
    });
    // -----------------------------------------------------------------------
    // get_diamond_scores — top diamond hands holders
    // -----------------------------------------------------------------------
    server.tool("get_diamond_scores", "Get the top diamond-hands DOG holders ranked by diamond score. " +
        "Diamond score (0-100) measures how strongly a holder has maintained " +
        "their position since the airdrop.", {
        limit: z
            .number()
            .int()
            .min(1)
            .max(100)
            .default(20)
            .describe("Number of top diamond holders to return"),
        min_score: z
            .number()
            .int()
            .min(0)
            .max(100)
            .default(80)
            .describe("Minimum diamond score threshold"),
    }, async ({ limit, min_score }) => {
        const data = await loadForensicData();
        const diamondHolders = data.all_profiles
            .filter((p) => p.diamond_score >= min_score)
            .sort((a, b) => b.diamond_score - a.diamond_score)
            .slice(0, limit)
            .map((p) => ({
            address: p.address,
            diamond_score: p.diamond_score,
            behavior_pattern: p.behavior_pattern,
            behavior_detail: p.behavior_detail,
            airdrop_amount: p.airdrop_amount,
            current_balance: p.current_balance,
            retention_rate: p.retention_rate,
            rank_change: p.rank_change,
            insights: p.insights,
        }));
        return toolResult({
            total_qualifying: data.all_profiles.filter((p) => p.diamond_score >= min_score)
                .length,
            showing: diamondHolders.length,
            min_score,
            diamond_holders: diamondHolders,
            statistics: {
                total_diamond_hands: data.statistics.diamond_hands,
                overall_retention_rate: data.statistics.retention_rate,
            },
            data_timestamp: data.timestamp,
        });
    });
}
//# sourceMappingURL=forensic.js.map