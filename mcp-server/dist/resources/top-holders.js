import { loadHolders, DOG_TOTAL_SUPPLY } from "../utils/data-loader.js";
import { resourceResult } from "../utils/formatters.js";
export function registerTopHoldersResource(server) {
    server.resource("top-holders", "dog://top-holders", async (uri) => {
        const data = await loadHolders();
        const top25 = data.holders.slice(0, 25).map((h) => ({
            rank: h.rank,
            address: h.address,
            total_dog: h.total_dog,
            percentage_of_supply: (h.total_dog / DOG_TOTAL_SUPPLY) * 100,
            utxo_count: h.utxo_count,
        }));
        return resourceResult(uri.href, {
            total_holders: data.total_holders,
            showing: top25.length,
            top_holders: top25,
            data_timestamp: data.timestamp,
        });
    });
}
//# sourceMappingURL=top-holders.js.map