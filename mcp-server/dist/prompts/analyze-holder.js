import { z } from "zod";
export function registerAnalyzeHolderPrompt(server) {
    server.prompt("analyze-holder", "Analyze a specific DOG holder address. Provides a structured prompt to investigate " +
        "the holder's position, forensic behavioral profile, and trading patterns.", {
        address: z.string().describe("Bitcoin address of the DOG holder to analyze"),
    }, ({ address }) => ({
        messages: [
            {
                role: "user",
                content: {
                    type: "text",
                    text: [
                        `Analyze the DOG•GO•TO•THE•MOON holder at address: ${address}`,
                        "",
                        "Please perform the following analysis:",
                        "",
                        "1. **Current Position**: Use the `search_holder` tool to look up this address. Report their rank, total DOG balance, UTXO count, and percentage of total supply.",
                        "",
                        "2. **Behavioral Profile**: If forensic data is available, analyze their behavior pattern, diamond score, retention rate, and whether they are accumulating or dumping.",
                        "",
                        "3. **Airdrop History**: Check if this address was an airdrop recipient using `get_airdrop_analysis` with a search. Report their original airdrop amount and current status.",
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
    }));
}
//# sourceMappingURL=analyze-holder.js.map