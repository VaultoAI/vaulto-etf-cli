import type { Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { resolveVault } from "../vaults.js";
import { hasSigner, requireSigner } from "../config.js";
import { walletBasketBalances } from "../onchain.js";
import { emit, pad, type OutputOpts } from "../output.js";
import type { Selector } from "../cli.js";

class InputError extends Error {
  code = "INPUT_ERROR";
}

/**
 * Show a wallet's basket-token balances + allowances toward the vault.
 * With --shares N, also shows amounts needed to mint and whether funded/approved.
 *
 *   vaulto-cli balances --vault vMAG7
 *   vaulto-cli balances 0xYou --shares 1000000000000000000 --vault vDTF2
 */
export async function balances(
  opts: OutputOpts,
  sel: Selector,
  addressArg: string | undefined,
  sharesFlag: string | undefined
): Promise<void> {
  const v = resolveVault(sel);
  let address: Address;
  if (addressArg) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(addressArg)) {
      throw new InputError(`Invalid address: ${addressArg}`);
    }
    address = addressArg as Address;
  } else if (hasSigner()) {
    address = privateKeyToAccount(requireSigner()).address;
  } else {
    throw new InputError(
      "Provide a wallet address or set PRIVATE_KEY. Usage: vaulto-cli balances [0x…] [--shares N] --vault X"
    );
  }

  const shares = sharesFlag ? parseUint(sharesFlag) : undefined;
  const b = await walletBasketBalances(v, address, shares);

  emit(b, opts, (d) => {
    const lines = [
      `Wallet ${d.address}`,
      `Vault  ${d.vaultSlug}  spender=${d.spender}`,
      d.shares ? `Mint target: ${d.shares} shares` : null,
      `All funded: ${d.allFunded}   All approved: ${d.allApproved}`,
      "",
      pad("ASSET", 10) +
        pad("BALANCE", 16) +
        pad("ALLOWANCE", 16) +
        (d.shares ? pad("NEEDED", 16) + "OK?" : ""),
    ].filter((x): x is string => x !== null);
    for (const t of d.tokens) {
      let row = pad(t.symbol, 10) + pad(String(t.balance), 16) + pad(String(t.allowanceToVault), 16);
      if (d.shares) {
        row += pad(String(t.neededForMint ?? 0), 16) + (t.enoughForMint ? "yes" : "NO");
      }
      lines.push(row);
    }
    return lines.join("\n");
  });
}

function parseUint(v: string): bigint {
  if (!/^\d+$/.test(v)) throw new InputError(`--shares must be a uint256 string, got: ${v}`);
  return BigInt(v);
}
