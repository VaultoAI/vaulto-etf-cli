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
  /** Needs PRIVATE_KEY (write/keeper ops). */
  needsSigner: boolean;
  positional?: { name: string; required: boolean; description: string };
  flags?: FlagSpec[];
  example: string;
}

/** Available on every command. */
export const GLOBAL_FLAGS: FlagSpec[] = [
  {
    name: "--vault",
    takesValue: true,
    description: "Target vault slug (vDTF2, vBNB1, vTE1). Default: vDTF2.",
    example: "--vault vBNB1",
  },
  {
    name: "--chain",
    takesValue: true,
    description: "Target chain (base, bnb). Selects the first vault on that chain if --vault is omitted.",
    example: "--chain bnb",
  },
  { name: "--human", takesValue: false, description: "Human-readable output instead of JSON." },
  { name: "--json", takesValue: false, description: "Force JSON output (default)." },
  { name: "--help", takesValue: false, description: "Show help." },
];

export const COMMANDS: CommandSpec[] = [
  {
    name: "doctor",
    summary: "Check RPC reachability per chain + config presence (never prints the key).",
    needsSigner: false,
    example: "vaulto-etf doctor",
  },
  {
    name: "vaults",
    summary: "List all registered vaults across chains with their addresses + explorer links.",
    needsSigner: false,
    example: "vaulto-etf vaults",
  },
  {
    name: "tokens",
    summary: "Token registry (address, decimals, Chainlink feed) for a chain.",
    needsSigner: false,
    example: "vaulto-etf tokens --chain bnb",
  },
  {
    name: "state",
    summary: "Live on-chain vault state: basket, target/current weights, drift, TVL, share price.",
    needsSigner: false,
    example: "vaulto-etf state --vault vDTF2",
  },
  {
    name: "preview-mint",
    summary: "Underlying assets + USD value required to mint N shares (on-chain previewMint).",
    needsSigner: false,
    flags: [
      {
        name: "--shares",
        takesValue: true,
        required: true,
        description: "Share quantity as uint256 (18 decimals). 1 share = 1000000000000000000.",
        example: "--shares 1000000000000000000",
      },
    ],
    example: "vaulto-etf preview-mint --shares 1000000000000000000 --vault vDTF2",
  },
  {
    name: "preview-redeem",
    summary: "Underlying assets + USD value returned for redeeming N shares (on-chain previewRedeem).",
    needsSigner: false,
    flags: [
      {
        name: "--shares",
        takesValue: true,
        required: true,
        description: "Share quantity as uint256 (18 decimals).",
        example: "--shares 1000000000000000000",
      },
    ],
    example: "vaulto-etf preview-redeem --shares 1000000000000000000 --vault vBNB1",
  },
  {
    name: "position",
    summary: "A wallet's vault position: shares, % of supply, pro-rata underlying holdings.",
    needsSigner: false,
    positional: { name: "address", required: true, description: "0x wallet address." },
    example: "vaulto-etf position 0x1234...abcd --vault vDTF2",
  },
  {
    name: "rebalance",
    summary:
      "Rebalance ops. Subcommand: status | start | settle. start/settle WRITE on-chain (need PRIVATE_KEY w/ EXECUTOR_ROLE); dry-run unless --confirm.",
    needsSigner: true,
    positional: { name: "subcommand", required: true, description: "status | start | settle" },
    flags: [
      { name: "--sell", takesValue: true, description: "[start] Sell token symbol or 0x address." },
      { name: "--buy", takesValue: true, description: "[start] Buy token symbol or 0x address." },
      { name: "--sell-amount", takesValue: true, description: "[start] Sell amount as uint256 (token's native decimals)." },
      { name: "--min-buy", takesValue: true, description: "[start] Minimum buy amount as uint256." },
      { name: "--valid-for", takesValue: true, description: "[start] Order validity window in seconds. Default 1800." },
      { name: "--confirm", takesValue: false, description: "Actually send the tx. Without it, the command is a dry run." },
    ],
    example: "vaulto-etf rebalance status --vault vDTF2",
  },
  {
    name: "deploy",
    summary:
      "Build the `forge script` command to deploy a new vault stack from the V2 repo (needs VAULTO_V2_DIR + PRIVATE_KEY). Dry-run (prints command) unless --confirm.",
    needsSigner: true,
    flags: [
      {
        name: "--script",
        takesValue: true,
        description: "Forge deploy script path or name (DeployV2Base | DeployV2BNB | DeployV2BNBStocks).",
        example: "--script DeployV2Base",
      },
      { name: "--rpc", takesValue: true, description: "Override RPC URL. Default: chain RPC from config." },
      { name: "--broadcast", takesValue: false, description: "Add --broadcast + --verify to the forge command (live deploy)." },
      { name: "--confirm", takesValue: false, description: "Execute the forge command. Without it, only prints it." },
    ],
    example: "vaulto-etf deploy --script DeployV2Base --chain base",
  },
  {
    name: "keeper",
    summary:
      "Run the off-chain keeper bot (drift monitor + CoW rebalancer) from VAULTO_V2_DIR/keeper. Mode: check | tick | loop.",
    needsSigner: true,
    positional: { name: "mode", required: false, description: "check (dry run, default) | tick (one rebalance) | loop (forever)" },
    example: "vaulto-etf keeper check --vault vDTF2",
  },
  {
    name: "describe",
    summary: "Dump this command schema as JSON for agent introspection.",
    needsSigner: false,
    example: "vaulto-etf describe",
  },
];
