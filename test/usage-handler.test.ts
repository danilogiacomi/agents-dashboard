import { describe, expect, test } from "bun:test";
import { CcusageError } from "../src/ccusage";
import { type HandlerDeps, handleUsage } from "../src/usage-handler";
import { emptyDaily, emptySession, sampleDaily, sampleSession } from "./fixtures/sample";

const NOW = new Date(2026, 4, 30);

function deps(over: Partial<HandlerDeps> = {}): HandlerDeps {
  return {
    now: () => NOW,
    run: async (_tool, grouping) => (grouping === "daily" ? sampleDaily : sampleSession),
    ...over,
  };
}

function req(qs: string): Request {
  return new Request(`http://localhost/api/usage?${qs}`);
}

describe("handleUsage", () => {
  test("returns 200 with aggregated data for a valid request", async () => {
    const res = await handleUsage(req("tool=claude&template=last-7-days"), deps());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kpis.totalCost).toBe(7);
    expect(body.range).toEqual({
      tool: "claude",
      template: "last-7-days",
      since: "2026-05-24",
      until: "2026-05-30",
    });
  });

  test("rejects an unsupported tool with 400", async () => {
    const res = await handleUsage(req("tool=bogus&template=today"), deps());
    expect(res.status).toBe(400);
  });

  test("rejects an unknown template with 400", async () => {
    const res = await handleUsage(req("tool=claude&template=nope"), deps());
    expect(res.status).toBe(400);
  });

  test("rejects a custom range with since after until (400)", async () => {
    const res = await handleUsage(
      req("tool=claude&template=custom&since=2026-03-01&until=2026-02-01"),
      deps(),
    );
    expect(res.status).toBe(400);
  });

  test("maps a CcusageError to 502", async () => {
    const res = await handleUsage(
      req("tool=claude&template=today"),
      deps({
        run: async () => {
          throw new CcusageError("ccusage not found");
        },
      }),
    );
    expect(res.status).toBe(502);
  });

  test("returns 200 zeroed dashboard for an empty range", async () => {
    const res = await handleUsage(
      req("tool=claude&template=today"),
      deps({ run: async (_t, g) => (g === "daily" ? emptyDaily : emptySession) }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kpis.sessionCount).toBe(0);
  });
});
