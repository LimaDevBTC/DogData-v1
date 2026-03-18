import { z } from "zod";
export function registerWhaleAlertPrompt(server) {
    server.prompt("whale-alert", "Detect and analyze whale activity in DOG token. Identifies large holders, " +
        "recent large transactions, and potential market impact.", {
        threshold_dog: z
            .string()
            .default("100000000")
            .describe("Minimum DOG amount to consider as whale activity (default: 100M)"),
    }, ({ threshold_dog }) => {
        const threshold = parseInt(threshold_dog, 10) || 100_000_000;
        return {
            messages: [
                {
                    role: "user",
                    content: {
                        type: "text",
                        text: [
                            `Perform a whale analysis for DOG•GO•TO•THE•MOON with a threshold of ${threshold.toLocaleString()} DOG.`,
                            "",
                            "Execute the following steps:",
                            "",
                            `1. **Identify Whales**: Call \`get_dog_holders\` and filter for holders with more than ${threshold.toLocaleString()} DOG. List each whale with their rank, balance, and supply percentage.`,
                            "",
                            `2. **Recent Whale Transactions**: Call \`get_recent_transactions\` with min_amount=${threshold} to find recent large movements.`,
                            "",
                            "3. **Whale Forensics**: For the top 5 whales, call `search_holder` to get their forensic profiles. Determine if they are:",
                            "   - Accumulating (buying more)",
                            "   - Holding steady (diamond hands)",
                            "   - Distributing (selling gradually)",
                            "   - Dumping (selling aggressively)",
                            "",
                            "4. **Concentration Risk**: Calculate the combined supply held by identified whales and assess the centralization risk.",
                            "",
                            "5. **Market Impact Assessment**: For each identified whale, estimate the potential price impact if they were to sell their entire position, assuming:",
                            "   - Current 24h volume from `get_dog_price`",
                            "   - Linear price impact model (2% impact per 1% of daily volume sold)",
                            "",
                            "Format your response as a whale alert report with clear severity indicators:",
                            "- HIGH RISK: Whale showing dumping behavior with large position",
                            "- MEDIUM RISK: Large holder with unclear intentions",
                            "- LOW RISK: Diamond hands whale with stable position",
                        ].join("\n"),
                    },
                },
            ],
        };
    });
}
//# sourceMappingURL=whale-alert.js.map