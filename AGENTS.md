# vaulto-etf — agent guide

CLI for **Vaulto V2 on-chain basket ETFs**. You (the agent) run it from the shell to inspect
vaults, check/trigger rebalances, deploy new vaults, and run the keeper — across **Base** and
**BNB Chain**. Data is read **directly on-chain via viem** (no backend API).

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

- `BASE_RPC_URL` / `BNB_RPC_URL` — optional; public fallbacks used if unset.
- `PRIVATE_KEY` — **only** for write ops (`rebalance start/settle`, `deploy`). Must hold
  `EXECUTOR_ROLE` for rebalance. Read commands never need it.
- `VAULTO_V2_DIR` — path to a local clone of `github.com/VaultoAI/Vaulto-ETF-V2`. Required only for
  `deploy` and `keeper`.

Verify with `vaulto-etf doctor`.

## Targeting a vault

Global flags `--vault <slug>` and `--chain <slug>` pick the target. Default vault: `vDTF2`.

| Slug | Chain | Composition |
|---|---|---|
| `vDTF2` | base | WETH / USDC |
| `vBNB1` | bnb | USDC / WBNB |
| `vTE1` | bnb | TSLAon / NVDAon (tokenized equities) |

⚠️ On **BNB**, USDC/USDT/DAI are **18 decimals** (not 6). The CLI handles this per-token; never
assume decimals — read them from `vaulto-etf tokens --chain bnb`.

## Commands

| Command | Needs key | What it does |
|---|---|---|
| `vaulto-etf doctor` | no | RPC reachability per chain + config presence. Never prints the key. |
| `vaulto-etf vaults` | no | List all registered vaults + addresses + explorer links. |
| `vaulto-etf tokens [--chain]` | no | Token registry (address, decimals, Chainlink feed). |
| `vaulto-etf state [--vault]` | no | Basket, target/current weights, drift, TVL, share price. |
| `vaulto-etf preview-mint --shares <uint256> [--vault]` | no | Assets + USD to mint N shares. |
| `vaulto-etf preview-redeem --shares <uint256> [--vault]` | no | Assets + USD for redeeming N shares. |
| `vaulto-etf position <0x-addr> [--vault]` | no | A wallet's shares, % of supply, holdings. |
| `vaulto-etf rebalance status [--vault]` | no | needsRebalance / active / drift threshold. |
| `vaulto-etf rebalance start/settle ...` | yes | WRITE on-chain. **Dry-run unless `--confirm`.** |
| `vaulto-etf deploy --script <name> [--chain]` | yes | Build/run the V2 `forge` deploy. **Dry-run unless `--confirm`.** |
| `vaulto-etf keeper <check\|tick\|loop> [--vault]` | yes* | Run the keeper bot. *`check` is a dry run. |
| `vaulto-etf describe` | no | Full schema as JSON. |

`<uint256>` shares use 18 decimals: 1 share = `1000000000000000000`.

## Write operations — read before using

`rebalance start/settle` and `deploy` are **dry-run by default**: they print exactly what they would
do, then exit without sending. Only `--confirm` executes. Never pass `--confirm` without explicit
user intent.

- `rebalance settle` calls `settleRebalance()` on the controller.
- `rebalance start` authorizes a CoW order on-chain — but the order must still be **submitted to the
  CoW API and settled**. That is the keeper's whole job. Prefer `vaulto-etf keeper` over hand-rolling
  a `start`.
- `deploy` runs a `forge script` from `$VAULTO_V2_DIR`. The forge scripts read `PRIVATE_KEY` from the
  environment (`vm.envUint`); the CLI never passes the key on the command line. Without `--broadcast`
  it is a simulation.

## Architecture

Reads use vendored ABIs (`src/abis.ts`) + a chain/vault registry (`src/chains.ts`, `src/vaults.ts`)
+ a viem reader (`src/onchain.ts`). Snapshot math mirrors `Vaulto-ETF-V2/keeper/src/planner.ts`.
`deploy`/`keeper` shell out to the V2 repo at `$VAULTO_V2_DIR`.
