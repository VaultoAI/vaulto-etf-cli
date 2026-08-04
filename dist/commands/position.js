import { resolveVault } from "../vaults.js";
import { userPosition } from "../onchain.js";
import { emit, pad, usd } from "../output.js";
class InputError extends Error {
    code = "INPUT_ERROR";
}
export async function position(opts, sel, address) {
    if (!address)
        throw new InputError("Missing address argument. Usage: vaulto-etf position 0x...");
    if (!/^0x[0-9a-fA-F]{40}$/.test(address))
        throw new InputError(`Invalid 0x address: ${address}`);
    const v = resolveVault(sel);
    const p = await userPosition(v, address);
    emit(p, opts, (d) => {
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
