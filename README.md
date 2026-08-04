# vaulto-etf-cli

**Agent-first CLI** for Vaulto on-chain basket ETFs
([DavidVaulto/ETFs](https://github.com/DavidVaulto/ETFs)).

Mint and redeem shares, check balances, zap USDG on Robinhood Chain, rebalance,
create ETFs via the factory, deploy, and run keepers — across **Base**, **BNB**,
and **Robinhood Chain**. No backend API; all reads/writes are on-chain (viem).

> Full agent contract, vault addresses, and mint/redeem recipes:
> **[AGENTS.md](./AGENTS.md)** (also shipped in the npm package).

## Install

```bash
# npm (when published)
npm install -g vaulto-etf-cli

# from GitHub
npm install -g github:VaultoAI/vaulto-etf-cli

# one-shot
npx github:VaultoAI/vaulto-etf-cli doctor
```

Requires Node 18+.

```bash
vaulto-etf doctor
vaulto-etf describe    # machine schema
vaulto-etf vaults      # deposit addresses
```

## Configure

Optional `.env`:

```bash
BASE_RPC_URL=…          # optional public fallbacks
BNB_RPC_URL=…
RH_RPC_URL=…
PRIVATE_KEY=0x…         # only for writes (mint/redeem/approve/…)
VAULTO_V2_DIR=…         # only for deploy + keeper
```

## Quick agent recipes

### Mint shares (deposit)

```bash
vaulto-etf preview-mint --shares 1000000000000000000 --vault vMAG7
vaulto-etf balances --shares 1000000000000000000 --vault vMAG7
vaulto-etf mint --shares 1000000000000000000 --vault vMAG7 --approve          # dry-run
vaulto-etf mint --shares 1000000000000000000 --vault vMAG7 --approve --confirm
```

RH single-asset (USDG):

```bash
vaulto-etf approve --token USDG --spender zapper --vault vMAG7-RH --confirm
vaulto-etf zap mint --shares 1000000000000000000 --max-usdg-in 30000000 \
  --vault vMAG7-RH --confirm
```

### Sell shares (redeem)

```bash
vaulto-etf preview-redeem --shares 1000000000000000000 --vault vMAG7
vaulto-etf redeem --shares 1000000000000000000 --vault vMAG7 --confirm
```

### Inspect

```bash
vaulto-etf state --vault vMAG7-RH --human
vaulto-etf rebalance status --vault vMAG7
vaulto-etf factory list --chain rh
```

Writes are **dry-run unless `--confirm`**. Default output is **JSON** for agents;
add `--human` for tables.

## Vaults

| Slug | Chain | Composition |
|---|---|---|
| `vDTF2` | base | WETH / USDC |
| `vBNB1` | bnb | USDC / WBNB |
| `vTE1` | bnb | TSLAon / NVDAon |
| `vMAG7` | bnb | Mag7 Ondo stocks |
| `vMAG7-RH` | rh | Mag7 RH stocks + zapper |

⚠️ BNB USDC/USDT/DAI use **18 decimals**.

## Development

```bash
git clone https://github.com/VaultoAI/vaulto-etf-cli.git
cd vaulto-etf-cli
npm install && npm run build && npm link
npm run typecheck
```

## License

MIT
