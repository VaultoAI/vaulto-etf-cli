/**
 * On-chain reader — replaces the old HTTP client.
 *
 * Reads everything the old backend returned directly from the
 * RebalanceController + BasketVaultV2 view functions, plus Chainlink USD feeds,
 * via viem. Snapshot math mirrors Vaulto-ETF-V2/keeper/src/planner.ts.
 *
 * All amounts are read with per-token decimals from the chain registry (or the
 * ERC-20 itself) — never assume 6 vs 18 (BNB stablecoins are 18 decimals).
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  formatUnits,
  type Address,
  type Chain,
  type PublicClient,
  type WalletClient,
} from "viem";
import { base, bsc } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { aggregatorAbi, controllerAbi, erc20Abi, vaultAbi } from "./abis.js";
import { findToken, getChainById } from "./chains.js";
import { getRpcUrl, requireSigner } from "./config.js";
import type { VaultInfo } from "./vaults.js";

const VIEM_CHAINS: Record<number, Chain> = { 8453: base, 56: bsc };

export class ChainError extends Error {
  code = "CHAIN_ERROR";
}

export function getPublicClient(chainId: number): PublicClient {
  const chain = getChainById(chainId);
  const viemChain = VIEM_CHAINS[chainId];
  if (!viemChain) throw new ChainError(`No viem chain for chainId ${chainId}`);
  return createPublicClient({
    chain: viemChain,
    transport: http(getRpcUrl(chain)),
  }) as PublicClient;
}

export function getWalletClient(chainId: number): { wallet: WalletClient; account: Address } {
  const viemChain = VIEM_CHAINS[chainId];
  if (!viemChain) throw new ChainError(`No viem chain for chainId ${chainId}`);
  const account = privateKeyToAccount(requireSigner());
  const wallet = createWalletClient({
    account,
    chain: viemChain,
    transport: http(getRpcUrl(getChainById(chainId))),
  });
  return { wallet, account: account.address };
}

// ── Types ────────────────────────────────────────────────────────────────

export interface AssetSnapshot {
  token: string;
  symbol: string;
  decimals: number;
  balanceRaw: string;
  balance: number;
  priceUsd: number;
  valueUsd: number;
  targetWeightPct: number;
  currentWeightPct: number;
  /** signed: positive = overweight, negative = underweight. */
  driftPct: number;
  isOverweight: boolean;
  maxTradeSizeRaw: string;
  feed: string;
}

export interface VaultState {
  vault: {
    slug: string;
    name: string;
    symbol: string;
    chainId: number;
    chain: string;
    vaultAddress: string;
    controllerAddress: string;
    handlerAddress: string;
    decimals: number;
    totalSupplyRaw: string;
    totalSupply: number;
    tvlUsd: number;
    sharePriceUsd: number;
    needsRebalance: boolean;
    rebalanceActive: boolean;
    driftThresholdPct: number;
    minBuyRatioPct: number;
  };
  basket: AssetSnapshot[];
}

// ── Helpers ──────────────────────────────────────────────────────────────

const D18 = 10n ** 18n;

function pctFromD18(x: bigint): number {
  return Number((x * 1_000_000n) / D18) / 1_000_000 * 100;
}

/** Resolve token symbol/decimals from the registry, falling back to on-chain. */
async function tokenMeta(
  client: PublicClient,
  chainId: number,
  token: Address
): Promise<{ symbol: string; decimals: number }> {
  const known = findToken(chainId, token);
  if (known) return { symbol: known.symbol, decimals: known.decimals };
  const [symbol, decimals] = await client.multicall({
    allowFailure: false,
    contracts: [
      { address: token, abi: erc20Abi, functionName: "symbol" },
      { address: token, abi: erc20Abi, functionName: "decimals" },
    ],
  });
  return { symbol: symbol as string, decimals: Number(decimals) };
}

// ── Reads ────────────────────────────────────────────────────────────────

/** Full basket snapshot: weights, drift, prices, balances, TVL, share price. */
export async function snapshotVault(v: VaultInfo): Promise<VaultState> {
  const client = getPublicClient(v.chainId);
  const controller = v.controller as Address;
  const vaultAddr = v.vault as Address;

  const [name, symbol, decimals, totalSupply, needsRebalance, rebalanceActive, driftThreshold, minBuyRatio, totalAssets] =
    await client.multicall({
      allowFailure: false,
      contracts: [
        { address: vaultAddr, abi: vaultAbi, functionName: "name" },
        { address: vaultAddr, abi: vaultAbi, functionName: "symbol" },
        { address: vaultAddr, abi: vaultAbi, functionName: "decimals" },
        { address: vaultAddr, abi: vaultAbi, functionName: "totalSupply" },
        { address: controller, abi: controllerAbi, functionName: "needsRebalance" },
        { address: controller, abi: controllerAbi, functionName: "rebalanceActive" },
        { address: controller, abi: controllerAbi, functionName: "driftThreshold" },
        { address: controller, abi: controllerAbi, functionName: "minBuyRatio" },
        { address: vaultAddr, abi: vaultAbi, functionName: "totalAssets" },
      ],
    });

  const [assets, balances] = totalAssets as readonly [readonly Address[], readonly bigint[]];

  // weights, drift, and per-token target/feed/maxTradeSize
  const [weightsRes, driftRes] = await client.multicall({
    allowFailure: false,
    contracts: [
      { address: controller, abi: controllerAbi, functionName: "currentWeights" },
      { address: controller, abi: controllerAbi, functionName: "driftFromTarget" },
    ],
  });
  const [, weights] = weightsRes as readonly [readonly Address[], readonly bigint[]];
  const [, absDrift, isOverweight] = driftRes as readonly [readonly Address[], readonly bigint[], readonly boolean[]];

  // per-token reads
  const perToken = await client.multicall({
    allowFailure: false,
    contracts: assets.flatMap((t) => [
      { address: controller, abi: controllerAbi, functionName: "targetWeights", args: [t] } as const,
      { address: controller, abi: controllerAbi, functionName: "maxTradeSize", args: [t] } as const,
      { address: controller, abi: controllerAbi, functionName: "priceFeeds", args: [t] } as const,
    ]),
  });

  // prices from feeds
  const feeds = assets.map((_, i) => perToken[i * 3 + 2] as Address);
  const priceData = await client.multicall({
    allowFailure: false,
    contracts: feeds.flatMap((f) => [
      { address: f, abi: aggregatorAbi, functionName: "latestRoundData" } as const,
      { address: f, abi: aggregatorAbi, functionName: "decimals" } as const,
    ]),
  });

  const basket: AssetSnapshot[] = [];
  let tvlUsd = 0;
  for (let i = 0; i < assets.length; i++) {
    const token = assets[i];
    const meta = await tokenMeta(client, v.chainId, token);
    const target = perToken[i * 3] as bigint;
    const maxTrade = perToken[i * 3 + 1] as bigint;
    const feed = feeds[i];
    const round = priceData[i * 2] as readonly [bigint, bigint, bigint, bigint, bigint];
    const feedDec = Number(priceData[i * 2 + 1] as number);
    const answer = round[1];
    const priceUsd = Number(formatUnits(answer < 0n ? 0n : answer, feedDec));
    const balance = Number(formatUnits(balances[i], meta.decimals));
    const valueUsd = balance * priceUsd;
    tvlUsd += valueUsd;
    basket.push({
      token,
      symbol: meta.symbol,
      decimals: meta.decimals,
      balanceRaw: balances[i].toString(),
      balance,
      priceUsd,
      valueUsd,
      targetWeightPct: pctFromD18(target),
      currentWeightPct: pctFromD18(weights[i] ?? 0n),
      driftPct: pctFromD18(absDrift[i] ?? 0n) * (isOverweight[i] ? 1 : -1),
      isOverweight: !!isOverweight[i],
      maxTradeSizeRaw: maxTrade.toString(),
      feed,
    });
  }

  const supply = Number(formatUnits(totalSupply as bigint, Number(decimals)));
  const chain = getChainById(v.chainId);
  return {
    vault: {
      slug: v.slug,
      name: name as string,
      symbol: symbol as string,
      chainId: v.chainId,
      chain: chain.slug,
      vaultAddress: v.vault,
      controllerAddress: v.controller,
      handlerAddress: v.handler,
      decimals: Number(decimals),
      totalSupplyRaw: (totalSupply as bigint).toString(),
      totalSupply: supply,
      tvlUsd,
      sharePriceUsd: supply > 0 ? tvlUsd / supply : 0,
      needsRebalance: needsRebalance as boolean,
      rebalanceActive: rebalanceActive as boolean,
      driftThresholdPct: pctFromD18(driftThreshold as bigint),
      minBuyRatioPct: pctFromD18(minBuyRatio as bigint),
    },
    basket,
  };
}

export interface PreviewLine {
  token: string;
  symbol: string;
  decimals: number;
  amountRaw: string;
  amount: number;
  priceUsd: number;
  valueUsd: number;
}

export interface PreviewResult {
  shares: string;
  kind: "mint" | "redeem";
  assets: PreviewLine[];
  totalValueUsd: number;
}

/** previewMint / previewRedeem on-chain, enriched with USD via Chainlink. */
export async function previewShares(
  v: VaultInfo,
  shares: bigint,
  kind: "mint" | "redeem"
): Promise<PreviewResult> {
  const client = getPublicClient(v.chainId);
  const vaultAddr = v.vault as Address;
  const fn = kind === "mint" ? "previewMint" : "previewRedeem";
  const [assets, amounts] = (await client.readContract({
    address: vaultAddr,
    abi: vaultAbi,
    functionName: fn,
    args: [shares],
  })) as readonly [readonly Address[], readonly bigint[]];

  // price each asset via the controller's configured feed
  const feeds = (await client.multicall({
    allowFailure: false,
    contracts: assets.map((t) => ({
      address: v.controller as Address,
      abi: controllerAbi,
      functionName: "priceFeeds",
      args: [t],
    })),
  })) as unknown as Address[];
  const priceData = await client.multicall({
    allowFailure: false,
    contracts: feeds.flatMap((f) => [
      { address: f, abi: aggregatorAbi, functionName: "latestRoundData" } as const,
      { address: f, abi: aggregatorAbi, functionName: "decimals" } as const,
    ]),
  });

  const lines: PreviewLine[] = [];
  let totalValueUsd = 0;
  for (let i = 0; i < assets.length; i++) {
    const meta = await tokenMeta(client, v.chainId, assets[i]);
    const round = priceData[i * 2] as readonly [bigint, bigint, bigint, bigint, bigint];
    const feedDec = Number(priceData[i * 2 + 1] as number);
    const priceUsd = Number(formatUnits(round[1] < 0n ? 0n : round[1], feedDec));
    const amount = Number(formatUnits(amounts[i], meta.decimals));
    const valueUsd = amount * priceUsd;
    totalValueUsd += valueUsd;
    lines.push({
      token: assets[i],
      symbol: meta.symbol,
      decimals: meta.decimals,
      amountRaw: amounts[i].toString(),
      amount,
      priceUsd,
      valueUsd,
    });
  }
  return { shares: shares.toString(), kind, assets: lines, totalValueUsd };
}

export interface PositionResult {
  address: string;
  vault: string;
  sharesRaw: string;
  shares: number;
  sharePercent: number;
  totalValueUsd: number;
  underlying: Array<{
    token: string;
    symbol: string;
    decimals: number;
    amountRaw: string;
    amount: number;
    valueUsd: number;
  }>;
}

/** A wallet's vault position: shares, % of supply, pro-rata underlying. */
export async function userPosition(v: VaultInfo, address: Address): Promise<PositionResult> {
  const client = getPublicClient(v.chainId);
  const vaultAddr = v.vault as Address;
  const [shares, totalSupply, decimals] = await client.multicall({
    allowFailure: false,
    contracts: [
      { address: vaultAddr, abi: vaultAbi, functionName: "balanceOf", args: [address] },
      { address: vaultAddr, abi: vaultAbi, functionName: "totalSupply" },
      { address: vaultAddr, abi: vaultAbi, functionName: "decimals" },
    ],
  });

  const sharesBn = shares as bigint;
  const supplyBn = totalSupply as bigint;
  const sharePercent = supplyBn > 0n ? Number((sharesBn * 1_000_000n) / supplyBn) / 1_000_000 * 100 : 0;

  // pro-rata = previewRedeem(shares) gives exact underlying for this holder
  const state = await snapshotVault(v);
  const underlying: PositionResult["underlying"] = [];
  let totalValueUsd = 0;
  if (sharesBn > 0n) {
    const preview = await previewShares(v, sharesBn, "redeem");
    for (const line of preview.assets) {
      underlying.push({
        token: line.token,
        symbol: line.symbol,
        decimals: line.decimals,
        amountRaw: line.amountRaw,
        amount: line.amount,
        valueUsd: line.valueUsd,
      });
      totalValueUsd += line.valueUsd;
    }
  } else {
    for (const a of state.basket) {
      underlying.push({
        token: a.token,
        symbol: a.symbol,
        decimals: a.decimals,
        amountRaw: "0",
        amount: 0,
        valueUsd: 0,
      });
    }
  }

  return {
    address,
    vault: v.vault,
    sharesRaw: sharesBn.toString(),
    shares: Number(formatUnits(sharesBn, Number(decimals))),
    sharePercent,
    totalValueUsd,
    underlying,
  };
}

export interface RebalanceStatus {
  vault: string;
  controller: string;
  needsRebalance: boolean;
  rebalanceActive: boolean;
  rebalanceNonce: string;
  driftThresholdPct: number;
  minBuyRatioPct: number;
  active: null | {
    sellToken: string;
    buyToken: string;
    sellAmount: string;
    minBuyAmount: string;
    validTo: number;
    appData: string;
  };
}

export async function rebalanceStatus(v: VaultInfo): Promise<RebalanceStatus> {
  const client = getPublicClient(v.chainId);
  const controller = v.controller as Address;
  const [needs, active, nonce, drift, minBuy] = await client.multicall({
    allowFailure: false,
    contracts: [
      { address: controller, abi: controllerAbi, functionName: "needsRebalance" },
      { address: controller, abi: controllerAbi, functionName: "rebalanceActive" },
      { address: controller, abi: controllerAbi, functionName: "rebalanceNonce" },
      { address: controller, abi: controllerAbi, functionName: "driftThreshold" },
      { address: controller, abi: controllerAbi, functionName: "minBuyRatio" },
    ],
  });

  let activeOrder: RebalanceStatus["active"] = null;
  if (active as boolean) {
    const ar = (await client.readContract({
      address: controller,
      abi: controllerAbi,
      functionName: "activeRebalance",
    })) as readonly [Address, Address, bigint, bigint, bigint, bigint, number, `0x${string}`];
    activeOrder = {
      sellToken: ar[0],
      buyToken: ar[1],
      sellAmount: ar[2].toString(),
      minBuyAmount: ar[3].toString(),
      validTo: Number(ar[6]),
      appData: ar[7],
    };
  }

  return {
    vault: v.vault,
    controller: v.controller,
    needsRebalance: needs as boolean,
    rebalanceActive: active as boolean,
    rebalanceNonce: (nonce as bigint).toString(),
    driftThresholdPct: pctFromD18(drift as bigint),
    minBuyRatioPct: pctFromD18(minBuy as bigint),
    active: activeOrder,
  };
}

export interface StartRebalanceParams {
  sellToken: Address;
  buyToken: Address;
  sellAmount: bigint;
  minBuyAmount: bigint;
  validTo: number;
  appData: `0x${string}`;
}

/**
 * Write: startRebalance(...). Authorizes a CoW order on-chain. NOTE: the
 * corresponding GPv2Order must still be submitted to the CoW REST API and
 * settleRebalance() called afterwards — that is the keeper's job. Prefer
 * `vaulto-etf keeper` over calling this by hand.
 */
export async function sendStartRebalance(v: VaultInfo, p: StartRebalanceParams): Promise<string> {
  const { wallet, account } = getWalletClient(v.chainId);
  const viemChain = VIEM_CHAINS[v.chainId];
  return wallet.writeContract({
    address: v.controller as Address,
    abi: controllerAbi,
    functionName: "startRebalance",
    args: [p.sellToken, p.buyToken, p.sellAmount, p.minBuyAmount, p.validTo, p.appData],
    account,
    chain: viemChain,
  });
}

/** Write: settleRebalance() — finalizes an in-flight rebalance. */
export async function sendSettleRebalance(v: VaultInfo): Promise<string> {
  const { wallet, account } = getWalletClient(v.chainId);
  const viemChain = VIEM_CHAINS[v.chainId];
  const hash = await wallet.writeContract({
    address: v.controller as Address,
    abi: controllerAbi,
    functionName: "settleRebalance",
    args: [],
    account,
    chain: viemChain,
  });
  return hash;
}
