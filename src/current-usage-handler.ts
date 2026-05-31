import { CcusageError } from "./ccusage";
import { type CurrentUsageDeps, getCurrentUsage } from "./current-usage";
import { SUPPORTED_TOOLS } from "./types";

export async function handleCurrentUsage(req: Request, deps: CurrentUsageDeps): Promise<Response> {
  const tool = new URL(req.url).searchParams.get("tool") ?? "";
  if (!(SUPPORTED_TOOLS as readonly string[]).includes(tool)) {
    return json({ error: `unsupported tool: ${tool || "(none)"}` }, 400);
  }
  try {
    return json(await getCurrentUsage(tool, deps), 200);
  } catch (e) {
    if (e instanceof CcusageError) return json({ error: e.message, detail: e.stderr }, 502);
    return json({ error: "internal error" }, 500);
  }
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
