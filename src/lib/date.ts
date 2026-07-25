/**
 * Client-safe date helpers for displaying date-only (`YYYY-MM-DD`) due dates.
 * No server-only import — used in client components.
 */

/** Parse `YYYY-MM-DD` into a local Date at noon (avoids TZ-edge day shifts). */
export function parseDateOnly(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/** Today's `YYYY-MM-DD` in a specific IANA timezone (server-side date resolution). */
export function todayInTz(tz: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Today's `YYYY-MM-DD` in the browser's local timezone. */
export function todayLocal(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface DueLabel {
  label: string;
  overdue: boolean;
}

/** Human label for a due date: Today / Tomorrow / weekday / "Jul 30". */
export function formatDue(dateStr: string | null): DueLabel | null {
  if (!dateStr) return null;
  const due = parseDateOnly(dateStr);
  const today = parseDateOnly(todayLocal());
  const diffDays = Math.round(
    (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  const overdue = diffDays < 0;
  let label: string;
  if (diffDays === 0) label = "Today";
  else if (diffDays === 1) label = "Tomorrow";
  else if (diffDays === -1) label = "Yesterday";
  else if (diffDays > 1 && diffDays < 7)
    label = due.toLocaleDateString(undefined, { weekday: "long" });
  else label = due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return { label, overdue };
}
