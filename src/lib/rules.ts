/**
 * Pure business-rules engine for the After-School Tracker, ported from the
 * design prototype's logic class. No framework, no I/O, no hidden clock —
 * every function takes the data (and, where relevant, the current `Clock`)
 * it needs and returns a value. See README.md in the repo root for the
 * plain-English spec this was ported from.
 */

import { parseDay, weekLabel as calendarWeekLabel } from "./calendar";

export type TaskKey = "rest" | "study" | "eve";

/** day: 0=Monday .. 6=Sunday. min: minutes since local midnight. */
export type Clock = { day: number; min: number };

export type WeekdayRecord = {
  rest: "done" | null;
  restAt: number | null;
  study: "clear" | "not" | "finished" | null;
  studyAt: number | null;
  eve: "done" | null;
};

export type WeekendRecord = {
  secs: number;
  study: "clear" | "not" | "finished" | null;
  studyAt: number | null;
};

export type DayRecord = WeekdayRecord | WeekendRecord;

/** Always length 7, index 0=Monday .. 6=Sunday. Index 0-4 are `WeekdayRecord`, 5-6 are `WeekendRecord`. */
export type WeekState = DayRecord[];

export type DayStatus = "done" | "missed" | "waiting" | "skip" | "locked" | "now" | "late";
export type DayAggregateState = "done" | "skip" | "missed" | "today" | "future";

export const WEEKDAY_WINDOWS: Record<TaskKey, [number, number]> = {
  rest: [990, 1080], // 4:30pm - 6:00pm ("ideal" window — see WEEKDAY_FINAL_DEADLINE)
  study: [1080, 1200], // 6:00pm - 8:00pm
  eve: [1200, 1320], // 8:00pm - 10:00pm
};

/**
 * 10:10pm — the single hard cutoff shared by all three weekday tasks. A task
 * is still tickable (flagged "late" rather than locked) any time after its
 * own window closes, right up until this shared deadline; only past this
 * point does an unticked task become permanently missed for the day.
 */
export const WEEKDAY_FINAL_DEADLINE = 1330;

export const TASKS: {
  key: TaskKey;
  title: string;
  sub: string;
  coins: number;
  act: string;
}[] = [
  {
    key: "rest",
    title: "Shower, lunch, rest",
    sub: "Dishes if you like",
    coins: 50,
    act: "I've showered & eaten",
  },
  {
    key: "study",
    title: "Study & read",
    sub: "Then explain what you read to your grown-up",
    coins: 50,
    act: "I've finished studying",
  },
  {
    key: "eve",
    title: "Dinner, night dishes, in bed by 10",
    sub: "Tick once you are in bed",
    coins: 50,
    act: "I'm in bed",
  },
];

export function isWeekday(day: number): boolean {
  return day < 5;
}

export function blankWeek(): WeekState {
  return Array.from({ length: 7 }, (_, d): DayRecord =>
    d < 5
      ? { rest: null, restAt: null, study: null, studyAt: null, eve: null }
      : { secs: 0, study: null, studyAt: null }
  );
}

/** Resolves a single task's status for a given day. */
export function status(
  rec: DayRecord,
  day: number,
  key: TaskKey,
  startDay: number,
  clock: Clock
): DayStatus {
  const v = (rec as Partial<WeekdayRecord>)[key as keyof WeekdayRecord];
  if (v === "done" || v === "clear") return "done";
  if (v === "not") return "missed";
  if (v === "finished") return "waiting";
  if (day < startDay) return "skip";
  if (day < clock.day) return "missed";
  if (day > clock.day) return "locked";
  if (day >= 5) return "now";
  const [open, close] = WEEKDAY_WINDOWS[key];
  if (clock.min < open) return "locked";
  if (clock.min >= WEEKDAY_FINAL_DEADLINE) return "missed";
  if (clock.min >= close) return "late";
  return "now";
}

/** Coins earned for a day's record so far (weekday = up to 150, weekend = 0 or 100). */
export function dayCoins(rec: DayRecord, day: number): number {
  if (day >= 5) {
    return (rec as WeekendRecord).study === "clear" ? 100 : 0;
  }
  const r = rec as WeekdayRecord;
  return (r.rest === "done" ? 50 : 0) + (r.study === "clear" ? 50 : 0) + (r.eve === "done" ? 50 : 0);
}

/** Aggregates the 3 weekday tasks' statuses into one day-level state. */
export function dayState(rec: DayRecord, day: number, startDay: number, clock: Clock): DayAggregateState {
  const keys: TaskKey[] = ["rest", "study", "eve"];
  const statuses = keys.map((k) => status(rec, day, k, startDay, clock));
  if (statuses.every((s) => s === "done")) return "done";
  if (statuses.every((s) => s === "skip" || s === "done")) return "skip";
  if (statuses.includes("missed")) return "missed";
  return day <= clock.day ? "today" : "future";
}

export type WeekSummary = {
  /** Consecutive done weekdays from the week's start, before the first miss. */
  streak: number;
  /** Index (0-4) of the first missed weekday, or -1 if none yet. */
  fail: number;
  /** 200 if all 5 weekdays are done and this isn't a partial first week, else 0. */
  bonus: number;
  /** True if this week started mid-week (no streak bonus is possible). */
  partial: boolean;
  weekdayCoins: number;
  weekendCoins: number;
  total: number;
};

export function summary(week: WeekState, startDay: number, clock: Clock): WeekSummary {
  let streak = 0;
  let fail = -1;
  const from = Math.min(startDay, 5);
  for (let d = from; d < 5; d++) {
    const s = dayState(week[d], d, startDay, clock);
    if (s === "done") {
      streak++;
    } else {
      if (s === "missed") fail = d;
      break;
    }
  }
  const partial = startDay > 0;
  const bonus = !partial && streak === 5 ? 200 : 0;
  const weekdayCoins = [0, 1, 2, 3, 4].reduce((a, d) => a + dayCoins(week[d], d), 0);
  const weekendCoins = dayCoins(week[5], 5) + dayCoins(week[6], 6);
  return { streak, fail, bonus, partial, weekdayCoins, weekendCoins, total: weekdayCoins + weekendCoins + bonus };
}

export type WeekCounts = {
  early: number;
  clear: number;
  bed: number;
  weekend: number;
  zero: number;
  weekendClear: number;
};

/** Raw counts from the recorded week data — no clock needed. */
export function weekCounts(week: WeekState): WeekCounts {
  const wd = [0, 1, 2, 3, 4];
  return {
    early: wd.filter((d) => {
      const r = week[d] as WeekdayRecord;
      return r.rest === "done" && r.restAt != null && r.restAt < 1020;
    }).length,
    clear: week.filter((r) => (r as WeekdayRecord | WeekendRecord).study === "clear").length,
    bed: wd.filter((d) => (week[d] as WeekdayRecord).eve === "done").length,
    weekend: (week[5] as WeekendRecord).study === "clear" && (week[6] as WeekendRecord).study === "clear" ? 1 : 0,
    zero: [0, 1, 2, 3].reduce((a, d) => {
      const r = week[d] as WeekdayRecord;
      return a + (r.rest === "done" ? 1 : 0) + (r.study === "clear" ? 1 : 0) + (r.eve === "done" ? 1 : 0);
    }, 0),
    weekendClear: [5, 6].filter((d) => (week[d] as WeekendRecord).study === "clear").length,
  };
}

export type Challenge = { id: "early" | "clear" | "zero" | "weekend"; title: string; desc: string; target: number };

export const CHALLENGES: Challenge[] = [
  { id: "early", title: "Early bird week", desc: "Finish rest before 5pm on 4 weekdays", target: 4 },
  { id: "clear", title: "Sharp mind", desc: "Get 6 clear explanations this week", target: 6 },
  { id: "zero", title: "No misses", desc: "Tick every duty Monday to Thursday", target: 12 },
  { id: "weekend", title: "Weekend double", desc: "Clear study on Saturday and Sunday", target: 2 },
];

/** Rotates deterministically by the number of weeks since the epoch. */
export function challengeForWeek(weekStartIso: string): Challenge {
  const n = CHALLENGES.length;
  const idx = Math.floor(parseDay(weekStartIso).getTime() / (7 * 864e5)) % n;
  return CHALLENGES[(idx + n) % n];
}

export function challengeProgress(week: WeekState, weekStartIso: string) {
  const challenge = challengeForWeek(weekStartIso);
  const wc = weekCounts(week);
  const have =
    challenge.id === "early"
      ? wc.early
      : challenge.id === "clear"
        ? wc.clear
        : challenge.id === "zero"
          ? wc.zero
          : wc.weekendClear;
  return { challenge, have: Math.min(have, challenge.target), done: have >= challenge.target };
}

export type KidStats = {
  early: number;
  clear: number;
  bed: number;
  perfect: number;
  weekend: number;
  /** Best-ever streak, ending the last completed week. Never decreases. */
  best: number;
  /** Streak carried into the current (in-progress) week. */
  carry: number;
  /** Streak shields available (max 2), earned by winning the weekly challenge. */
  shields: number;
  challenges: number;
  /** Total coins ever earned, across every week, whether paid out or not. Never decreases. */
  lifetimeEarned: number;
  /** Total coins ever actually paid out. Never decreases. */
  lifetimeWithdrawn: number;
  /** Coins earned in closed weeks that were never paid — still owed, still collectible any time. */
  carryUnpaid: number;
};

export function zeroStats(): KidStats {
  return {
    early: 0,
    clear: 0,
    bed: 0,
    perfect: 0,
    weekend: 0,
    best: 0,
    carry: 0,
    shields: 0,
    challenges: 0,
    lifetimeEarned: 0,
    lifetimeWithdrawn: 0,
    carryUnpaid: 0,
  };
}

/**
 * The kid's live streak *as of `clock`* within the given week, carrying over
 * `stats.carry`/`stats.best`/`stats.shields` from prior weeks. A missed
 * weekday consumes a shield if one is available; otherwise the streak resets
 * to 0. `best` only ever increases.
 */
export function liveStreak(week: WeekState, stats: KidStats, startDay: number, clock: Clock) {
  let cur = stats.carry;
  let best = stats.best;
  let used = 0;
  for (let d = 0; d < 5; d++) {
    const ds = dayState(week[d], d, startDay, clock);
    if (ds === "done") {
      cur++;
      best = Math.max(best, cur);
    } else if (ds === "missed") {
      if (stats.shields - used > 0) used++;
      else cur = 0;
    } else if (ds === "future") {
      break;
    }
  }
  return { cur, best, used, shieldsLeft: stats.shields - used };
}

/**
 * Folds a finished week into a kid's lifetime stats — run by the weekly
 * cron (Monday 00:05) against the week that just ended. `clock` is fixed to
 * end-of-week so every day is resolved as done/missed rather than
 * locked/now. `weekWasPaid` tells it whether the week's earnings were
 * already paid out before the fold ran — if not, they carry forward into
 * `carryUnpaid` instead of being lost.
 */
export function foldKidStats(
  prev: KidStats,
  week: WeekState,
  weekStartIso: string,
  startDay: number,
  weekWasPaid: boolean
): KidStats {
  const endOfWeek: Clock = { day: 7, min: 0 };
  const wc = weekCounts(week);
  const ls = liveStreak(week, prev, startDay, endOfWeek);
  const sm = summary(week, startDay, endOfWeek);
  const cp = challengeProgress(week, weekStartIso);
  return {
    early: prev.early + wc.early,
    clear: prev.clear + wc.clear,
    bed: prev.bed + wc.bed,
    perfect: prev.perfect + (sm.bonus ? 1 : 0),
    weekend: prev.weekend + wc.weekend,
    best: ls.best,
    carry: ls.cur,
    shields: Math.min(2, ls.shieldsLeft + (cp.done ? 1 : 0)),
    challenges: prev.challenges + (cp.done ? 1 : 0),
    lifetimeEarned: prev.lifetimeEarned + sm.total,
    lifetimeWithdrawn: prev.lifetimeWithdrawn,
    carryUnpaid: prev.carryUnpaid + (weekWasPaid ? 0 : sm.total),
  };
}

/**
 * How much is available to collect right now: any carried-over unpaid
 * balance from past (closed) weeks, plus this week's earnings once they've
 * unlocked (Sunday 8pm, per the usual payday rhythm) and haven't been paid
 * yet. Carried-over balances are always collectible, any day — that's what
 * stops a missed payday from becoming a permanent loss.
 */
export function readyToCollect(stats: KidStats, currentWeekTotal: number, currentWeekPaid: boolean, currentWeekUnlocked: boolean): number {
  if (currentWeekPaid) return stats.carryUnpaid;
  return stats.carryUnpaid + (currentWeekUnlocked ? currentWeekTotal : 0);
}

/** Records a payout of exactly `paidAmount` (from readyToCollect) — clears the carried balance and adds to the lifetime-withdrawn total. */
export function settlePayment(stats: KidStats, paidAmount: number): KidStats {
  return { ...stats, carryUnpaid: 0, lifetimeWithdrawn: stats.lifetimeWithdrawn + paidAmount };
}

export type BadgeTotals = {
  streak: number;
  clear: number;
  early: number;
  bed: number;
  perfect: number;
  weekend: number;
};

/** Live (mid-week) totals used for badge progress — folded stats plus the current week so far. */
export function liveTotals(stats: KidStats, week: WeekState, startDay: number, clock: Clock): BadgeTotals {
  const wc = weekCounts(week);
  const ls = liveStreak(week, stats, startDay, clock);
  const sm = summary(week, startDay, clock);
  return {
    streak: ls.best,
    clear: stats.clear + wc.clear,
    early: stats.early + wc.early,
    bed: stats.bed + wc.bed,
    perfect: stats.perfect + (sm.bonus ? 1 : 0),
    weekend: stats.weekend + wc.weekend,
  };
}

export type Badge = {
  id: keyof BadgeTotals;
  name: string;
  desc: string;
  tiers: [number, number, number];
  icon: "flame" | "book" | "sun" | "moon" | "trophy" | "star";
};

export const BADGES: Badge[] = [
  { id: "streak", name: "Unbroken", desc: "Longest streak (days)", tiers: [5, 10, 20], icon: "flame" },
  { id: "clear", name: "Clear thinker", desc: "Clear explanations", tiers: [5, 20, 50], icon: "book" },
  { id: "early", name: "Early bird", desc: "Rest done before 5pm", tiers: [5, 15, 40], icon: "sun" },
  { id: "bed", name: "Sleep champ", desc: "In bed by 10pm", tiers: [10, 30, 75], icon: "moon" },
  { id: "perfect", name: "Perfect weeks", desc: "Every weekday duty done", tiers: [1, 4, 10], icon: "trophy" },
  { id: "weekend", name: "Weekend scholar", desc: "Both weekend days clear", tiers: [1, 4, 8], icon: "star" },
];

export const TIER_NAMES = ["Locked", "Bronze", "Silver", "Gold"] as const;
/** [color, bg, stroke] per tier — 0=Locked .. 3=Gold. */
export const TIER_STYLE: [string, string, string][] = [
  ["#5A6275", "#F1EADB", "#8E97AC"],
  ["#B8520E", "#B8520E", "#FFFFFF"],
  ["#5A6275", "#8E97AC", "#FFFFFF"],
  ["#1E2A44", "#F5B301", "#1E2A44"],
];

export function badgeTier(value: number, tiers: [number, number, number]): number {
  let tier = 0;
  tiers.forEach((t, i) => {
    if (value >= t) tier = i + 1;
  });
  return tier;
}

export function badgeProgress(badge: Badge, totals: BadgeTotals) {
  const value = totals[badge.id];
  const tier = badgeTier(value, badge.tiers);
  const nextThreshold: number | undefined = badge.tiers[tier];
  const prevThreshold = tier ? badge.tiers[tier - 1] : 0;
  const pct = nextThreshold ? Math.round(((value - prevThreshold) / (nextThreshold - prevThreshold)) * 100) : 100;
  const [tierColor, bg, stroke] = TIER_STYLE[tier];
  return {
    tier,
    tierName: TIER_NAMES[tier],
    tierColor,
    bg,
    stroke,
    value,
    nextThreshold: nextThreshold ?? null,
    pct: Math.max(0, Math.min(100, pct)),
    remaining: nextThreshold ? nextThreshold - value : 0,
    maxed: tier === 3,
  };
}

export const LEVEL_THRESHOLDS = [0, 1500, 4000, 8000, 15000];
export const LEVEL_NAMES = ["Starter", "Reader", "Scholar", "Champion", "Legend"];

export function levelForCoins(lifetimeCoins: number) {
  let idx = 0;
  LEVEL_THRESHOLDS.forEach((v, i) => {
    if (lifetimeCoins >= v) idx = i;
  });
  const next: number | undefined = LEVEL_THRESHOLDS[idx + 1];
  return {
    level: idx + 1,
    name: LEVEL_NAMES[idx],
    pct: next ? Math.round(((lifetimeCoins - LEVEL_THRESHOLDS[idx]) / (next - LEVEL_THRESHOLDS[idx])) * 100) : 100,
    remainingToNext: next ? next - lifetimeCoins : 0,
    nextName: LEVEL_NAMES[idx + 1] ?? null,
    maxed: next === undefined,
  };
}

export type Prize = { days: number; text: string };

/** Prizes unlock (and stay unlocked) once the kid's best-ever streak reaches `days`. */
export function prizeUnlocked(prize: Prize, bestStreak: number): boolean {
  return bestStreak >= prize.days;
}

export { calendarWeekLabel as weekLabel };
