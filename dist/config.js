/**
 * Configuration — env loading + validation. No secrets are ever printed.
 *
 * The CLI reads chain data directly on-chain via viem, so it needs an RPC URL
 * per chain (with public fallbacks). Write operations (rebalance, deploy, zap,
 * factory create) need a PRIVATE_KEY; deploy/keeper shell-outs need a local
 * clone of DavidVaulto/ETFs at VAULTO_V2_DIR (name kept for back-compat).
 */
import "dotenv/config";
import { existsSync } from "node:fs";
export class ConfigError extends Error {
    code = "CONFIG_ERROR";
}
/** Resolve the RPC URL for a chain: env var, else public default. */
export function getRpcUrl(chain) {
    return (process.env[chain.rpcEnv] || chain.defaultRpc).replace(/\/+$/, "");
}
/** True if a chain-specific RPC env var is set (vs. falling back to public). */
export function hasCustomRpc(chain) {
    return !!process.env[chain.rpcEnv];
}
/**
 * Resolve the signer private key. Throws ConfigError if missing — only
 * write commands require it.
 */
export function requireSigner() {
    const pk = process.env.PRIVATE_KEY;
    if (!pk) {
        throw new ConfigError("Missing PRIVATE_KEY. Set it in your environment or a .env file. " +
            "Required only for write operations (rebalance, deploy, factory create, zap).");
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) {
        throw new ConfigError("PRIVATE_KEY must be a 0x-prefixed 32-byte hex string.");
    }
    return pk;
}
/** True if a signer is configured (without exposing it). */
export function hasSigner() {
    return !!process.env.PRIVATE_KEY;
}
/**
 * Resolve the path to a local DavidVaulto/ETFs (or Vaulto-ETF-V2) checkout —
 * required for `deploy` (forge scripts) and `keeper` (npm scripts).
 */
export function requireV2Dir() {
    const dir = process.env.VAULTO_V2_DIR;
    if (!dir) {
        throw new ConfigError("Missing VAULTO_V2_DIR. Set it to a local clone of github.com/DavidVaulto/ETFs " +
            "(or VaultoAI/Vaulto-ETF-V2). Required for `deploy` and `keeper`.");
    }
    if (!existsSync(dir)) {
        throw new ConfigError(`VAULTO_V2_DIR does not exist: ${dir}`);
    }
    return dir;
}
export function v2Dir() {
    return process.env.VAULTO_V2_DIR;
}
/** Non-secret view of config state, for `doctor`. */
export function configDebug() {
    const dir = process.env.VAULTO_V2_DIR;
    return {
        signerConfigured: hasSigner(),
        v2DirConfigured: !!dir,
        v2Dir: dir ? dir : null,
    };
}
