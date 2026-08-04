/**
 * Output helpers — agent-first.
 *
 * Default: compact-but-readable JSON to stdout. `--human` flips to a plain
 * text rendering. Errors always go to stderr as JSON and the process exits
 * non-zero, so an agent can branch reliably on exit code.
 */
/** Success payload → stdout. */
export function emit(data, opts, humanRender) {
    if (opts.human && humanRender) {
        process.stdout.write(humanRender(data) + "\n");
    }
    else {
        process.stdout.write(JSON.stringify(data, null, 2) + "\n");
    }
}
/** Error → stderr as JSON, then exit non-zero. Never throws. */
export function fail(err) {
    const e = err;
    const body = {
        error: e?.message || String(err),
        code: e?.code || "ERROR",
        ...(e?.status ? { status: e.status } : {}),
    };
    process.stderr.write(JSON.stringify(body, null, 2) + "\n");
    process.exit(1);
}
/** Right-pad for simple aligned columns in --human mode. */
export function pad(s, width) {
    const str = String(s);
    return str.length >= width ? str : str + " ".repeat(width - str.length);
}
export function usd(n) {
    return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
