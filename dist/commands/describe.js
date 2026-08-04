import { COMMANDS, GLOBAL_FLAGS } from "../spec.js";
import { CHAINS } from "../chains.js";
import { VAULTS } from "../vaults.js";
import { emit } from "../output.js";
/** Emit the full command schema as JSON so an agent can discover the tool. */
export async function describe(opts) {
    emit({
        tool: "vaulto-cli",
        description: "Agent CLI for Vaulto on-chain basket ETFs. Install: npm i -g etf-cli  OR  npx etf-cli. " +
            "JSON stdout, errors on stderr. Reads vaults on Base/BNB/RH; mint/redeem shares; zap USDG on RH; rebalance; factory; deploy; keeper. " +
            "Start with: vaulto-cli describe | vaulto-cli doctor | vaulto-cli vaults.",
        install: {
            npm: "npm install -g etf-cli",
            npx: "npx etf-cli <command>",
            github: "npm install -g github:VaultoAI/vaulto-etf-cli",
            docs: "AGENTS.md (shipped with package)",
        },
        userFlows: {
            mint: [
                "vaulto-cli preview-mint --shares <uint256> --vault <slug>",
                "vaulto-cli balances --shares <uint256> --vault <slug>",
                "vaulto-cli mint --shares <uint256> --vault <slug> --approve --confirm",
                "RH single-asset USDG: vaulto-cli zap mint --shares N --max-usdg-in X --vault vMAG7-RH --confirm",
            ],
            redeem: [
                "vaulto-cli position <0x> --vault <slug>",
                "vaulto-cli preview-redeem --shares <uint256> --vault <slug>",
                "vaulto-cli redeem --shares <uint256> --vault <slug> --confirm",
                "RH USDG out: vaulto-cli approve --share-token --spender zapper --vault vMAG7-RH --confirm && vaulto-cli zap redeem ...",
            ],
        },
        env: {
            BASE_RPC_URL: "Base mainnet RPC (optional; public fallback).",
            BNB_RPC_URL: "BNB Chain RPC (optional; public fallback).",
            RH_RPC_URL: "Robinhood Chain RPC (optional; public fallback).",
            PRIVATE_KEY: "Signer key for write ops (mint, redeem, approve, rebalance, deploy, factory, zap). Optional for reads.",
            VAULTO_V2_DIR: "Path to a local clone of github.com/DavidVaulto/ETFs. Required only for deploy/keeper.",
        },
        output: {
            default: "JSON to stdout",
            humanFlag: "--human",
            errors: "JSON to stderr with non-zero exit code",
        },
        chains: CHAINS.map((c) => ({
            slug: c.slug,
            chainId: c.id,
            name: c.name,
            factory: c.protocol?.factory ?? null,
        })),
        vaults: VAULTS.map((v) => ({
            slug: v.slug,
            chainId: v.chainId,
            kind: v.kind,
            vault: v.vault,
            controller: v.controller || null,
            handler: v.handler,
            zapper: v.zapper ?? null,
        })),
        globalFlags: GLOBAL_FLAGS,
        commands: COMMANDS,
    }, { ...opts, human: false });
}
