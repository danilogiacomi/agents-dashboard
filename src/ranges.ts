import type { DateRange, TemplateId } from "./types";

export function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Structural format check only (YYYY-MM-DD); does not validate calendar ranges (e.g. month 13).
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function resolveRange(
  template: TemplateId,
  now: Date,
  custom?: { since?: string; until?: string },
): DateRange {
  switch (template) {
    case "today": {
      const t = fmt(now);
      return { since: t, until: t };
    }
    case "last-7-days": {
      const s = new Date(now);
      s.setDate(now.getDate() - 6);
      return { since: fmt(s), until: fmt(now) };
    }
    case "last-30-days": {
      const s = new Date(now);
      s.setDate(now.getDate() - 29);
      return { since: fmt(s), until: fmt(now) };
    }
    case "this-month": {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      return { since: fmt(s), until: fmt(now) };
    }
    case "last-month": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0); // day 0 = last day of prev month
      return { since: fmt(s), until: fmt(e) };
    }
    case "all-time":
      return {};
    case "custom": {
      if (!custom?.since || !custom?.until) {
        throw new RangeError("custom range requires both since and until");
      }
      if (!ISO_RE.test(custom.since) || !ISO_RE.test(custom.until)) {
        throw new RangeError("dates must be in YYYY-MM-DD format");
      }
      if (custom.since > custom.until) {
        throw new RangeError("since must be on or before until");
      }
      return { since: custom.since, until: custom.until };
    }
    default:
      throw new RangeError(`unknown template: ${template as string}`);
  }
}
