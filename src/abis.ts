/**
 * Vendored ABIs — only the functions the CLI calls.
 *
 * controller/handler/aggregator/erc20 ported verbatim from
 * Vaulto-ETF-V2/keeper/src/abis.ts. vaultAbi added for the read commands
 * (preview, total assets, supply). Vendored so read commands never need the
 * Solidity repo checked out.
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
] as const;

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
] as const;

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
] as const;

export const erc20Abi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
] as const;
