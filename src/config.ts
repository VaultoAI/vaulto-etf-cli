/**
 * Configuration — env loading + validation.
 *
 * Mirrors the validation pattern from the web app's lib/vaulto-api/config.ts,
 * but adapted for a standalone CLI. No secrets are ever printed.
 */

import "dotenv/config";

const ENV_URL = "BASKET_ETF_API_URL";
const ENV_TOKEN = "BASKET_ETF_API_TOKEN";

/** Production basket-ETF backend — used when BASKET_ETF_API_URL is unset. */
export const DEFAULT_API_URL =
  "https://vaulto-api-etf-production.up.railway.app";

export interface Config {
  apiUrl: string;
  apiToken: string;
}

export class ConfigError extends Error {
  code = "CONFIG_ERROR";
}

/** Resolve the API base URL (env or default). Always present. */
export function getApiUrl(): string {
  return (process.env[ENV_URL] || DEFAULT_API_URL).replace(/\/+$/, "");
}

/**
 * Resolve the API token. Throws ConfigError if missing — callers for
 * token-requiring commands should let this propagate to the error handler.
 */
export function requireToken(): string {
  const token = process.env[ENV_TOKEN];
  if (!token) {
    throw new ConfigError(
      `Missing ${ENV_TOKEN}. Set it in your environment or a .env file ` +
        `(see .env.example). Required for all commands except 'tokens' and 'describe'.`
    );
  }
  return token;
}

/** Full config for commands that hit the backend. */
export function loadConfig(): Config {
  return { apiUrl: getApiUrl(), apiToken: requireToken() };
}

/** Non-secret view of config state, for `doctor`. */
export function configDebug(): {
  apiUrl: string;
  tokenConfigured: boolean;
  tokenLength: number;
} {
  const token = process.env[ENV_TOKEN] || "";
  return {
    apiUrl: getApiUrl(),
    tokenConfigured: !!token,
    tokenLength: token.length,
  };
}
