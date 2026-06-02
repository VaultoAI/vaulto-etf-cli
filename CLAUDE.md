# CLAUDE.md

This repo is a CLI tool, `vaulto-etf`, for **Vaulto V2 on-chain basket ETFs**. It reads vault data
directly on-chain (viem) across Base + BNB Chain — there is no backend API.

**The full agent reference lives in [AGENTS.md](./AGENTS.md) — read it.** It covers the command
surface, the JSON/stderr/exit-code contract, setup, env vars, and the vault registry.

Critical rules:

- Output is JSON on stdout; errors are JSON on stderr with a non-zero exit. Branch on exit code.
- Reads need no key. `PRIVATE_KEY` is only for write ops (`rebalance start/settle`, `deploy`).
- `--vault <slug>` / `--chain <slug>` pick the target (default `vDTF2`). Vaults: `vDTF2` (base),
  `vBNB1`/`vTE1` (bnb).
- ⚠️ BNB stablecoins (USDC/USDT/DAI) are **18 decimals**, not 6 — never assume; the registry holds
  the truth.
- `rebalance start/settle` and `deploy` **write on-chain / cost gas**. They are dry-run unless
  `--confirm`. Never pass `--confirm` without explicit user intent.
- Run `vaulto-etf describe` for the machine-readable schema.

Source layout:
- `src/cli.ts` — dispatch + flag parser (global `--vault`/`--chain`).
- `src/chains.ts` — chain registry (RPC, tokens, decimals, Chainlink feeds).
- `src/vaults.ts` — vault registry (vDTF2/vBNB1/vTE1 → vault/controller/handler addresses).
- `src/abis.ts` — vendored contract ABIs (from `Vaulto-ETF-V2/keeper/src/abis.ts` + vault ABI).
- `src/onchain.ts` — viem reader + writers (replaces the old HTTP client).
- `src/config.ts` — env loading (RPC, PRIVATE_KEY, VAULTO_V2_DIR).
- `src/commands/*` — one file per command.
- `src/spec.ts` — single source of truth for the command schema; update it when adding a command.

`deploy`/`keeper` shell out to a local clone of `VaultoAI/Vaulto-ETF-V2` at `$VAULTO_V2_DIR`.
