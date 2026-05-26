import { COMMANDS, GLOBAL_FLAGS } from "../spec.js";
import { getApiUrl } from "../config.js";
import { emit, type OutputOpts } from "../output.js";

/** Emit the full command schema as JSON so an agent can discover the tool. */
export async function describe(opts: OutputOpts): Promise<void> {
  emit(
    {
      tool: "vaulto-etf",
      description:
        "Agent CLI for the Vaulto on-chain basket ETF backend. Reads vault state and creates ETFs.",
      apiUrl: getApiUrl(),
      env: {
        BASKET_ETF_API_URL: "Backend base URL (optional; defaults to production).",
        BASKET_ETF_API_TOKEN: "Backend API key. Required for all commands except 'tokens'/'describe'.",
      },
      output: {
        default: "JSON to stdout",
        humanFlag: "--human",
        errors: "JSON to stderr with non-zero exit code",
      },
      globalFlags: GLOBAL_FLAGS,
      commands: COMMANDS,
    },
    { ...opts, human: false }
  );
}
