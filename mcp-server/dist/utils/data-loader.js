import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { Redis } from "@upstash/redis";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "..", "..", "data");
const cache = new Map();
function getCached(key) {
    const entry = cache.get(key);
    if (!entry)
        return null;
    if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        return null;
    }
    return entry.data;
}
function setCache(key, data, ttlMs) {
    cache.set(key, { data, expiresAt: Date.now() + ttlMs });
    return data;
}
// ---------------------------------------------------------------------------
// JSON file loaders
// ---------------------------------------------------------------------------
async function loadJsonFile(filename, ttlMs = 60_000) {
    const cacheKey = `file:${filename}`;
    const cached = getCached(cacheKey);
    if (cached)
        return cached;
    const filePath = path.join(DATA_DIR, filename);
    const raw = await readFile(filePath, "utf-8");
    const data = JSON.parse(raw);
    return setCache(cacheKey, data, ttlMs);
}
// --- Public loaders -------------------------------------------------------
export async function loadHolders() {
    return loadJsonFile("dog_holders_by_address.json", 120_000);
}
export async function loadHoldersWithUtxoStats() {
    return loadJsonFile("dog_holders.json", 120_000);
}
export async function loadForensicData() {
    return loadJsonFile("forensic_behavioral_analysis.json", 300_000);
}
export async function loadAirdropData() {
    return loadJsonFile("airdrop_analytics.json", 300_000);
}
export async function loadUtxoSet() {
    return loadJsonFile("dog_utxo_set.json", 120_000);
}
// ---------------------------------------------------------------------------
// Redis (Upstash) — lazy singleton
// ---------------------------------------------------------------------------
let redis = null;
function getRedis() {
    if (redis)
        return redis;
    const url = process.env.UPSTASH_KV_REST_API_URL;
    const token = process.env.UPSTASH_KV_REST_API_TOKEN;
    if (!url || !token)
        return null;
    redis = new Redis({ url, token });
    return redis;
}
export async function loadTransactions() {
    const cacheKey = "redis:transactions";
    const cached = getCached(cacheKey);
    if (cached)
        return cached;
    const r = getRedis();
    if (!r)
        return [];
    try {
        const data = await r.get("dog:transactions");
        if (!data)
            return [];
        const txs = Array.isArray(data) ? data : [];
        return setCache(cacheKey, txs, 30_000);
    }
    catch (err) {
        console.error("[data-loader] Redis error:", err);
        return [];
    }
}
export async function fetchKrakenPrice() {
    const cacheKey = "api:kraken";
    const cached = getCached(cacheKey);
    if (cached)
        return cached;
    const resp = await fetch("https://api.kraken.com/0/public/Ticker?pair=DOGUSD");
    const json = (await resp.json());
    const pair = Object.values(json.result ?? {})[0];
    if (!pair)
        throw new Error("Kraken returned no data");
    const data = {
        price: parseFloat(pair.c[0]),
        ask: parseFloat(pair.a[0]),
        bid: parseFloat(pair.b[0]),
        volume_24h: parseFloat(pair.v[1]),
        vwap: parseFloat(pair.p[1]),
        high_24h: parseFloat(pair.h[1]),
        low_24h: parseFloat(pair.l[1]),
        open_24h: parseFloat(pair.o),
        trades_24h: pair.t[1],
        timestamp: new Date().toISOString(),
    };
    return setCache(cacheKey, data, 30_000);
}
export async function fetchCoinGeckoData() {
    const cacheKey = "api:coingecko";
    const cached = getCached(cacheKey);
    if (cached)
        return cached;
    const resp = await fetch("https://api.coingecko.com/api/v3/coins/dog-go-to-the-moon-rune");
    const json = (await resp.json());
    const md = json.market_data ?? {};
    const data = {
        market_cap: md.market_cap?.usd ?? 0,
        market_cap_rank: md.market_cap_rank ?? null,
        fully_diluted_valuation: md.fully_diluted_valuation?.usd ?? 0,
        total_volume: md.total_volume?.usd ?? 0,
        price_change_24h: md.price_change_24h ?? 0,
        price_change_percentage_24h: md.price_change_percentage_24h ?? 0,
        price_change_percentage_7d: md.price_change_percentage_7d ?? 0,
        price_change_percentage_30d: md.price_change_percentage_30d ?? 0,
        circulating_supply: md.circulating_supply ?? 0,
        total_supply: md.total_supply ?? 0,
        ath: md.ath?.usd ?? 0,
        ath_date: md.ath_date?.usd ?? "",
        atl: md.atl?.usd ?? 0,
        atl_date: md.atl_date?.usd ?? "",
        tickers: (json.tickers ?? []).map((t) => ({
            base: t.base,
            target: t.target,
            market: t.market,
            last: t.last,
            volume: t.volume,
            converted_volume: t.converted_volume,
            trust_score: t.trust_score,
            trade_url: t.trade_url,
        })),
        timestamp: new Date().toISOString(),
    };
    return setCache(cacheKey, data, 120_000);
}
export async function fetchBitcoinNetwork() {
    const cacheKey = "api:mempool";
    const cached = getCached(cacheKey);
    if (cached)
        return cached;
    const [tipHash, tipHeight, fees, mempoolInfo] = await Promise.all([
        fetch("https://mempool.space/api/blocks/tip/hash").then((r) => r.text()),
        fetch("https://mempool.space/api/blocks/tip/height").then((r) => r.text()),
        fetch("https://mempool.space/api/v1/fees/recommended").then((r) => r.json()),
        fetch("https://mempool.space/api/mempool").then((r) => r.json()),
    ]);
    const hashRateResp = await fetch("https://mempool.space/api/v1/mining/hashrate/1d");
    const hashRateJson = (await hashRateResp.json());
    const data = {
        block_height: parseInt(tipHeight, 10),
        block_hash: tipHash,
        difficulty: hashRateJson.difficulty?.[0]?.difficulty ?? 0,
        hashrate: hashRateJson.hashrates?.[0]?.avgHashrate ?? 0,
        mempool_size: mempoolInfo.count,
        mempool_bytes: mempoolInfo.vsize,
        fee_estimates: {
            fastest: fees.fastestFee,
            half_hour: fees.halfHourFee,
            hour: fees.hourFee,
            economy: fees.economyFee,
            minimum: fees.minimumFee,
        },
        timestamp: new Date().toISOString(),
    };
    return setCache(cacheKey, data, 60_000);
}
// ---------------------------------------------------------------------------
// DOG supply constant
// ---------------------------------------------------------------------------
export const DOG_TOTAL_SUPPLY = 100_000_000_000; // 100 billion DOG
//# sourceMappingURL=data-loader.js.map