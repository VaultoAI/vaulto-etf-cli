import { privateKeyToAccount } from "viem/accounts";
import { resolveVault } from "../vaults.js";
import { requireSigner, hasSigner } from "../config.js";
import { previewShares, sendApproveBasket, sendMint, walletBasketBalances, MAX_UINT256, } from "../onchain.js";
import { emit, pad, usd } from "../output.js";
class InputError extends Error {
    code = "INPUT_ERROR";
}
/**
 * Mint vault shares by depositing proportional basket tokens.
 *
 * Flow for agents:
 *   1. vaulto-etf preview-mint --shares N --vault X
 *   2. vaulto-etf balances --shares N --vault X   (check wallet funding + allowances)
 *   3. vaulto-etf mint --shares N --vault X --approve --confirm
 *
 * Caller must hold every basket asset. --approve sets infinite ERC-20 allowance
 * on the vault for each asset first.
 */
export async function mint(opts, sel, flags) {
    const v = resolveVault(sel);
    const shares = parseUint(flags.shares, "shares");
    const receiver = resolveReceiver(flags.receiver);
    const preview = await previewShares(v, shares, "mint");
    const signer = hasSigner() ? privateKeyToAccount(requireSigner()).address : undefined;
    if (!flags.confirm) {
        const balances = signer !== undefined
            ? await walletBasketBalances(v, signer, shares)
            : null;
        emit({
            dryRun: true,
            action: "depositExactForShares",
            vault: v.vault,
            vaultSlug: v.slug,
            chainId: v.chainId,
            shares: shares.toString(),
            receiver,
            depositTo: v.vault,
            note: "Deposit EACH listed asset to the vault address (via approve + depositExactForShares). " +
                "Re-run with --confirm to send. Add --approve to infinite-approve basket tokens first. " +
                "On RH with USDG, prefer: vaulto-etf zap mint (single-asset).",
            assetsRequired: preview.assets.map((a) => ({
                symbol: a.symbol,
                token: a.token,
                amountRaw: a.amountRaw,
                amount: a.amount,
                valueUsd: a.valueUsd,
                approveSpender: v.vault,
            })),
            totalValueUsd: preview.totalValueUsd,
            wallet: balances,
            willApprove: flags.approve,
        }, opts, (d) => {
            const lines = [
                `Mint ${d.shares} shares of ${d.vaultSlug}`,
                `Deposit to vault: ${d.depositTo}`,
                `Receiver:         ${d.receiver}`,
                `Total value:      ${usd(d.totalValueUsd)}`,
                "",
                `${pad("ASSET", 10)}${pad("AMOUNT", 22)}APPROVE → VAULT`,
            ];
            for (const a of d.assetsRequired) {
                lines.push(pad(a.symbol, 10) + pad(String(a.amount), 22) + a.token);
            }
            lines.push("", "Dry run — re-run with --confirm" + (d.willApprove ? " --approve" : "") + " to execute.");
            if (d.wallet) {
                lines.push("", `Wallet funded: ${d.wallet.allFunded}   All approved: ${d.wallet.allApproved}`);
            }
            return lines.join("\n");
        });
        return;
    }
    // Live path requires signer
    requireSigner();
    const approveTxs = [];
    if (flags.approve) {
        const minAmounts = preview.assets.map((a) => BigInt(a.amountRaw));
        const res = await sendApproveBasket(v, v.vault, {
            amount: MAX_UINT256,
            skipIfSufficient: true,
            minAmounts,
        });
        approveTxs.push(...res);
    }
    const txHash = await sendMint(v, shares, receiver);
    emit({
        action: "depositExactForShares",
        vault: v.vault,
        vaultSlug: v.slug,
        shares: shares.toString(),
        receiver,
        txHash,
        approvals: approveTxs,
        assetsRequired: preview.assets.map((a) => ({
            symbol: a.symbol,
            token: a.token,
            amountRaw: a.amountRaw,
        })),
    }, opts);
}
function parseUint(v, label) {
    if (!v)
        throw new InputError(`Missing --${label}.`);
    if (!/^\d+$/.test(v))
        throw new InputError(`--${label} must be a uint256 string, got: ${v}`);
    return BigInt(v);
}
function resolveReceiver(explicit) {
    if (explicit) {
        if (!/^0x[0-9a-fA-F]{40}$/.test(explicit))
            throw new InputError(`Invalid --receiver: ${explicit}`);
        return explicit;
    }
    if (!hasSigner()) {
        throw new InputError("Missing --receiver (or set PRIVATE_KEY so the signer receives shares).");
    }
    return privateKeyToAccount(requireSigner()).address;
}
