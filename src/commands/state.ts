import { loadConfig } from "../config.js";
import { fetchVaultState, fetchRawVault } from "../client.js";
import { emit, pad, usd, type OutputOpts } from "../output.js";

/** Merged /vault + /state: basket, weights, drift, TVL, share price. */
export async function state(opts: OutputOpts): Promise<void> {
  const cfg = loadConfig();
  const data = await fetchVaultState(cfg);

  emit(data, opts, (d) => {
    const lines = [
      `${d.vault.name} (${d.vault.symbol})  ${d.vault.vaultAddress}`,
      `TVL: ${usd(d.vault.tvlUsd)}   Share price: ${usd(d.sharePriceUsd)}   Max drift: ${d.vault.maxDriftPct.toFixed(2)}%`,
      `Needs rebalance: ${d.vault.needsRebalance ? "YES" : "no"}   Paused: ${d.vault.paused ? "YES" : "no"}`,
      "",
      `${pad("ASSET", 8)}${pad("TARGET%", 10)}${pad("CURRENT%", 10)}${pad("DRIFT%", 10)}${pad("PRICE", 14)}VALUE`,
    ];
    for (const a of d.basket) {
      lines.push(
        pad(a.symbol, 8) +
          pad(a.targetWeightPct.toFixed(2), 10) +
          pad(a.currentWeightPct.toFixed(2), 10) +
          pad(a.driftPct.toFixed(2), 10) +
          pad(usd(a.priceUsd), 14) +
          usd(a.valueUsd)
      );
    }
    return lines.join("\n");
  });
}

/** Raw upstream /vault metadata. */
export async function vault(opts: OutputOpts): Promise<void> {
  const cfg = loadConfig();
  const data = await fetchRawVault(cfg);
  emit(data, opts);
}
