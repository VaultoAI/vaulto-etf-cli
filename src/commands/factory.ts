import type { Address } from "viem";
import { getChainBySlug, findTokenBySymbol } from "../chains.js";
import {
  listFactoryDeployments,
  listFactoryWhitelist,
  sendCreateEtf,
  type CreateEtfParams,
} from "../onchain.js";
import { emit, pad, type OutputOpts } from "../output.js";
import type { Selector } from "../cli.js";

class InputError extends Error {
  code = "INPUT_ERROR";
}

export interface FactoryFlags {
  name?: string;
  symbol?: string;
  /** Comma-separated symbols or 0x addresses. */
  tokens?: string;
  /** Comma-separated 1e18-scaled weights (must sum to 1e18). */
  weights?: string;
  /** Target USD per share as 1e18-scaled uint (default 10e18 = $10). */
  targetShareValue?: string;
  /** Drift threshold 1e18-scaled (default 0.05e18). */
  driftThreshold?: string;
  /** Min buy ratio 1e18-scaled (default 0.94e18). */
  minBuyRatio?: string;
  /** Staleness seconds (default 172800 = 2d). */
  priceStaleness?: string;
  confirm: boolean;
}

/**
 * factory list | whitelist | create
 * Operates on the RH VaultFactoryV3 (chain 4663) unless --chain overrides.
 */
export async function factory(
  opts: OutputOpts,
  sel: Selector,
  sub: string | undefined,
  flags: FactoryFlags
): Promise<void> {
  const chainSlug = (sel.chain ?? "rh").toLowerCase();
  const chain = getChainBySlug(chainSlug);
  if (!chain.protocol?.factory) {
    throw new InputError(
      `No VaultFactoryV3 on chain ${chain.slug}. Factory is currently deployed on --chain rh only.`
    );
  }

  const action = (sub ?? "list").toLowerCase();

  if (action === "list") {
    const rows = await listFactoryDeployments(chain.id);
    emit(
      {
        chain: chain.slug,
        chainId: chain.id,
        factory: chain.protocol.factory,
        count: rows.length,
        deployments: rows,
      },
      opts,
      (d) => {
        const lines = [
          `Factory ${d.factory} on ${d.chain} — ${d.count} deployment(s)`,
          `${pad("#", 4)}${pad("VAULT", 44)}${pad("HANDLER", 44)}ZAPPER`,
        ];
        for (const r of d.deployments) {
          lines.push(pad(String(r.index), 4) + pad(r.vault, 44) + pad(r.handler, 44) + r.zapper);
        }
        return lines.join("\n");
      }
    );
    return;
  }

  if (action === "whitelist") {
    const entries = await listFactoryWhitelist(chain.id);
    emit(
      {
        chain: chain.slug,
        chainId: chain.id,
        factory: chain.protocol.factory,
        count: entries.length,
        tokens: entries,
      },
      opts,
      (d) => {
        const lines = [
          `Whitelist on ${d.chain} (${d.count} tokens)`,
          `${pad("SYMBOL", 8)}${pad("DEC", 5)}ADDRESS`,
        ];
        for (const t of d.tokens) {
          lines.push(pad(t.symbol, 8) + pad(t.decimals, 5) + t.token);
        }
        return lines.join("\n");
      }
    );
    return;
  }

  if (action === "create") {
    const params = buildCreateParams(chain.id, flags);
    if (!flags.confirm) {
      emit(
        {
          dryRun: true,
          action: "createETF",
          chain: chain.slug,
          factory: chain.protocol.factory,
          params: {
            ...params,
            tokens: params.tokens,
            weights: params.weights.map((w) => w.toString()),
            targetShareValueUsd: params.targetShareValueUsd.toString(),
            driftThreshold: params.driftThreshold.toString(),
            minBuyRatio: params.minBuyRatio.toString(),
            priceStalenessLimit: params.priceStalenessLimit.toString(),
          },
          note: "Re-run with --confirm to send. Requires PRIVATE_KEY. Creates vault+handler+zapper atomically.",
        },
        opts
      );
      return;
    }
    const result = await sendCreateEtf(chain.id, params);
    emit({ action: "createETF", chain: chain.slug, factory: chain.protocol.factory, ...result }, opts);
    return;
  }

  throw new InputError(`Unknown factory subcommand: ${action}. Use list | whitelist | create.`);
}

function buildCreateParams(chainId: number, flags: FactoryFlags): CreateEtfParams {
  if (!flags.name) throw new InputError("Missing --name.");
  if (!flags.symbol) throw new InputError("Missing --symbol.");
  if (!flags.tokens) throw new InputError("Missing --tokens (comma-separated symbols or 0x addresses).");
  if (!flags.weights) throw new InputError("Missing --weights (comma-separated 1e18-scaled uints summing to 1e18).");

  const tokenRefs = flags.tokens.split(",").map((s) => s.trim()).filter(Boolean);
  const weightStrs = flags.weights.split(",").map((s) => s.trim()).filter(Boolean);
  if (tokenRefs.length < 2) throw new InputError("--tokens needs at least 2 assets.");
  if (tokenRefs.length !== weightStrs.length) {
    throw new InputError(`--tokens (${tokenRefs.length}) and --weights (${weightStrs.length}) length mismatch.`);
  }

  const tokens: Address[] = tokenRefs.map((ref) => {
    if (/^0x[0-9a-fA-F]{40}$/.test(ref)) return ref as Address;
    const t = findTokenBySymbol(chainId, ref);
    if (!t) throw new InputError(`Unknown token "${ref}" on chain ${chainId}.`);
    return t.address as Address;
  });

  const weights = weightStrs.map((w) => {
    if (!/^\d+$/.test(w)) throw new InputError(`Bad weight "${w}" — must be uint256 string.`);
    return BigInt(w);
  });
  const sum = weights.reduce((a, b) => a + b, 0n);
  if (sum !== 10n ** 18n) {
    throw new InputError(`Weights must sum to exactly 1e18 (1000000000000000000). Got ${sum.toString()}.`);
  }

  return {
    name: flags.name,
    symbol: flags.symbol,
    tokens,
    weights,
    targetShareValueUsd: BigInt(flags.targetShareValue ?? "10000000000000000000"), // $10
    driftThreshold: BigInt(flags.driftThreshold ?? "50000000000000000"), // 5%
    minBuyRatio: BigInt(flags.minBuyRatio ?? "940000000000000000"), // 94%
    priceStalenessLimit: BigInt(flags.priceStaleness ?? "172800"), // 2 days
  };
}
