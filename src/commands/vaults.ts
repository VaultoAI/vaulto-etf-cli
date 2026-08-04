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
      kind: v.kind,
      vault: v.vault,
      controller: v.controller || null,
      handler: v.handler,
      zapper: v.zapper ?? null,
      note: v.note ?? null,
      explorer: explorerAddrUrl(v.chainId, v.vault),
    };
  });

  emit(list, opts, (rows: typeof list) => {
    const lines = [`${pad("SLUG", 10)}${pad("CHAIN", 6)}${pad("KIND", 5)}${pad("NAME", 26)}VAULT`];
    for (const r of rows) {
      lines.push(pad(r.slug, 10) + pad(r.chain, 6) + pad(r.kind, 5) + pad(r.name, 26) + r.vault);
      if (r.note) lines.push(`          ${r.note}`);
    }
    return lines.join("\n");
  });
}
