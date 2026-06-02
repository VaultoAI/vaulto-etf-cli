/**
 * Vault registry — every deployed BasketVaultV2 / RebalanceController /
 * VaultoRebalanceHandler stack.
 *
 * Source of truth: Vaulto-ETF-V2/CHAINS.md. Update whenever a new vault deploys.
 */

import { getChainById, type ChainInfo, RegistryError } from "./chains.js";

export interface VaultInfo {
  /** Short slug for --vault. */
  slug: string;
  name: string;
  chainId: number;
  vault: string;
  controller: string;
  handler: string;
  /** Forge deploy script (in the V2 repo) that produced this vault. */
  deployScript: string;
  note?: string;
}

export const VAULTS: readonly VaultInfo[] = [
  {
    slug: "vDTF2",
    name: "Vaulto DTF v2",
    chainId: 8453,
    vault: "0x8CD6c14127D398a27fe9b387BC76761A2B9a37dA",
    controller: "0x9b04039005C7D45347C963404Dd8875057311b77",
    handler: "0x0360e4E11482A22AcFd1727b4bFE59872551120F",
    deployScript: "script/DeployV2Base.s.sol",
  },
  {
    slug: "vBNB1",
    name: "Vaulto BNB Index 1",
    chainId: 56,
    vault: "0xA51254cC25360e8F04Eebee6d5579348BF0570a8",
    controller: "0x30286B89712D2db53E2dDcb5eBA190A93b1d0ca4",
    handler: "0x2a29CB5CaE50fc9d186341FA5D94778Cec84d7FE",
    deployScript: "script/DeployV2BNB.s.sol",
    note: "50% USDC + 50% WBNB",
  },
  {
    slug: "vTE1",
    name: "Vaulto Tech Equity 1",
    chainId: 56,
    vault: "0x5e4Ed5C26Aa626c750A98a7aCc8475D962eeCC88",
    controller: "0x95DDD0951caA27FbE8482cA4ce4F6a095F9c5574",
    handler: "0xD4F4Abd8466F4cA26bFD40D546E9796820573b03",
    deployScript: "script/DeployV2BNBStocks.s.sol",
    note: "50% TSLAon + 50% NVDAon (tokenized equities)",
  },
] as const;

/** Default vault when neither --vault nor --chain is given. */
export const DEFAULT_VAULT_SLUG = "vDTF2";

export function getVaultBySlug(slug: string): VaultInfo {
  const s = slug.toLowerCase();
  const v = VAULTS.find((x) => x.slug.toLowerCase() === s);
  if (!v) {
    throw new RegistryError(
      `Unknown vault: ${slug}. Known: ${VAULTS.map((x) => x.slug).join(", ")}.`
    );
  }
  return v;
}

/**
 * Resolve the target vault from optional --vault / --chain flags.
 * - --vault wins if given.
 * - else if --chain given, use the first vault on that chain.
 * - else fall back to DEFAULT_VAULT_SLUG.
 */
export function resolveVault(opts: { vault?: string; chain?: string }): VaultInfo {
  if (opts.vault) return getVaultBySlug(opts.vault);
  if (opts.chain) {
    const slug = opts.chain.toLowerCase();
    const v = VAULTS.find((x) => getChainById(x.chainId).slug === slug);
    if (!v) throw new RegistryError(`No vaults registered on chain: ${opts.chain}.`);
    return v;
  }
  return getVaultBySlug(DEFAULT_VAULT_SLUG);
}

export function vaultChain(v: VaultInfo): ChainInfo {
  return getChainById(v.chainId);
}
