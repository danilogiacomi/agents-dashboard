import { Chart, registerables } from "chart.js";
import { type DashboardData, SUPPORTED_TOOLS, type TemplateId } from "../src/types";

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
const mainEl = $<HTMLElement>("main");

let selectedTemplate: TemplateId = "last-7-days";
// Monotonic request id: a query is only rendered if it is still the latest one,
// so rapidly switching controls never lets a stale response overwrite a newer one.
let runSeq = 0;
const charts: Record<string, Chart | undefined> = {};

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
  renderTable(data);
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

function renderTable(data: DashboardData): void {
  const rows = [...data.sessions].sort((a, b) => b.totalCost - a.totalCost);
  const head =
    "<table><thead><tr><th>Project</th><th>Models</th><th class='num'>Tokens</th><th class='num'>Cost</th><th>Last activity</th></tr></thead><tbody>";
  const body = rows
    .map(
      (s) =>
        `<tr><td>${esc(s.projectPath)}</td><td>${esc(s.modelsUsed.join(", "))}</td>` +
        `<td class="num">${fmtNum(s.totalTokens)}</td><td class="num">${fmtUsd(s.totalCost)}</td>` +
        `<td>${esc(s.lastActivity)}</td></tr>`,
    )
    .join("");
  tableWrap.innerHTML = `${head}${body}</tbody></table>`;
}

initControls();
// Auto-run on first load with the default tool (claude) and range (last 7 days).
void run();
