import { homedir } from "node:os";
import { join } from "node:path";
import type { CodexRateLimits } from "./types";

// Find the most recently modified rollout-*.jsonl under CODEX_HOME/sessions and
// return the last rate_limits snapshot it contains, or null if none is found.
export async function readLatestCodexRateLimits(): Promise<CodexRateLimits | null> {
  const root = join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "sessions");
  const glob = new Bun.Glob("**/rollout-*.jsonl");

  let newest: { path: string; mtime: number } | null = null;
  try {
    for await (const rel of glob.scan({ cwd: root, onlyFiles: true })) {
      const path = join(root, rel);
      const mtime = (await Bun.file(path).stat()).mtimeMs;
      if (!newest || mtime > newest.mtime) newest = { path, mtime };
    }
  } catch {
    return null; // no ~/.codex/sessions directory
  }
  if (!newest) return null;

  const text = await Bun.file(newest.path).text();
  let found: CodexRateLimits | null = null;
  for (const line of text.split("\n")) {
    if (!line.includes("rate_limits")) continue;
    try {
      const obj = JSON.parse(line) as { payload?: { info?: { rate_limits?: CodexRateLimits } } };
      const rl = obj.payload?.info?.rate_limits;
      if (rl) found = rl; // keep the last one
    } catch {
      // ignore malformed lines
    }
  }
  return found;
}
