import type { Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { resolveVault } from "../vaults.js";
import { requireSigner, hasSigner } from "../config.js";
import { previewShares, sendRedeem, userPosition } from "../onchain.js";
import { emit, pad, usd, type OutputOpts } from "../output.js";
import type { Selector } from "../cli.js";

class InputError extends Error {
  code = "INPUT_ERROR";
}

export interface RedeemFlags {
  shares?: string;
  receiver?: string;
  confirm: boolean;
}

/**
 * Sell (redeem) vault shares for pro-rata basket tokens.
 *
 * Shares are burned from the signer — no ERC-20 approve of the vault share
 * token is needed for direct redeem (unlike zap redeem).
 *
 * Flow:
 *   1. vaulto-cli position <addr> --vault X
 *   2. vaulto-cli preview-redeem --shares N --vault X
 *   3. vaulto-cli redeem --shares N --vault X --confirm
 *
 * On RH with USDG out, prefer: vaulto-cli zap redeem.
 */
export async function redeemCmd(opts: OutputOpts, sel: Selector, flags: RedeemFlags): Promise<void> {
  const v = resolveVault(sel);
  const shares = parseUint(flags.shares, "shares");
  const receiver = resolveReceiver(flags.receiver);
  const preview = await previewShares(v, shares, "redeem");

  let holderPosition = null;
  if (hasSigner()) {
    const addr = privateKeyToAccount(requireSigner()).address;
    holderPosition = await userPosition(v, addr);
  }

  if (!flags.confirm) {
    emit(
      {
        dryRun: true,
        action: "redeem",
        vault: v.vault,
        vaultSlug: v.slug,
        chainId: v.chainId,
        shares: shares.toString(),
        receiver,
        note:
          "Burns shares from the signer and sends basket tokens to --receiver. " +
          "Re-run with --confirm to send. No token approvals needed for direct redeem. " +
          "For single-asset USDG on RH: vaulto-cli zap redeem.",
        assetsReturned: preview.assets.map((a) => ({
          symbol: a.symbol,
          token: a.token,
          amountRaw: a.amountRaw,
          amount: a.amount,
          valueUsd: a.valueUsd,
        })),
        totalValueUsd: preview.totalValueUsd,
        signerShares: holderPosition
          ? { sharesRaw: holderPosition.sharesRaw, shares: holderPosition.shares }
          : null,
      },
      opts,
      (d) => {
        const lines = [
          `Redeem ${d.shares} shares of ${d.vaultSlug}`,
          `Vault:     ${d.vault}`,
          `Receiver:  ${d.receiver}`,
          `Value out: ${usd(d.totalValueUsd)}`,
          "",
          `${pad("ASSET", 10)}${pad("AMOUNT", 22)}VALUE`,
        ];
        for (const a of d.assetsReturned) {
          lines.push(pad(a.symbol, 10) + pad(String(a.amount), 22) + usd(a.valueUsd));
        }
        lines.push("", "Dry run — re-run with --confirm to execute.");
        return lines.join("\n");
      }
    );
    return;
  }

  requireSigner();
  if (holderPosition && BigInt(holderPosition.sharesRaw) < shares) {
    throw new InputError(
      `Signer holds only ${holderPosition.sharesRaw} shares, cannot redeem ${shares.toString()}.`
    );
  }
  const txHash = await sendRedeem(v, shares, receiver);
  emit(
    {
      action: "redeem",
      vault: v.vault,
      vaultSlug: v.slug,
      shares: shares.toString(),
      receiver,
      txHash,
      assetsReturned: preview.assets.map((a) => ({
        symbol: a.symbol,
        token: a.token,
        amountRaw: a.amountRaw,
      })),
    },
    opts
  );
}

function parseUint(v: string | undefined, label: string): bigint {
  if (!v) throw new InputError(`Missing --${label}.`);
  if (!/^\d+$/.test(v)) throw new InputError(`--${label} must be a uint256 string, got: ${v}`);
  return BigInt(v);
}

function resolveReceiver(explicit?: string): Address {
  if (explicit) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(explicit)) throw new InputError(`Invalid --receiver: ${explicit}`);
    return explicit as Address;
  }
  if (!hasSigner()) {
    throw new InputError("Missing --receiver (or set PRIVATE_KEY so the signer receives assets).");
  }
  return privateKeyToAccount(requireSigner()).address;
}
