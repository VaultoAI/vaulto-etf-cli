#!/usr/bin/env node
/**
 * vaulto-etf — agent-first CLI for the Vaulto basket-ETF backend.
 *
 * Design for agents: JSON stdout by default, no interactive prompts, errors
 * to stderr as JSON with a non-zero exit code. `describe` dumps the schema.
 */

import { COMMANDS, GLOBAL_FLAGS } from "./spec.js";
import { fail, type OutputOpts } from "./output.js";
import { doctor } from "./commands/doctor.js";
import { state, vault } from "./commands/state.js";
import { previewMint, previewRedeem } from "./commands/preview.js";
import { position } from "./commands/position.js";
import { tokens } from "./commands/tokens.js";
import { createVaultCommand } from "./commands/createVault.js";
import { describe } from "./commands/describe.js";

interface ParsedArgs {
  positional: string[];
  /** string values, or `true` for boolean flags; repeatable flags → string[]. */
  flags: Record<string, string | boolean | string[]>;
}

/** Minimal flag parser. `--flag value` or `--flag=value`; bare `--flag` = true. */
function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string | boolean | string[]> = {};
  const valueFlags = new Set<string>();
  const repeatable = new Set<string>();
  for (const c of COMMANDS) {
    for (const f of c.flags ?? []) {
      const key = f.name.replace(/^--/, "");
      if (f.takesValue) valueFlags.add(key);
      if (f.repeatable) repeatable.add(key);
    }
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
function arr(v: string | boolean | string[] | undefined): string[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") return [v];
  return [];
}

function printHelp(): void {
  const lines = [
    "vaulto-etf — agent CLI for the Vaulto basket-ETF backend",
    "",
    "Usage: vaulto-etf <command> [flags]",
    "",
    "Commands:",
  ];
  const w = Math.max(...COMMANDS.map((c) => c.name.length)) + 2;
  for (const c of COMMANDS) {
    lines.push(`  ${c.name.padEnd(w)}${c.summary}`);
  }
  lines.push("", "Global flags:");
  for (const f of GLOBAL_FLAGS) {
    lines.push(`  ${f.name.padEnd(w)}${f.description}`);
  }
  lines.push("", "Run `vaulto-etf describe` for the full JSON schema.");
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

  if (flags["help"] === true) {
    printHelp();
    return;
  }

  switch (command) {
    case "doctor":
      return doctor(opts);
    case "state":
      return state(opts);
    case "vault":
      return vault(opts);
    case "preview-mint":
      return previewMint(opts, str(flags["shares"]));
    case "preview-redeem":
      return previewRedeem(opts, str(flags["shares"]));
    case "position":
      return position(opts, positional[0]);
    case "tokens":
      return tokens(opts);
    case "create-vault":
      return createVaultCommand(opts, {
        name: str(flags["name"]),
        symbol: str(flags["symbol"]),
        description: str(flags["description"]),
        creator: str(flags["creator"]),
        asset: arr(flags["asset"]),
        confirm: flags["confirm"] === true,
      });
    case "describe":
      return describe(opts);
    default:
      throw Object.assign(new Error(`Unknown command: ${command}. Run \`vaulto-etf help\`.`), {
        code: "UNKNOWN_COMMAND",
      });
  }
}

main().catch(fail);
