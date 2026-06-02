import { resolveVault } from "../vaults.js";
import { snapshotVault } from "../onchain.js";
import { emit, pad, usd, type OutputOpts } from "../output.js";
import type { Selector } from "../cli.js";

/** Live on-chain vault state: basket, weights, drift, TVL, share price. */
export async function state(opts: OutputOpts, sel: Selector): Promise<void> {
  const v = resolveVault(sel);
  const s = await snapshotVault(v);

  emit(s, opts, (d: typeof s) => {
    const lines = [
      `${d.vault.name} (${d.vault.symbol})  [${d.vault.slug} @ ${d.vault.chain}]`,
      `Vault:        ${d.vault.vaultAddress}`,
      `TVL:          ${usd(d.vault.tvlUsd)}`,
      `Supply:       ${d.vault.totalSupply}`,
      `Share price:  ${usd(d.vault.sharePriceUsd)}`,
      `Needs rebal:  ${d.vault.needsRebalance}   Active: ${d.vault.rebalanceActive}`,
      `Drift thresh: ${d.vault.driftThresholdPct.toFixed(2)}%   Min buy: ${d.vault.minBuyRatioPct.toFixed(2)}%`,
      "",
      `${pad("ASSET", 9)}${pad("TARGET", 9)}${pad("CURRENT", 9)}${pad("DRIFT", 9)}${pad("PRICE", 14)}VALUE`,
    ];
    for (const a of d.basket) {
      lines.push(
        pad(a.symbol, 9) +
          pad(a.targetWeightPct.toFixed(1) + "%", 9) +
          pad(a.currentWeightPct.toFixed(1) + "%", 9) +
          pad((a.driftPct >= 0 ? "+" : "") + a.driftPct.toFixed(2) + "%", 9) +
          pad(usd(a.priceUsd), 14) +
          usd(a.valueUsd)
      );
    }
    return lines.join("\n");
  });
}
