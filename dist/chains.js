/**
 * Chain registry — one entry per EVM chain Vaulto is deployed on.
 *
 * Source of truth: DavidVaulto/ETFs CHAINS.md + web/src/lib (RH whitelist).
 * Token tables include the Chainlink (or equivalent AggregatorV3) USD feed
 * and per-chain decimals.
 *
 * ⚠️ Decimal gotcha: on BNB Chain, USDC / USDT / DAI use **18 decimals**, not 6.
 * Every amount calculation must read decimals from this table, never assume.
 */
const BASE_TOKENS = [
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
];
/** BNB Chain tokens including Ondo tokenized equities used by vTE1 / vMAG7. */
const BNB_TOKENS = [
    { address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", symbol: "WBNB", name: "Wrapped BNB", decimals: 18, feed: "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE" },
    { address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", symbol: "USDC", name: "USD Coin (BSC)", decimals: 18, feed: "0x51597f405303C4377E36123cBc172b13269EA163" },
    { address: "0x55d398326f99059fF775485246999027B3197955", symbol: "USDT", name: "Tether USD (BSC)", decimals: 18, feed: "0xB97Ad0E74fa7d920791E90258A6E2085088b4320" },
    { address: "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3", symbol: "DAI", name: "Dai Stablecoin (BSC)", decimals: 18, feed: "0x132d3C0B1D2cEa0BC552588063bdBb210FDeecfA" },
    { address: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c", symbol: "BTCB", name: "Bitcoin BEP20", decimals: 18, feed: "0x264990fbd0A4796A3E3d8E37C4d5F87a3aCa5Ebf" },
    { address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8", symbol: "ETH", name: "Ethereum BEP20", decimals: 18, feed: "0x9ef1B8c0E4F7dc8bF5719Ea496883DC6401d5b2e" },
    { address: "0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD", symbol: "LINK", name: "Chainlink (BSC)", decimals: 18, feed: "0xca236E327F629f9Fc2c30A4E95775EbF0B89fac8" },
    { address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82", symbol: "CAKE", name: "PancakeSwap", decimals: 18, feed: "0xB6064eD41d4f67e353768aA239cA86f4F73665a1" },
    // Ondo Global Markets (tokenized equities) — vTE1 / vMAG7
    { address: "0x091FC7778e6932d4009B087B191D1EE3bac5729A", symbol: "GOOGLon", name: "Alphabet (Ondo)", decimals: 18, feed: "0x0000000000000000000000000000000000000000" },
    { address: "0x2494b603319d4D9F9715c9f4496d9E0364B59d93", symbol: "TSLAon", name: "Tesla (Ondo)", decimals: 18, feed: "0xEEA2ae9c074E87596A85ABE698B2Afebc9B57893" },
    { address: "0x390a684EF9cADE28A7AD0DFa61AB1Eb3842618c4", symbol: "AAPLon", name: "Apple (Ondo)", decimals: 18, feed: "0x0000000000000000000000000000000000000000" },
    { address: "0x4553cFe1C09f37f38b12dC509F676964e392F8Fc", symbol: "AMZNon", name: "Amazon (Ondo)", decimals: 18, feed: "0x0000000000000000000000000000000000000000" },
    { address: "0x6Bfe75D1ad432050eA973C3A3DcD88F02e2444C3", symbol: "MSFTon", name: "Microsoft (Ondo)", decimals: 18, feed: "0x0000000000000000000000000000000000000000" },
    { address: "0xA9eE28C80f960B889dFbd1902055218cBa016F75", symbol: "NVDAon", name: "NVIDIA (Ondo)", decimals: 18, feed: "0xea5c2Cbb5cD57daC24E26180b19a929F3E9699B8" },
    { address: "0xD7dF5863A3e742F0c767768cDfcb63f09E0422f6", symbol: "METAon", name: "Meta (Ondo)", decimals: 18, feed: "0x0000000000000000000000000000000000000000" },
    { address: "0x6a708EAD771238919D85930b5a0f10454E1C331a", symbol: "SPYon", name: "S&P 500 (Ondo)", decimals: 18, feed: "0xb24D1DeE5F9a3f761D286B56d2bC44CE1D02DF7e" },
    { address: "0xf8589b526FdD65F7F301c605a6e04F0F1b4B3620", symbol: "COINon", name: "Coinbase (Ondo)", decimals: 18, feed: "0x2d1AB79D059e21aE519d88F978cAF39d74E31AEB" },
];
/**
 * Robinhood Chain whitelisted stock tokens (source: ETFs/web/src/lib/rh-basket.ts).
 * All stock tokens are 18-decimal ERC-20s; feeds are 8-decimal USD Chainlink proxies.
 */
const RH_TOKENS = [
    { address: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168", symbol: "USDG", name: "USD Gold (RH stable)", decimals: 6, feed: "0x0000000000000000000000000000000000000000" },
    // Big Tech
    { address: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9", symbol: "AAPL", name: "Apple", decimals: 18, feed: "0x6B22A786bAa607d76728168703a39Ea9C99f2cD0" },
    { address: "0x12f190a9F9d7D37a250758b26824B97CE941bF54", symbol: "AMZN", name: "Amazon", decimals: 18, feed: "0xD5a1508ceD74c084eBf3cBe853e2C968fB2a651C" },
    { address: "0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3", symbol: "GOOGL", name: "Alphabet", decimals: 18, feed: "0xF6f373a037c30F0e5010d854385cA89185AE638b" },
    { address: "0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35", symbol: "META", name: "Meta Platforms", decimals: 18, feed: "0x7C38C00C30BEe9378381E7B6135d7283356D71b1" },
    { address: "0xe93237C50D904957Cf27E7B1133b510C669c2e74", symbol: "MSFT", name: "Microsoft", decimals: 18, feed: "0x45C3C877C15E6BA2EBB19eA114Ea508d14C1Af2E" },
    { address: "0xb0992820E760d836549ba69BC7598b4af75dEE03", symbol: "ORCL", name: "Oracle", decimals: 18, feed: "0x0e6a64a2B58A6693a531E6c555f3A5d042eEA844" },
    { address: "0x322F0929c4625eD5bAd873c95208D54E1c003b2d", symbol: "TSLA", name: "Tesla", decimals: 18, feed: "0x4A1166a659A55625345e9515b32adECea5547C38" },
    // Semis & AI
    { address: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC", symbol: "NVDA", name: "NVIDIA", decimals: 18, feed: "0x379EC4f7C378F34a1B47E4F3cbeBCbAC3E8E9F15" },
    { address: "0x86923f96303D656E4aa86D9d42D1e57ad2023fdC", symbol: "AMD", name: "AMD", decimals: 18, feed: "0x943A29E7ae51A4798823ca9eEd2ed533B2A22C72" },
    { address: "0x58FfE4a942d3885bAa22D7520691F611EF09e7AA", symbol: "TSM", name: "TSMC", decimals: 18, feed: "0x874cF94aa8eC88Fd9560094dD065f2fB3E41Fc2F" },
    { address: "0xc72b96e0E48ecd4DC75E1e45396e26300BC39681", symbol: "INTC", name: "Intel", decimals: 18, feed: "0x3f390C5C24628Ac7C489515402235FeAD71D1913" },
    { address: "0xfF080c8ce2E5feadaCa0Da81314Ae59D232d4afD", symbol: "MU", name: "Micron", decimals: 18, feed: "0x425EEFdCf05ed6526C3cE61Af99429A228a6d596" },
    { address: "0xB90A19fF0Af67f7779afF50A882A9CfF42446400", symbol: "SNDK", name: "SanDisk", decimals: 18, feed: "0xfb133Fa4B7b385802B693a293606682Df47109A3" },
    { address: "0x894E1EC2D74FFE5AEF8Dc8A9e84686acCB964F2A", symbol: "PLTR", name: "Palantir", decimals: 18, feed: "0x820ABedFF239034956B7A9d2F0a331f9F075eB4c" },
    { address: "0x5f10A1C971B69e47e059e1dC91901B59b3fB49C3", symbol: "CRWV", name: "CoreWeave", decimals: 18, feed: "0xe1b3aABCAFAd1c94708dc1367dcfF8Aa4407487C" },
    // Frontier / crypto equities / meme / ETFs / commodities
    { address: "0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa", symbol: "SPCX", name: "SpaceX", decimals: 18, feed: "0xB265810950ba6c5C0Ff821c9963014a56fD8Bffb" },
    { address: "0xd917B029C761D264c6A312BBbcDA868658eF86a6", symbol: "USAR", name: "USA Rare Earth", decimals: 18, feed: "0xA994d3684e8400A6c8078226925779FdeE682DD9" },
    { address: "0x6330D8C3178a418788dF01a47479c0ce7CCF450b", symbol: "COIN", name: "Coinbase", decimals: 18, feed: "0xA3a468A452940B7D6b69991207B508c609a98Ef2" },
    { address: "0xec262a75e413fAfD0dF80480274532C79D42da09", symbol: "MSTR", name: "Strategy", decimals: 18, feed: "0x396118bdFB181e6240E74D243F266B061c0edc3D" },
    { address: "0x1b0E319c6A659F002271B69dB8A7df2F911c153E", symbol: "GME", name: "GameStop", decimals: 18, feed: "0x27C71df6A64fB476468EdF256CF72c038baB5B67" },
    { address: "0x117cc2133c37B721F49dE2A7a74833232B3B4C0C", symbol: "SPY", name: "S&P 500 ETF", decimals: 18, feed: "0x319724394D3A0e3669269846abE664Cd621f9f6A" },
    { address: "0xD5f3879160bc7c32ebb4dC785F8a4F505888de68", symbol: "QQQ", name: "Nasdaq 100 ETF", decimals: 18, feed: "0x80901d846d5D7B030F26B480776EE3b29374C2ae" },
    { address: "0x92FD66527192E3e61d4DDd13322Aa222DE86F9B5", symbol: "SGOV", name: "US T-Bills 0-3mo", decimals: 18, feed: "0xa0DF4ee0fFf975306345875E3548Fcc519577A11" },
    { address: "0x411eFb0E7f985935DAec3D4C3ebaEa0d0AD7D89f", symbol: "SLV", name: "iShares Silver", decimals: 18, feed: "0x209b73908e92Ae021826eD79609845451Ecba2ce" },
    { address: "0xa30FA36Db767ad9eD3f7a60fC79526fB4d56D344", symbol: "USO", name: "US Oil Fund", decimals: 18, feed: "0x75a9c76Ef439e2C7c2E5a34Ab105EcFe3766431c" },
];
export const CHAINS = [
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
        // bsc-dataseed.binance.org is intermittently unreachable; seed1 + publicnode are reliable.
        defaultRpc: "https://bsc-dataseed1.binance.org",
        nativeSymbol: "BNB",
        cowApi: "https://api.cow.fi/bnb/api/v1",
        explorerName: "BscScan",
        explorerBase: "https://bscscan.com",
        tokens: BNB_TOKENS,
    },
    {
        id: 4663,
        slug: "rh",
        name: "Robinhood Chain",
        rpcEnv: "RH_RPC_URL",
        defaultRpc: "https://rpc.mainnet.chain.robinhood.com",
        nativeSymbol: "ETH",
        cowApi: "", // V4 direct-execution, no CoW
        explorerName: "Blockscout",
        explorerBase: "https://robinhoodchain.blockscout.com",
        tokens: RH_TOKENS,
        protocol: {
            factory: "0x388A9b1A5b7d305043Bb8f26a20f4984ed1Fdbcf",
            stackDeployer: "0x525954e855107f325b179dF4BBA0eB822b7D64e6",
            usdg: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
            universalRouter: "0x8876789976dEcBfCbBbe364623C63652db8C0904",
            permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
        },
    },
];
export class RegistryError extends Error {
    code = "REGISTRY_ERROR";
}
export function getChainById(id) {
    const c = CHAINS.find((x) => x.id === id);
    if (!c)
        throw new RegistryError(`Unknown chainId: ${id}`);
    return c;
}
export function getChainBySlug(slug) {
    const s = slug.toLowerCase();
    const c = CHAINS.find((x) => x.slug === s);
    if (!c) {
        throw new RegistryError(`Unknown chain: ${slug}. Known: ${CHAINS.map((x) => x.slug).join(", ")}.`);
    }
    return c;
}
/** Look up a token by address (case-insensitive) within a chain. */
export function findToken(chainId, address) {
    const c = getChainById(chainId);
    const a = address.toLowerCase();
    return c.tokens.find((t) => t.address.toLowerCase() === a);
}
/** Look up a token by symbol (case-insensitive) within a chain. */
export function findTokenBySymbol(chainId, symbol) {
    const c = getChainById(chainId);
    const s = symbol.toLowerCase();
    return c.tokens.find((t) => t.symbol.toLowerCase() === s);
}
export function explorerTxUrl(chainId, txHash) {
    return `${getChainById(chainId).explorerBase}/tx/${txHash}`;
}
export function explorerAddrUrl(chainId, address) {
    return `${getChainById(chainId).explorerBase}/address/${address}`;
}
