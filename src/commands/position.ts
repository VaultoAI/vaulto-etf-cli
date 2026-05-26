import { loadConfig, ConfigError } from "../config.js";
import { fetchUserPosition } from "../client.js";
import { emit, pad, usd, type OutputOpts } from "../output.js";

/** User position in the vault: shares, %, underlying holdings. */
export async function position(
  opts: OutputOpts,
  address: string | undefined
): Promise<void> {
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new ConfigError(
      "A wallet address is required: vaulto-etf position <0x-address>"
    );
  }
  const cfg = loadConfig();
  const data = await fetchUserPosition(cfg, address);

  emit(data, opts, (d) => {
    const lines = [
      `Address: ${d.userAddress}`,
      `Shares: ${d.sharesFormatted} (${d.sharePercent.toFixed(4)}% of supply)   Value: ${usd(d.totalValueUsd)}`,
      "",
      `${pad("TOKEN", 8)}${pad("AMOUNT", 22)}VALUE`,
    ];
    for (const u of d.underlying) {
      lines.push(pad(u.symbol, 8) + pad(u.amount, 22) + usd(u.valueUsd));
    }
    return lines.join("\n");
  });
}
