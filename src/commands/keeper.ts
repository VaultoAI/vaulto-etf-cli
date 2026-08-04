import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { requireV2Dir, getRpcUrl } from "../config.js";
import { resolveVault, vaultChain } from "../vaults.js";
import { emit, type OutputOpts } from "../output.js";
import type { Selector } from "../cli.js";

class InputError extends Error {
  code = "INPUT_ERROR";
}

/** CoW keeper (Base) npm scripts. */
const COW_MODE_SCRIPT: Record<string, string> = {
  check: "check",
  tick: "start",
  loop: "loop",
};

/** RH V4 keeper npm scripts. */
const RH_MODE_SCRIPT: Record<string, string> = {
  check: "rh:check",
  tick: "rh:start",
  loop: "rh:loop",
};

/**
 * Run the off-chain keeper bot from $VAULTO_V2_DIR/keeper.
 *
 *   - cow vaults on Base → npm run check|start|loop (CoW Protocol)
 *   - v4 vaults on RH   → npm run rh:check|rh:start|rh:loop (Uniswap V4)
 *   - cow vaults on BNB → clear error (upstream keeper hard-codes Base chain/API)
 */
export async function keeper(opts: OutputOpts, sel: Selector, mode: string | undefined): Promise<void> {
  const dir = requireV2Dir();
  const keeperDir = join(dir, "keeper");
  if (!existsSync(keeperDir)) throw new InputError(`No keeper/ in ETFs repo: ${keeperDir}`);

  const m = (mode ?? "check").toLowerCase();
  const v = resolveVault(sel);
  const chain = vaultChain(v);

  if (v.kind === "v4") {
    const npmScript = RH_MODE_SCRIPT[m];
    if (!npmScript) throw new InputError(`Unknown keeper mode: ${m}. Use check | tick | loop.`);

    // RH entrypoint imports shared logger.ts which eagerly loads Base config.ts
    // (requires BASE_RPC_URL + CoW addresses). Satisfy those so RH can start;
    // they are unused by the V4 path.
    const pk =
      process.env.RH_KEEPER_PRIVATE_KEY ||
      process.env.KEEPER_PRIVATE_KEY ||
      process.env.PRIVATE_KEY ||
      "";
    const env = {
      ...process.env,
      RH_RPC_URL: getRpcUrl(chain),
      RH_VAULT_ADDRESS: v.vault,
      RH_HANDLER_ADDRESS: v.handler,
      ...(pk ? { RH_KEEPER_PRIVATE_KEY: pk, KEEPER_PRIVATE_KEY: pk } : {}),
      BASE_RPC_URL: process.env.BASE_RPC_URL || "https://mainnet.base.org",
      VAULT_ADDRESS: process.env.VAULT_ADDRESS || "0x0000000000000000000000000000000000000001",
      CONTROLLER_ADDRESS: process.env.CONTROLLER_ADDRESS || "0x0000000000000000000000000000000000000001",
      HANDLER_ADDRESS: process.env.HANDLER_ADDRESS || "0x0000000000000000000000000000000000000001",
    };

    const res = spawnSync("npm", ["run", npmScript], { cwd: keeperDir, stdio: "inherit", env });
    if (res.error) throw Object.assign(new Error(`keeper failed: ${res.error.message}`), { code: "KEEPER_ERROR" });
    if (res.status !== 0) {
      throw Object.assign(new Error(`keeper exited with code ${res.status}`), { code: "KEEPER_ERROR" });
    }
    emit({ ok: true, mode: m, kind: "v4", vault: v.slug, chain: chain.slug, cwd: keeperDir }, opts);
    return;
  }

  // CoW path
  const npmScript = COW_MODE_SCRIPT[m];
  if (!npmScript) throw new InputError(`Unknown keeper mode: ${m}. Use check | tick | loop.`);

  // Upstream keeper clients.ts hard-codes viem `base` + CoW base API.
  if (chain.id !== 8453) {
    throw Object.assign(
      new Error(
        `CoW keeper is hard-wired to Base (chainId 8453). Vault ${v.slug} is on ${chain.slug} (${chain.id}). ` +
          `RH V4 vaults: vaulto-etf keeper --vault vMAG7-RH. BNB CoW needs a multi-chain-aware keeper fork.`
      ),
      { code: "KEEPER_CHAIN_UNSUPPORTED" }
    );
  }

  const env = {
    ...process.env,
    BASE_RPC_URL: getRpcUrl(chain),
    VAULT_ADDRESS: v.vault,
    CONTROLLER_ADDRESS: v.controller,
    HANDLER_ADDRESS: v.handler,
    ...(process.env.PRIVATE_KEY && !process.env.KEEPER_PRIVATE_KEY
      ? { KEEPER_PRIVATE_KEY: process.env.PRIVATE_KEY }
      : {}),
  };

  const res = spawnSync("npm", ["run", npmScript], { cwd: keeperDir, stdio: "inherit", env });
  if (res.error) throw Object.assign(new Error(`keeper failed: ${res.error.message}`), { code: "KEEPER_ERROR" });
  if (res.status !== 0) {
    throw Object.assign(new Error(`keeper exited with code ${res.status}`), { code: "KEEPER_ERROR" });
  }
  emit({ ok: true, mode: m, kind: "cow", vault: v.slug, chain: chain.slug, cwd: keeperDir }, opts);
}
