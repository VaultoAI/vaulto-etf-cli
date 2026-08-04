import { configDebug } from "../config.js";
import { CHAINS } from "../chains.js";
import { getPublicClient } from "../onchain.js";
import { emit } from "../output.js";
/** Verify RPC reachability per chain + config presence (never leaks the key). */
export async function doctor(opts) {
    const cfg = configDebug();
    const chains = await Promise.all(CHAINS.map(async (c) => {
        try {
            const block = await getPublicClient(c.id).getBlockNumber();
            return { chain: c.slug, chainId: c.id, reachable: true, blockNumber: block.toString(), error: null };
        }
        catch (e) {
            return {
                chain: c.slug,
                chainId: c.id,
                reachable: false,
                blockNumber: null,
                error: e instanceof Error ? e.message : String(e),
            };
        }
    }));
    const allReachable = chains.every((c) => c.reachable);
    const result = {
        chains,
        signerConfigured: cfg.signerConfigured,
        v2DirConfigured: cfg.v2DirConfigured,
        v2Dir: cfg.v2Dir,
        ok: allReachable,
    };
    emit(result, opts, (r) => [
        "RPC reachability:",
        ...r.chains.map((c) => `  ${c.chain.padEnd(6)} ${c.reachable ? `OK (block ${c.blockNumber})` : `FAIL: ${c.error}`}`),
        `Signer (PRIVATE_KEY): ${r.signerConfigured ? "configured" : "not set"}`,
        `VAULTO_V2_DIR:        ${r.v2DirConfigured ? r.v2Dir : "not set"}`,
        `Status:               ${r.ok ? "OK" : "DEGRADED"}`,
    ].join("\n"));
}
