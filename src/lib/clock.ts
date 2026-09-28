import type { Clock } from "@/lib/rules";

const WEEKDAY_INDEX: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

/** The family's current local `Clock` (day 0-6 Mon-Sun, minutes since local midnight). */
export function currentClock(timezone: string, now: Date = new Date()): Clock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const day = WEEKDAY_INDEX[map.weekday] ?? 0;
  const min = parseInt(map.hour, 10) * 60 + parseInt(map.minute, 10);
  return { day, min };
}
