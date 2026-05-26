# CLAUDE.md

This repo is a CLI tool, `vaulto-etf`, for the Vaulto basket-ETF backend.

**The full agent reference lives in [AGENTS.md](./AGENTS.md) — read it.** It covers the command
surface, the JSON/stderr/exit-code contract, setup, and env vars.

Critical rules:

- Output is JSON on stdout; errors are JSON on stderr with a non-zero exit. Branch on exit code.
- `BASKET_ETF_API_TOKEN` is required for every command except `tokens` and `describe`.
- `create-vault` **deploys real contracts on Base mainnet (costs gas, irreversible)**. It is a
  dry run unless you pass `--confirm`. Never pass `--confirm` without explicit user intent.
- Run `vaulto-etf describe` for the machine-readable schema.

Source layout: `src/cli.ts` (dispatch), `src/client.ts` (backend client, ported from the web
app's `lib/vaulto-api/basket-etf.ts`), `src/commands/*`, `src/spec.ts` (single source of truth for
the command schema — update it when adding a command).
