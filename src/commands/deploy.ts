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

export interface DeployFlags {
  script?: string;
  rpc?: string;
  broadcast: boolean;
  confirm: boolean;
}

const KNOWN_SCRIPTS: Record<string, string> = {
  DeployV2Base: "script/DeployV2Base.s.sol",
  DeployV2BNB: "script/DeployV2BNB.s.sol",
  DeployV2BNBStocks: "script/DeployV2BNBStocks.s.sol",
};

/** Resolve a --script value (name or path) to a path relative to the V2 repo. */
function resolveScript(ref: string | undefined): { rel: string; contract: string } {
  if (!ref) throw new InputError(`Missing --script. Known: ${Object.keys(KNOWN_SCRIPTS).join(", ")}.`);
  if (KNOWN_SCRIPTS[ref]) return { rel: KNOWN_SCRIPTS[ref], contract: ref };
  // a path was given
  const rel = ref.startsWith("script/") ? ref : `script/${ref}`;
  const contract = rel.replace(/^.*\//, "").replace(/\.s\.sol$/, "");
  return { rel, contract };
}

/**
 * Build (and optionally run) the `forge script` command to deploy a new vault
 * stack. Dry-run prints the command; --confirm executes it. --broadcast makes
 * it a live deploy (otherwise forge simulates).
 */
export async function deploy(opts: OutputOpts, sel: Selector, flags: DeployFlags): Promise<void> {
  const dir = requireV2Dir();
  const v = resolveVault(sel);
  const chain = vaultChain(v);
  const { rel, contract } = resolveScript(flags.script);

  const scriptPath = join(dir, rel);
  if (!existsSync(scriptPath)) {
    throw new InputError(`Deploy script not found in V2 repo: ${rel}`);
  }

  const rpc = flags.rpc || getRpcUrl(chain);
  const target = `${rel}:${contract}`;
  const args = ["script", target, "--rpc-url", rpc];
  if (flags.broadcast) {
    args.push("--broadcast", "--verify");
  }
  // forge reads PRIVATE_KEY from env (vm.envUint in the scripts); we never pass it on the CLI.
  const printable = `forge ${args.join(" ")}`;

  if (!flags.confirm) {
    emit(
      {
        dryRun: true,
        cwd: dir,
        command: printable,
        chain: chain.slug,
        broadcast: flags.broadcast,
        note: "Re-run with --confirm to execute. PRIVATE_KEY must be set in the environment (the forge scripts read it via vm.envUint). Without --broadcast this is a simulation.",
      },
      opts
    );
    return;
  }

  const res = spawnSync("forge", args, { cwd: dir, stdio: "inherit", env: process.env });
  if (res.error) throw Object.assign(new Error(`forge failed: ${res.error.message}`), { code: "FORGE_ERROR" });
  if (res.status !== 0) {
    throw Object.assign(new Error(`forge exited with code ${res.status}`), { code: "FORGE_ERROR" });
  }
  emit({ ok: true, command: printable, cwd: dir }, opts);
}
