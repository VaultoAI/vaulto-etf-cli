/**
 * Single source of truth for the command surface. Consumed by `describe`
 * (machine introspection) and `--help` (human listing).
 */
/** Available on every command. */
export const GLOBAL_FLAGS = [
    {
        name: "--vault",
        takesValue: true,
        description: "Target vault slug (vDTF2, vBNB1, vTE1, vMAG7, vMAG7-RH). Default: vDTF2.",
        example: "--vault vMAG7-RH",
    },
    {
        name: "--chain",
        takesValue: true,
        description: "Target chain (base, bnb, rh). Selects the first vault on that chain if --vault is omitted.",
        example: "--chain rh",
    },
    { name: "--human", takesValue: false, description: "Human-readable output instead of JSON." },
    { name: "--json", takesValue: false, description: "Force JSON output (default)." },
    { name: "--help", takesValue: false, description: "Show help." },
];
export const COMMANDS = [
    {
        name: "doctor",
        summary: "Check RPC reachability per chain + config presence (never prints the key).",
        needsSigner: false,
        example: "vaulto-cli doctor",
    },
    {
        name: "vaults",
        summary: "List all registered vaults across chains with addresses, kind (cow|v4), and explorer links.",
        needsSigner: false,
        example: "vaulto-cli vaults",
    },
    {
        name: "tokens",
        summary: "Token registry (address, decimals, price feed) for a chain.",
        needsSigner: false,
        example: "vaulto-cli tokens --chain rh",
    },
    {
        name: "state",
        summary: "Live on-chain vault state: basket, target/current weights, drift, TVL, share price.",
        needsSigner: false,
        example: "vaulto-cli state --vault vMAG7-RH",
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
        example: "vaulto-cli preview-mint --shares 1000000000000000000 --vault vDTF2",
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
        example: "vaulto-cli preview-redeem --shares 1000000000000000000 --vault vBNB1",
    },
    {
        name: "position",
        summary: "A wallet's vault position: shares, % of supply, pro-rata underlying holdings.",
        needsSigner: false,
        positional: { name: "address", required: true, description: "0x wallet address." },
        example: "vaulto-cli position 0x1234...abcd --vault vDTF2",
    },
    {
        name: "balances",
        summary: "Wallet basket-token balances + allowances toward the vault. With --shares, shows amounts needed to mint and whether funded/approved.",
        needsSigner: false,
        positional: { name: "address", required: false, description: "0x wallet (default: signer from PRIVATE_KEY)." },
        flags: [
            {
                name: "--shares",
                takesValue: true,
                description: "Share quantity to size a mint check (uint256, 18 decimals).",
            },
        ],
        example: "vaulto-cli balances --shares 1000000000000000000 --vault vMAG7",
    },
    {
        name: "approve",
        summary: "Approve ERC-20 spending for mint (vault) or zap (zapper). Dry-run unless --confirm. Use --all for every basket token, --share-token for vault shares (zap redeem).",
        needsSigner: true,
        flags: [
            { name: "--token", takesValue: true, description: "Token symbol or 0x address." },
            { name: "--all", takesValue: false, description: "Approve every basket asset." },
            { name: "--share-token", takesValue: false, description: "Approve the vault share token (for zap redeem)." },
            {
                name: "--spender",
                takesValue: true,
                description: "vault (default) | zapper | 0x address.",
                example: "--spender zapper",
            },
            { name: "--amount", takesValue: true, description: "uint256 amount. Default: max uint256." },
            { name: "--for-shares", takesValue: true, description: "With --all, size min allowances for this mint size." },
            { name: "--confirm", takesValue: false, description: "Send the approve tx(s)." },
        ],
        example: "vaulto-cli approve --all --vault vMAG7",
    },
    {
        name: "mint",
        summary: "Deposit proportional basket tokens → mint shares (depositExactForShares). Dry-run unless --confirm. Use --approve to infinite-approve basket tokens first. RH single-asset: prefer zap mint.",
        needsSigner: true,
        flags: [
            {
                name: "--shares",
                takesValue: true,
                required: true,
                description: "Share quantity as uint256 (18 decimals). 1 share = 1000000000000000000.",
            },
            { name: "--receiver", takesValue: true, description: "Address to receive shares (default: signer)." },
            { name: "--approve", takesValue: false, description: "Approve all basket tokens to the vault before minting." },
            { name: "--confirm", takesValue: false, description: "Send the deposit tx. Without it, dry run." },
        ],
        example: "vaulto-cli mint --shares 1000000000000000000 --vault vMAG7 --approve",
    },
    {
        name: "redeem",
        summary: "Sell/burn vault shares → receive pro-rata basket tokens. Dry-run unless --confirm. No approvals needed for direct redeem. RH single-asset USDG: prefer zap redeem.",
        needsSigner: true,
        flags: [
            {
                name: "--shares",
                takesValue: true,
                required: true,
                description: "Share quantity as uint256 (18 decimals).",
            },
            { name: "--receiver", takesValue: true, description: "Address to receive basket tokens (default: signer)." },
            { name: "--confirm", takesValue: false, description: "Send the redeem tx. Without it, dry run." },
        ],
        example: "vaulto-cli redeem --shares 1000000000000000000 --vault vMAG7",
    },
    {
        name: "rebalance",
        summary: "Rebalance ops. Subcommand: status | start | settle | execute. cow vaults: start/settle (CoW). v4 vaults: execute (Uniswap V4). Writes need PRIVATE_KEY; dry-run unless --confirm.",
        needsSigner: true,
        positional: { name: "subcommand", required: true, description: "status | start | settle | execute" },
        flags: [
            { name: "--sell", takesValue: true, description: "[start|execute] Sell token symbol or 0x address." },
            { name: "--buy", takesValue: true, description: "[start|execute] Buy token symbol or 0x address." },
            { name: "--sell-amount", takesValue: true, description: "[start|execute] Sell amount as uint256 (token decimals)." },
            { name: "--min-buy", takesValue: true, description: "[start|execute] Minimum buy amount as uint256." },
            { name: "--valid-for", takesValue: true, description: "[start] Order validity window in seconds. Default 1800." },
            { name: "--confirm", takesValue: false, description: "Actually send the tx. Without it, the command is a dry run." },
        ],
        example: "vaulto-cli rebalance status --vault vMAG7-RH",
    },
    {
        name: "factory",
        summary: "VaultFactoryV3 ops on Robinhood Chain. Subcommand: list | whitelist | create. create WRITE (dry-run unless --confirm).",
        needsSigner: true,
        positional: { name: "subcommand", required: true, description: "list | whitelist | create" },
        flags: [
            { name: "--name", takesValue: true, description: "[create] ETF name." },
            { name: "--symbol", takesValue: true, description: "[create] ETF symbol." },
            {
                name: "--tokens",
                takesValue: true,
                description: "[create] Comma-separated symbols or 0x addresses (min 2).",
                example: "--tokens AAPL,MSFT,NVDA",
            },
            {
                name: "--weights",
                takesValue: true,
                description: "[create] Comma-separated 1e18-scaled weights summing to exactly 1e18.",
                example: "--weights 333333333333333333,333333333333333333,333333333333333334",
            },
            { name: "--target-share-value", takesValue: true, description: "[create] 1e18-scaled USD per share. Default 10e18." },
            { name: "--drift-threshold", takesValue: true, description: "[create] 1e18-scaled. Default 0.05e18 (5%)." },
            { name: "--min-buy-ratio", takesValue: true, description: "[create] 1e18-scaled. Default 0.94e18." },
            { name: "--price-staleness", takesValue: true, description: "[create] Seconds. Default 172800 (2d)." },
            { name: "--confirm", takesValue: false, description: "Actually send createETF. Without it, dry run." },
        ],
        example: "vaulto-cli factory list --chain rh",
    },
    {
        name: "zap",
        summary: "RHZapper single-asset USDG mint/redeem. Subcommand: preview-mint | preview-redeem | mint | redeem. mint/redeem WRITE (dry-run unless --confirm).",
        needsSigner: true,
        positional: {
            name: "subcommand",
            required: true,
            description: "preview-mint | preview-redeem | mint | redeem",
        },
        flags: [
            { name: "--shares", takesValue: true, required: true, description: "Share quantity as uint256 (18 decimals)." },
            { name: "--max-usdg-in", takesValue: true, description: "[mint] Max USDG to spend (token decimals, usually 6)." },
            { name: "--min-usdg-out", takesValue: true, description: "[redeem] Min USDG to receive." },
            { name: "--receiver", takesValue: true, description: "[mint|redeem] Receiver address (default: signer)." },
            { name: "--zapper", takesValue: true, description: "Override zapper address (default: vault's registered zapper)." },
            { name: "--confirm", takesValue: false, description: "Actually send the tx. Without it, dry run." },
        ],
        example: "vaulto-cli zap preview-mint --shares 1000000000000000000 --vault vMAG7-RH",
    },
    {
        name: "deploy",
        summary: "Build/run a forge deploy script from VAULTO_V2_DIR (DavidVaulto/ETFs). Dry-run (prints command) unless --confirm.",
        needsSigner: true,
        flags: [
            {
                name: "--script",
                takesValue: true,
                description: "Forge script name or path (DeployV2Base | DeployV2BNB | DeployV2BNBStocks | DeployV2BNBMag7 | DeployV3RHMag7 | DeployV4HandlerRHMag7 | DeployRHZapperMag7 | DeployVaultFactoryV3 | …).",
                example: "--script DeployV2BNBMag7",
            },
            { name: "--rpc", takesValue: true, description: "Override RPC URL. Default: chain RPC from config." },
            { name: "--broadcast", takesValue: false, description: "Add --broadcast + --slow to the forge command (live deploy)." },
            { name: "--confirm", takesValue: false, description: "Execute the forge command. Without it, only prints it." },
        ],
        example: "vaulto-cli deploy --script DeployV3RHMag7 --chain rh",
    },
    {
        name: "keeper",
        summary: "Run the off-chain keeper from VAULTO_V2_DIR/keeper. CoW (Base) or RH V4 (rh:*) based on vault kind. Mode: check | tick | loop.",
        needsSigner: true,
        positional: {
            name: "mode",
            required: false,
            description: "check (dry run, default) | tick (one rebalance) | loop (forever)",
        },
        example: "vaulto-cli keeper check --vault vMAG7-RH",
    },
    {
        name: "describe",
        summary: "Dump this command schema as JSON for agent introspection.",
        needsSigner: false,
        example: "vaulto-cli describe",
    },
];
