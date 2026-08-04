import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { requireV2Dir, getRpcUrl } from "../config.js";
import { getChainBySlug, type ChainInfo } from "../chains.js";
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

/** Known forge deploy scripts in DavidVaulto/ETFs. */
const KNOWN_SCRIPTS: Record<string, { path: string; defaultChain: string }> = {
  DeployV2Base: { path: "script/DeployV2Base.s.sol", defaultChain: "base" },
  DeployV2BNB: { path: "script/DeployV2BNB.s.sol", defaultChain: "bnb" },
  DeployV2BNBStocks: { path: "script/DeployV2BNBStocks.s.sol", defaultChain: "bnb" },
  DeployV2BNBMag7: { path: "script/DeployV2BNBMag7.s.sol", defaultChain: "bnb" },
  DeployV2BNBTechMacro: { path: "script/DeployV2BNBTechMacro.s.sol", defaultChain: "bnb" },
  DeployV2RHMag7: { path: "script/DeployV2RHMag7.s.sol", defaultChain: "rh" },
  DeployV3RHMag7: { path: "script/DeployV3RHMag7.s.sol", defaultChain: "rh" },
  DeployV4HandlerRHMag7: { path: "script/DeployV4HandlerRHMag7.s.sol", defaultChain: "rh" },
  DeployRHZapperMag7: { path: "script/DeployRHZapperMag7.s.sol", defaultChain: "rh" },
  DeployVaultFactoryV3: { path: "script/DeployVaultFactoryV3.s.sol", defaultChain: "rh" },
  DeployStorkAdaptersMag7: { path: "script/DeployStorkAdaptersMag7.s.sol", defaultChain: "bnb" },
  DeployBase: { path: "script/DeployBase.s.sol", defaultChain: "base" },
};

/** Resolve a --script value (name or path) to a path relative to the ETFs repo. */
function resolveScript(ref: string | undefined): { rel: string; contract: string; defaultChain?: string } {
  if (!ref) {
    throw new InputError(`Missing --script. Known: ${Object.keys(KNOWN_SCRIPTS).join(", ")}.`);
  }
  if (KNOWN_SCRIPTS[ref]) {
    return {
      rel: KNOWN_SCRIPTS[ref].path,
      contract: ref,
      defaultChain: KNOWN_SCRIPTS[ref].defaultChain,
    };
  }
  const rel = ref.startsWith("script/") ? ref : `script/${ref}`;
  const contract = rel.replace(/^.*\//, "").replace(/\.s\.sol$/, "");
  return { rel, contract };
}

function resolveDeployChain(sel: { vault?: string; chain?: string }, defaultChain?: string): ChainInfo {
  if (sel.chain) return getChainBySlug(sel.chain);
  if (sel.vault) return vaultChain(resolveVault(sel));
  if (defaultChain) return getChainBySlug(defaultChain);
  return vaultChain(resolveVault({}));
}

/**
 * Build (and optionally run) the `forge script` command to deploy a vault stack.
 * Dry-run prints the command; --confirm executes. --broadcast makes it live.
 *
 * Note: forge scripts read various env keys (PRIVATE_KEY, DEPLOYER_PRIVATE_KEY,
 * BNB_DEPLOYER_PK, RH_DEPLOYER_PK) via vm.envUint — we never pass keys on the CLI.
 */
export async function deploy(opts: OutputOpts, sel: Selector, flags: DeployFlags): Promise<void> {
  const dir = requireV2Dir();
  const { rel, contract, defaultChain } = resolveScript(flags.script);
  const chain = resolveDeployChain(sel, defaultChain);

  const scriptPath = join(dir, rel);
  if (!existsSync(scriptPath)) {
    throw new InputError(`Deploy script not found in ETFs repo: ${rel}`);
  }

  const rpc = flags.rpc || getRpcUrl(chain);
  const target = `${rel}:${contract}`;
  const args = ["script", target, "--rpc-url", rpc];
  if (flags.broadcast) {
    args.push("--broadcast", "--slow");
  }
  const printable = `forge ${args.join(" ")}`;

  if (!flags.confirm) {
    emit(
      {
        dryRun: true,
        cwd: dir,
        command: printable,
        chain: chain.slug,
        script: rel,
        broadcast: flags.broadcast,
        knownScripts: Object.keys(KNOWN_SCRIPTS),
        note:
          "Re-run with --confirm to execute. Forge scripts read PRIVATE_KEY / DEPLOYER_PRIVATE_KEY / BNB_DEPLOYER_PK / RH_DEPLOYER_PK from env (never on the CLI). Without --broadcast this is a simulation.",
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
  emit({ ok: true, command: printable, cwd: dir, chain: chain.slug }, opts);
}
