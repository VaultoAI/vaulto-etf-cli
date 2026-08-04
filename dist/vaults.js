/**
 * Vault registry — every deployed BasketVault stack across Base / BNB / RH.
 *
 * Source of truth: DavidVaulto/ETFs broadcast/ + CHAINS.md + web addresses.
 * Update whenever a new vault deploys.
 *
 * Two rebalance architectures:
 *   - `cow`  — BasketVaultV2 + RebalanceController + VaultoRebalanceHandler
 *              (CoW Protocol: startRebalance → CoW API → settleRebalance)
 *   - `v4`   — BasketVaultV3 + UniswapV4RebalanceHandler
 *              (atomic executeSwap on Robinhood Chain; no controller)
 */
import { getChainById, RegistryError } from "./chains.js";
export const VAULTS = [
    {
        slug: "vDTF2",
        name: "Vaulto DTF v2",
        chainId: 8453,
        vault: "0x8CD6c14127D398a27fe9b387BC76761A2B9a37dA",
        controller: "0x9b04039005C7D45347C963404Dd8875057311b77",
        handler: "0x0360e4E11482A22AcFd1727b4bFE59872551120F",
        kind: "cow",
        deployScript: "script/DeployV2Base.s.sol",
        note: "50% WETH + 50% USDC (CoW rebalance)",
    },
    {
        slug: "vBNB1",
        name: "Vaulto BNB Index 1",
        chainId: 56,
        vault: "0xA51254cC25360e8F04Eebee6d5579348BF0570a8",
        controller: "0x30286B89712D2db53E2dDcb5eBA190A93b1d0ca4",
        handler: "0x2a29CB5CaE50fc9d186341FA5D94778Cec84d7FE",
        kind: "cow",
        deployScript: "script/DeployV2BNB.s.sol",
        note: "50% USDC + 50% WBNB (CoW rebalance)",
    },
    {
        slug: "vTE1",
        name: "Vaulto Tech Equity 1",
        chainId: 56,
        vault: "0x5e4Ed5C26Aa626c750A98a7aCc8475D962eeCC88",
        controller: "0x95DDD0951caA27FbE8482cA4ce4F6a095F9c5574",
        handler: "0xD4F4Abd8466F4cA26bFD40D546E9796820573b03",
        kind: "cow",
        deployScript: "script/DeployV2BNBStocks.s.sol",
        note: "50% TSLAon + 50% NVDAon (tokenized equities, CoW)",
    },
    {
        slug: "vMAG7",
        name: "Vaulto Magnificent 7",
        chainId: 56,
        vault: "0x765ce7c25e561c2695741fcf245594f1497198a3",
        controller: "0xf76932ef0ab250c7e0411f65a3ff65518be4d0ba",
        handler: "0x494bacf3a4fbe9d894a66bc55a003fbd4f315d99",
        kind: "cow",
        deployScript: "script/DeployV2BNBMag7.s.sol",
        note: "Equal-weight Mag7 Ondo stocks on BNB (CoW; some Pyth/Stork feeds)",
    },
    {
        slug: "vMAG7-RH",
        name: "Vaulto Mag7 (Robinhood)",
        chainId: 4663,
        vault: "0x9f1BbE4a60D5311E2Eff35Db384A7aA82D7Cdbb3",
        controller: "", // V4 handler owns state — no separate controller
        handler: "0xf2c35Acc1180b4f8D2d384177115C7c282998DE4",
        zapper: "0x0fA89eEca2BDb9CF77c6FDcb42F54b56C07765B2",
        kind: "v4",
        deployScript: "script/DeployV3RHMag7.s.sol",
        note: "Equal-weight Mag7 RH stocks; Uniswap V4 executeSwap + RHZapper",
    },
];
/** Default vault when neither --vault nor --chain is given. */
export const DEFAULT_VAULT_SLUG = "vDTF2";
export function getVaultBySlug(slug) {
    const s = slug.toLowerCase();
    const v = VAULTS.find((x) => x.slug.toLowerCase() === s);
    if (!v) {
        throw new RegistryError(`Unknown vault: ${slug}. Known: ${VAULTS.map((x) => x.slug).join(", ")}.`);
    }
    return v;
}
/**
 * Resolve the target vault from optional --vault / --chain flags.
 * - --vault wins if given.
 * - else if --chain given, use the first vault on that chain.
 * - else fall back to DEFAULT_VAULT_SLUG.
 */
export function resolveVault(opts) {
    if (opts.vault)
        return getVaultBySlug(opts.vault);
    if (opts.chain) {
        const slug = opts.chain.toLowerCase();
        const v = VAULTS.find((x) => getChainById(x.chainId).slug === slug);
        if (!v)
            throw new RegistryError(`No vaults registered on chain: ${opts.chain}.`);
        return v;
    }
    return getVaultBySlug(DEFAULT_VAULT_SLUG);
}
export function vaultChain(v) {
    return getChainById(v.chainId);
}
/** Address of the contract that owns rebalance view/write state. */
export function rebalanceTarget(v) {
    return v.kind === "v4" ? v.handler : v.controller;
}
