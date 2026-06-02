/**
 * Chain registry — one entry per EVM chain Vaulto V2 is deployed on.
 *
 * Source of truth: Vaulto-ETF-V2/CHAINS.md. Token tables include the Chainlink
 * USD feed and per-chain decimals.
 *
 * ⚠️ Decimal gotcha: on BNB Chain, USDC / USDT / DAI use **18 decimals**, not 6.
 * Every amount calculation must read decimals from this table, never assume.
 */

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  /** Chainlink USD price feed (8 decimals) for this token. */
  feed: string;
}

export interface ChainInfo {
  /** EVM chain id. */
  id: number;
  /** Short slug for --chain. */
  slug: string;
  name: string;
  /** Env var holding the RPC URL. */
  rpcEnv: string;
  /** Fallback public RPC if the env var is unset. */
  defaultRpc: string;
  /** Native gas symbol. */
  nativeSymbol: string;
  /** CoW Protocol REST API base for this chain. */
  cowApi: string;
  explorerName: string;
  explorerBase: string;
  tokens: readonly TokenInfo[];
}

const BASE_TOKENS: readonly TokenInfo[] = [
  { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", name: "Wrapped Ether", decimals: 18, feed: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70" },
  { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", name: "USD Coin", decimals: 6, feed: "0x7e860098F58bBFC8648a4311b374B1D669a2bc6B" },
  { address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", symbol: "cbBTC", name: "Coinbase Wrapped BTC", decimals: 8, feed: "0x07DA0E54543a844a80ABE69c8A12F22B3aA59f9D" },
  { address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22", symbol: "cbETH", name: "Coinbase Wrapped Staked ETH", decimals: 18, feed: "0xd7818272B9e248357d13057AAb0B417aF31E817d" },
  { address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", symbol: "DAI", name: "Dai Stablecoin", decimals: 18, feed: "0x591e79239a7d679378eC8c847e5038150364C78F" },
  { address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", symbol: "USDT", name: "Tether USD", decimals: 6, feed: "0xf19d560eB8d2ADf07BD6D13ed03e1D11215721F9" },
  { address: "0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196", symbol: "LINK", name: "Chainlink", decimals: 18, feed: "0x17CAb8FE31E32f08326e5E27412894e49B0f9D65" },
  { address: "0x63706e401c06ac8513145b7687A14804d17f814b", symbol: "AAVE", name: "Aave", decimals: 18, feed: "0x3d6774EF702A10b20FCa8Ed40FC022f7E4938e07" },
  { address: "0x9e1028F5F1D5eDE59748FFceE5532509976840E0", symbol: "COMP", name: "Compound", decimals: 18, feed: "0x9DDa783DE64A9d1A60c49ca761EbE528C35BA428" },
  { address: "0x940181a94A35A4569E4529A3CDfB74e38FD98631", symbol: "AERO", name: "Aerodrome", decimals: 18, feed: "0x4EC5970fC728C5f65ba413992CD5fF6FD70fcfF0" },
] as const;

const BNB_TOKENS: readonly TokenInfo[] = [
  { address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", symbol: "WBNB", name: "Wrapped BNB", decimals: 18, feed: "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE" },
  { address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", symbol: "USDC", name: "USD Coin (BSC)", decimals: 18, feed: "0x51597f405303C4377E36123cBc172b13269EA163" },
  { address: "0x55d398326f99059fF775485246999027B3197955", symbol: "USDT", name: "Tether USD (BSC)", decimals: 18, feed: "0xB97Ad0E74fa7d920791E90258A6E2085088b4320" },
  { address: "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3", symbol: "DAI", name: "Dai Stablecoin (BSC)", decimals: 18, feed: "0x132d3C0B1D2cEa0BC552588063bdBb210FDeecfA" },
  { address: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c", symbol: "BTCB", name: "Bitcoin BEP20", decimals: 18, feed: "0x264990fbd0A4796A3E3d8E37C4d5F87a3aCa5Ebf" },
  { address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8", symbol: "ETH", name: "Ethereum BEP20", decimals: 18, feed: "0x9ef1B8c0E4F7dc8bF5719Ea496883DC6401d5b2e" },
  { address: "0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD", symbol: "LINK", name: "Chainlink (BSC)", decimals: 18, feed: "0xca236E327F629f9Fc2c30A4E95775EbF0B89fac8" },
  { address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82", symbol: "CAKE", name: "PancakeSwap", decimals: 18, feed: "0xB6064eD41d4f67e353768aA239cA86f4F73665a1" },
  { address: "0xA9eE28C80f960B889dFbd1902055218cBa016F75", symbol: "NVDAon", name: "NVIDIA (Ondo)", decimals: 18, feed: "0xea5c2Cbb5cD57daC24E26180b19a929F3E9699B8" },
  { address: "0x2494b603319d4D9F9715c9f4496d9E0364B59d93", symbol: "TSLAon", name: "Tesla (Ondo)", decimals: 18, feed: "0xEEA2ae9c074E87596A85ABE698B2Afebc9B57893" },
] as const;

export const CHAINS: readonly ChainInfo[] = [
  {
    id: 8453,
    slug: "base",
    name: "Base Mainnet",
    rpcEnv: "BASE_RPC_URL",
    defaultRpc: "https://mainnet.base.org",
    nativeSymbol: "ETH",
    cowApi: "https://api.cow.fi/base/api/v1",
    explorerName: "BaseScan",
    explorerBase: "https://basescan.org",
    tokens: BASE_TOKENS,
  },
  {
    id: 56,
    slug: "bnb",
    name: "BNB Chain Mainnet",
    rpcEnv: "BNB_RPC_URL",
    defaultRpc: "https://bsc-dataseed.binance.org",
    nativeSymbol: "BNB",
    cowApi: "https://api.cow.fi/bnb/api/v1",
    explorerName: "BscScan",
    explorerBase: "https://bscscan.com",
    tokens: BNB_TOKENS,
  },
] as const;

export class RegistryError extends Error {
  code = "REGISTRY_ERROR";
}

export function getChainById(id: number): ChainInfo {
  const c = CHAINS.find((x) => x.id === id);
  if (!c) throw new RegistryError(`Unknown chainId: ${id}`);
  return c;
}

export function getChainBySlug(slug: string): ChainInfo {
  const s = slug.toLowerCase();
  const c = CHAINS.find((x) => x.slug === s);
  if (!c) {
    throw new RegistryError(
      `Unknown chain: ${slug}. Known: ${CHAINS.map((x) => x.slug).join(", ")}.`
    );
  }
  return c;
}

/** Look up a token by address (case-insensitive) within a chain. */
export function findToken(chainId: number, address: string): TokenInfo | undefined {
  const c = getChainById(chainId);
  const a = address.toLowerCase();
  return c.tokens.find((t) => t.address.toLowerCase() === a);
}

export function explorerTxUrl(chainId: number, txHash: string): string {
  return `${getChainById(chainId).explorerBase}/tx/${txHash}`;
}

export function explorerAddrUrl(chainId: number, address: string): string {
  return `${getChainById(chainId).explorerBase}/address/${address}`;
}
