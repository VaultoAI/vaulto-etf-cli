/**
 * Single source of truth for the command surface. Consumed by `describe`
 * (machine introspection) and `--help` (human listing).
 */

export interface FlagSpec {
  name: string;
  takesValue: boolean;
  repeatable?: boolean;
  required?: boolean;
  description: string;
  example?: string;
}

export interface CommandSpec {
  name: string;
  summary: string;
  needsToken: boolean;
  positional?: { name: string; required: boolean; description: string };
  flags?: FlagSpec[];
  example: string;
}

export const GLOBAL_FLAGS: FlagSpec[] = [
  { name: "--human", takesValue: false, description: "Human-readable output instead of JSON." },
  { name: "--json", takesValue: false, description: "Force JSON output (default)." },
  { name: "--help", takesValue: false, description: "Show help." },
];

export const COMMANDS: CommandSpec[] = [
  {
    name: "doctor",
    summary: "Check config + backend reachability (never prints the token).",
    needsToken: false,
    example: "vaulto-etf doctor",
  },
  {
    name: "state",
    summary: "Live vault state: basket, target/current weights, drift, TVL, share price.",
    needsToken: true,
    example: "vaulto-etf state",
  },
  {
    name: "vault",
    summary: "Raw upstream vault metadata.",
    needsToken: true,
    example: "vaulto-etf vault",
  },
  {
    name: "preview-mint",
    summary: "Underlying assets + USD value required to mint N shares.",
    needsToken: true,
    flags: [
      {
        name: "--shares",
        takesValue: true,
        required: true,
        description: "Share quantity as uint256 (18 decimals). 1 share = 1000000000000000000.",
        example: "--shares 1000000000000000000",
      },
    ],
    example: "vaulto-etf preview-mint --shares 1000000000000000000",
  },
  {
    name: "preview-redeem",
    summary: "Underlying assets + USD value returned for redeeming N shares.",
    needsToken: true,
    flags: [
      {
        name: "--shares",
        takesValue: true,
        required: true,
        description: "Share quantity as uint256 (18 decimals).",
        example: "--shares 1000000000000000000",
      },
    ],
    example: "vaulto-etf preview-redeem --shares 1000000000000000000",
  },
  {
    name: "position",
    summary: "A wallet's vault position: shares, % of supply, underlying holdings.",
    needsToken: true,
    positional: { name: "address", required: true, description: "0x wallet address." },
    example: "vaulto-etf position 0x1234...abcd",
  },
  {
    name: "tokens",
    summary: "Asset allowlist for create-vault (no backend call, no token needed).",
    needsToken: false,
    example: "vaulto-etf tokens",
  },
  {
    name: "create-vault",
    summary:
      "Create a new ETF vault. DEPLOYS REAL CONTRACTS ON BASE (costs gas, irreversible). Dry-run unless --confirm.",
    needsToken: true,
    flags: [
      { name: "--name", takesValue: true, required: true, description: "Vault name." },
      { name: "--symbol", takesValue: true, required: true, description: "Vault symbol, e.g. vTECH." },
      { name: "--description", takesValue: true, description: "Optional description." },
      { name: "--creator", takesValue: true, required: true, description: "Creator 0x wallet address (metadata only)." },
      {
        name: "--asset",
        takesValue: true,
        repeatable: true,
        required: true,
        description:
          "Asset weight as SYMBOL:BPS. Repeat for each. Weights must sum to 10000. Allowed: WETH, USDC.",
        example: "--asset WETH:6000 --asset USDC:4000",
      },
      {
        name: "--confirm",
        takesValue: false,
        description: "Actually send the request. Without it, the command is a dry run.",
      },
    ],
    example:
      "vaulto-etf create-vault --name 'My ETF' --symbol vMINE --asset WETH:6000 --asset USDC:4000 --creator 0x1234...abcd",
  },
  {
    name: "describe",
    summary: "Dump this command schema as JSON for agent introspection.",
    needsToken: false,
    example: "vaulto-etf describe",
  },
];
