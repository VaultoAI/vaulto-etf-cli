import { privateKeyToAccount } from "viem/accounts";
import { resolveVault } from "../vaults.js";
import { requireSigner } from "../config.js";
import { previewZap, sendZapMint, sendZapRedeem } from "../onchain.js";
import { emit, pad } from "../output.js";
class InputError extends Error {
    code = "INPUT_ERROR";
}
/**
 * zap preview-mint | preview-redeem | mint | redeem
 * Single-asset USDG path via RHZapper (Robinhood Chain vaults).
 */
export async function zap(opts, sel, sub, flags) {
    const v = resolveVault(sel);
    const action = (sub ?? "").toLowerCase();
    if (!action) {
        throw new InputError("Missing zap subcommand. Use preview-mint | preview-redeem | mint | redeem.");
    }
    const shares = parseUint(flags.shares, "shares");
    const zapper = flags.zapper
        ? parseAddr(flags.zapper, "zapper")
        : undefined;
    if (action === "preview-mint" || action === "preview-redeem") {
        const kind = action === "preview-mint" ? "mint" : "redeem";
        const p = await previewZap(v, shares, kind, zapper);
        emit(p, opts, (d) => {
            const lines = [
                `Zap ${d.kind} preview for ${d.shares} shares via ${d.zapper}`,
                `${pad("ASSET", 10)}${pad("AMOUNT", 24)}RAW`,
            ];
            for (const a of d.assets) {
                lines.push(pad(a.symbol, 10) + pad(String(a.amount), 24) + a.amountRaw);
            }
            return lines.join("\n");
        });
        return;
    }
    if (action === "mint") {
        const maxUsdgIn = parseUint(flags.maxUsdgIn, "max-usdg-in");
        const receiver = resolveReceiver(flags.receiver);
        if (!flags.confirm) {
            emit({
                dryRun: true,
                action: "zapMint",
                vault: v.vault,
                zapper: zapper ?? v.zapper,
                shares: shares.toString(),
                maxUsdgIn: maxUsdgIn.toString(),
                receiver,
                note: "Re-run with --confirm to send. Requires PRIVATE_KEY + USDG approval on the zapper.",
            }, opts);
            return;
        }
        const hash = await sendZapMint(v, shares, maxUsdgIn, receiver, zapper);
        emit({ action: "zapMint", vault: v.vault, txHash: hash, shares: shares.toString(), receiver }, opts);
        return;
    }
    if (action === "redeem") {
        const minUsdgOut = parseUint(flags.minUsdgOut, "min-usdg-out");
        const receiver = resolveReceiver(flags.receiver);
        if (!flags.confirm) {
            emit({
                dryRun: true,
                action: "zapRedeem",
                vault: v.vault,
                zapper: zapper ?? v.zapper,
                shares: shares.toString(),
                minUsdgOut: minUsdgOut.toString(),
                receiver,
                note: "Re-run with --confirm to send. Requires PRIVATE_KEY + vault-share approval on the zapper.",
            }, opts);
            return;
        }
        const hash = await sendZapRedeem(v, shares, minUsdgOut, receiver, zapper);
        emit({ action: "zapRedeem", vault: v.vault, txHash: hash, shares: shares.toString(), receiver }, opts);
        return;
    }
    throw new InputError(`Unknown zap subcommand: ${action}. Use preview-mint | preview-redeem | mint | redeem.`);
}
function parseUint(v, label) {
    if (!v)
        throw new InputError(`Missing --${label}.`);
    if (!/^\d+$/.test(v))
        throw new InputError(`--${label} must be a uint256 string, got: ${v}`);
    return BigInt(v);
}
function parseAddr(v, label) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(v))
        throw new InputError(`Invalid --${label} address: ${v}`);
    return v;
}
function resolveReceiver(explicit) {
    if (explicit)
        return parseAddr(explicit, "receiver");
    // Default to the signer when writing; for dry-run without a key use zero address marker.
    try {
        return privateKeyToAccount(requireSigner()).address;
    }
    catch {
        throw new InputError("Missing --receiver (or set PRIVATE_KEY so the signer is used as receiver).");
    }
}
