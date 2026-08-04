/**
 * On-chain reader/writer — viem clients for Base + BNB + Robinhood Chain.
 *
 * Supports two vault architectures:
 *   - cow: RebalanceController owns weights/drift/start/settle
 *   - v4:  UniswapV4RebalanceHandler owns weights/drift/executeSwap
 *
 * Snapshot math mirrors ETFs/keeper/src/planner.ts and planner-rh.ts.
 * All amounts use per-token decimals from the chain registry (or ERC-20).
 */

import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  formatUnits,
  decodeEventLog,
  type Address,
  type Chain,
  type PublicClient,
  type WalletClient,
  type Hash,
} from "viem";
import { base, bsc } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import {
  aggregatorAbi,
  controllerAbi,
  erc20Abi,
  factoryAbi,
  v4HandlerAbi,
  vaultAbi,
  zapperAbi,
} from "./abis.js";
import { findToken, getChainById } from "./chains.js";
import { getRpcUrl, requireSigner } from "./config.js";
import type { VaultInfo } from "./vaults.js";
import { rebalanceTarget } from "./vaults.js";

/** Robinhood Chain — Arbitrum Orbit L2. Multicall3 is at the CREATE2 address. */
const robinhoodChain = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
  blockExplorers: {
    default: { name: "Blockscout", url: "https://robinhoodchain.blockscout.com" },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
      blockCreated: 0,
    },
  },
});

const VIEM_CHAINS: Record<number, Chain> = {
  8453: base,
  56: bsc,
  4663: robinhoodChain,
};

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
    kind: "cow" | "v4";
    vaultAddress: string;
    controllerAddress: string;
    handlerAddress: string;
    zapperAddress: string | null;
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
  return (Number((x * 1_000_000n) / D18) / 1_000_000) * 100;
}

function absBigInt(x: bigint): bigint {
  return x < 0n ? -x : x;
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

/** Contract that holds priceFeeds / targetWeights / maxTradeSize for a vault. */
function stateContract(v: VaultInfo): Address {
  return rebalanceTarget(v) as Address;
}

// ── Reads ────────────────────────────────────────────────────────────────

/** Full basket snapshot: weights, drift, prices, balances, TVL, share price. */
export async function snapshotVault(v: VaultInfo): Promise<VaultState> {
  const client = getPublicClient(v.chainId);
  const stateAddr = stateContract(v);
  const vaultAddr = v.vault as Address;

  if (v.kind === "v4") {
    return snapshotV4(client, v, vaultAddr, stateAddr);
  }
  return snapshotCow(client, v, vaultAddr, stateAddr);
}

async function snapshotCow(
  client: PublicClient,
  v: VaultInfo,
  vaultAddr: Address,
  controller: Address
): Promise<VaultState> {
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

  const [weightsRes, driftRes] = await client.multicall({
    allowFailure: false,
    contracts: [
      { address: controller, abi: controllerAbi, functionName: "currentWeights" },
      { address: controller, abi: controllerAbi, functionName: "driftFromTarget" },
    ],
  });
  const [, weights] = weightsRes as readonly [readonly Address[], readonly bigint[]];
  const [, absDrift, isOverweight] = driftRes as readonly [
    readonly Address[],
    readonly bigint[],
    readonly boolean[],
  ];

  const basket = await buildBasket(client, v.chainId, controller, "cow", assets, balances, weights, absDrift, isOverweight);
  return assembleState(v, name as string, symbol as string, Number(decimals), totalSupply as bigint, needsRebalance as boolean, rebalanceActive as boolean, driftThreshold as bigint, minBuyRatio as bigint, basket);
}

async function snapshotV4(
  client: PublicClient,
  v: VaultInfo,
  vaultAddr: Address,
  handler: Address
): Promise<VaultState> {
  const [name, symbol, decimals, totalSupply, needsRebalance, driftThreshold, minBuyRatio, totalAssets] =
    await client.multicall({
      allowFailure: false,
      contracts: [
        { address: vaultAddr, abi: vaultAbi, functionName: "name" },
        { address: vaultAddr, abi: vaultAbi, functionName: "symbol" },
        { address: vaultAddr, abi: vaultAbi, functionName: "decimals" },
        { address: vaultAddr, abi: vaultAbi, functionName: "totalSupply" },
        { address: handler, abi: v4HandlerAbi, functionName: "needsRebalance" },
        { address: handler, abi: v4HandlerAbi, functionName: "driftThreshold" },
        { address: handler, abi: v4HandlerAbi, functionName: "minBuyRatio" },
        { address: vaultAddr, abi: vaultAbi, functionName: "totalAssets" },
      ],
    });

  const [assets, balances] = totalAssets as readonly [readonly Address[], readonly bigint[]];

  const [weightsRes, driftRes] = await client.multicall({
    allowFailure: false,
    contracts: [
      { address: handler, abi: v4HandlerAbi, functionName: "currentWeights" },
      { address: handler, abi: v4HandlerAbi, functionName: "driftFromTarget" },
    ],
  });
  const [, weights] = weightsRes as readonly [readonly Address[], readonly bigint[]];
  const [, signedDrift] = driftRes as readonly [readonly Address[], readonly bigint[]];

  const absDrift = signedDrift.map((d) => absBigInt(d));
  const isOverweight = signedDrift.map((d) => d >= 0n);

  const basket = await buildBasket(client, v.chainId, handler, "v4", assets, balances, weights, absDrift, isOverweight);
  // V4 has no in-flight rebalance flag — swaps are atomic.
  return assembleState(v, name as string, symbol as string, Number(decimals), totalSupply as bigint, needsRebalance as boolean, false, driftThreshold as bigint, minBuyRatio as bigint, basket);
}

async function buildBasket(
  client: PublicClient,
  chainId: number,
  stateAddr: Address,
  kind: "cow" | "v4",
  assets: readonly Address[],
  balances: readonly bigint[],
  weights: readonly bigint[],
  absDrift: readonly bigint[],
  isOverweight: readonly boolean[]
): Promise<AssetSnapshot[]> {
  const targetAbi = kind === "v4" ? v4HandlerAbi : controllerAbi;
  const perToken = await client.multicall({
    allowFailure: false,
    contracts: assets.flatMap((t) => [
      { address: stateAddr, abi: targetAbi, functionName: "targetWeights", args: [t] } as const,
      { address: stateAddr, abi: targetAbi, functionName: "maxTradeSize", args: [t] } as const,
      { address: stateAddr, abi: targetAbi, functionName: "priceFeeds", args: [t] } as const,
    ]),
  });

  const feeds = assets.map((_, i) => perToken[i * 3 + 2] as Address);

  // Price feeds can fail (stale Pyth/Stork, weekend equities) — allow partial failure.
  const priceData = await client.multicall({
    allowFailure: true,
    contracts: feeds.flatMap((f) => [
      { address: f, abi: aggregatorAbi, functionName: "latestRoundData" } as const,
      { address: f, abi: aggregatorAbi, functionName: "decimals" } as const,
    ]),
  });

  const basket: AssetSnapshot[] = [];
  let tvlUsd = 0;
  for (let i = 0; i < assets.length; i++) {
    const token = assets[i];
    const meta = await tokenMeta(client, chainId, token);
    const target = perToken[i * 3] as bigint;
    const maxTrade = perToken[i * 3 + 1] as bigint;
    const feed = feeds[i];

    let priceUsd = 0;
    const roundRes = priceData[i * 2];
    const decRes = priceData[i * 2 + 1];
    if (roundRes.status === "success" && decRes.status === "success") {
      const round = roundRes.result as readonly [bigint, bigint, bigint, bigint, bigint];
      const feedDec = Number(decRes.result as number);
      const answer = round[1];
      priceUsd = Number(formatUnits(answer < 0n ? 0n : answer, feedDec));
    }

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
  // Attach TVL on the basket build via side-channel — recompute in assemble.
  // (tvlUsd is recalculated in assembleState from basket)
  void tvlUsd;
  return basket;
}

function assembleState(
  v: VaultInfo,
  name: string,
  symbol: string,
  decimals: number,
  totalSupply: bigint,
  needsRebalance: boolean,
  rebalanceActive: boolean,
  driftThreshold: bigint,
  minBuyRatio: bigint,
  basket: AssetSnapshot[]
): VaultState {
  const tvlUsd = basket.reduce((s, a) => s + a.valueUsd, 0);
  const supply = Number(formatUnits(totalSupply, decimals));
  const chain = getChainById(v.chainId);
  return {
    vault: {
      slug: v.slug,
      name,
      symbol,
      chainId: v.chainId,
      chain: chain.slug,
      kind: v.kind,
      vaultAddress: v.vault,
      controllerAddress: v.controller || "",
      handlerAddress: v.handler,
      zapperAddress: v.zapper ?? null,
      decimals,
      totalSupplyRaw: totalSupply.toString(),
      totalSupply: supply,
      tvlUsd,
      sharePriceUsd: supply > 0 ? tvlUsd / supply : 0,
      needsRebalance,
      rebalanceActive,
      driftThresholdPct: pctFromD18(driftThreshold),
      minBuyRatioPct: pctFromD18(minBuyRatio),
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

/** previewMint / previewRedeem on-chain, enriched with USD via price feeds. */
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

  const stateAddr = stateContract(v);
  const feedAbi = v.kind === "v4" ? v4HandlerAbi : controllerAbi;
  const feeds = (await client.multicall({
    allowFailure: false,
    contracts: assets.map((t) => ({
      address: stateAddr,
      abi: feedAbi,
      functionName: "priceFeeds",
      args: [t],
    })),
  })) as unknown as Address[];

  const priceData = await client.multicall({
    allowFailure: true,
    contracts: feeds.flatMap((f) => [
      { address: f, abi: aggregatorAbi, functionName: "latestRoundData" } as const,
      { address: f, abi: aggregatorAbi, functionName: "decimals" } as const,
    ]),
  });

  const lines: PreviewLine[] = [];
  let totalValueUsd = 0;
  for (let i = 0; i < assets.length; i++) {
    const meta = await tokenMeta(client, v.chainId, assets[i]);
    let priceUsd = 0;
    const roundRes = priceData[i * 2];
    const decRes = priceData[i * 2 + 1];
    if (roundRes.status === "success" && decRes.status === "success") {
      const round = roundRes.result as readonly [bigint, bigint, bigint, bigint, bigint];
      const feedDec = Number(decRes.result as number);
      priceUsd = Number(formatUnits(round[1] < 0n ? 0n : round[1], feedDec));
    }
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
  const sharePercent = supplyBn > 0n ? (Number((sharesBn * 1_000_000n) / supplyBn) / 1_000_000) * 100 : 0;

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
  kind: "cow" | "v4";
  controller: string;
  handler: string;
  needsRebalance: boolean;
  rebalanceActive: boolean;
  rebalanceNonce: string | null;
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

  if (v.kind === "v4") {
    const handler = v.handler as Address;
    const [needs, drift, minBuy] = await client.multicall({
      allowFailure: false,
      contracts: [
        { address: handler, abi: v4HandlerAbi, functionName: "needsRebalance" },
        { address: handler, abi: v4HandlerAbi, functionName: "driftThreshold" },
        { address: handler, abi: v4HandlerAbi, functionName: "minBuyRatio" },
      ],
    });
    return {
      vault: v.vault,
      kind: "v4",
      controller: "",
      handler: v.handler,
      needsRebalance: needs as boolean,
      rebalanceActive: false,
      rebalanceNonce: null,
      driftThresholdPct: pctFromD18(drift as bigint),
      minBuyRatioPct: pctFromD18(minBuy as bigint),
      active: null,
    };
  }

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
    kind: "cow",
    controller: v.controller,
    handler: v.handler,
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

export interface ExecuteSwapParams {
  sellToken: Address;
  buyToken: Address;
  sellAmount: bigint;
  minBuyAmount: bigint;
}

/**
 * Write: startRebalance(...). CoW vaults only. Authorizes a CoW order on-chain;
 * the order must still be submitted to the CoW API and settled (prefer keeper).
 */
export async function sendStartRebalance(v: VaultInfo, p: StartRebalanceParams): Promise<string> {
  if (v.kind !== "cow") throw new ChainError(`startRebalance is CoW-only; vault ${v.slug} is kind=${v.kind}. Use rebalance execute.`);
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

/** Write: settleRebalance() — CoW vaults only. */
export async function sendSettleRebalance(v: VaultInfo): Promise<string> {
  if (v.kind !== "cow") throw new ChainError(`settleRebalance is CoW-only; vault ${v.slug} is kind=${v.kind}.`);
  const { wallet, account } = getWalletClient(v.chainId);
  const viemChain = VIEM_CHAINS[v.chainId];
  return wallet.writeContract({
    address: v.controller as Address,
    abi: controllerAbi,
    functionName: "settleRebalance",
    args: [],
    account,
    chain: viemChain,
  });
}

/** Write: handler.executeSwap — V4 vaults only (atomic Uniswap V4 rebalance). */
export async function sendExecuteSwap(v: VaultInfo, p: ExecuteSwapParams): Promise<string> {
  if (v.kind !== "v4") throw new ChainError(`executeSwap is V4-only; vault ${v.slug} is kind=${v.kind}. Use start/settle.`);
  const { wallet, account } = getWalletClient(v.chainId);
  const viemChain = VIEM_CHAINS[v.chainId];
  return wallet.writeContract({
    address: v.handler as Address,
    abi: v4HandlerAbi,
    functionName: "executeSwap",
    args: [p.sellToken, p.buyToken, p.sellAmount, p.minBuyAmount],
    account,
    chain: viemChain,
  });
}

// ── Factory (RH VaultFactoryV3) ──────────────────────────────────────────

export interface FactoryDeployment {
  index: number;
  creator: string;
  vault: string;
  handler: string;
  zapper: string;
  createdAt: number;
}

export async function listFactoryDeployments(chainId = 4663): Promise<FactoryDeployment[]> {
  const chain = getChainById(chainId);
  const factory = chain.protocol?.factory as Address | undefined;
  if (!factory) throw new ChainError(`No factory registered on chain ${chain.slug}.`);

  const client = getPublicClient(chainId);
  const count = (await client.readContract({
    address: factory,
    abi: factoryAbi,
    functionName: "deploymentCount",
  })) as bigint;

  const n = Number(count);
  if (n === 0) return [];

  const rows = await client.multicall({
    allowFailure: false,
    contracts: Array.from({ length: n }, (_, i) => ({
      address: factory,
      abi: factoryAbi,
      functionName: "deployments" as const,
      args: [BigInt(i)] as const,
    })),
  });

  return rows.map((tuple, i) => {
    const [creator, vault, handler, zapper, createdAt] = tuple as readonly [
      Address,
      Address,
      Address,
      Address,
      bigint,
    ];
    return {
      index: i,
      creator,
      vault,
      handler,
      zapper,
      createdAt: Number(createdAt),
    };
  });
}

export interface FactoryWhitelistEntry {
  token: string;
  symbol: string;
  decimals: number;
  priceFeed: string;
  poolFee: number;
  poolTickSpacing: number;
  poolHooks: string;
  defaultMaxTradeSize: string;
}

export async function listFactoryWhitelist(chainId = 4663): Promise<FactoryWhitelistEntry[]> {
  const chain = getChainById(chainId);
  const factory = chain.protocol?.factory as Address | undefined;
  if (!factory) throw new ChainError(`No factory registered on chain ${chain.slug}.`);

  const client = getPublicClient(chainId);
  const tokens = (await client.readContract({
    address: factory,
    abi: factoryAbi,
    functionName: "whitelistedTokens",
  })) as readonly Address[];

  const entries = await client.multicall({
    allowFailure: false,
    contracts: tokens.map((t) => ({
      address: factory,
      abi: factoryAbi,
      functionName: "tokenEntry" as const,
      args: [t] as const,
    })),
  });

  const result: FactoryWhitelistEntry[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const meta = await tokenMeta(client, chainId, tokens[i]);
    const [priceFeed, poolFee, poolTickSpacing, poolHooks, defaultMaxTradeSize] = entries[i] as readonly [
      Address,
      number,
      number,
      Address,
      bigint,
    ];
    result.push({
      token: tokens[i],
      symbol: meta.symbol,
      decimals: meta.decimals,
      priceFeed,
      poolFee: Number(poolFee),
      poolTickSpacing: Number(poolTickSpacing),
      poolHooks,
      defaultMaxTradeSize: defaultMaxTradeSize.toString(),
    });
  }
  return result;
}

export interface CreateEtfParams {
  name: string;
  symbol: string;
  tokens: Address[];
  weights: bigint[];
  targetShareValueUsd: bigint;
  driftThreshold: bigint;
  minBuyRatio: bigint;
  priceStalenessLimit: bigint;
}

export async function sendCreateEtf(
  chainId: number,
  p: CreateEtfParams
): Promise<{ txHash: string; vault?: string; handler?: string; zapper?: string }> {
  const chain = getChainById(chainId);
  const factory = chain.protocol?.factory as Address | undefined;
  if (!factory) throw new ChainError(`No factory registered on chain ${chain.slug}.`);

  const { wallet, account } = getWalletClient(chainId);
  const viemChain = VIEM_CHAINS[chainId];
  const client = getPublicClient(chainId);

  const hash = (await wallet.writeContract({
    address: factory,
    abi: factoryAbi,
    functionName: "createETF",
    args: [
      {
        name: p.name,
        symbol: p.symbol,
        tokens: p.tokens,
        weights: p.weights,
        targetShareValueUsd: p.targetShareValueUsd,
        driftThreshold: p.driftThreshold,
        minBuyRatio: p.minBuyRatio,
        priceStalenessLimit: p.priceStalenessLimit,
      },
    ],
    account,
    chain: viemChain,
  })) as Hash;

  const receipt = await client.waitForTransactionReceipt({ hash });
  let vault: string | undefined;
  let handler: string | undefined;
  let zapper: string | undefined;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== factory.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: factoryAbi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "ETFCreated") {
        const args = decoded.args as {
          vault: Address;
          handler: Address;
          zapper: Address;
        };
        vault = args.vault;
        handler = args.handler;
        zapper = args.zapper;
      }
    } catch {
      // skip non-matching logs
    }
  }
  return { txHash: hash, vault, handler, zapper };
}

// ── Zapper (RH single-asset USDG mint/redeem) ────────────────────────────

export interface ZapPreview {
  shares: string;
  kind: "mint" | "redeem";
  zapper: string;
  assets: Array<{ token: string; symbol: string; decimals: number; amountRaw: string; amount: number }>;
}

export async function previewZap(
  v: VaultInfo,
  shares: bigint,
  kind: "mint" | "redeem",
  zapperOverride?: Address
): Promise<ZapPreview> {
  const zapper = (zapperOverride ?? v.zapper) as Address | undefined;
  if (!zapper) throw new ChainError(`Vault ${v.slug} has no zapper. Pass --zapper or use a RH vault with one.`);

  const client = getPublicClient(v.chainId);
  const fn = kind === "mint" ? "previewMintAmounts" : "previewRedeemAmounts";
  const [assets, amounts] = (await client.readContract({
    address: zapper,
    abi: zapperAbi,
    functionName: fn,
    args: [shares],
  })) as readonly [readonly Address[], readonly bigint[]];

  const lines = [];
  for (let i = 0; i < assets.length; i++) {
    const meta = await tokenMeta(client, v.chainId, assets[i]);
    lines.push({
      token: assets[i],
      symbol: meta.symbol,
      decimals: meta.decimals,
      amountRaw: amounts[i].toString(),
      amount: Number(formatUnits(amounts[i], meta.decimals)),
    });
  }
  return { shares: shares.toString(), kind, zapper, assets: lines };
}

export async function sendZapMint(
  v: VaultInfo,
  shares: bigint,
  maxUsdgIn: bigint,
  receiver: Address,
  zapperOverride?: Address
): Promise<string> {
  const zapper = (zapperOverride ?? v.zapper) as Address | undefined;
  if (!zapper) throw new ChainError(`Vault ${v.slug} has no zapper.`);
  const { wallet, account } = getWalletClient(v.chainId);
  const viemChain = VIEM_CHAINS[v.chainId];
  return wallet.writeContract({
    address: zapper,
    abi: zapperAbi,
    functionName: "zapMint",
    args: [shares, maxUsdgIn, receiver],
    account,
    chain: viemChain,
  });
}

export async function sendZapRedeem(
  v: VaultInfo,
  shares: bigint,
  minUsdgOut: bigint,
  receiver: Address,
  zapperOverride?: Address
): Promise<string> {
  const zapper = (zapperOverride ?? v.zapper) as Address | undefined;
  if (!zapper) throw new ChainError(`Vault ${v.slug} has no zapper.`);
  const { wallet, account } = getWalletClient(v.chainId);
  const viemChain = VIEM_CHAINS[v.chainId];
  return wallet.writeContract({
    address: zapper,
    abi: zapperAbi,
    functionName: "zapRedeem",
    args: [shares, minUsdgOut, receiver],
    account,
    chain: viemChain,
  });
}

// ── User mint / redeem / approvals ───────────────────────────────────────

const MAX_UINT256 = 2n ** 256n - 1n;

export interface TokenBalanceLine {
  token: string;
  symbol: string;
  decimals: number;
  balanceRaw: string;
  balance: number;
  allowanceToVaultRaw: string;
  allowanceToVault: number;
  /** Amount required for a given share mint (0 if not requested). */
  neededForMintRaw?: string;
  neededForMint?: number;
  enoughForMint?: boolean;
}

export interface WalletBasketBalances {
  address: string;
  vault: string;
  vaultSlug: string;
  spender: string;
  shares?: string;
  tokens: TokenBalanceLine[];
  allApproved: boolean;
  allFunded: boolean;
}

/**
 * Wallet balances + allowances for every basket token (spender = vault by default).
 * If shares is set, also shows how much is needed for that mint and whether funded.
 */
export async function walletBasketBalances(
  v: VaultInfo,
  address: Address,
  shares?: bigint,
  spenderOverride?: Address
): Promise<WalletBasketBalances> {
  const client = getPublicClient(v.chainId);
  const vaultAddr = v.vault as Address;
  const spender = (spenderOverride ?? vaultAddr) as Address;

  const totalAssets = (await client.readContract({
    address: vaultAddr,
    abi: vaultAbi,
    functionName: "totalAssets",
  })) as readonly [readonly Address[], readonly bigint[]];
  const assets = totalAssets[0];

  let needed: readonly bigint[] | undefined;
  if (shares !== undefined) {
    const preview = (await client.readContract({
      address: vaultAddr,
      abi: vaultAbi,
      functionName: "previewMint",
      args: [shares],
    })) as readonly [readonly Address[], readonly bigint[]];
    needed = preview[1];
  }

  const reads = await client.multicall({
    allowFailure: false,
    contracts: assets.flatMap((t) => [
      { address: t, abi: erc20Abi, functionName: "balanceOf", args: [address] } as const,
      { address: t, abi: erc20Abi, functionName: "allowance", args: [address, spender] } as const,
    ]),
  });

  const tokens: TokenBalanceLine[] = [];
  let allApproved = true;
  let allFunded = true;
  for (let i = 0; i < assets.length; i++) {
    const meta = await tokenMeta(client, v.chainId, assets[i]);
    const bal = reads[i * 2] as bigint;
    const allow = reads[i * 2 + 1] as bigint;
    const need = needed?.[i];
    const line: TokenBalanceLine = {
      token: assets[i],
      symbol: meta.symbol,
      decimals: meta.decimals,
      balanceRaw: bal.toString(),
      balance: Number(formatUnits(bal, meta.decimals)),
      allowanceToVaultRaw: allow.toString(),
      allowanceToVault: Number(formatUnits(allow, meta.decimals)),
    };
    if (need !== undefined) {
      line.neededForMintRaw = need.toString();
      line.neededForMint = Number(formatUnits(need, meta.decimals));
      line.enoughForMint = bal >= need;
      if (allow < need) allApproved = false;
      if (bal < need) allFunded = false;
    } else {
      if (allow === 0n) allApproved = false;
    }
    tokens.push(line);
  }

  return {
    address,
    vault: v.vault,
    vaultSlug: v.slug,
    spender,
    shares: shares?.toString(),
    tokens,
    allApproved: shares !== undefined ? allApproved : tokens.every((t) => t.allowanceToVaultRaw !== "0"),
    allFunded: shares !== undefined ? allFunded : true,
  };
}

/** Approve a single ERC-20 for a spender (default: vault). amount defaults to max uint256. */
export async function sendApprove(
  chainId: number,
  token: Address,
  spender: Address,
  amount: bigint = MAX_UINT256
): Promise<string> {
  const { wallet, account } = getWalletClient(chainId);
  const viemChain = VIEM_CHAINS[chainId];
  return wallet.writeContract({
    address: token,
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, amount],
    account,
    chain: viemChain,
  });
}

/**
 * Approve every basket asset (and optionally the vault share token) for a spender.
 * Returns list of tx hashes (skips tokens already at max allowance if skipIfSufficient).
 */
export async function sendApproveBasket(
  v: VaultInfo,
  spender: Address,
  opts: { amount?: bigint; skipIfSufficient?: boolean; minAmounts?: bigint[] } = {}
): Promise<{ token: string; symbol: string; skipped: boolean; txHash?: string }[]> {
  const amount = opts.amount ?? MAX_UINT256;
  const { wallet, account } = getWalletClient(v.chainId);
  const client = getPublicClient(v.chainId);
  const viemChain = VIEM_CHAINS[v.chainId];

  const [assets] = (await client.readContract({
    address: v.vault as Address,
    abi: vaultAbi,
    functionName: "totalAssets",
  })) as readonly [readonly Address[], readonly bigint[]];

  const results: { token: string; symbol: string; skipped: boolean; txHash?: string }[] = [];
  for (let i = 0; i < assets.length; i++) {
    const token = assets[i];
    const meta = await tokenMeta(client, v.chainId, token);
    if (opts.skipIfSufficient) {
      const allow = (await client.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "allowance",
        args: [account, spender],
      })) as bigint;
      const need = opts.minAmounts?.[i] ?? 1n;
      if (allow >= need) {
        results.push({ token, symbol: meta.symbol, skipped: true });
        continue;
      }
    }
    const hash = await wallet.writeContract({
      address: token,
      abi: erc20Abi,
      functionName: "approve",
      args: [spender, amount],
      account,
      chain: viemChain,
    });
    results.push({ token, symbol: meta.symbol, skipped: false, txHash: hash });
  }
  return results;
}

/** Deposit basket tokens → mint vault shares (depositExactForShares). */
export async function sendMint(
  v: VaultInfo,
  shares: bigint,
  receiver: Address
): Promise<string> {
  const { wallet, account } = getWalletClient(v.chainId);
  const viemChain = VIEM_CHAINS[v.chainId];
  return wallet.writeContract({
    address: v.vault as Address,
    abi: vaultAbi,
    functionName: "depositExactForShares",
    args: [shares, receiver],
    account,
    chain: viemChain,
  });
}

/** Burn vault shares → receive pro-rata basket tokens (redeem). */
export async function sendRedeem(
  v: VaultInfo,
  shares: bigint,
  receiver: Address
): Promise<string> {
  const { wallet, account } = getWalletClient(v.chainId);
  const viemChain = VIEM_CHAINS[v.chainId];
  return wallet.writeContract({
    address: v.vault as Address,
    abi: vaultAbi,
    functionName: "redeem",
    args: [shares, receiver],
    account,
    chain: viemChain,
  });
}

/** Approve vault share token for a spender (needed for zapRedeem). */
export async function sendApproveShares(
  v: VaultInfo,
  spender: Address,
  amount: bigint = MAX_UINT256
): Promise<string> {
  return sendApprove(v.chainId, v.vault as Address, spender, amount);
}

export { MAX_UINT256 };
