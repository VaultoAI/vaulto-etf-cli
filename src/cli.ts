#!/usr/bin/env node
/**
 * vaulto-cli — agent-first CLI for Vaulto on-chain basket ETFs
 * (DavidVaulto/ETFs: Base + BNB + Robinhood Chain).
 *
 * Reads vault data directly on-chain (viem). Design for agents: JSON stdout by
 * default, no interactive prompts, errors to stderr as JSON with a non-zero
 * exit code. `describe` dumps the schema.
 */

import { COMMANDS, GLOBAL_FLAGS } from "./spec.js";
import { fail, type OutputOpts } from "./output.js";
import { doctor } from "./commands/doctor.js";
import { vaultsCmd } from "./commands/vaults.js";
import { tokens } from "./commands/tokens.js";
import { state } from "./commands/state.js";
import { previewMint, previewRedeem } from "./commands/preview.js";
import { position } from "./commands/position.js";
import { rebalance } from "./commands/rebalance.js";
import { factory } from "./commands/factory.js";
import { zap } from "./commands/zap.js";
import { mint } from "./commands/mint.js";
import { redeemCmd } from "./commands/redeem.js";
import { approve } from "./commands/approve.js";
import { balances } from "./commands/balances.js";
import { deploy } from "./commands/deploy.js";
import { keeper } from "./commands/keeper.js";
import { describe } from "./commands/describe.js";

/** Optional vault/chain selector, parsed from global flags. */
export interface Selector {
  vault?: string;
  chain?: string;
}

interface ParsedArgs {
  positional: string[];
  flags: Record<string, string | boolean | string[]>;
}

/** Minimal flag parser. `--flag value` or `--flag=value`; bare `--flag` = true. */
function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string | boolean | string[]> = {};
  const valueFlags = new Set<string>(["vault", "chain"]);
  const repeatable = new Set<string>();
  for (const c of COMMANDS) {
    for (const f of c.flags ?? []) {
      const key = f.name.replace(/^--/, "");
      if (f.takesValue) valueFlags.add(key);
      if (f.repeatable) repeatable.add(key);
    }
  }
  for (const f of GLOBAL_FLAGS) {
    if (f.takesValue) valueFlags.add(f.name.replace(/^--/, ""));
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      let key = arg.slice(2);
      let value: string | undefined;
      const eq = key.indexOf("=");
      if (eq !== -1) {
        value = key.slice(eq + 1);
        key = key.slice(0, eq);
      } else if (valueFlags.has(key)) {
        value = argv[++i];
      }
      if (value === undefined) {
        flags[key] = true;
      } else if (repeatable.has(key)) {
        const prev = flags[key];
        flags[key] = Array.isArray(prev) ? [...prev, value] : [value];
      } else {
        flags[key] = value;
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function str(v: string | boolean | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function printHelp(): void {
  const lines = [
    "vaulto-cli — agent CLI for Vaulto on-chain basket ETFs (Base + BNB + Robinhood)",
    "",
    "Usage: vaulto-cli <command> [--vault <slug>] [--chain <slug>] [flags]",
    "",
    "Commands:",
  ];
  const w = Math.max(...COMMANDS.map((c) => c.name.length)) + 2;
  for (const c of COMMANDS) {
    lines.push(`  ${c.name.padEnd(w)}${c.summary}`);
  }
  lines.push("", "Global flags:");
  const gw = Math.max(...GLOBAL_FLAGS.map((f) => f.name.length)) + 2;
  for (const f of GLOBAL_FLAGS) {
    lines.push(`  ${f.name.padEnd(gw)}${f.description}`);
  }
  lines.push("", "Run `vaulto-cli describe` for the full JSON schema.");
  process.stdout.write(lines.join("\n") + "\n");
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const command = argv[0];

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  const { positional, flags } = parseArgs(argv.slice(1));
  const opts: OutputOpts = { human: flags["human"] === true && flags["json"] !== true };
  const sel: Selector = { vault: str(flags["vault"]), chain: str(flags["chain"]) };

  if (flags["help"] === true) {
    printHelp();
    return;
  }

  switch (command) {
    case "doctor":
      return doctor(opts);
    case "vaults":
      return vaultsCmd(opts);
    case "tokens":
      return tokens(opts, sel);
    case "state":
      return state(opts, sel);
    case "preview-mint":
      return previewMint(opts, sel, str(flags["shares"]));
    case "preview-redeem":
      return previewRedeem(opts, sel, str(flags["shares"]));
    case "position":
      return position(opts, sel, positional[0]);
    case "rebalance":
      return rebalance(opts, sel, positional[0], {
        sell: str(flags["sell"]),
        buy: str(flags["buy"]),
        sellAmount: str(flags["sell-amount"]),
        minBuy: str(flags["min-buy"]),
        validFor: str(flags["valid-for"]),
        confirm: flags["confirm"] === true,
      });
    case "factory":
      return factory(opts, sel, positional[0], {
        name: str(flags["name"]),
        symbol: str(flags["symbol"]),
        tokens: str(flags["tokens"]),
        weights: str(flags["weights"]),
        targetShareValue: str(flags["target-share-value"]),
        driftThreshold: str(flags["drift-threshold"]),
        minBuyRatio: str(flags["min-buy-ratio"]),
        priceStaleness: str(flags["price-staleness"]),
        confirm: flags["confirm"] === true,
      });
    case "zap":
      return zap(opts, sel, positional[0], {
        shares: str(flags["shares"]),
        maxUsdgIn: str(flags["max-usdg-in"]),
        minUsdgOut: str(flags["min-usdg-out"]),
        receiver: str(flags["receiver"]),
        zapper: str(flags["zapper"]),
        confirm: flags["confirm"] === true,
      });
    case "mint":
      return mint(opts, sel, {
        shares: str(flags["shares"]),
        receiver: str(flags["receiver"]),
        approve: flags["approve"] === true,
        confirm: flags["confirm"] === true,
      });
    case "redeem":
      return redeemCmd(opts, sel, {
        shares: str(flags["shares"]),
        receiver: str(flags["receiver"]),
        confirm: flags["confirm"] === true,
      });
    case "approve":
      return approve(opts, sel, {
        token: str(flags["token"]),
        spender: str(flags["spender"]),
        amount: str(flags["amount"]),
        all: flags["all"] === true,
        shareToken: flags["share-token"] === true,
        forShares: str(flags["for-shares"]),
        confirm: flags["confirm"] === true,
      });
    case "balances":
      return balances(opts, sel, positional[0], str(flags["shares"]));
    case "deploy":
      return deploy(opts, sel, {
        script: str(flags["script"]),
        rpc: str(flags["rpc"]),
        broadcast: flags["broadcast"] === true,
        confirm: flags["confirm"] === true,
      });
    case "keeper":
      return keeper(opts, sel, positional[0]);
    case "describe":
      return describe(opts);
    default:
      throw Object.assign(new Error(`Unknown command: ${command}. Run \`vaulto-cli help\`.`), {
        code: "UNKNOWN_COMMAND",
      });
  }
}

main().catch(fail);
