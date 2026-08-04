# vaulto-cli — agent guide

Agent-first CLI for **Vaulto on-chain basket ETFs**
([DavidVaulto/ETFs](https://github.com/DavidVaulto/ETFs) contracts).

You run shell commands. Output is machine-readable JSON. No prompts. No backend API —
everything is **on-chain via viem** (Base, BNB Chain, Robinhood Chain).

---

## Install (first step)

Package: **`@vaultoai/etf-cli`** (VaultoAI · GitHub Packages)  
Binary: **`vaulto-cli`**  
Repo is **public**: https://github.com/VaultoAI/vaulto-etf-cli

```bash
# Easiest (public repo, no registry auth)
npm install -g github:VaultoAI/vaulto-etf-cli
vaulto-cli doctor

# Or from GitHub Packages (needs a GitHub token with read:packages)
echo "@vaultoai:registry=https://npm.pkg.github.com" >> ~/.npmrc
echo "//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN" >> ~/.npmrc
npm install -g @vaultoai/etf-cli
```

```bash
vaulto-cli doctor      # RPC + config check
vaulto-cli describe    # FULL command schema as JSON — read this first if unsure
vaulto-cli vaults      # every registered ETF + deposit addresses
```

Optional env (`.env` or process env):

| Var | Required for | Notes |
|---|---|---|
| `PRIVATE_KEY` | mint, redeem, approve, zap writes, rebalance writes, factory create, deploy | `0x` + 64 hex. **Never print it.** |
| `BASE_RPC_URL` / `BNB_RPC_URL` / `RH_RPC_URL` | optional | Public fallbacks if unset |
| `VAULTO_V2_DIR` | `deploy`, `keeper` only | Local clone of DavidVaulto/ETFs |

---

## Contract for agents

| Rule | Detail |
|---|---|
| Success | JSON on **stdout**, exit **0** |
| Failure | JSON on **stderr** `{"error","code"}`, exit **non-zero** |
| Human mode | `--human` (optional; default is JSON) |
| No prompts | Missing flags → error, never a question |
| Writes | **Dry-run by default**. Only `--confirm` sends a tx |
| Schema | `vaulto-cli describe` |

Shares are **18 decimals**: `1 share = 1000000000000000000`.

---

## Vaults (deposit addresses)

| Slug | Chain | Kind | Deposit (vault) | Notes |
|---|---|---|---|---|
| `vDTF2` | base | cow | `0x8CD6c14127D398a27fe9b387BC76761A2B9a37dA` | WETH + USDC |
| `vBNB1` | bnb | cow | `0xA51254cC25360e8F04Eebee6d5579348BF0570a8` | USDC + WBNB (USDC is **18 dec** on BNB) |
| `vTE1` | bnb | cow | `0x5e4Ed5C26Aa626c750A98a7aCc8475D962eeCC88` | TSLAon + NVDAon |
| `vMAG7` | bnb | cow | `0x765ce7c25e561c2695741fcf245594f1497198a3` | Mag7 Ondo stocks |
| `vMAG7-RH` | rh | v4 | `0x9f1BbE4a60D5311E2Eff35Db384A7aA82D7Cdbb3` | Mag7 RH stocks + **zapper** `0x0fA89eEc…` |

Always re-check with `vaulto-cli vaults` (source of truth in the CLI registry).

Target: `--vault <slug>` or `--chain <slug>` (default vault: `vDTF2`).

---

## User flows you must support

### A. Mint shares (deposit basket → get shares)

Multi-asset path (all vaults):

```bash
# 1) How much of each asset is required?
vaulto-cli preview-mint --shares 1000000000000000000 --vault vMAG7

# 2) Does the wallet hold enough + have allowances?
vaulto-cli balances --shares 1000000000000000000 --vault vMAG7
# (uses PRIVATE_KEY address, or pass 0x… as first arg)

# 3) Dry-run mint (shows deposit address = vault + each token amount)
vaulto-cli mint --shares 1000000000000000000 --vault vMAG7 --approve

# 4) Execute: approve basket tokens to vault, then depositExactForShares
vaulto-cli mint --shares 1000000000000000000 --vault vMAG7 --approve --confirm
```

**What “deposit” means:** caller must hold each basket ERC-20, **approve the vault** as spender, then call `depositExactForShares(shares, receiver)`. The CLI does that. Tokens go **to the vault contract**, not to an EOA treasury.

RH single-asset path (USDG only) — preferred on `vMAG7-RH`:

```bash
vaulto-cli zap preview-mint --shares 1000000000000000000 --vault vMAG7-RH
vaulto-cli approve --token USDG --spender zapper --vault vMAG7-RH --confirm
vaulto-cli zap mint --shares 1000000000000000000 --max-usdg-in 30000000 --vault vMAG7-RH --confirm
```

### B. Sell / redeem shares (burn shares → get assets back)

```bash
vaulto-cli position 0xWALLET --vault vMAG7
vaulto-cli preview-redeem --shares 1000000000000000000 --vault vMAG7
vaulto-cli redeem --shares 1000000000000000000 --vault vMAG7          # dry-run
vaulto-cli redeem --shares 1000000000000000000 --vault vMAG7 --confirm
```

Direct redeem burns shares from the **signer** and sends basket tokens to `--receiver` (default: signer). **No approve** needed.

RH single-asset USDG out:

```bash
vaulto-cli approve --share-token --spender zapper --vault vMAG7-RH --confirm
vaulto-cli zap redeem --shares 1000000000000000000 --min-usdg-out 1 --vault vMAG7-RH --confirm
```

### C. Inspect any ETF

```bash
vaulto-cli state --vault vMAG7-RH          # TVL, weights, drift, share price
vaulto-cli rebalance status --vault vMAG7
vaulto-cli tokens --chain rh
vaulto-cli factory list --chain rh         # permissionless ETFs on RH
```

---

## Write safety

Every state-changing command is **dry-run unless `--confirm`**:

- `mint`, `redeem`, `approve`
- `zap mint|redeem`
- `rebalance start|settle|execute`
- `factory create`
- `deploy`

Never pass `--confirm` without explicit user intent to spend gas / move funds.

---

## Command map

| Command | Key? | Purpose |
|---|---|---|
| `doctor` | no | RPC reachability + config |
| `describe` | no | Full schema JSON |
| `vaults` | no | Registry + vault deposit addresses |
| `tokens` | no | Token decimals + feeds |
| `state` | no | Live basket / TVL / drift |
| `preview-mint` / `preview-redeem` | no | Asset amounts for N shares |
| `position <0x>` | no | Wallet share holdings |
| `balances [0x]` | no* | Wallet funding + allowances (*key if no addr) |
| `approve` | yes | ERC-20 approve for vault/zapper |
| `mint` | yes | Deposit basket → mint shares |
| `redeem` | yes | Burn shares → basket tokens |
| `zap …` | yes* | RH USDG mint/redeem (*preview is read) |
| `rebalance …` | yes* | status / start / settle / execute |
| `factory …` | yes* | list / whitelist / create |
| `deploy` | yes | forge scripts from VAULTO_V2_DIR |
| `keeper` | yes* | check / tick / loop |

---

## Architecture notes

- **cow** vaults: BasketVaultV2 + RebalanceController + CoW (Base/BNB).
- **v4** vaults: BasketVaultV3 + UniswapV4RebalanceHandler (RH); optional RHZapper.
- BNB USDC/USDT/DAI are **18 decimals**, not 6 — never assume; use `tokens` / preview output.
- Keeper: Base CoW + RH V4 supported; BNB CoW keeper not wired in upstream bot.

Source: vendored ABIs + chain/vault registry + viem. `deploy`/`keeper` shell out to `$VAULTO_V2_DIR`.
