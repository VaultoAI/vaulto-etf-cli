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

const MODE_SCRIPT: Record<string, string> = {
  check: "check", // npm run check  (dry run, --check-only)
  tick: "start", // npm start      (single tick)
  loop: "loop", // npm run loop   (forever)
};

/**
 * Run the off-chain keeper bot from $VAULTO_V2_DIR/keeper. Thread the target
 * vault's addresses + RPC into the keeper's env so it monitors the right vault.
 * `check` is a dry run and needs no key; `tick`/`loop` send txs and need
 * KEEPER_PRIVATE_KEY (or PRIVATE_KEY).
 */
export async function keeper(opts: OutputOpts, sel: Selector, mode: string | undefined): Promise<void> {
  const dir = requireV2Dir();
  const keeperDir = join(dir, "keeper");
  if (!existsSync(keeperDir)) throw new InputError(`No keeper/ in V2 repo: ${keeperDir}`);

  const m = (mode ?? "check").toLowerCase();
  const npmScript = MODE_SCRIPT[m];
  if (!npmScript) throw new InputError(`Unknown keeper mode: ${m}. Use check | tick | loop.`);

  const v = resolveVault(sel);
  const chain = vaultChain(v);

  // The bundled keeper is wired for Base; warn if pointed elsewhere.
  if (chain.id !== 8453) {
    emit(
      {
        warning: `The bundled keeper is hard-wired to Base (CoW base API). Vault ${v.slug} is on ${chain.slug}. Running it as-is may target the wrong CoW endpoint.`,
        skipped: true,
        note: "Run the keeper manually after adding multi-chain support, or use --vault vDTF2.",
      },
      opts
    );
    return;
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
  // For one-shot modes, emit a small confirmation (loop won't reach here).
  emit({ ok: true, mode: m, vault: v.slug, cwd: keeperDir }, opts);
}
