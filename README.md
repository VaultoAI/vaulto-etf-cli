# @vaulto/etf-cli

**Agent-first CLI** for Vaulto on-chain basket ETFs
([DavidVaulto/ETFs](https://github.com/DavidVaulto/ETFs)).

Mint and redeem shares, check balances, zap USDG on Robinhood Chain, rebalance,
create ETFs via the factory, deploy, and run keepers — across **Base**, **BNB**,
and **Robinhood Chain**. No backend API; all reads/writes are on-chain (viem).

> Full agent contract, vault addresses, and mint/redeem recipes:
> **[AGENTS.md](./AGENTS.md)** (also shipped in the npm package).

## Install

```bash
# scoped package (preferred)
npm install -g @vaulto/etf-cli

# one-shot
npx @vaulto/etf-cli doctor

# from GitHub if not yet on the registry
npm install -g github:VaultoAI/vaulto-etf-cli
```

Requires Node 18+. After install the binary is **`vaulto-cli`**.

```bash
vaulto-cli doctor
vaulto-cli describe    # machine schema
vaulto-cli vaults      # deposit addresses
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
vaulto-cli preview-mint --shares 1000000000000000000 --vault vMAG7
vaulto-cli balances --shares 1000000000000000000 --vault vMAG7
vaulto-cli mint --shares 1000000000000000000 --vault vMAG7 --approve          # dry-run
vaulto-cli mint --shares 1000000000000000000 --vault vMAG7 --approve --confirm
```

RH single-asset (USDG):

```bash
vaulto-cli approve --token USDG --spender zapper --vault vMAG7-RH --confirm
vaulto-cli zap mint --shares 1000000000000000000 --max-usdg-in 30000000 \
  --vault vMAG7-RH --confirm
```

### Sell shares (redeem)

```bash
vaulto-cli preview-redeem --shares 1000000000000000000 --vault vMAG7
vaulto-cli redeem --shares 1000000000000000000 --vault vMAG7 --confirm
```

### Inspect

```bash
vaulto-cli state --vault vMAG7-RH --human
vaulto-cli rebalance status --vault vMAG7
vaulto-cli factory list --chain rh
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
