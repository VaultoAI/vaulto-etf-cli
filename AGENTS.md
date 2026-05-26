# vaulto-etf — agent guide

CLI for the Vaulto on-chain **basket ETF** backend. You (the agent) run it from the shell to
inspect vaults and create new ETFs. No browser, no wallet UI.

## Contract for agents

- **Output is JSON on stdout** by default — parse it directly. Add `--human` only for display.
- **Errors are JSON on stderr** (`{"error","code"}`) and the process **exits non-zero**. Branch on
  exit code.
- **No interactive prompts.** Every input is a flag/argument. Missing input → error, never a prompt.
- Run `vaulto-etf describe` to get the full command/flag schema as JSON.

## Setup

```bash
# one-time, from the repo root
npm install && npm run build && npm link    # exposes `vaulto-etf` on PATH
```

Env (or a `.env` file — see `.env.example`):

- `BASKET_ETF_API_TOKEN` — **required** for every command except `tokens` and `describe`.
- `BASKET_ETF_API_URL` — optional; defaults to the production backend.

Verify with `vaulto-etf doctor`.

## Commands

| Command | Needs token | What it does |
|---|---|---|
| `vaulto-etf doctor` | no | Config + reachability check. Never prints the token. |
| `vaulto-etf state` | yes | Vault basket, target/current weights, drift, TVL, share price. |
| `vaulto-etf vault` | yes | Raw upstream vault metadata. |
| `vaulto-etf preview-mint --shares <uint256>` | yes | Assets + USD to mint N shares. |
| `vaulto-etf preview-redeem --shares <uint256>` | yes | Assets + USD returned for N shares. |
| `vaulto-etf position <0x-addr>` | yes | A wallet's shares, % of supply, holdings. |
| `vaulto-etf tokens` | no | Allowlist for `create-vault` (currently WETH + USDC). |
| `vaulto-etf create-vault ...` | yes | Create an ETF. **Dry-run unless `--confirm`.** |
| `vaulto-etf describe` | no | Full schema as JSON. |

`<uint256>` shares use 18 decimals: 1 share = `1000000000000000000`.

## create-vault — read this before using

`create-vault` **deploys real contracts on Base mainnet. It costs gas and is irreversible.**

It is a **dry run by default**: it validates and prints the exact payload it would send, then
exits without calling the backend. Only `--confirm` actually executes.

```bash
# dry run — safe, sends nothing
vaulto-etf create-vault \
  --name "My ETF" --symbol vMINE \
  --asset WETH:6000 --asset USDC:4000 \
  --creator 0xYourWalletAddress

# real deploy
vaulto-etf create-vault ... --confirm
```

Rules (validated locally before any network call):
- `--asset SYMBOL:BPS`, repeated. Weights are basis points and **must sum to 10000**.
- At least 2 assets. Symbols must be in the allowlist (`vaulto-etf tokens`).
- `--creator` must be a valid `0x` address (stored as metadata only — no signing happens here).
- Assets are auto-sorted by token address ascending (a contract requirement).

## Not included

`zap-deposit` / `zap-redeem` (buying/selling into a vault) are intentionally **out of scope** —
they require an on-chain `approve` signed by a private key. This tool never holds a key.
