import { resolveVault } from "../vaults.js";
import { previewShares, type PreviewResult } from "../onchain.js";
import { emit, pad, usd, type OutputOpts } from "../output.js";
import type { Selector } from "../cli.js";

class InputError extends Error {
  code = "INPUT_ERROR";
}

function parseShares(shares: string | undefined): bigint {
  if (!shares) throw new InputError("Missing --shares. Provide a uint256 (18 decimals).");
  if (!/^\d+$/.test(shares)) throw new InputError(`--shares must be a non-negative integer string, got: ${shares}`);
  return BigInt(shares);
}

function render(d: PreviewResult): string {
  const verb = d.kind === "mint" ? "needed to mint" : "returned for redeeming";
  const lines = [`Assets ${verb} ${d.shares} shares:`, `${pad("ASSET", 9)}${pad("AMOUNT", 22)}VALUE`];
  for (const a of d.assets) {
    lines.push(pad(a.symbol, 9) + pad(String(a.amount), 22) + usd(a.valueUsd));
  }
  lines.push("", `Total: ${usd(d.totalValueUsd)}`);
  return lines.join("\n");
}

export async function previewMint(opts: OutputOpts, sel: Selector, shares: string | undefined): Promise<void> {
  const v = resolveVault(sel);
  const result = await previewShares(v, parseShares(shares), "mint");
  emit(result, opts, render);
}

export async function previewRedeem(opts: OutputOpts, sel: Selector, shares: string | undefined): Promise<void> {
  const v = resolveVault(sel);
  const result = await previewShares(v, parseShares(shares), "redeem");
  emit(result, opts, render);
}
