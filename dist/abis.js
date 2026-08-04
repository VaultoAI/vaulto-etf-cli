/**
 * Vendored ABIs — only the functions the CLI calls.
 *
 * CoW controller/handler/aggregator/erc20 ported from ETFs/keeper/src/abis.ts.
 * V4 handler / zapper / factory from ETFs/web/src/lib/contracts.ts + keeper abis-rh.
 * Vendored so read commands never need the Solidity repo checked out.
 */
export const controllerAbi = [
    { type: "function", name: "rebalanceActive", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
    { type: "function", name: "rebalanceNonce", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
    { type: "function", name: "needsRebalance", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
    { type: "function", name: "driftThreshold", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
    { type: "function", name: "minBuyRatio", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
    {
        type: "function",
        name: "currentWeights",
        stateMutability: "view",
        inputs: [],
        outputs: [
            { name: "tokens", type: "address[]" },
            { name: "weights", type: "uint256[]" },
        ],
    },
    {
        type: "function",
        name: "driftFromTarget",
        stateMutability: "view",
        inputs: [],
        outputs: [
            { name: "tokens", type: "address[]" },
            { name: "absDrift", type: "uint256[]" },
            { name: "isOverweight", type: "bool[]" },
        ],
    },
    { type: "function", name: "targetWeights", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
    { type: "function", name: "maxTradeSize", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
    { type: "function", name: "priceFeeds", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "address" }] },
    {
        type: "function",
        name: "activeRebalance",
        stateMutability: "view",
        inputs: [],
        outputs: [
            { name: "sellToken", type: "address" },
            { name: "buyToken", type: "address" },
            { name: "sellAmount", type: "uint256" },
            { name: "minBuyAmount", type: "uint256" },
            { name: "sellBalanceBefore", type: "uint256" },
            { name: "buyBalanceBefore", type: "uint256" },
            { name: "validTo", type: "uint32" },
            { name: "appData", type: "bytes32" },
        ],
    },
    {
        type: "function",
        name: "startRebalance",
        stateMutability: "nonpayable",
        inputs: [
            { name: "sellToken", type: "address" },
            { name: "buyToken", type: "address" },
            { name: "sellAmount", type: "uint256" },
            { name: "minBuyAmount", type: "uint256" },
            { name: "validTo", type: "uint32" },
            { name: "appData", type: "bytes32" },
        ],
        outputs: [],
    },
    { type: "function", name: "settleRebalance", stateMutability: "nonpayable", inputs: [], outputs: [] },
];
/**
 * UniswapV4RebalanceHandler on RH Chain.
 * Owns all rebalance state (no separate controller). driftFromTarget returns
 * signed int256[] (+ overweight, − underweight).
 */
export const v4HandlerAbi = [
    { type: "function", name: "needsRebalance", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
    { type: "function", name: "driftThreshold", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
    { type: "function", name: "minBuyRatio", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
    {
        type: "function",
        name: "currentWeights",
        stateMutability: "view",
        inputs: [],
        outputs: [
            { name: "tokens", type: "address[]" },
            { name: "weights", type: "uint256[]" },
        ],
    },
    {
        type: "function",
        name: "driftFromTarget",
        stateMutability: "view",
        inputs: [],
        outputs: [
            { name: "tokens", type: "address[]" },
            { name: "drift", type: "int256[]" },
        ],
    },
    { type: "function", name: "targetWeights", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
    { type: "function", name: "maxTradeSize", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
    { type: "function", name: "priceFeeds", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "address" }] },
    {
        type: "function",
        name: "executeSwap",
        stateMutability: "nonpayable",
        inputs: [
            { name: "sellToken", type: "address" },
            { name: "buyToken", type: "address" },
            { name: "sellAmount", type: "uint256" },
            { name: "minBuyAmount", type: "uint256" },
        ],
        outputs: [],
    },
];
export const vaultAbi = [
    { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
    { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
    { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
    { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
    { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
    { type: "function", name: "basketLength", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
    {
        type: "function",
        name: "totalAssets",
        stateMutability: "view",
        inputs: [],
        outputs: [
            { name: "assets", type: "address[]" },
            { name: "balances", type: "uint256[]" },
        ],
    },
    {
        type: "function",
        name: "previewMint",
        stateMutability: "view",
        inputs: [{ type: "uint256" }],
        outputs: [
            { name: "assets", type: "address[]" },
            { name: "amounts", type: "uint256[]" },
        ],
    },
    {
        type: "function",
        name: "previewRedeem",
        stateMutability: "view",
        inputs: [{ type: "uint256" }],
        outputs: [
            { name: "assets", type: "address[]" },
            { name: "amounts", type: "uint256[]" },
        ],
    },
    /** Deposit proportional basket tokens → mint shares. Caller must have approved vault for each asset. */
    {
        type: "function",
        name: "depositExactForShares",
        stateMutability: "nonpayable",
        inputs: [
            { name: "shares", type: "uint256" },
            { name: "receiver", type: "address" },
        ],
        outputs: [{ name: "amounts", type: "uint256[]" }],
    },
    /** Burn shares → receive pro-rata basket tokens. Shares are burned from msg.sender. */
    {
        type: "function",
        name: "redeem",
        stateMutability: "nonpayable",
        inputs: [
            { name: "shares", type: "uint256" },
            { name: "receiver", type: "address" },
        ],
        outputs: [{ name: "amounts", type: "uint256[]" }],
    },
    {
        type: "function",
        name: "approve",
        stateMutability: "nonpayable",
        inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
        ],
        outputs: [{ type: "bool" }],
    },
];
export const zapperAbi = [
    {
        type: "function",
        name: "zapMint",
        stateMutability: "nonpayable",
        inputs: [
            { name: "shares", type: "uint256" },
            { name: "maxUsdgIn", type: "uint256" },
            { name: "receiver", type: "address" },
        ],
        outputs: [{ name: "usdgUsed", type: "uint256" }],
    },
    {
        type: "function",
        name: "zapRedeem",
        stateMutability: "nonpayable",
        inputs: [
            { name: "shares", type: "uint256" },
            { name: "minUsdgOut", type: "uint256" },
            { name: "receiver", type: "address" },
        ],
        outputs: [{ name: "usdgOut", type: "uint256" }],
    },
    {
        type: "function",
        name: "previewMintAmounts",
        stateMutability: "view",
        inputs: [{ type: "uint256" }],
        outputs: [
            { name: "assets", type: "address[]" },
            { name: "amounts", type: "uint256[]" },
        ],
    },
    {
        type: "function",
        name: "previewRedeemAmounts",
        stateMutability: "view",
        inputs: [{ type: "uint256" }],
        outputs: [
            { name: "assets", type: "address[]" },
            { name: "amounts", type: "uint256[]" },
        ],
    },
];
export const factoryAbi = [
    { type: "function", name: "whitelistedTokens", stateMutability: "view", inputs: [], outputs: [{ type: "address[]" }] },
    { type: "function", name: "whitelistedTokensLength", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
    {
        type: "function",
        name: "tokenEntry",
        stateMutability: "view",
        inputs: [{ type: "address" }],
        outputs: [
            { name: "priceFeed", type: "address" },
            { name: "poolFee", type: "uint24" },
            { name: "poolTickSpacing", type: "int24" },
            { name: "poolHooks", type: "address" },
            { name: "defaultMaxTradeSize", type: "uint256" },
        ],
    },
    { type: "function", name: "deploymentCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
    {
        type: "function",
        name: "deployments",
        stateMutability: "view",
        inputs: [{ type: "uint256" }],
        outputs: [
            { name: "creator", type: "address" },
            { name: "vault", type: "address" },
            { name: "handler", type: "address" },
            { name: "zapper", type: "address" },
            { name: "createdAt", type: "uint64" },
        ],
    },
    {
        type: "function",
        name: "deploymentsByCreator",
        stateMutability: "view",
        inputs: [{ type: "address" }],
        outputs: [
            {
                type: "tuple[]",
                components: [
                    { name: "creator", type: "address" },
                    { name: "vault", type: "address" },
                    { name: "handler", type: "address" },
                    { name: "zapper", type: "address" },
                    { name: "createdAt", type: "uint64" },
                ],
            },
        ],
    },
    {
        type: "function",
        name: "createETF",
        stateMutability: "nonpayable",
        inputs: [
            {
                name: "p",
                type: "tuple",
                components: [
                    { name: "name", type: "string" },
                    { name: "symbol", type: "string" },
                    { name: "tokens", type: "address[]" },
                    { name: "weights", type: "uint256[]" },
                    { name: "targetShareValueUsd", type: "uint256" },
                    { name: "driftThreshold", type: "uint256" },
                    { name: "minBuyRatio", type: "uint256" },
                    { name: "priceStalenessLimit", type: "uint256" },
                ],
            },
        ],
        outputs: [
            { name: "vault", type: "address" },
            { name: "handler", type: "address" },
            { name: "zapper", type: "address" },
        ],
    },
    {
        type: "event",
        name: "ETFCreated",
        inputs: [
            { name: "creator", type: "address", indexed: true },
            { name: "vault", type: "address", indexed: true },
            { name: "handler", type: "address", indexed: false },
            { name: "zapper", type: "address", indexed: false },
            { name: "name", type: "string", indexed: false },
            { name: "symbol", type: "string", indexed: false },
            { name: "tokens", type: "address[]", indexed: false },
            { name: "weights", type: "uint256[]", indexed: false },
            { name: "seedUnitsPerShare", type: "uint256[]", indexed: false },
        ],
    },
];
export const aggregatorAbi = [
    {
        type: "function",
        name: "latestRoundData",
        stateMutability: "view",
        inputs: [],
        outputs: [
            { name: "roundId", type: "uint80" },
            { name: "answer", type: "int256" },
            { name: "startedAt", type: "uint256" },
            { name: "updatedAt", type: "uint256" },
            { name: "answeredInRound", type: "uint80" },
        ],
    },
    { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
];
export const erc20Abi = [
    { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
    { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
    { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
    {
        type: "function",
        name: "allowance",
        stateMutability: "view",
        inputs: [
            { type: "address" },
            { type: "address" },
        ],
        outputs: [{ type: "uint256" }],
    },
    {
        type: "function",
        name: "approve",
        stateMutability: "nonpayable",
        inputs: [
            { type: "address" },
            { type: "uint256" },
        ],
        outputs: [{ type: "bool" }],
    },
];
