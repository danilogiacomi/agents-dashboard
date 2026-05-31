import type { DateRange } from "./types";

export type Grouping = "daily" | "session";

export class CcusageError extends Error {
  readonly stderr?: string;
  constructor(message: string, stderr?: string) {
    super(message);
    this.name = "CcusageError";
    this.stderr = stderr;
  }
}

export function buildCcusageArgs(tool: string, grouping: Grouping, range: DateRange): string[] {
  const args = [tool, grouping, "--json"];
  if (range.since) args.push("--since", range.since);
  if (range.until) args.push("--until", range.until);
  return args;
}

export interface RunOptions {
  bin?: string;
  timeoutMs?: number;
}

export async function runCcusage(
  tool: string,
  grouping: Grouping,
  range: DateRange,
  opts: RunOptions = {},
): Promise<unknown> {
  const binParts = (opts.bin ?? process.env.CCUSAGE_BIN ?? "bunx ccusage").split(" ");
  const head = binParts[0];
  if (!head) throw new CcusageError("CCUSAGE_BIN is empty");
  const cmd = [head, ...binParts.slice(1), ...buildCcusageArgs(tool, grouping, range)];

  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    proc.kill();
  }, opts.timeoutMs ?? 60_000);

  try {
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    if (timedOut) throw new CcusageError("ccusage timed out", stderr);
    if (code !== 0) throw new CcusageError(`ccusage exited with code ${code}`, stderr);
    try {
      return JSON.parse(stdout);
    } catch {
      throw new CcusageError("failed to parse ccusage JSON output", stdout.slice(0, 500));
    }
  } finally {
    clearTimeout(timer);
  }
}
