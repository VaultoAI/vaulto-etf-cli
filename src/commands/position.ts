import { resolveVault } from "../vaults.js";
import { userPosition } from "../onchain.js";
import { emit, pad, usd, type OutputOpts } from "../output.js";
import type { Selector } from "../cli.js";
import type { Address } from "viem";

class InputError extends Error {
  code = "INPUT_ERROR";
}

export async function position(opts: OutputOpts, sel: Selector, address: string | undefined): Promise<void> {
  if (!address) throw new InputError("Missing address argument. Usage: vaulto-cli position 0x...");
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new InputError(`Invalid 0x address: ${address}`);

  const v = resolveVault(sel);
  const p = await userPosition(v, address as Address);

  emit(p, opts, (d: typeof p) => {
    const lines = [
      `Position of ${d.address}`,
      `Vault:    ${d.vault}`,
      `Shares:   ${d.shares} (${d.sharePercent.toFixed(4)}% of supply)`,
      `Value:    ${usd(d.totalValueUsd)}`,
      "",
      `${pad("ASSET", 9)}${pad("AMOUNT", 22)}VALUE`,
    ];
    for (const u of d.underlying) {
      lines.push(pad(u.symbol, 9) + pad(String(u.amount), 22) + usd(u.valueUsd));
    }
    return lines.join("\n");
  });
}
