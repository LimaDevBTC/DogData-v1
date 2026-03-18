import { loadAirdropData } from "../utils/data-loader.js";
import { resourceResult } from "../utils/formatters.js";
export function registerAirdropSummaryResource(server) {
    server.resource("airdrop-summary", "dog://airdrop-summary", async (uri) => {
        const data = await loadAirdropData();
        const summary = data.analytics.summary;
        const byCategory = data.analytics.by_category;
        // Top 10 largest airdrop recipients
        const topRecipients = data.analytics.recipients.slice(0, 10).map((r) => ({
            address: r.address,
            airdrop_amount: r.airdrop_amount,
            receive_count: r.receive_count,
            current_balance: r.current_balance,
            status: r.status,
        }));
        return resourceResult(uri.href, {
            data_source: data.data_source,
            summary: {
                total_recipients: summary.total_recipients,
                still_holding: summary.still_holding,
                sold_everything: summary.sold_everything,
                retention_rate: summary.retention_rate,
                total_current_balance: summary.total_current_balance,
                recipients_with_multiple_airdrops: summary.recipients_with_multiple,
                total_airdrop_events: summary.total_airdrops,
            },
            by_category: byCategory,
            top_recipients: topRecipients,
            data_timestamp: data.timestamp,
        });
    });
}
//# sourceMappingURL=airdrop-summary.js.map