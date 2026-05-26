import { SUPPORTED_TOKENS } from "../client.js";
import { emit, pad, type OutputOpts } from "../output.js";

/** Print the create-vault asset allowlist. No backend call, no token needed. */
export async function tokens(opts: OutputOpts): Promise<void> {
  emit([...SUPPORTED_TOKENS], opts, (list: typeof SUPPORTED_TOKENS) => {
    const lines = [`${pad("SYMBOL", 8)}${pad("DECIMALS", 10)}ADDRESS`];
    for (const t of list) {
      lines.push(pad(t.symbol, 8) + pad(t.decimals, 10) + t.address);
    }
    lines.push("", "Note: v1 allowlist is WETH + USDC only.");
    return lines.join("\n");
  });
}
