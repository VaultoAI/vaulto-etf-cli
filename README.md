# vaulto-etf-cli

An agent-first CLI for the Vaulto on-chain **basket ETF** backend
(`vaulto-api-etf`). Built so an AI agent (Claude Code, Codex, etc.) — or a human — can inspect
ETF vaults and create new ones from the shell, without the web app.

It re-implements the typed API client from the Vaulto web app
(`lib/vaulto-api/basket-etf.ts`) as a thin standalone tool. The actual logic — contract
deployment, swaps, rebalancing — runs in the backend; this CLI just calls it.

## Install

```bash
npm install
npm run build
npm link          # optional: puts `vaulto-etf` on your PATH
```

Requires Node 18+ (uses native `fetch`).

## Configure

Copy `.env.example` to `.env` and set:

```bash
BASKET_ETF_API_URL=https://vaulto-api-etf-production.up.railway.app   # optional, this is the default
BASKET_ETF_API_TOKEN=<your backend api key>                          # required
```

`BASKET_ETF_API_TOKEN` is required for everything except `tokens` and `describe`.

Check it works:

```bash
vaulto-etf doctor
```

## Usage

```bash
vaulto-etf state                                   # vault basket, weights, drift, TVL
vaulto-etf preview-mint --shares 1000000000000000000
vaulto-etf position 0xYourAddress
vaulto-etf tokens                                  # asset allowlist
vaulto-etf describe                                # full JSON schema
vaulto-etf help
```

Output is JSON by default; add `--human` for tables. See **[AGENTS.md](./AGENTS.md)** for the
agent-facing contract and the full command reference.

### Creating a vault

`create-vault` deploys real contracts on Base mainnet (costs gas, irreversible). It is a **dry run
by default** and only executes with `--confirm`:

```bash
vaulto-etf create-vault \
  --name "My ETF" --symbol vMINE \
  --asset WETH:6000 --asset USDC:4000 \
  --creator 0xYourWalletAddress
# ...review the printed payload, then add --confirm
```

## Scope

- **Reads:** `state`, `vault`, `preview-mint`, `preview-redeem`, `position`, `tokens`.
- **Write:** `create-vault` (no wallet signing needed — server-side deploy).
- **Out of scope:** `zap-deposit` / `zap-redeem` need an on-chain `approve` signed by a private
  key; this tool never holds one.

## Development

```bash
npm run dev -- state          # run from source via tsx
npm run typecheck
```

`.reference-etf/` (gitignored) is a shallow clone of `DavidVaulto/ETF@feature/build-etf`, kept
only as a reference for the upstream API shapes.
