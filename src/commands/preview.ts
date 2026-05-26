import { loadConfig } from "../config.js";
import {
  fetchPreviewMint,
  fetchPreviewRedeem,
  type PreviewMintResponse,
} from "../client.js";
import { ConfigError } from "../config.js";
import { emit, pad, usd, type OutputOpts } from "../output.js";

function requireShares(shares: string | undefined): string {
  if (!shares || !/^\d+$/.test(shares)) {
    throw new ConfigError(
      "--shares is required and must be a uint256 string (18 decimals). " +
        "e.g. 1 share = 1000000000000000000"
    );
  }
  return shares;
}

function render(d: PreviewMintResponse): string {
  const lines = [
    `Shares: ${d.shares}   Total value: ${usd(d.totalValueUsd)}   USDC equiv (raw): ${d.usdcEquivalentRaw}`,
    "",
    `${pad("TOKEN", 8)}${pad("AMOUNT", 22)}${pad("PRICE", 14)}`,
  ];
  for (const a of d.assets) {
    lines.push(
      pad(a.symbol, 8) +
        pad(a.amountFormatted ?? a.amount, 22) +
        pad(a.priceUsd != null ? usd(a.priceUsd) : "-", 14)
    );
  }
  return lines.join("\n");
}

export async function previewMint(
  opts: OutputOpts,
  shares: string | undefined
): Promise<void> {
  const validShares = requireShares(shares);
  const cfg = loadConfig();
  const data = await fetchPreviewMint(cfg, validShares);
  emit(data, opts, render);
}

export async function previewRedeem(
  opts: OutputOpts,
  shares: string | undefined
): Promise<void> {
  const validShares = requireShares(shares);
  const cfg = loadConfig();
  const data = await fetchPreviewRedeem(cfg, validShares);
  emit(data, opts, render);
}
