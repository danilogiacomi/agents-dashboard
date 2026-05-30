import { aggregate } from "./aggregate";
import { CcusageError, type Grouping } from "./ccusage";
import { resolveRange } from "./ranges";
import {
  type CcusageDailyReport,
  type CcusageSessionReport,
  type DashboardData,
  type DateRange,
  SUPPORTED_TOOLS,
  type TemplateId,
} from "./types";

export interface HandlerDeps {
  run: (tool: string, grouping: Grouping, range: DateRange) => Promise<unknown>;
  now: () => Date;
}

const TEMPLATES: readonly TemplateId[] = [
  "today",
  "last-7-days",
  "this-month",
  "last-month",
  "last-30-days",
  "all-time",
  "custom",
];

export async function handleUsage(req: Request, deps: HandlerDeps): Promise<Response> {
  const url = new URL(req.url);
  const tool = url.searchParams.get("tool") ?? "";
  const template = (url.searchParams.get("template") ?? "") as TemplateId;

  if (!(SUPPORTED_TOOLS as readonly string[]).includes(tool)) {
    return json({ error: `unsupported tool: ${tool || "(none)"}` }, 400);
  }
  if (!TEMPLATES.includes(template)) {
    return json({ error: `unknown template: ${template || "(none)"}` }, 400);
  }

  let range: DateRange;
  try {
    range = resolveRange(template, deps.now(), {
      since: url.searchParams.get("since") ?? undefined,
      until: url.searchParams.get("until") ?? undefined,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }

  try {
    const [daily, session] = await Promise.all([
      deps.run(tool, "daily", range) as Promise<CcusageDailyReport>,
      deps.run(tool, "session", range) as Promise<CcusageSessionReport>,
    ]);
    const data: DashboardData = aggregate(daily, session, {
      tool,
      template,
      since: range.since,
      until: range.until,
    });
    return json(data, 200);
  } catch (e) {
    if (e instanceof CcusageError) {
      return json({ error: e.message, detail: e.stderr }, 502);
    }
    return json({ error: "internal error" }, 500);
  }
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
