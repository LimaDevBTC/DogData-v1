/**
 * Formatting helpers for MCP tool/resource responses.
 */
/** Standard MCP tool text response */
export declare function toolResult(data: unknown): {
    content: Array<{
        type: "text";
        text: string;
    }>;
};
/** Standard MCP resource response */
export declare function resourceResult(uri: string, data: unknown): {
    contents: Array<{
        uri: string;
        mimeType: string;
        text: string;
    }>;
};
/** Format large numbers with commas */
export declare function formatNumber(n: number): string;
/** Format DOG amounts (divide by 100_000 when stored as sats-like) */
export declare function formatDog(amount: number): string;
/** Format USD amounts */
export declare function formatUsd(amount: number): string;
/** Format percentage */
export declare function formatPercent(value: number): string;
/** Truncate address for display */
export declare function truncateAddress(address: string): string;
