import { COMMANDS, GLOBAL_FLAGS } from "../spec.js";
import { CHAINS } from "../chains.js";
import { VAULTS } from "../vaults.js";
import { emit, type OutputOpts } from "../output.js";

/** Emit the full command schema as JSON so an agent can discover the tool. */
export async function describe(opts: OutputOpts): Promise<void> {
  emit(
    {
      tool: "vaulto-etf",
      description:
        "Agent CLI for Vaulto V2 on-chain basket ETFs. Reads vault state directly on-chain (viem) across Base + BNB, triggers rebalances, deploys vaults (forge), and runs the keeper.",
      env: {
        BASE_RPC_URL: "Base mainnet RPC (optional; falls back to a public RPC).",
        BNB_RPC_URL: "BNB Chain RPC (optional; falls back to a public RPC).",
        PRIVATE_KEY: "Signer key for write ops (rebalance start/settle, deploy). Optional otherwise.",
        VAULTO_V2_DIR: "Path to a local clone of VaultoAI/Vaulto-ETF-V2. Required for deploy/keeper.",
      },
      output: {
        default: "JSON to stdout",
        humanFlag: "--human",
        errors: "JSON to stderr with non-zero exit code",
      },
      chains: CHAINS.map((c) => ({ slug: c.slug, chainId: c.id, name: c.name })),
      vaults: VAULTS.map((v) => ({ slug: v.slug, chainId: v.chainId, vault: v.vault })),
      globalFlags: GLOBAL_FLAGS,
      commands: COMMANDS,
    },
    { ...opts, human: false }
  );
}
