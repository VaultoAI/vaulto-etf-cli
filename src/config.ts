/**
 * Configuration — env loading + validation. No secrets are ever printed.
 *
 * The CLI reads chain data directly on-chain via viem, so it needs an RPC URL
 * per chain (with public fallbacks). Write operations (rebalance, deploy) need
 * a PRIVATE_KEY; deploy/keeper shell-outs need a local clone of the
 * Vaulto-ETF-V2 repo at VAULTO_V2_DIR.
 */

import "dotenv/config";
import { existsSync } from "node:fs";
import { type ChainInfo } from "./chains.js";

export class ConfigError extends Error {
  code = "CONFIG_ERROR";
}

/** Resolve the RPC URL for a chain: env var, else public default. */
export function getRpcUrl(chain: ChainInfo): string {
  return (process.env[chain.rpcEnv] || chain.defaultRpc).replace(/\/+$/, "");
}

/** True if a chain-specific RPC env var is set (vs. falling back to public). */
export function hasCustomRpc(chain: ChainInfo): boolean {
  return !!process.env[chain.rpcEnv];
}

/**
 * Resolve the signer private key. Throws ConfigError if missing — only
 * write commands (rebalance start/settle) require it.
 */
export function requireSigner(): `0x${string}` {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) {
    throw new ConfigError(
      "Missing PRIVATE_KEY. Set it in your environment or a .env file. " +
        "Required only for write operations (rebalance start/settle, deploy)."
    );
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    throw new ConfigError("PRIVATE_KEY must be a 0x-prefixed 32-byte hex string.");
  }
  return pk as `0x${string}`;
}

/** True if a signer is configured (without exposing it). */
export function hasSigner(): boolean {
  return !!process.env.PRIVATE_KEY;
}

/**
 * Resolve the path to a local Vaulto-ETF-V2 checkout — required for `deploy`
 * (forge scripts) and `keeper` (npm scripts). Throws if unset or missing.
 */
export function requireV2Dir(): string {
  const dir = process.env.VAULTO_V2_DIR;
  if (!dir) {
    throw new ConfigError(
      "Missing VAULTO_V2_DIR. Set it to a local clone of github.com/VaultoAI/Vaulto-ETF-V2. " +
        "Required for `deploy` and `keeper`."
    );
  }
  if (!existsSync(dir)) {
    throw new ConfigError(`VAULTO_V2_DIR does not exist: ${dir}`);
  }
  return dir;
}

export function v2Dir(): string | undefined {
  return process.env.VAULTO_V2_DIR;
}

/** Non-secret view of config state, for `doctor`. */
export function configDebug(): {
  signerConfigured: boolean;
  v2DirConfigured: boolean;
  v2Dir: string | null;
} {
  const dir = process.env.VAULTO_V2_DIR;
  return {
    signerConfigured: hasSigner(),
    v2DirConfigured: !!dir,
    v2Dir: dir ? dir : null,
  };
}
