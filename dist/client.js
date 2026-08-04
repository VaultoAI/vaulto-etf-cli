/**
 * Basket ETF (BasketVaultV2) API client.
 *
 * Ported from the Vaulto web app's lib/vaulto-api/basket-etf.ts. Next.js cache
 * hints (`next: { revalidate }`) removed; config is passed explicitly instead
 * of read from process.env inside each call.
 *
 * Backed by ${BASKET_ETF_API_URL}/api/etf/v2/*
 */
// ============================================
// CONSTANTS
// ============================================
/** Currently the only deployed vault — Vaulto DTF v2 on Base. */
export const VAULTO_DTF_V2_ADDRESS = "0x8CD6c14127D398a27fe9b387BC76761A2B9a37dA";
/** Base mainnet chain ID. */
export const BASE_CHAIN_ID = 8453;
/** USDC on Base — deposit settlement token. */
export const BASE_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const BASE_USDC_DECIMALS = 6;
/**
 * v1 lock: only WETH + USDC are accepted by the on-chain approved-asset
 * allowlist. Submitting any other token to create-vault fails at the wire step.
 */
export const SUPPORTED_TOKENS = [
    {
        address: "0x4200000000000000000000000000000000000006",
        symbol: "WETH",
        name: "Wrapped Ether",
        decimals: 18,
    },
    {
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
    },
];
export function baseScanTxUrl(txHash) {
    return `https://basescan.org/tx/${txHash}`;
}
export function baseScanAddressUrl(address) {
    return `https://basescan.org/address/${address}`;
}
// ============================================
// HELPERS
// ============================================
export class ApiError extends Error {
    code = "API_ERROR";
    status;
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}
const num = (v) => {
    if (v === null || v === undefined)
        return 0;
    const n = typeof v === "number" ? v : parseFloat(v);
    return Number.isFinite(n) ? n : 0;
};
/** Parse a uint256 string with given decimals to a JS number (lossy for big values). */
export function rawToNumber(raw, decimals) {
    if (!raw || raw === "0")
        return 0;
    try {
        return Number(BigInt(raw)) / 10 ** decimals;
    }
    catch {
        return 0;
    }
}
/** Convert a JS number to a uint256 string with given decimals. */
export function numberToRaw(value, decimals) {
    if (!Number.isFinite(value) || value <= 0)
        return "0";
    const factor = 10 ** decimals;
    return BigInt(Math.round(value * factor)).toString();
}
export function bpsToPercent(bps) {
    return bps / 100;
}
export function percentToBps(percent) {
    return Math.round(percent * 100);
}
async function handleResponse(res, url) {
    let payload;
    const ct = res.headers.get("content-type");
    if (ct?.includes("application/json")) {
        payload = await res.json();
    }
    else {
        const text = await res.text();
        throw new ApiError(`Unexpected non-JSON response from ${url}: ${res.status} ${text.slice(0, 200)}`, res.status);
    }
    if (!res.ok) {
        const data = payload;
        const msg = data?.error || data?.message || `Request failed: ${res.status}`;
        throw new ApiError(msg, res.status);
    }
    return payload;
}
function headers(cfg) {
    return { "Content-Type": "application/json", "x-api-key": cfg.apiToken };
}
// ============================================
// READ ENDPOINTS
// ============================================
export async function fetchRawVault(cfg) {
    const url = `${cfg.apiUrl}/api/etf/v2/vault`;
    const res = await fetch(url, { headers: headers(cfg) });
    return handleResponse(res, url);
}
export async function fetchRawState(cfg) {
    const url = `${cfg.apiUrl}/api/etf/v2/state`;
    const res = await fetch(url, { headers: headers(cfg) });
    return handleResponse(res, url);
}
/** Merge /vault + /state into the normalized VaultStateResponse. */
export async function fetchVaultState(cfg) {
    const [vault, state] = await Promise.all([
        fetchRawVault(cfg),
        fetchRawState(cfg),
    ]);
    const basket = (state.assets ?? []).map((a) => ({
        token: a.token,
        symbol: a.symbol,
        decimals: a.decimals,
        targetWeightPct: num(a.targetPct),
        currentWeightPct: num(a.weightPct),
        driftPct: num(a.driftPct) * (a.isOverweight ? 1 : -1),
        priceUsd: num(a.priceUsd),
        balance: a.balance,
        valueUsd: num(a.valueUsd),
    }));
    const tvl = num(vault.totalValueUsd);
    const supply = num(vault.totalSupplyFormatted);
    const sharePriceUsd = supply > 0 ? tvl / supply : 0;
    const maxDriftPct = basket.reduce((max, a) => Math.max(max, Math.abs(a.driftPct)), 0);
    return {
        vault: {
            vaultAddress: vault.vaultAddress,
            controllerAddress: vault.controllerAddress,
            handlerAddress: vault.handlerAddress,
            zapHelperAddress: vault.zapHelperAddress,
            name: vault.name,
            symbol: vault.symbol,
            decimals: 18,
            totalSupply: vault.totalSupply,
            tvlUsd: tvl,
            paused: !!vault.keeper?.paused,
            createdAt: vault.createdAt,
            lastTickAt: vault.keeper?.lastTickAt ?? null,
            lastRebalancedAt: vault.lastRebalance?.settledAt ?? null,
            driftThresholdPct: num(vault.driftThresholdPct),
            maxDriftPct,
            needsRebalance: !!state.needsRebalance,
            priceChange24hPct: null,
        },
        basket,
        sharePriceUsd,
    };
}
async function fetchPriceMap(cfg) {
    try {
        const state = await fetchRawState(cfg);
        const map = new Map();
        for (const a of state.assets ?? []) {
            map.set(a.token.toLowerCase(), num(a.priceUsd));
        }
        return map;
    }
    catch {
        return null;
    }
}
function valueBasket(assets, prices) {
    let totalValueUsd = 0;
    const enriched = (assets ?? []).map((a) => {
        const price = prices?.get(a.token.toLowerCase()) ?? 0;
        const amountFloat = num(a.amount) / 10 ** a.decimals;
        totalValueUsd += price * amountFloat;
        return { ...a, priceUsd: price };
    });
    return { totalValueUsd, enriched };
}
export async function fetchPreviewMint(cfg, shares) {
    const url = `${cfg.apiUrl}/api/etf/v2/preview-mint?shares=${shares}`;
    const [rawRes, prices] = await Promise.all([
        fetch(url, { headers: headers(cfg) }),
        fetchPriceMap(cfg),
    ]);
    const raw = await handleResponse(rawRes, url);
    const { totalValueUsd, enriched } = valueBasket(raw.assets, prices);
    const usdcRaw = totalValueUsd > 0
        ? BigInt(Math.ceil(totalValueUsd * 1_000_000)).toString()
        : "0";
    return {
        shares: raw.shares,
        assets: enriched,
        totalValueUsd,
        usdcEquivalentRaw: usdcRaw,
    };
}
export async function fetchPreviewRedeem(cfg, shares) {
    const url = `${cfg.apiUrl}/api/etf/v2/preview-redeem?shares=${shares}`;
    const [rawRes, prices] = await Promise.all([
        fetch(url, { headers: headers(cfg) }),
        fetchPriceMap(cfg),
    ]);
    const raw = await handleResponse(rawRes, url);
    const { totalValueUsd, enriched } = valueBasket(raw.assets, prices);
    const usdcRaw = totalValueUsd > 0
        ? BigInt(Math.floor(totalValueUsd * 1_000_000)).toString()
        : "0";
    return {
        shares: raw.shares,
        assets: enriched,
        totalValueUsd,
        usdcEquivalentRaw: usdcRaw,
    };
}
export async function fetchUserPosition(cfg, address) {
    const url = `${cfg.apiUrl}/api/etf/v2/user/${address}`;
    const res = await fetch(url, { headers: headers(cfg) });
    const raw = await handleResponse(res, url);
    return {
        userAddress: raw.address,
        shares: raw.sharesBalance,
        sharesFormatted: raw.sharesBalanceFormatted,
        sharePercent: num(raw.sharePercentage),
        totalValueUsd: num(raw.valueUsd),
        underlying: (raw.underlyingHoldings ?? []).map((u) => ({
            token: u.token,
            symbol: u.symbol,
            decimals: u.decimals,
            amount: u.amount ?? "0",
            valueUsd: num(u.valueUsd),
        })),
    };
}
// ============================================
// CREATE VAULT (server-side deploy — no wallet signing)
// ============================================
/**
 * POST /api/etf/v2/create-vault. Deploys + wires contracts on Base; takes
 * ~30s, occasionally up to 60s. Irreversible and costs gas upstream.
 */
export async function createVault(cfg, req) {
    const url = `${cfg.apiUrl}/api/etf/v2/create-vault`;
    const res = await fetch(url, {
        method: "POST",
        headers: headers(cfg),
        body: JSON.stringify(req),
        signal: AbortSignal.timeout(115_000),
    });
    return handleResponse(res, url);
}
