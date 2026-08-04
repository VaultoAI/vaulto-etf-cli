import { resolveVault } from "../vaults.js";
import { findTokenBySymbol, getChainById } from "../chains.js";
import { rebalanceStatus, sendExecuteSwap, sendSettleRebalance, sendStartRebalance, } from "../onchain.js";
import { emit } from "../output.js";
/** CoW canonical empty appData hash (keccak256("{}")). */
const EMPTY_APP_DATA_HASH = "0xb48d38f93eaa084033fc5970bf96e559c33c4cdc07d889ab00b4d63f9590739d";
class InputError extends Error {
    code = "INPUT_ERROR";
}
/** Resolve a token symbol or 0x address to an address on the vault's chain. */
function resolveToken(v, ref, label) {
    if (!ref)
        throw new InputError(`Missing --${label}.`);
    if (/^0x[0-9a-fA-F]{40}$/.test(ref))
        return ref;
    const bySymbol = findTokenBySymbol(v.chainId, ref);
    if (bySymbol)
        return bySymbol.address;
    throw new InputError(`Unknown token "${ref}" on chain ${v.chainId}. Use a symbol or 0x address.`);
}
/**
 * Rebalance ops.
 * Subcommands:
 *   status  — read (all vaults)
 *   start   — CoW authorize (cow vaults only)
 *   settle  — CoW finalize (cow vaults only)
 *   execute — V4 atomic swap (v4 vaults only)
 */
export async function rebalance(opts, sel, sub, flags) {
    const v = resolveVault(sel);
    const action = (sub ?? "status").toLowerCase();
    if (action === "status") {
        const s = await rebalanceStatus(v);
        emit(s, opts, (d) => [
            `Vault:        ${d.vault}`,
            `Kind:         ${d.kind}`,
            `Needs rebal:  ${d.needsRebalance}`,
            `Active:       ${d.rebalanceActive}`,
            `Nonce:        ${d.rebalanceNonce ?? "n/a"}`,
            `Drift thresh: ${d.driftThresholdPct.toFixed(2)}%`,
            `Min buy:      ${d.minBuyRatioPct.toFixed(2)}%`,
            d.active
                ? `Active order: sell ${d.active.sellAmount} ${d.active.sellToken} -> >=${d.active.minBuyAmount} ${d.active.buyToken} (validTo ${d.active.validTo})`
                : "Active order: none",
            d.kind === "v4"
                ? "Note: V4 vaults use `rebalance execute` (atomic Uniswap swap). Prefer `vaulto-cli keeper`."
                : "Note: CoW vaults use start → CoW API → settle. Prefer `vaulto-cli keeper`.",
        ].join("\n"));
        return;
    }
    if (action === "settle") {
        if (v.kind !== "cow") {
            throw new InputError(`settle is CoW-only. Vault ${v.slug} is kind=${v.kind}. Use: rebalance execute`);
        }
        if (!flags.confirm) {
            emit({
                dryRun: true,
                action: "settleRebalance",
                vault: v.vault,
                controller: v.controller,
                note: "Re-run with --confirm to send. Requires PRIVATE_KEY with EXECUTOR_ROLE.",
            }, opts);
            return;
        }
        const hash = await sendSettleRebalance(v);
        emit({ action: "settleRebalance", vault: v.vault, txHash: hash }, opts);
        return;
    }
    if (action === "start") {
        if (v.kind !== "cow") {
            throw new InputError(`start is CoW-only. Vault ${v.slug} is kind=${v.kind}. Use: rebalance execute`);
        }
        const params = {
            sellToken: resolveToken(v, flags.sell, "sell"),
            buyToken: resolveToken(v, flags.buy, "buy"),
            sellAmount: BigInt(requireUint(flags.sellAmount, "sell-amount")),
            minBuyAmount: BigInt(requireUint(flags.minBuy, "min-buy")),
            validTo: Math.floor(nowSecs() + Number(flags.validFor ?? 1800)),
            appData: EMPTY_APP_DATA_HASH,
        };
        if (!flags.confirm) {
            emit({
                dryRun: true,
                action: "startRebalance",
                vault: v.vault,
                controller: v.controller,
                params: {
                    ...params,
                    sellAmount: params.sellAmount.toString(),
                    minBuyAmount: params.minBuyAmount.toString(),
                },
                note: "Re-run with --confirm to send. Prefer `vaulto-cli keeper` (handles CoW API + settle).",
            }, opts);
            return;
        }
        const hash = await sendStartRebalance(v, params);
        emit({ action: "startRebalance", vault: v.vault, txHash: hash }, opts);
        return;
    }
    if (action === "execute") {
        if (v.kind !== "v4") {
            throw new InputError(`execute is V4-only. Vault ${v.slug} is kind=${v.kind}. Use: rebalance start/settle`);
        }
        const params = {
            sellToken: resolveToken(v, flags.sell, "sell"),
            buyToken: resolveToken(v, flags.buy, "buy"),
            sellAmount: BigInt(requireUint(flags.sellAmount, "sell-amount")),
            minBuyAmount: BigInt(requireUint(flags.minBuy, "min-buy")),
        };
        if (!flags.confirm) {
            emit({
                dryRun: true,
                action: "executeSwap",
                vault: v.vault,
                handler: v.handler,
                chain: getChainById(v.chainId).slug,
                params: {
                    ...params,
                    sellAmount: params.sellAmount.toString(),
                    minBuyAmount: params.minBuyAmount.toString(),
                },
                note: "Re-run with --confirm to send. Requires PRIVATE_KEY with EXECUTOR_ROLE on the V4 handler. Prefer `vaulto-cli keeper`.",
            }, opts);
            return;
        }
        const hash = await sendExecuteSwap(v, params);
        emit({ action: "executeSwap", vault: v.vault, handler: v.handler, txHash: hash }, opts);
        return;
    }
    throw new InputError(`Unknown rebalance subcommand: ${action}. Use status | start | settle | execute.`);
}
function requireUint(v, label) {
    if (!v)
        throw new InputError(`Missing --${label}.`);
    if (!/^\d+$/.test(v))
        throw new InputError(`--${label} must be a uint256 string, got: ${v}`);
    return v;
}
function nowSecs() {
    return Date.now() / 1000;
}
