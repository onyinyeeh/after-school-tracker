export const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export const SHORT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** ISO 8601 date-only string, e.g. "2026-09-28". */
export function iso(date: Date): string {
  return (
    date.getFullYear() +
    "-" +
    String(date.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(date.getDate()).padStart(2, "0")
  );
}

/** Parses an `iso()` date string as a local-time Date at midnight. */
export function parseDay(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** The Monday (as an iso date string) of the week containing `date`. */
export function mondayOf(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return iso(addDays(d, -((d.getDay() + 6) % 7)));
}

function shortMonth(i: number): string {
  return MONTHS[i].slice(0, 3);
}

/** e.g. "21-27 Sep" or "29 Sep - 5 Oct" for a week starting on `weekStartIso`. */
export function weekLabel(weekStartIso: string): string {
  const start = parseDay(weekStartIso);
  const end = addDays(start, 6);
  return start.getMonth() === end.getMonth()
    ? `${start.getDate()}–${end.getDate()} ${shortMonth(end.getMonth())}`
    : `${start.getDate()} ${shortMonth(start.getMonth())} – ${end.getDate()} ${shortMonth(end.getMonth())}`;
}
