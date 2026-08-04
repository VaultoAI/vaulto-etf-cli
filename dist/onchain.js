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
import { createPublicClient, createWalletClient, defineChain, http, formatUnits, decodeEventLog, } from "viem";
import { base, bsc } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { aggregatorAbi, controllerAbi, erc20Abi, factoryAbi, v4HandlerAbi, vaultAbi, zapperAbi, } from "./abis.js";
import { findToken, getChainById } from "./chains.js";
import { getRpcUrl, requireSigner } from "./config.js";
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
const VIEM_CHAINS = {
    8453: base,
    56: bsc,
    4663: robinhoodChain,
};
export class ChainError extends Error {
    code = "CHAIN_ERROR";
}
export function getPublicClient(chainId) {
    const chain = getChainById(chainId);
    const viemChain = VIEM_CHAINS[chainId];
    if (!viemChain)
        throw new ChainError(`No viem chain for chainId ${chainId}`);
    return createPublicClient({
        chain: viemChain,
        transport: http(getRpcUrl(chain)),
    });
}
export function getWalletClient(chainId) {
    const viemChain = VIEM_CHAINS[chainId];
    if (!viemChain)
        throw new ChainError(`No viem chain for chainId ${chainId}`);
    const account = privateKeyToAccount(requireSigner());
    const wallet = createWalletClient({
        account,
        chain: viemChain,
        transport: http(getRpcUrl(getChainById(chainId))),
    });
    return { wallet, account: account.address };
}
// ── Helpers ──────────────────────────────────────────────────────────────
const D18 = 10n ** 18n;
function pctFromD18(x) {
    return (Number((x * 1000000n) / D18) / 1_000_000) * 100;
}
function absBigInt(x) {
    return x < 0n ? -x : x;
}
/** Resolve token symbol/decimals from the registry, falling back to on-chain. */
async function tokenMeta(client, chainId, token) {
    const known = findToken(chainId, token);
    if (known)
        return { symbol: known.symbol, decimals: known.decimals };
    const [symbol, decimals] = await client.multicall({
        allowFailure: false,
        contracts: [
            { address: token, abi: erc20Abi, functionName: "symbol" },
            { address: token, abi: erc20Abi, functionName: "decimals" },
        ],
    });
    return { symbol: symbol, decimals: Number(decimals) };
}
/** Contract that holds priceFeeds / targetWeights / maxTradeSize for a vault. */
function stateContract(v) {
    return rebalanceTarget(v);
}
// ── Reads ────────────────────────────────────────────────────────────────
/** Full basket snapshot: weights, drift, prices, balances, TVL, share price. */
export async function snapshotVault(v) {
    const client = getPublicClient(v.chainId);
    const stateAddr = stateContract(v);
    const vaultAddr = v.vault;
    if (v.kind === "v4") {
        return snapshotV4(client, v, vaultAddr, stateAddr);
    }
    return snapshotCow(client, v, vaultAddr, stateAddr);
}
async function snapshotCow(client, v, vaultAddr, controller) {
    const [name, symbol, decimals, totalSupply, needsRebalance, rebalanceActive, driftThreshold, minBuyRatio, totalAssets] = await client.multicall({
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
    const [assets, balances] = totalAssets;
    const [weightsRes, driftRes] = await client.multicall({
        allowFailure: false,
        contracts: [
            { address: controller, abi: controllerAbi, functionName: "currentWeights" },
            { address: controller, abi: controllerAbi, functionName: "driftFromTarget" },
        ],
    });
    const [, weights] = weightsRes;
    const [, absDrift, isOverweight] = driftRes;
    const basket = await buildBasket(client, v.chainId, controller, "cow", assets, balances, weights, absDrift, isOverweight);
    return assembleState(v, name, symbol, Number(decimals), totalSupply, needsRebalance, rebalanceActive, driftThreshold, minBuyRatio, basket);
}
async function snapshotV4(client, v, vaultAddr, handler) {
    const [name, symbol, decimals, totalSupply, needsRebalance, driftThreshold, minBuyRatio, totalAssets] = await client.multicall({
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
    const [assets, balances] = totalAssets;
    const [weightsRes, driftRes] = await client.multicall({
        allowFailure: false,
        contracts: [
            { address: handler, abi: v4HandlerAbi, functionName: "currentWeights" },
            { address: handler, abi: v4HandlerAbi, functionName: "driftFromTarget" },
        ],
    });
    const [, weights] = weightsRes;
    const [, signedDrift] = driftRes;
    const absDrift = signedDrift.map((d) => absBigInt(d));
    const isOverweight = signedDrift.map((d) => d >= 0n);
    const basket = await buildBasket(client, v.chainId, handler, "v4", assets, balances, weights, absDrift, isOverweight);
    // V4 has no in-flight rebalance flag — swaps are atomic.
    return assembleState(v, name, symbol, Number(decimals), totalSupply, needsRebalance, false, driftThreshold, minBuyRatio, basket);
}
async function buildBasket(client, chainId, stateAddr, kind, assets, balances, weights, absDrift, isOverweight) {
    const targetAbi = kind === "v4" ? v4HandlerAbi : controllerAbi;
    const perToken = await client.multicall({
        allowFailure: false,
        contracts: assets.flatMap((t) => [
            { address: stateAddr, abi: targetAbi, functionName: "targetWeights", args: [t] },
            { address: stateAddr, abi: targetAbi, functionName: "maxTradeSize", args: [t] },
            { address: stateAddr, abi: targetAbi, functionName: "priceFeeds", args: [t] },
        ]),
    });
    const feeds = assets.map((_, i) => perToken[i * 3 + 2]);
    // Price feeds can fail (stale Pyth/Stork, weekend equities) — allow partial failure.
    const priceData = await client.multicall({
        allowFailure: true,
        contracts: feeds.flatMap((f) => [
            { address: f, abi: aggregatorAbi, functionName: "latestRoundData" },
            { address: f, abi: aggregatorAbi, functionName: "decimals" },
        ]),
    });
    const basket = [];
    let tvlUsd = 0;
    for (let i = 0; i < assets.length; i++) {
        const token = assets[i];
        const meta = await tokenMeta(client, chainId, token);
        const target = perToken[i * 3];
        const maxTrade = perToken[i * 3 + 1];
        const feed = feeds[i];
        let priceUsd = 0;
        const roundRes = priceData[i * 2];
        const decRes = priceData[i * 2 + 1];
        if (roundRes.status === "success" && decRes.status === "success") {
            const round = roundRes.result;
            const feedDec = Number(decRes.result);
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
function assembleState(v, name, symbol, decimals, totalSupply, needsRebalance, rebalanceActive, driftThreshold, minBuyRatio, basket) {
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
/** previewMint / previewRedeem on-chain, enriched with USD via price feeds. */
export async function previewShares(v, shares, kind) {
    const client = getPublicClient(v.chainId);
    const vaultAddr = v.vault;
    const fn = kind === "mint" ? "previewMint" : "previewRedeem";
    const [assets, amounts] = (await client.readContract({
        address: vaultAddr,
        abi: vaultAbi,
        functionName: fn,
        args: [shares],
    }));
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
    }));
    const priceData = await client.multicall({
        allowFailure: true,
        contracts: feeds.flatMap((f) => [
            { address: f, abi: aggregatorAbi, functionName: "latestRoundData" },
            { address: f, abi: aggregatorAbi, functionName: "decimals" },
        ]),
    });
    const lines = [];
    let totalValueUsd = 0;
    for (let i = 0; i < assets.length; i++) {
        const meta = await tokenMeta(client, v.chainId, assets[i]);
        let priceUsd = 0;
        const roundRes = priceData[i * 2];
        const decRes = priceData[i * 2 + 1];
        if (roundRes.status === "success" && decRes.status === "success") {
            const round = roundRes.result;
            const feedDec = Number(decRes.result);
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
/** A wallet's vault position: shares, % of supply, pro-rata underlying. */
export async function userPosition(v, address) {
    const client = getPublicClient(v.chainId);
    const vaultAddr = v.vault;
    const [shares, totalSupply, decimals] = await client.multicall({
        allowFailure: false,
        contracts: [
            { address: vaultAddr, abi: vaultAbi, functionName: "balanceOf", args: [address] },
            { address: vaultAddr, abi: vaultAbi, functionName: "totalSupply" },
            { address: vaultAddr, abi: vaultAbi, functionName: "decimals" },
        ],
    });
    const sharesBn = shares;
    const supplyBn = totalSupply;
    const sharePercent = supplyBn > 0n ? (Number((sharesBn * 1000000n) / supplyBn) / 1_000_000) * 100 : 0;
    const state = await snapshotVault(v);
    const underlying = [];
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
    }
    else {
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
export async function rebalanceStatus(v) {
    const client = getPublicClient(v.chainId);
    if (v.kind === "v4") {
        const handler = v.handler;
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
            needsRebalance: needs,
            rebalanceActive: false,
            rebalanceNonce: null,
            driftThresholdPct: pctFromD18(drift),
            minBuyRatioPct: pctFromD18(minBuy),
            active: null,
        };
    }
    const controller = v.controller;
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
    let activeOrder = null;
    if (active) {
        const ar = (await client.readContract({
            address: controller,
            abi: controllerAbi,
            functionName: "activeRebalance",
        }));
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
        needsRebalance: needs,
        rebalanceActive: active,
        rebalanceNonce: nonce.toString(),
        driftThresholdPct: pctFromD18(drift),
        minBuyRatioPct: pctFromD18(minBuy),
        active: activeOrder,
    };
}
/**
 * Write: startRebalance(...). CoW vaults only. Authorizes a CoW order on-chain;
 * the order must still be submitted to the CoW API and settled (prefer keeper).
 */
export async function sendStartRebalance(v, p) {
    if (v.kind !== "cow")
        throw new ChainError(`startRebalance is CoW-only; vault ${v.slug} is kind=${v.kind}. Use rebalance execute.`);
    const { wallet, account } = getWalletClient(v.chainId);
    const viemChain = VIEM_CHAINS[v.chainId];
    return wallet.writeContract({
        address: v.controller,
        abi: controllerAbi,
        functionName: "startRebalance",
        args: [p.sellToken, p.buyToken, p.sellAmount, p.minBuyAmount, p.validTo, p.appData],
        account,
        chain: viemChain,
    });
}
/** Write: settleRebalance() — CoW vaults only. */
export async function sendSettleRebalance(v) {
    if (v.kind !== "cow")
        throw new ChainError(`settleRebalance is CoW-only; vault ${v.slug} is kind=${v.kind}.`);
    const { wallet, account } = getWalletClient(v.chainId);
    const viemChain = VIEM_CHAINS[v.chainId];
    return wallet.writeContract({
        address: v.controller,
        abi: controllerAbi,
        functionName: "settleRebalance",
        args: [],
        account,
        chain: viemChain,
    });
}
/** Write: handler.executeSwap — V4 vaults only (atomic Uniswap V4 rebalance). */
export async function sendExecuteSwap(v, p) {
    if (v.kind !== "v4")
        throw new ChainError(`executeSwap is V4-only; vault ${v.slug} is kind=${v.kind}. Use start/settle.`);
    const { wallet, account } = getWalletClient(v.chainId);
    const viemChain = VIEM_CHAINS[v.chainId];
    return wallet.writeContract({
        address: v.handler,
        abi: v4HandlerAbi,
        functionName: "executeSwap",
        args: [p.sellToken, p.buyToken, p.sellAmount, p.minBuyAmount],
        account,
        chain: viemChain,
    });
}
export async function listFactoryDeployments(chainId = 4663) {
    const chain = getChainById(chainId);
    const factory = chain.protocol?.factory;
    if (!factory)
        throw new ChainError(`No factory registered on chain ${chain.slug}.`);
    const client = getPublicClient(chainId);
    const count = (await client.readContract({
        address: factory,
        abi: factoryAbi,
        functionName: "deploymentCount",
    }));
    const n = Number(count);
    if (n === 0)
        return [];
    const rows = await client.multicall({
        allowFailure: false,
        contracts: Array.from({ length: n }, (_, i) => ({
            address: factory,
            abi: factoryAbi,
            functionName: "deployments",
            args: [BigInt(i)],
        })),
    });
    return rows.map((tuple, i) => {
        const [creator, vault, handler, zapper, createdAt] = tuple;
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
export async function listFactoryWhitelist(chainId = 4663) {
    const chain = getChainById(chainId);
    const factory = chain.protocol?.factory;
    if (!factory)
        throw new ChainError(`No factory registered on chain ${chain.slug}.`);
    const client = getPublicClient(chainId);
    const tokens = (await client.readContract({
        address: factory,
        abi: factoryAbi,
        functionName: "whitelistedTokens",
    }));
    const entries = await client.multicall({
        allowFailure: false,
        contracts: tokens.map((t) => ({
            address: factory,
            abi: factoryAbi,
            functionName: "tokenEntry",
            args: [t],
        })),
    });
    const result = [];
    for (let i = 0; i < tokens.length; i++) {
        const meta = await tokenMeta(client, chainId, tokens[i]);
        const [priceFeed, poolFee, poolTickSpacing, poolHooks, defaultMaxTradeSize] = entries[i];
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
export async function sendCreateEtf(chainId, p) {
    const chain = getChainById(chainId);
    const factory = chain.protocol?.factory;
    if (!factory)
        throw new ChainError(`No factory registered on chain ${chain.slug}.`);
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
    }));
    const receipt = await client.waitForTransactionReceipt({ hash });
    let vault;
    let handler;
    let zapper;
    for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== factory.toLowerCase())
            continue;
        try {
            const decoded = decodeEventLog({
                abi: factoryAbi,
                data: log.data,
                topics: log.topics,
            });
            if (decoded.eventName === "ETFCreated") {
                const args = decoded.args;
                vault = args.vault;
                handler = args.handler;
                zapper = args.zapper;
            }
        }
        catch {
            // skip non-matching logs
        }
    }
    return { txHash: hash, vault, handler, zapper };
}
export async function previewZap(v, shares, kind, zapperOverride) {
    const zapper = (zapperOverride ?? v.zapper);
    if (!zapper)
        throw new ChainError(`Vault ${v.slug} has no zapper. Pass --zapper or use a RH vault with one.`);
    const client = getPublicClient(v.chainId);
    const fn = kind === "mint" ? "previewMintAmounts" : "previewRedeemAmounts";
    const [assets, amounts] = (await client.readContract({
        address: zapper,
        abi: zapperAbi,
        functionName: fn,
        args: [shares],
    }));
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
export async function sendZapMint(v, shares, maxUsdgIn, receiver, zapperOverride) {
    const zapper = (zapperOverride ?? v.zapper);
    if (!zapper)
        throw new ChainError(`Vault ${v.slug} has no zapper.`);
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
export async function sendZapRedeem(v, shares, minUsdgOut, receiver, zapperOverride) {
    const zapper = (zapperOverride ?? v.zapper);
    if (!zapper)
        throw new ChainError(`Vault ${v.slug} has no zapper.`);
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
/**
 * Wallet balances + allowances for every basket token (spender = vault by default).
 * If shares is set, also shows how much is needed for that mint and whether funded.
 */
export async function walletBasketBalances(v, address, shares, spenderOverride) {
    const client = getPublicClient(v.chainId);
    const vaultAddr = v.vault;
    const spender = (spenderOverride ?? vaultAddr);
    const totalAssets = (await client.readContract({
        address: vaultAddr,
        abi: vaultAbi,
        functionName: "totalAssets",
    }));
    const assets = totalAssets[0];
    let needed;
    if (shares !== undefined) {
        const preview = (await client.readContract({
            address: vaultAddr,
            abi: vaultAbi,
            functionName: "previewMint",
            args: [shares],
        }));
        needed = preview[1];
    }
    const reads = await client.multicall({
        allowFailure: false,
        contracts: assets.flatMap((t) => [
            { address: t, abi: erc20Abi, functionName: "balanceOf", args: [address] },
            { address: t, abi: erc20Abi, functionName: "allowance", args: [address, spender] },
        ]),
    });
    const tokens = [];
    let allApproved = true;
    let allFunded = true;
    for (let i = 0; i < assets.length; i++) {
        const meta = await tokenMeta(client, v.chainId, assets[i]);
        const bal = reads[i * 2];
        const allow = reads[i * 2 + 1];
        const need = needed?.[i];
        const line = {
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
            if (allow < need)
                allApproved = false;
            if (bal < need)
                allFunded = false;
        }
        else {
            if (allow === 0n)
                allApproved = false;
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
export async function sendApprove(chainId, token, spender, amount = MAX_UINT256) {
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
export async function sendApproveBasket(v, spender, opts = {}) {
    const amount = opts.amount ?? MAX_UINT256;
    const { wallet, account } = getWalletClient(v.chainId);
    const client = getPublicClient(v.chainId);
    const viemChain = VIEM_CHAINS[v.chainId];
    const [assets] = (await client.readContract({
        address: v.vault,
        abi: vaultAbi,
        functionName: "totalAssets",
    }));
    const results = [];
    for (let i = 0; i < assets.length; i++) {
        const token = assets[i];
        const meta = await tokenMeta(client, v.chainId, token);
        if (opts.skipIfSufficient) {
            const allow = (await client.readContract({
                address: token,
                abi: erc20Abi,
                functionName: "allowance",
                args: [account, spender],
            }));
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
export async function sendMint(v, shares, receiver) {
    const { wallet, account } = getWalletClient(v.chainId);
    const viemChain = VIEM_CHAINS[v.chainId];
    return wallet.writeContract({
        address: v.vault,
        abi: vaultAbi,
        functionName: "depositExactForShares",
        args: [shares, receiver],
        account,
        chain: viemChain,
    });
}
/** Burn vault shares → receive pro-rata basket tokens (redeem). */
export async function sendRedeem(v, shares, receiver) {
    const { wallet, account } = getWalletClient(v.chainId);
    const viemChain = VIEM_CHAINS[v.chainId];
    return wallet.writeContract({
        address: v.vault,
        abi: vaultAbi,
        functionName: "redeem",
        args: [shares, receiver],
        account,
        chain: viemChain,
    });
}
/** Approve vault share token for a spender (needed for zapRedeem). */
export async function sendApproveShares(v, spender, amount = MAX_UINT256) {
    return sendApprove(v.chainId, v.vault, spender, amount);
}
export { MAX_UINT256 };
