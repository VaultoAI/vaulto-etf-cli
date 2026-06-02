import { resolveVault, type VaultInfo } from "../vaults.js";
import { getChainById } from "../chains.js";
import {
  rebalanceStatus,
  sendSettleRebalance,
  sendStartRebalance,
  type StartRebalanceParams,
} from "../onchain.js";
import { emit, type OutputOpts } from "../output.js";
import type { Selector } from "../cli.js";
import type { Address } from "viem";

/** CoW canonical empty appData hash (keccak256("{}")). */
const EMPTY_APP_DATA_HASH = "0xb48d38f93eaa084033fc5970bf96e559c33c4cdc07d889ab00b4d63f9590739d" as const;

class InputError extends Error {
  code = "INPUT_ERROR";
}

export interface RebalanceFlags {
  sell?: string;
  buy?: string;
  sellAmount?: string;
  minBuy?: string;
  validFor?: string;
  confirm: boolean;
}

/** Resolve a token symbol or 0x address to an address on the vault's chain. */
function resolveToken(v: VaultInfo, ref: string | undefined, label: string): Address {
  if (!ref) throw new InputError(`Missing --${label}.`);
  if (/^0x[0-9a-fA-F]{40}$/.test(ref)) return ref as Address;
  const bySymbol = getChainById(v.chainId).tokens.find(
    (x) => x.symbol.toLowerCase() === ref.toLowerCase()
  );
  if (bySymbol) return bySymbol.address as Address;
  throw new InputError(`Unknown token "${ref}" on chain ${v.chainId}. Use a symbol or 0x address.`);
}

export async function rebalance(
  opts: OutputOpts,
  sel: Selector,
  sub: string | undefined,
  flags: RebalanceFlags
): Promise<void> {
  const v = resolveVault(sel);
  const action = (sub ?? "status").toLowerCase();

  if (action === "status") {
    const s = await rebalanceStatus(v);
    emit(s, opts, (d: typeof s) =>
      [
        `Vault:        ${d.vault}`,
        `Needs rebal:  ${d.needsRebalance}`,
        `Active:       ${d.rebalanceActive}`,
        `Nonce:        ${d.rebalanceNonce}`,
        `Drift thresh: ${d.driftThresholdPct.toFixed(2)}%`,
        `Min buy:      ${d.minBuyRatioPct.toFixed(2)}%`,
        d.active
          ? `Active order: sell ${d.active.sellAmount} ${d.active.sellToken} -> >=${d.active.minBuyAmount} ${d.active.buyToken} (validTo ${d.active.validTo})`
          : "Active order: none",
      ].join("\n")
    );
    return;
  }

  if (action === "settle") {
    if (!flags.confirm) {
      emit(
        { dryRun: true, action: "settleRebalance", vault: v.vault, controller: v.controller, note: "Re-run with --confirm to send. Requires PRIVATE_KEY with EXECUTOR_ROLE." },
        opts
      );
      return;
    }
    const hash = await sendSettleRebalance(v);
    emit({ action: "settleRebalance", vault: v.vault, txHash: hash }, opts);
    return;
  }

  if (action === "start") {
    const params: StartRebalanceParams = {
      sellToken: resolveToken(v, flags.sell, "sell"),
      buyToken: resolveToken(v, flags.buy, "buy"),
      sellAmount: BigInt(requireUint(flags.sellAmount, "sell-amount")),
      minBuyAmount: BigInt(requireUint(flags.minBuy, "min-buy")),
      validTo: Math.floor(nowSecs() + Number(flags.validFor ?? 1800)),
      appData: EMPTY_APP_DATA_HASH,
    };
    if (!flags.confirm) {
      emit(
        {
          dryRun: true,
          action: "startRebalance",
          vault: v.vault,
          controller: v.controller,
          params: { ...params, sellAmount: params.sellAmount.toString(), minBuyAmount: params.minBuyAmount.toString() },
          note: "Re-run with --confirm to send. NOTE: authorizing on-chain is not enough — the CoW order must also be submitted to the CoW API and settled. Prefer `vaulto-etf keeper`.",
        },
        opts
      );
      return;
    }
    const hash = await sendStartRebalance(v, params);
    emit({ action: "startRebalance", vault: v.vault, txHash: hash }, opts);
    return;
  }

  throw new InputError(`Unknown rebalance subcommand: ${action}. Use status | start | settle.`);
}

function requireUint(v: string | undefined, label: string): string {
  if (!v) throw new InputError(`Missing --${label}.`);
  if (!/^\d+$/.test(v)) throw new InputError(`--${label} must be a uint256 string, got: ${v}`);
  return v;
}

// validTo must be a future unix timestamp; Date is fine here (CLI is short-lived).
function nowSecs(): number {
  return Date.now() / 1000;
}
