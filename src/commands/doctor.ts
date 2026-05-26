import { configDebug, getApiUrl } from "../config.js";
import { fetchRawVault } from "../client.js";
import { emit, type OutputOpts } from "../output.js";

/** Verify config + backend reachability without leaking the token. */
export async function doctor(opts: OutputOpts): Promise<void> {
  const cfg = configDebug();
  let reachable = false;
  let vaultName: string | null = null;
  let reachError: string | null = null;

  if (cfg.tokenConfigured) {
    try {
      const v = await fetchRawVault({ apiUrl: getApiUrl(), apiToken: process.env.BASKET_ETF_API_TOKEN! });
      reachable = true;
      vaultName = v.name;
    } catch (e) {
      reachError = e instanceof Error ? e.message : String(e);
    }
  }

  const result = {
    apiUrl: cfg.apiUrl,
    tokenConfigured: cfg.tokenConfigured,
    tokenLength: cfg.tokenLength,
    backendReachable: reachable,
    sampleVaultName: vaultName,
    error: reachError,
    ok: cfg.tokenConfigured && reachable,
  };

  emit(result, opts, (r) =>
    [
      `API URL:           ${r.apiUrl}`,
      `Token configured:  ${r.tokenConfigured ? `yes (${r.tokenLength} chars)` : "NO"}`,
      `Backend reachable: ${r.backendReachable ? "yes" : "no"}`,
      r.sampleVaultName ? `Sample vault:      ${r.sampleVaultName}` : null,
      r.error ? `Error:             ${r.error}` : null,
      `Status:            ${r.ok ? "OK" : "NOT READY"}`,
    ]
      .filter(Boolean)
      .join("\n")
  );
}
