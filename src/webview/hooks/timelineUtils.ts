import { ItemData } from "../types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DAY_WIDTH = 28;
export const ROW_HEIGHT = 40;
export const LABEL_WIDTH = 220;
export const HEADER_HEIGHT = 56;
export const SPRINT_ROW_HEIGHT = 28;
export const MONTH_HEIGHT = 24;
export const WEEK_HEIGHT = 32;
export const ARROW_COLOR = "var(--vscode-editorInfo-foreground)";

export const TYPE_COLORS: Record<string, string> = {
  sprint: "#0d9488",
  epic: "#7c3aed",
  story: "#2563eb",
  task: "#16a34a",
  bug: "#dc2626",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimelineItem {
  item: ItemData;
  start: Date;
  end: Date;
  row: number;
  color: string;
}

export type DragMode = "move" | "resize-start" | "resize-end";

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

export function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
