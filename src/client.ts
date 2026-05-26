/**
 * Basket ETF (BasketVaultV2) API client.
 *
 * Ported from the Vaulto web app's lib/vaulto-api/basket-etf.ts. Next.js cache
 * hints (`next: { revalidate }`) removed; config is passed explicitly instead
 * of read from process.env inside each call.
 *
 * Backed by ${BASKET_ETF_API_URL}/api/etf/v2/*
 */

import type { Config } from "./config.js";

// ============================================
// CONSTANTS
// ============================================

/** Currently the only deployed vault — Vaulto DTF v2 on Base. */
export const VAULTO_DTF_V2_ADDRESS =
  "0x8CD6c14127D398a27fe9b387BC76761A2B9a37dA";

/** Base mainnet chain ID. */
export const BASE_CHAIN_ID = 8453;

/** USDC on Base — deposit settlement token. */
export const BASE_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const BASE_USDC_DECIMALS = 6;

export interface SupportedToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

/**
 * v1 lock: only WETH + USDC are accepted by the on-chain approved-asset
 * allowlist. Submitting any other token to create-vault fails at the wire step.
 */
export const SUPPORTED_TOKENS: readonly SupportedToken[] = [
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
] as const;

export function baseScanTxUrl(txHash: string): string {
  return `https://basescan.org/tx/${txHash}`;
}

export function baseScanAddressUrl(address: string): string {
  return `https://basescan.org/address/${address}`;
}

// ============================================
// RAW UPSTREAM SHAPES
// ============================================

export interface RawVault {
  id: number;
  chainId: number;
  name: string;
  symbol: string;
  status: string;
  vaultAddress: string;
  controllerAddress: string;
  handlerAddress: string;
  cowRelayerAddress: string;
  zapHelperAddress: string;
  totalValueUsd: string;
  totalSupply: string;
  totalSupplyFormatted: string;
  driftThresholdPct: string;
  minBuyRatioPct: string;
  createdAt: string;
  keeper: {
    paused: boolean;
    totalRebalances: number;
    totalValueTradedUsd: string;
    lastTickAt: string;
  };
  lastRebalance: {
    nonce: number;
    sellToken: string;
    buyToken: string;
    sellAmount: string;
    actualBuyAmount: string;
    settleTxHash: string;
    settledAt: string;
  } | null;
}

export interface RawStateAsset {
  token: string;
  symbol: string;
  balance: string;
  decimals: number;
  driftPct: string;
  priceUsd: string;
  valueUsd: string;
  targetPct: string;
  weightPct: string;
  isOverweight: boolean;
}

export interface RawState {
  source: string;
  snapshotAt: string;
  ageSeconds: number;
  totalValueUsd: string;
  needsRebalance: boolean;
  blockNumber: string;
  assets: RawStateAsset[];
}

export interface RawPreviewMint {
  shares: string;
  assets: Array<{
    token: string;
    symbol: string;
    decimals: number;
    amount: string;
    amountFormatted: string;
  }>;
}

export type RawPreviewRedeem = RawPreviewMint;

export interface RawUserPosition {
  address: string;
  sharesBalance: string;
  sharesBalanceFormatted: string;
  sharePercentage: string;
  valueUsd: string;
  underlyingHoldings: Array<{
    token: string;
    symbol: string;
    decimals: number;
    amount?: string;
    amountFormatted?: string;
    valueUsd?: string;
  }>;
}

// ============================================
// NORMALIZED SHAPES
// ============================================

export interface BasketAsset {
  token: string;
  symbol: string;
  decimals: number;
  targetWeightPct: number;
  currentWeightPct: number;
  driftPct: number;
  priceUsd: number;
  balance: string;
  valueUsd: number;
}

export interface VaultMetadata {
  vaultAddress: string;
  controllerAddress: string;
  handlerAddress: string;
  zapHelperAddress: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  tvlUsd: number;
  paused: boolean;
  createdAt: string;
  lastTickAt: string | null;
  lastRebalancedAt: string | null;
  driftThresholdPct: number;
  maxDriftPct: number;
  needsRebalance: boolean;
  priceChange24hPct: number | null;
}

export interface VaultStateResponse {
  vault: VaultMetadata;
  basket: BasketAsset[];
  sharePriceUsd: number;
}

export interface PreviewMintResponse {
  shares: string;
  assets: Array<{
    token: string;
    symbol: string;
    decimals: number;
    amount: string;
    amountFormatted: string;
    priceUsd?: number;
  }>;
  totalValueUsd: number;
  usdcEquivalentRaw: string;
}

export type PreviewRedeemResponse = PreviewMintResponse;

export interface UserPositionResponse {
  userAddress: string;
  shares: string;
  sharesFormatted: string;
  sharePercent: number;
  totalValueUsd: number;
  underlying: Array<{
    token: string;
    symbol: string;
    decimals: number;
    amount: string;
    valueUsd: number;
  }>;
}

// ============================================
// CREATE VAULT
// ============================================

export interface CreateVaultAsset {
  /** ERC-20 address (must be in the controller's approved-asset allowlist). */
  token: string;
  /** Weight in basis points. Sum across the basket MUST equal 10000. */
  weight: number;
}

export interface CreateVaultRequest {
  name: string;
  symbol: string;
  description?: string;
  /** Assets MUST be sorted by token address ascending (contract requirement). */
  assets: CreateVaultAsset[];
  creatorAddress: string;
}

export interface CreateVaultSeedAsset {
  token: string;
  symbol: string;
  decimals: number;
  amount: string;
}

export interface CreateVaultSeedRequirements {
  shares: string;
  estimatedUsdcCost: string;
  assets: CreateVaultSeedAsset[];
}

export interface CreateVaultResponse {
  vaultAddress: string;
  controllerAddress: string;
  handlerAddress: string;
  name: string;
  symbol: string;
  deployTxHashes: string[];
  wireTxHashes: string[];
  seedRequirements: CreateVaultSeedRequirements;
}

export interface CreateVaultError {
  code: string;
  message: string;
  status?: number;
  requestId?: string;
  step?: string;
  txHash?: string;
}

// ============================================
// HELPERS
// ============================================

export class ApiError extends Error {
  code = "API_ERROR";
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

const num = (v: string | number | null | undefined): number => {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/** Parse a uint256 string with given decimals to a JS number (lossy for big values). */
export function rawToNumber(raw: string, decimals: number): number {
  if (!raw || raw === "0") return 0;
  try {
    return Number(BigInt(raw)) / 10 ** decimals;
  } catch {
    return 0;
  }
}

/** Convert a JS number to a uint256 string with given decimals. */
export function numberToRaw(value: number, decimals: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  const factor = 10 ** decimals;
  return BigInt(Math.round(value * factor)).toString();
}

export function bpsToPercent(bps: number): number {
  return bps / 100;
}

export function percentToBps(percent: number): number {
  return Math.round(percent * 100);
}

async function handleResponse<T>(res: Response, url: string): Promise<T> {
  let payload: unknown;
  const ct = res.headers.get("content-type");
  if (ct?.includes("application/json")) {
    payload = await res.json();
  } else {
    const text = await res.text();
    throw new ApiError(
      `Unexpected non-JSON response from ${url}: ${res.status} ${text.slice(0, 200)}`,
      res.status
    );
  }

  if (!res.ok) {
    const data = payload as { error?: string; message?: string };
    const msg = data?.error || data?.message || `Request failed: ${res.status}`;
    throw new ApiError(msg, res.status);
  }

  return payload as T;
}

function headers(cfg: Config): Record<string, string> {
  return { "Content-Type": "application/json", "x-api-key": cfg.apiToken };
}

// ============================================
// READ ENDPOINTS
// ============================================

export async function fetchRawVault(cfg: Config): Promise<RawVault> {
  const url = `${cfg.apiUrl}/api/etf/v2/vault`;
  const res = await fetch(url, { headers: headers(cfg) });
  return handleResponse<RawVault>(res, url);
}

export async function fetchRawState(cfg: Config): Promise<RawState> {
  const url = `${cfg.apiUrl}/api/etf/v2/state`;
  const res = await fetch(url, { headers: headers(cfg) });
  return handleResponse<RawState>(res, url);
}

/** Merge /vault + /state into the normalized VaultStateResponse. */
export async function fetchVaultState(cfg: Config): Promise<VaultStateResponse> {
  const [vault, state] = await Promise.all([
    fetchRawVault(cfg),
    fetchRawState(cfg),
  ]);

  const basket: BasketAsset[] = (state.assets ?? []).map((a) => ({
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
  const maxDriftPct = basket.reduce(
    (max, a) => Math.max(max, Math.abs(a.driftPct)),
    0
  );

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

async function fetchPriceMap(cfg: Config): Promise<Map<string, number> | null> {
  try {
    const state = await fetchRawState(cfg);
    const map = new Map<string, number>();
    for (const a of state.assets ?? []) {
      map.set(a.token.toLowerCase(), num(a.priceUsd));
    }
    return map;
  } catch {
    return null;
  }
}

function valueBasket(
  assets: RawPreviewMint["assets"],
  prices: Map<string, number> | null
): { totalValueUsd: number; enriched: PreviewMintResponse["assets"] } {
  let totalValueUsd = 0;
  const enriched = (assets ?? []).map((a) => {
    const price = prices?.get(a.token.toLowerCase()) ?? 0;
    const amountFloat = num(a.amount) / 10 ** a.decimals;
    totalValueUsd += price * amountFloat;
    return { ...a, priceUsd: price };
  });
  return { totalValueUsd, enriched };
}

export async function fetchPreviewMint(
  cfg: Config,
  shares: string
): Promise<PreviewMintResponse> {
  const url = `${cfg.apiUrl}/api/etf/v2/preview-mint?shares=${shares}`;
  const [rawRes, prices] = await Promise.all([
    fetch(url, { headers: headers(cfg) }),
    fetchPriceMap(cfg),
  ]);
  const raw = await handleResponse<RawPreviewMint>(rawRes, url);
  const { totalValueUsd, enriched } = valueBasket(raw.assets, prices);
  const usdcRaw =
    totalValueUsd > 0
      ? BigInt(Math.ceil(totalValueUsd * 1_000_000)).toString()
      : "0";
  return {
    shares: raw.shares,
    assets: enriched,
    totalValueUsd,
    usdcEquivalentRaw: usdcRaw,
  };
}

export async function fetchPreviewRedeem(
  cfg: Config,
  shares: string
): Promise<PreviewRedeemResponse> {
  const url = `${cfg.apiUrl}/api/etf/v2/preview-redeem?shares=${shares}`;
  const [rawRes, prices] = await Promise.all([
    fetch(url, { headers: headers(cfg) }),
    fetchPriceMap(cfg),
  ]);
  const raw = await handleResponse<RawPreviewRedeem>(rawRes, url);
  const { totalValueUsd, enriched } = valueBasket(raw.assets, prices);
  const usdcRaw =
    totalValueUsd > 0
      ? BigInt(Math.floor(totalValueUsd * 1_000_000)).toString()
      : "0";
  return {
    shares: raw.shares,
    assets: enriched,
    totalValueUsd,
    usdcEquivalentRaw: usdcRaw,
  };
}

export async function fetchUserPosition(
  cfg: Config,
  address: string
): Promise<UserPositionResponse> {
  const url = `${cfg.apiUrl}/api/etf/v2/user/${address}`;
  const res = await fetch(url, { headers: headers(cfg) });
  const raw = await handleResponse<RawUserPosition>(res, url);
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
export async function createVault(
  cfg: Config,
  req: CreateVaultRequest
): Promise<CreateVaultResponse> {
  const url = `${cfg.apiUrl}/api/etf/v2/create-vault`;
  const res = await fetch(url, {
    method: "POST",
    headers: headers(cfg),
    body: JSON.stringify(req),
    signal: AbortSignal.timeout(115_000),
  });
  return handleResponse<CreateVaultResponse>(res, url);
}
