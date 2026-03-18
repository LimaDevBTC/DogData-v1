import { z } from "zod";
import { loadHolders, loadForensicData } from "../utils/data-loader.js";
import { toolResult } from "../utils/formatters.js";
export function registerHolderTools(server) {
    // -----------------------------------------------------------------------
    // get_dog_holders — paginated holder list
    // -----------------------------------------------------------------------
    server.tool("get_dog_holders", "Get paginated list of DOG token holders with their balances and UTXO counts. " +
        "Returns rank, address, total DOG amount, and UTXO count for each holder.", {
        page: z.number().int().min(1).default(1).describe("Page number (starts at 1)"),
        limit: z
            .number()
            .int()
            .min(1)
            .max(100)
            .default(20)
            .describe("Number of holders per page (max 100)"),
        sort: z
            .enum(["rank", "total_dog", "utxo_count"])
            .default("rank")
            .describe("Sort field"),
        order: z.enum(["asc", "desc"]).default("asc").describe("Sort order"),
    }, async ({ page, limit, sort, order }) => {
        const data = await loadHolders();
        let holders = [...data.holders];
        // Sort
        holders.sort((a, b) => {
            let cmp = 0;
            if (sort === "rank")
                cmp = a.rank - b.rank;
            else if (sort === "total_dog")
                cmp = a.total_dog - b.total_dog;
            else if (sort === "utxo_count")
                cmp = a.utxo_count - b.utxo_count;
            return order === "desc" ? -cmp : cmp;
        });
        const totalPages = Math.ceil(holders.length / limit);
        const start = (page - 1) * limit;
        const pageHolders = holders.slice(start, start + limit);
        return toolResult({
            timestamp: data.timestamp,
            total_holders: data.total_holders,
            total_utxos: data.total_utxos,
            page,
            limit,
            total_pages: totalPages,
            holders: pageHolders,
        });
    });
    // -----------------------------------------------------------------------
    // search_holder — search by address
    // -----------------------------------------------------------------------
    server.tool("search_holder", "Search for a specific DOG holder by Bitcoin address. Returns holder details " +
        "including rank, balance, UTXO count, and forensic behavioral data if available.", {
        address: z.string().describe("Bitcoin address to search for"),
    }, async ({ address }) => {
        const [holdersData, forensicData] = await Promise.all([
            loadHolders(),
            loadForensicData().catch(() => null),
        ]);
        const holder = holdersData.holders.find((h) => h.address.toLowerCase() === address.toLowerCase());
        const forensicProfile = forensicData?.all_profiles.find((p) => p.address.toLowerCase() === address.toLowerCase());
        if (!holder && !forensicProfile) {
            return toolResult({
                found: false,
                address,
                message: "Address not found in current holder data or forensic profiles.",
            });
        }
        return toolResult({
            found: true,
            address,
            holder: holder
                ? {
                    rank: holder.rank,
                    total_dog: holder.total_dog,
                    total_amount: holder.total_amount,
                    utxo_count: holder.utxo_count,
                    percentage_of_supply: (holder.total_dog / 100_000_000_000) * 100,
                }
                : null,
            forensic: forensicProfile
                ? {
                    airdrop_rank: forensicProfile.airdrop_rank,
                    airdrop_amount: forensicProfile.airdrop_amount,
                    current_balance: forensicProfile.current_balance,
                    behavior_pattern: forensicProfile.behavior_pattern,
                    behavior_category: forensicProfile.behavior_category,
                    behavior_detail: forensicProfile.behavior_detail,
                    diamond_score: forensicProfile.diamond_score,
                    retention_rate: forensicProfile.retention_rate,
                    accumulation_rate: forensicProfile.accumulation_rate,
                    is_dumping: forensicProfile.is_dumping,
                    rank_change: forensicProfile.rank_change,
                    insights: forensicProfile.insights,
                }
                : null,
            data_timestamp: holdersData.timestamp,
        });
    });
}
//# sourceMappingURL=holders.js.map