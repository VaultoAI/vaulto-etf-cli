# CLAUDE.md

CLI tool `vaulto-cli` for Vaulto on-chain basket ETFs. **Read [AGENTS.md](./AGENTS.md)** for the
full agent contract (install, mint/redeem flows, vault deposit addresses, flags).

Critical rules:

- JSON stdout; errors JSON on stderr + non-zero exit.
- Install: `npm i -g etf-cli` or `npm i -g github:VaultoAI/vaulto-etf-cli`.
- Writes (`mint`, `redeem`, `approve`, `zap`, rebalance, factory, deploy) are dry-run unless
  `--confirm`. Never pass `--confirm` without user intent.
- Deposit address for multi-asset mint = **vault contract** (approve basket tokens → vault, then
  `depositExactForShares`). RH single-asset = **zapper** + USDG.
- Shares: 18 decimals (`1e18` = 1 share).
- BNB stables are 18 decimals. Vaults: vDTF2, vBNB1, vTE1, vMAG7, vMAG7-RH.

Layout: `src/cli.ts`, `src/spec.ts`, `src/onchain.ts`, `src/commands/*`, `src/vaults.ts`,
`src/chains.ts`, `src/abis.ts`.
