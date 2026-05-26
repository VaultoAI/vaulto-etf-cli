/**
 * Output helpers — agent-first.
 *
 * Default: compact-but-readable JSON to stdout. `--human` flips to a plain
 * text rendering. Errors always go to stderr as JSON and the process exits
 * non-zero, so an agent can branch reliably on exit code.
 */

export interface OutputOpts {
  human: boolean;
}

/** Success payload → stdout. */
export function emit(data: unknown, opts: OutputOpts, humanRender?: (d: any) => string): void {
  if (opts.human && humanRender) {
    process.stdout.write(humanRender(data) + "\n");
  } else {
    process.stdout.write(JSON.stringify(data, null, 2) + "\n");
  }
}

/** Error → stderr as JSON, then exit non-zero. Never throws. */
export function fail(err: unknown): never {
  const e = err as { message?: string; code?: string; status?: number };
  const body = {
    error: e?.message || String(err),
    code: e?.code || "ERROR",
    ...(e?.status ? { status: e.status } : {}),
  };
  process.stderr.write(JSON.stringify(body, null, 2) + "\n");
  process.exit(1);
}

/** Right-pad for simple aligned columns in --human mode. */
export function pad(s: string | number, width: number): string {
  const str = String(s);
  return str.length >= width ? str : str + " ".repeat(width - str.length);
}

export function usd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
