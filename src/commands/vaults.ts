import { VAULTS } from "../vaults.js";
import { getChainById, explorerAddrUrl } from "../chains.js";
import { emit, pad, type OutputOpts } from "../output.js";

/** List every registered vault across chains. No chain calls. */
export async function vaultsCmd(opts: OutputOpts): Promise<void> {
  const list = VAULTS.map((v) => {
    const chain = getChainById(v.chainId);
    return {
      slug: v.slug,
      name: v.name,
      chain: chain.slug,
      chainId: v.chainId,
      vault: v.vault,
      controller: v.controller,
      handler: v.handler,
      note: v.note ?? null,
      explorer: explorerAddrUrl(v.chainId, v.vault),
    };
  });

  emit(list, opts, (rows: typeof list) => {
    const lines = [`${pad("SLUG", 8)}${pad("CHAIN", 7)}${pad("NAME", 24)}VAULT`];
    for (const r of rows) {
      lines.push(pad(r.slug, 8) + pad(r.chain, 7) + pad(r.name, 24) + r.vault);
      if (r.note) lines.push(`        ${r.note}`);
    }
    return lines.join("\n");
  });
}
