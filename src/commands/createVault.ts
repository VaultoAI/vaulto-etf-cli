import { loadConfig, ConfigError } from "../config.js";
import {
  createVault as apiCreateVault,
  SUPPORTED_TOKENS,
  baseScanAddressUrl,
  type CreateVaultAsset,
  type CreateVaultRequest,
} from "../client.js";
import { emit, type OutputOpts } from "../output.js";

export interface CreateVaultArgs {
  name?: string;
  symbol?: string;
  description?: string;
  creator?: string;
  /** Repeatable --asset SYMBOL:BPS, e.g. ["WETH:6000", "USDC:4000"]. */
  asset: string[];
  confirm: boolean;
}

/** Resolve a SYMBOL:BPS pair to a {token,weight}, validating against the allowlist. */
function parseAsset(spec: string): { symbol: string; asset: CreateVaultAsset } {
  const [symbolRaw, bpsRaw] = spec.split(":");
  const symbol = (symbolRaw ?? "").trim().toUpperCase();
  const token = SUPPORTED_TOKENS.find((t) => t.symbol.toUpperCase() === symbol);
  if (!token) {
    throw new ConfigError(
      `Unknown or unsupported asset "${symbolRaw}". Allowed: ${SUPPORTED_TOKENS.map((t) => t.symbol).join(", ")}. ` +
        `Use --asset SYMBOL:BPS (e.g. --asset WETH:6000).`
    );
  }
  const weight = Number(bpsRaw);
  if (!Number.isInteger(weight) || weight <= 0) {
    throw new ConfigError(
      `Invalid weight for ${symbol}: "${bpsRaw}". Must be a positive integer in basis points (bps).`
    );
  }
  return { symbol, asset: { token: token.address, weight } };
}

/**
 * Build + validate a create-vault request. Mirrors the pre-flight checks in
 * the web app's app/api/etf/v2/create-vault/route.ts:
 *  - name, symbol, creator, >=2 assets required
 *  - weights must sum to exactly 10000 bps
 *  - assets sorted by token address ascending (contract requirement)
 */
function buildRequest(args: CreateVaultArgs): CreateVaultRequest {
  if (!args.name?.trim()) throw new ConfigError("--name is required");
  if (!args.symbol?.trim()) throw new ConfigError("--symbol is required");
  if (!args.creator || !/^0x[a-fA-F0-9]{40}$/.test(args.creator)) {
    throw new ConfigError("--creator must be a valid 0x wallet address");
  }
  if (!args.asset || args.asset.length < 2) {
    throw new ConfigError(
      "At least 2 assets required. Use repeated --asset SYMBOL:BPS (e.g. --asset WETH:6000 --asset USDC:4000)."
    );
  }

  const parsed = args.asset.map(parseAsset);
  const sumBps = parsed.reduce((s, p) => s + p.asset.weight, 0);
  if (sumBps !== 10000) {
    throw new ConfigError(
      `Asset weights must sum to exactly 10000 bps (got ${sumBps}).`
    );
  }

  // Contract requires assets sorted by token address ascending.
  const assets = parsed
    .map((p) => p.asset)
    .sort((a, b) => (a.token.toLowerCase() < b.token.toLowerCase() ? -1 : 1));

  return {
    name: args.name.trim(),
    symbol: args.symbol.trim(),
    ...(args.description ? { description: args.description } : {}),
    assets,
    creatorAddress: args.creator,
  };
}

/**
 * create-vault — DEPLOYS REAL CONTRACTS ON BASE MAINNET (costs gas,
 * irreversible). Dry-run by default; requires --confirm to actually send.
 */
export async function createVaultCommand(
  opts: OutputOpts,
  args: CreateVaultArgs
): Promise<void> {
  const request = buildRequest(args);

  if (!args.confirm) {
    emit(
      {
        dryRun: true,
        message:
          "Dry run — nothing sent. This deploys real contracts on Base and costs gas. " +
          "Re-run with --confirm to execute.",
        request,
      },
      opts,
      (d) =>
        [
          "DRY RUN — no request sent.",
          "create-vault deploys real contracts on Base mainnet (costs gas, irreversible).",
          "",
          "Would send:",
          JSON.stringify(d.request, null, 2),
          "",
          "Re-run with --confirm to execute.",
        ].join("\n")
    );
    return;
  }

  const cfg = loadConfig();
  const result = await apiCreateVault(cfg, request);

  emit(result, opts, (r) =>
    [
      `Vault created: ${r.name} (${r.symbol})`,
      `Address:    ${r.vaultAddress}`,
      `Controller: ${r.controllerAddress}`,
      `Handler:    ${r.handlerAddress}`,
      `Explorer:   ${baseScanAddressUrl(r.vaultAddress)}`,
      `Deploy txs: ${r.deployTxHashes.join(", ")}`,
      `Wire txs:   ${r.wireTxHashes.join(", ")}`,
      "",
      `Seed requirements: ${r.seedRequirements.shares} shares, ~${r.seedRequirements.estimatedUsdcCost} USDC (raw)`,
    ].join("\n")
  );
}
