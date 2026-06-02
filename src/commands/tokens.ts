import { getChainBySlug, CHAINS, type ChainInfo } from "../chains.js";
import { emit, pad, type OutputOpts } from "../output.js";
import type { Selector } from "../cli.js";

/** Token registry for a chain (or all chains). No chain calls. */
export async function tokens(opts: OutputOpts, sel: Selector): Promise<void> {
  const chains: ChainInfo[] = sel.chain ? [getChainBySlug(sel.chain)] : [...CHAINS];

  const result = chains.map((c) => ({
    chain: c.slug,
    chainId: c.id,
    tokens: c.tokens.map((t) => ({
      symbol: t.symbol,
      name: t.name,
      address: t.address,
      decimals: t.decimals,
      feed: t.feed,
    })),
  }));

  emit(result, opts, (rows: typeof result) => {
    const lines: string[] = [];
    for (const c of rows) {
      lines.push(`# ${c.chain} (${c.chainId})`);
      lines.push(`${pad("SYMBOL", 9)}${pad("DEC", 5)}ADDRESS`);
      for (const t of c.tokens) {
        lines.push(pad(t.symbol, 9) + pad(t.decimals, 5) + t.address);
      }
      lines.push("");
    }
    return lines.join("\n").trimEnd();
  });
}
