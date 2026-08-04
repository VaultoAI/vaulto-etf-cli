import type { Address } from "viem";
import { resolveVault } from "../vaults.js";
import { requireSigner } from "../config.js";
import { findTokenBySymbol, getChainById } from "../chains.js";
import {
  previewShares,
  sendApprove,
  sendApproveBasket,
  sendApproveShares,
  MAX_UINT256,
} from "../onchain.js";
import { emit, type OutputOpts } from "../output.js";
import type { Selector } from "../cli.js";

class InputError extends Error {
  code = "INPUT_ERROR";
}

export interface ApproveFlags {
  /** Token symbol or 0x address. Omit with --all for every basket asset. */
  token?: string;
  /** Spender: vault (default) | zapper | 0x address. */
  spender?: string;
  /** Approve amount as uint256. Default: max uint256. */
  amount?: string;
  /** Approve all basket tokens to spender. */
  all: boolean;
  /** Approve vault share token (needed for zap redeem). */
  shareToken: boolean;
  /** Optional shares qty to size min allowances for --all. */
  forShares?: string;
  confirm: boolean;
}

/**
 * Approve ERC-20 spending for vault deposits or zapper flows.
 *
 *   vaulto-etf approve --all --vault vMAG7 --confirm
 *   vaulto-etf approve --token USDC --vault vDTF2 --confirm
 *   vaulto-etf approve --token USDG --spender zapper --vault vMAG7-RH --confirm
 *   vaulto-etf approve --share-token --spender zapper --vault vMAG7-RH --confirm
 */
export async function approve(opts: OutputOpts, sel: Selector, flags: ApproveFlags): Promise<void> {
  const v = resolveVault(sel);
  const amount = flags.amount ? parseUint(flags.amount, "amount") : MAX_UINT256;
  const spender = resolveSpender(v, flags.spender);

  if (flags.shareToken) {
    if (!flags.confirm) {
      emit(
        {
          dryRun: true,
          action: "approveShares",
          token: v.vault,
          symbol: "vault-shares",
          spender,
          amount: amount.toString(),
          note: "Re-run with --confirm to approve vault shares for the spender (needed for zap redeem).",
        },
        opts
      );
      return;
    }
    requireSigner();
    const txHash = await sendApproveShares(v, spender, amount);
    emit({ action: "approveShares", token: v.vault, spender, amount: amount.toString(), txHash }, opts);
    return;
  }

  if (flags.all) {
    let minAmounts: bigint[] | undefined;
    if (flags.forShares) {
      const preview = await previewShares(v, parseUint(flags.forShares, "for-shares"), "mint");
      minAmounts = preview.assets.map((a) => BigInt(a.amountRaw));
    }
    if (!flags.confirm) {
      emit(
        {
          dryRun: true,
          action: "approveBasket",
          vault: v.vault,
          vaultSlug: v.slug,
          spender,
          amount: amount.toString(),
          forShares: flags.forShares ?? null,
          note: "Re-run with --confirm to approve every basket token for the spender.",
        },
        opts
      );
      return;
    }
    requireSigner();
    const results = await sendApproveBasket(v, spender, {
      amount,
      skipIfSufficient: true,
      minAmounts,
    });
    emit({ action: "approveBasket", vault: v.vault, spender, results }, opts);
    return;
  }

  if (!flags.token) {
    throw new InputError("Provide --token <symbol|0x> or --all or --share-token.");
  }
  const token = resolveToken(v.chainId, flags.token);
  if (!flags.confirm) {
    emit(
      {
        dryRun: true,
        action: "approve",
        token,
        spender,
        amount: amount.toString(),
        vault: v.vault,
        note: "Re-run with --confirm to send approve(spender, amount).",
      },
      opts
    );
    return;
  }
  requireSigner();
  const txHash = await sendApprove(v.chainId, token, spender, amount);
  emit({ action: "approve", token, spender, amount: amount.toString(), txHash }, opts);
}

function resolveSpender(v: ReturnType<typeof resolveVault>, ref?: string): Address {
  if (!ref || ref === "vault") return v.vault as Address;
  if (ref === "zapper") {
    if (!v.zapper) throw new InputError(`Vault ${v.slug} has no zapper. Use --spender vault or a 0x address.`);
    return v.zapper as Address;
  }
  if (/^0x[0-9a-fA-F]{40}$/.test(ref)) return ref as Address;
  throw new InputError(`Invalid --spender: ${ref}. Use vault | zapper | 0x address.`);
}

function resolveToken(chainId: number, ref: string): Address {
  if (/^0x[0-9a-fA-F]{40}$/.test(ref)) return ref as Address;
  const t = findTokenBySymbol(chainId, ref);
  if (t) return t.address as Address;
  throw new InputError(
    `Unknown token "${ref}" on chain ${chainId}. Known: ${getChainById(chainId)
      .tokens.map((x) => x.symbol)
      .join(", ")}.`
  );
}

function parseUint(v: string, label: string): bigint {
  if (!/^\d+$/.test(v)) throw new InputError(`--${label} must be a uint256 string, got: ${v}`);
  return BigInt(v);
}
