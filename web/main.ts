import { Chart, registerables } from "chart.js";
import {
  type CurrentUsage,
  type DashboardData,
  SUPPORTED_TOOLS,
  type SessionRow,
  type TemplateId,
  type UsageWindow,
} from "../src/types";
import { aggregateByProject, fmtCountdown, fmtPercent, projectLabeler, shortModel } from "./format";

Chart.register(...registerables);

interface Template {
  id: TemplateId;
  label: string;
}
const TEMPLATES: Template[] = [
  { id: "today", label: "Today" },
  { id: "last-7-days", label: "Last 7 days" },
  { id: "this-month", label: "This month" },
  { id: "last-month", label: "Last month" },
  { id: "last-30-days", label: "Last 30 days" },
  { id: "all-time", label: "All time" },
  { id: "custom", label: "Custom" },
];

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing element #${id}`);
  return el as T;
};

const toolSel = $<HTMLSelectElement>("tool");
const templatesEl = $<HTMLSpanElement>("templates");
const customEl = $<HTMLSpanElement>("custom");
const sinceEl = $<HTMLInputElement>("since");
const untilEl = $<HTMLInputElement>("until");
const statusEl = $<HTMLDivElement>("status");
const kpisEl = $<HTMLElement>("kpis");
const tableWrap = $<HTMLDivElement>("tableWrap");
const groupChk = $<HTMLInputElement>("groupProj");
const mainEl = $<HTMLElement>("main");
const usagePanel = $<HTMLElement>("usagePanel");
const usageBody = $<HTMLDivElement>("usageBody");

let selectedTemplate: TemplateId = "last-7-days";
// Monotonic request id: a query is only rendered if it is still the latest one,
// so rapidly switching controls never lets a stale response overwrite a newer one.
let runSeq = 0;
const charts: Record<string, Chart | undefined> = {};

// Sessions-table state: the current rows plus how they're sorted. Default is by date,
// descending (most recent first); clicking the Cost/Last activity headers re-sorts.
let tableSessions: SessionRow[] = [];
let sortKey: "date" | "cost" | "tokens" = "date";
let sortDir: 1 | -1 = -1;
// Default to one row per project (summed); the checkbox switches to per-session rows.
let groupByProject = true;

function initControls(): void {
  for (const t of SUPPORTED_TOOLS) {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    toolSel.append(opt);
  }
  for (const t of TEMPLATES) {
    const b = document.createElement("button");
    b.className = "chip";
    b.textContent = t.label;
    b.dataset.id = t.id;
    b.setAttribute("aria-pressed", String(t.id === selectedTemplate));
    b.addEventListener("click", () => {
      selectTemplate(t.id);
      void run();
    });
    templatesEl.append(b);
  }
  // No Run button: changing any control re-queries automatically.
  toolSel.addEventListener("change", () => void run());
  for (const el of [sinceEl, untilEl]) {
    el.addEventListener("change", () => void run());
  }
  // Sort the sessions table when a sortable header is clicked (delegated, survives rebuilds).
  tableWrap.addEventListener("click", (e) => {
    const th = (e.target as HTMLElement).closest<HTMLElement>("th[data-sort]");
    if (!th) return;
    const ds = th.dataset.sort;
    const key: "date" | "cost" | "tokens" =
      ds === "cost" ? "cost" : ds === "tokens" ? "tokens" : "date";
    if (key === sortKey) {
      sortDir = sortDir === 1 ? -1 : 1;
    } else {
      sortKey = key;
      sortDir = -1;
    }
    renderTable();
  });
  // Toggle project-aggregated vs per-session rows.
  groupChk.addEventListener("change", () => {
    groupByProject = groupChk.checked;
    renderTable();
  });
  // The token-split panel starts collapsed, so its canvas has no size until first
  // opened — resize the chart on expand so it draws at the correct dimensions.
  document.getElementById("tokenPanel")?.addEventListener("toggle", (e) => {
    if ((e.target as HTMLDetailsElement).open) charts.token?.resize();
  });
}

function selectTemplate(id: TemplateId): void {
  selectedTemplate = id;
  for (const b of templatesEl.querySelectorAll<HTMLButtonElement>(".chip")) {
    b.setAttribute("aria-pressed", String(b.dataset.id === id));
  }
  customEl.classList.toggle("show", id === "custom");
}

function fmtNum(n: number): string {
  return n.toLocaleString("en-US");
}
function fmtUsd(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function esc(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c,
  );
}

async function run(): Promise<void> {
  void loadCurrentUsage();
  const params = new URLSearchParams({ tool: toolSel.value, template: selectedTemplate });
  if (selectedTemplate === "custom") {
    if (!sinceEl.value || !untilEl.value) {
      statusEl.textContent = "Custom range needs both a start and end date.";
      return;
    }
    params.set("since", sinceEl.value);
    params.set("until", untilEl.value);
  }
  const seq = ++runSeq;
  mainEl.classList.add("loading");
  statusEl.innerHTML = '<span class="spinner"></span>Running ccusage…';
  try {
    const res = await fetch(`/api/usage?${params}`);
    if (seq !== runSeq) return; // a newer request superseded this one
    if (!res.ok) {
      let message = res.statusText;
      try {
        const errBody = (await res.json()) as { error?: string };
        message = errBody.error ?? message;
      } catch {
        // error response was not JSON; keep statusText
      }
      statusEl.textContent = `Error: ${message}`;
      return;
    }
    const body = (await res.json()) as DashboardData;
    if (seq !== runSeq) return; // superseded while parsing
    render(body);
  } catch (e) {
    if (seq === runSeq) statusEl.textContent = `Request failed: ${(e as Error).message}`;
  } finally {
    // Only the latest request clears the loading state; a superseded one leaves
    // it on for the newer request that is still in flight.
    if (seq === runSeq) mainEl.classList.remove("loading");
  }
}

function render(data: DashboardData): void {
  const r = data.range;
  statusEl.textContent = `${r.tool} · ${r.template}${r.since ? ` · ${r.since} → ${r.until}` : " · all time"}`;

  if (data.sessions.length === 0) {
    kpisEl.hidden = true;
    kpisEl.innerHTML = ""; // clear stale cards from a previously selected tool
    tableSessions = [];
    tableWrap.innerHTML = "<p>No usage in this range.</p>";
    for (const key of Object.keys(charts)) {
      charts[key]?.destroy();
      charts[key] = undefined;
    }
    return;
  }

  kpisEl.hidden = false;
  kpisEl.innerHTML = "";
  const kpiDefs: [string, string][] = [
    ["Total cost", fmtUsd(data.kpis.totalCost)],
    ["Total tokens", fmtNum(data.kpis.totalTokens)],
    ["Sessions", fmtNum(data.kpis.sessionCount)],
    ["Active days", fmtNum(data.kpis.activeDays)],
  ];
  for (const [label, value] of kpiDefs) {
    const div = document.createElement("div");
    div.className = "kpi";
    div.innerHTML = `<div class="label">${label}</div><div class="value">${value}</div>`;
    kpisEl.append(div);
  }

  renderTimeChart(data);
  renderModelChart(data);
  renderTokenChart(data);
  tableSessions = data.sessions;
  renderTable();
}

function canvas(id: string): HTMLCanvasElement {
  return $<HTMLCanvasElement>(id);
}

function renderTimeChart(data: DashboardData): void {
  charts.time?.destroy();
  charts.time = new Chart(canvas("timeChart"), {
    data: {
      labels: data.daily.map((d) => d.date),
      datasets: [
        { type: "bar", label: "Tokens", yAxisID: "y1", data: data.daily.map((d) => d.totalTokens) },
        { type: "line", label: "Cost (USD)", yAxisID: "y", data: data.daily.map((d) => d.cost) },
      ],
    },
    options: {
      responsive: true,
      scales: {
        y: { position: "left", title: { display: true, text: "USD" } },
        y1: {
          position: "right",
          title: { display: true, text: "tokens" },
          grid: { drawOnChartArea: false },
        },
      },
    },
  });
}

function renderModelChart(data: DashboardData): void {
  charts.model?.destroy();
  charts.model = new Chart(canvas("modelChart"), {
    type: "doughnut",
    data: {
      labels: data.byModel.map((m) => m.model),
      datasets: [{ data: data.byModel.map((m) => Number(m.cost.toFixed(4))) }],
    },
    options: { responsive: true, plugins: { legend: { position: "bottom" } } },
  });
}

function renderTokenChart(data: DashboardData): void {
  charts.token?.destroy();
  const s = data.tokenSplit;
  charts.token = new Chart(canvas("tokenChart"), {
    type: "bar",
    data: {
      labels: ["Input", "Output", "Cache create", "Cache read"],
      datasets: [{ label: "Tokens", data: [s.input, s.output, s.cacheCreate, s.cacheRead] }],
    },
    options: { responsive: true, indexAxis: "y", plugins: { legend: { display: false } } },
  });
}

function renderTable(): void {
  if (tableSessions.length === 0) {
    tableWrap.innerHTML = "<p>No usage in this range.</p>";
    return;
  }
  const baseRows = groupByProject ? aggregateByProject(tableSessions) : tableSessions;
  const labelOf = projectLabeler(baseRows.map((r) => r.projectPath));
  const sorted = [...baseRows].sort((a, b) => {
    const cmp =
      sortKey === "cost"
        ? a.totalCost - b.totalCost
        : sortKey === "tokens"
          ? a.totalTokens - b.totalTokens
          : a.lastActivity.localeCompare(b.lastActivity);
    return cmp * sortDir;
  });
  const arrow = sortDir < 0 ? "▼" : "▲";
  const ind = (key: "date" | "cost" | "tokens"): string =>
    key === sortKey ? `<span class="sort-ind">${arrow}</span>` : "";
  const head = `<table><thead><tr><th>Project</th><th>Models</th><th class='num sortable' data-sort='tokens'>Tokens${ind("tokens")}</th><th class='num sortable' data-sort='cost'>Cost${ind("cost")}</th><th class='sortable' data-sort='date'>Last activity${ind("date")}</th></tr></thead><tbody>`;
  const body = sorted
    .map((s) => {
      const pills = s.modelsUsed
        .map((m) => `<span class="pill" title="${esc(m)}">${esc(shortModel(m))}</span>`)
        .join("");
      const count = "sessionCount" in s ? s.sessionCount : 1;
      const badge = groupByProject && count > 1 ? ` <span class="count">×${count}</span>` : "";
      return (
        `<tr><td class="proj" title="${esc(s.projectPath)}">${esc(labelOf(s.projectPath))}${badge}</td>` +
        `<td class="models">${pills}</td>` +
        `<td class="num">${fmtNum(s.totalTokens)}</td>` +
        `<td class="num">${fmtUsd(s.totalCost)}</td>` +
        `<td>${esc(s.lastActivity)}</td></tr>`
      );
    })
    .join("");
  tableWrap.innerHTML = `${head}${body}</tbody></table>`;
}

let usageWindows: UsageWindow[] = [];

function renderCurrentUsage(u: CurrentUsage): void {
  usageWindows = u.windows;
  usagePanel.hidden = false;
  const rows = u.windows
    .map((w, i) => {
      const est = w.basis === "estimate" ? `<span class="usage-est">estimate</span>` : "";
      const detail = w.detail ? ` · ${w.detail}` : "";
      const pct = Math.max(0, Math.min(100, w.usedPercent));
      return `
      <div class="usage-win">
        <div class="usage-head"><span>${w.label}${est}${detail}</span>
          <span class="pct">${fmtPercent(w.usedPercent)}</span></div>
        <div class="usage-bar"><span style="width:${pct}%"></span></div>
        <div class="usage-reset" data-reset="${i}">resets in …</div>
      </div>`;
    })
    .join("");
  // No windows (unavailable agent, or Claude with no active session) → show the note only.
  const note = u.note ? `<p class="usage-note">${u.note}</p>` : "";
  usageBody.innerHTML = u.windows.length
    ? rows + note
    : note || `<p class="usage-note">Current usage not available.</p>`;
  tickCountdowns();
}

function tickCountdowns(): void {
  const nowMs = Date.now();
  for (const el of Array.from(usageBody.querySelectorAll<HTMLElement>("[data-reset]"))) {
    const w = usageWindows[Number(el.dataset.reset)];
    if (w) el.textContent = `resets in ${fmtCountdown(new Date(w.resetsAt).getTime() - nowMs)}`;
  }
}

async function loadCurrentUsage(): Promise<void> {
  try {
    const res = await fetch(`/api/current-usage?tool=${encodeURIComponent(toolSel.value)}`);
    if (!res.ok) {
      usagePanel.hidden = true;
      return;
    }
    renderCurrentUsage(await res.json());
  } catch {
    usagePanel.hidden = true;
  }
}

setInterval(tickCountdowns, 1000);
setInterval(() => void loadCurrentUsage(), 60_000);

initControls();
// Auto-run on first load with the default tool (claude) and range (last 7 days).
void run();
