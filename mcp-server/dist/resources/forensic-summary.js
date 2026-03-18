import { loadForensicData } from "../utils/data-loader.js";
import { resourceResult } from "../utils/formatters.js";
export function registerForensicSummaryResource(server) {
    server.resource("forensic-summary", "dog://forensic-summary", async (uri) => {
        const data = await loadForensicData();
        const stats = data.statistics;
        return resourceResult(uri.href, {
            analysis_type: data.analysis_type,
            total_analyzed: stats.total_analyzed,
            still_holding: stats.still_holding,
            sold_everything: stats.sold_everything,
            retention_rate: stats.retention_rate,
            accumulator_rate: stats.accumulator_rate,
            dumper_rate: stats.dumper_rate,
            diamond_hands_count: stats.diamond_hands,
            behavior_distribution: stats.by_pattern,
            top_diamond_hands: data.top_performers.diamond_hands.slice(0, 10).map((p) => ({
                address: p.address,
                diamond_score: p.diamond_score,
                behavior_pattern: p.behavior_pattern,
                current_balance: p.current_balance,
                retention_rate: p.retention_rate,
            })),
            data_timestamp: data.timestamp,
        });
    });
}
//# sourceMappingURL=forensic-summary.js.map