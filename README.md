# vaulto-etf-cli

An agent-first CLI for **Vaulto V2 on-chain basket ETFs**. Built so an AI agent (Claude Code, Codex,
etc.) — or a human — can inspect ETF vaults, check/trigger rebalances, deploy new vaults, and run the
keeper from the shell, across **Base** and **BNB Chain**.

It reads vault data **directly on-chain via viem** from the `RebalanceController` + `BasketVaultV2`
contracts (see [`VaultoAI/Vaulto-ETF-V2`](https://github.com/VaultoAI/Vaulto-ETF-V2)) plus Chainlink
USD feeds. There is no backend API. Write operations (`rebalance`, `deploy`) and the keeper are
opt-in and key-gated.

## Install

```bash
npm install
npm run build
npm link          # optional: puts `vaulto-etf` on your PATH
```

Requires Node 18+.

## Configure

Copy `.env.example` to `.env`:

```bash
BASE_RPC_URL=https://mainnet.base.org        # optional, public fallback used if unset
BNB_RPC_URL=https://bsc-dataseed.binance.org # optional
PRIVATE_KEY=                                 # only for write ops (rebalance/deploy)
VAULTO_V2_DIR=                               # local Vaulto-ETF-V2 clone; only for deploy/keeper
```

Check it works:

```bash
vaulto-etf doctor      # RPC reachability per chain + config presence
```

## Vaults

Pick a target with `--vault <slug>` or `--chain <slug>` (default: `vDTF2`).

| Slug | Chain | Composition |
|---|---|---|
| `vDTF2` | base | WETH / USDC |
| `vBNB1` | bnb | USDC / WBNB |
| `vTE1` | bnb | TSLAon / NVDAon (tokenized equities) |

> ⚠️ On BNB, USDC/USDT/DAI are **18 decimals** (not 6). The CLI reads decimals per-token from the
> registry — `vaulto-etf tokens --chain bnb`.

## Usage

```bash
vaulto-etf vaults                                          # all vaults across chains
vaulto-etf state --vault vDTF2                             # basket, weights, drift, TVL, share price
vaulto-etf preview-mint --shares 1000000000000000000 --vault vBNB1
vaulto-etf position 0xYourAddress --vault vDTF2
vaulto-etf tokens --chain bnb                              # token registry + Chainlink feeds
vaulto-etf rebalance status --vault vDTF2
vaulto-etf describe                                        # full JSON schema
vaulto-etf help
```

Output is JSON by default; add `--human` for tables. See **[AGENTS.md](./AGENTS.md)** for the
agent-facing contract and full command reference.

## Write operations & keeper

`rebalance start/settle` and `deploy` **cost gas / change state**. They are **dry-run by default** and
only execute with `--confirm`.

```bash
# rebalance: status is a read; settle/start write on-chain (need PRIVATE_KEY w/ EXECUTOR_ROLE)
vaulto-etf rebalance settle --vault vDTF2            # dry run — prints what it would send
vaulto-etf rebalance settle --vault vDTF2 --confirm  # actually sends

# deploy a new vault stack via the V2 repo's forge scripts (needs VAULTO_V2_DIR)
vaulto-etf deploy --script DeployV2Base --chain base               # prints the forge command
vaulto-etf deploy --script DeployV2Base --chain base --broadcast --confirm

# keeper: drift monitor + CoW rebalancer (from $VAULTO_V2_DIR/keeper)
vaulto-etf keeper check --vault vDTF2     # dry run, no key
vaulto-etf keeper tick  --vault vDTF2     # one rebalance tick (needs key)
vaulto-etf keeper loop  --vault vDTF2     # run forever
```

`rebalance start` only authorizes a CoW order on-chain — submitting it to the CoW API and settling
is the keeper's job, so prefer `vaulto-etf keeper`.

## Development

```bash
npm run dev -- state --vault vDTF2    # run from source via tsx
npm run typecheck
```

`.reference-v2/` (gitignored) is a clone of `VaultoAI/Vaulto-ETF-V2`, kept as the source of truth for
ABIs, forge scripts, and the keeper.
