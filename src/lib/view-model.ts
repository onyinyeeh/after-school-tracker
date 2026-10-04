/**
 * Presentation layer: turns rules.ts outputs + raw kid/prize data into the
 * plain objects the screen components render. No server actions or event
 * handlers live here — TrackerApp wires those up around this data.
 */
import { DAYS, SHORT_DAYS, addDays, iso, parseDay } from "@/lib/calendar";
import { fmtDuration, fmtTime, fmtWindowRange, naira } from "@/lib/format";
import {
  BADGES,
  TASKS,
  TIER_NAMES,
  WEEKDAY_WINDOWS,
  badgeProgress,
  challengeProgress,
  dayCoins,
  dayState,
  levelForCoins,
  liveStreak,
  liveTotals,
  prizeUnlocked,
  readyToCollect,
  status,
  summary,
  weekCounts,
  type Clock,
  type TaskKey,
  type WeekdayRecord,
  type WeekendRecord,
} from "@/lib/rules";
import type { KidData, PrizeData } from "@/lib/tracker-types";

export function initialOf(name: string): string {
  return (name.replace(/[^A-Za-z]/g, "")[0] || "?").toUpperCase();
}

export function dateForDay(weekStartIso: string, day: number): string {
  return iso(addDays(parseDay(weekStartIso), day));
}

export function pickCardView(kid: KidData, startDay: number, clock: Clock, paid: boolean) {
  const sm = summary(kid.week, startDay, clock);
  let msg: string;
  let bad = false;
  if (sm.partial) msg = "First week · streak bonus starts Monday";
  else if (sm.fail >= 0) {
    msg = `Streak ended ${DAYS[sm.fail]} · new streak starts Monday`;
    bad = true;
  } else if (sm.streak === 5) msg = "Full streak! +200 bonus earned";
  else msg = clock.day >= 5 ? `${sm.streak} of 5 days done` : `${sm.streak} of 5 days done · on track for +200`;

  const dots = [0, 1, 2, 3, 4].map((d) => {
    const st = dayState(kid.week[d], d, startDay, clock);
    const isToday = st === "today" && d === clock.day;
    return {
      letter: "MTWTF"[d],
      isDone: st === "done",
      isMissed: st === "missed",
      isToday,
      isFuture: !isToday && st !== "done" && st !== "missed",
    };
  });

  return {
    id: kid.id,
    name: kid.name,
    grade: kid.grade,
    color: kid.color,
    initial: initialOf(kid.name),
    total: naira(paid ? 0 : sm.total),
    msg,
    msgGood: !bad,
    dots,
  };
}

export function statsCardView(kid: KidData, startDay: number, clock: Clock, paid: boolean) {
  const sm = summary(kid.week, startDay, clock);
  const todayCoins = clock.day < 5 ? dayCoins(kid.week[clock.day], clock.day) : 0;
  const bars = [0, 1, 2, 3, 4].map((d) => {
    const st = dayState(kid.week[d], d, startDay, clock);
    return { color: st === "done" ? "#3FB57A" : st === "missed" ? "#E07A6E" : d === clock.day ? "#F5B301" : "#3A4764" };
  });
  const streakLine = sm.partial
    ? "First week! Daily coins count now. Streak bonus starts Monday."
    : sm.fail >= 0
      ? `Streak ended ${DAYS[sm.fail]}. Keep collecting daily coins.`
      : sm.streak === 5
        ? "Full streak! +200 bonus coins earned"
        : "Finish every duty till Friday for +200 bonus coins";
  return {
    total: naira(paid ? 0 : sm.total),
    todayCoins,
    streak: sm.streak,
    bars,
    streakLine,
  };
}

export function weekdayTasksView(kid: KidData, startDay: number, clock: Clock) {
  const rec = kid.week[clock.day] as WeekdayRecord;
  const studyDone = Math.max(0, Math.min(120, clock.min - 1080));
  return TASKS.map((t) => {
    const st = status(rec, clock.day, t.key, startDay, clock);
    let note = "";
    if (st === "done") note = t.key === "study" ? "Explained clearly" : t.key === "rest" && rec.restAt ? "Done " + fmtTime(rec.restAt) : "Done";
    if (st === "missed") note = rec[t.key] === "not" ? "Explanation not clear" : "Missed — past 10:10pm";
    if (st === "waiting") note = "Finished " + fmtTime(rec.studyAt ?? clock.min);
    if (st === "locked") note = "Opens " + fmtTime(WEEKDAY_WINDOWS[t.key][0]).replace(":00", "");
    const [open, close] = WEEKDAY_WINDOWS[t.key];
    if (st === "late") note = "Past " + fmtTime(close).replace(":00", "") + " — still counts till 10:10pm";
    return {
      key: t.key,
      range: fmtWindowRange(open, close),
      title: t.title,
      sub: t.sub,
      note,
      actLabel: t.act,
      status: st,
      isLate: st === "late",
      hasProgress: t.key === "study",
      pct: Math.round(studyDone / 1.2),
      progressLabel: `${fmtDuration(studyDone)} done · ${fmtDuration(120 - studyDone)} to go`,
    };
  });
}

export function weekendRingView(kid: KidData, day: number, startDay: number, clock: Clock, liveSecs: number) {
  const rec = kid.week[day] as WeekendRecord;
  const st = status(rec, day, "study", startDay, clock);
  const mins = Math.floor(liveSecs / 60);
  const pct = Math.round(mins / 1.2);
  return {
    status: st,
    ringPct: Math.max(0, Math.min(100, pct)),
    clockLabel: Math.floor(mins / 60) + ":" + String(mins % 60).padStart(2, "0"),
    mins,
    canFinish: mins >= 120,
  };
}

/** Weekend bedtime — same 8pm-10pm window (and 10:10pm grace) as the weekday "eve" task, for today's weekend day. */
export function weekendBedtimeView(kid: KidData, startDay: number, clock: Clock) {
  const rec = kid.week[clock.day] as WeekendRecord;
  const st = status(rec, clock.day, "eve", startDay, clock);
  const [open, close] = WEEKDAY_WINDOWS.eve;
  let note = "";
  if (st === "done") note = "Done";
  if (st === "missed") note = "Missed — past 10:10pm";
  if (st === "locked") note = "Opens " + fmtTime(open).replace(":00", "");
  if (st === "late") note = "Past " + fmtTime(close).replace(":00", "") + " — still counts till 10:10pm";
  return {
    status: st,
    isLate: st === "late",
    range: fmtWindowRange(open, close),
    title: "In bed by 10pm",
    sub: "Tick once you're in bed",
    note,
    actLabel: "I'm in bed",
  };
}

export function weekendTilesView(kid: KidData, startDay: number, clock: Clock) {
  const lbl: Record<string, string> = { done: "Explained · +100", waiting: "Waiting for check" };
  return [5, 6].map((d) => {
    const rec = kid.week[d] as WeekendRecord;
    const t = status(rec, d, "study", startDay, clock);
    const m = Math.floor(rec.secs / 60);
    let label =
      t === "skip"
        ? "Before you started"
        : lbl[t] || (m ? (d === clock.day ? "Studying · " + fmtDuration(m) : fmtDuration(m)) : "Not started");
    if (t === "missed") label = rec.study === "not" ? "Not clear" : "Missed";
    return { day: DAYS[d], label, bg: t === "done" ? "#E3F3EA" : t === "missed" ? "#FBE6E2" : d === clock.day ? "#FFF1C7" : "#F1EADB" };
  });
}

export function streakView(
  kid: KidData,
  weekStartIso: string,
  startDay: number,
  clock: Clock,
  prizes: PrizeData[],
  withdrawnTotal: number,
  paid: boolean
) {
  const sm = summary(kid.week, startDay, clock);
  const ls = liveStreak(kid.week, kid.stats, startDay, clock);
  const cp = challengeProgress(kid.week, weekStartIso);
  const totals = liveTotals(kid.stats, kid.week, startDay, clock);
  const earnedAll = withdrawnTotal + (paid ? 0 : sm.total);
  const level = levelForCoins(earnedAll);

  const badges = BADGES.map((b) => ({ ...b, ...badgeProgress(b, totals) }));

  let nextGoal: string | null = null;
  let bestGap = Infinity;
  for (const b of badges) {
    if (b.nextThreshold != null) {
      const gap = (b.nextThreshold - b.value) / b.nextThreshold;
      if (gap < bestGap) {
        bestGap = gap;
        nextGoal = `${b.remaining} more for ${TIER_NAMES[b.tier + 1]} ${b.name}`;
      }
    }
  }

  const prizeViews = [...prizes]
    .sort((a, b) => a.days - b.days)
    .map((p) => {
      const unlocked = prizeUnlocked(p, ls.best);
      const given = kid.prizesGiven.includes(p.id);
      return {
        id: p.id,
        text: p.text,
        days: p.days,
        isLocked: !unlocked,
        isReady: unlocked && !given,
        isGiven: unlocked && given,
        pct: Math.round((Math.min(ls.best, p.days) / p.days) * 100),
        left: `${p.days - Math.min(ls.best, p.days)} more days · ${Math.min(ls.best, p.days)} / ${p.days}`,
      };
    });

  const daysLeft = 6 - clock.day;
  const wins = kid.stats.challenges + (cp.done ? 1 : 0);
  const roadBad = sm.fail >= 0 && !sm.partial;

  return {
    best: ls.best,
    cur: ls.cur,
    shieldsLeft: ls.shieldsLeft,
    level,
    wins,
    shieldTitle: ls.shieldsLeft ? `${ls.shieldsLeft} streak shield${ls.shieldsLeft > 1 ? "s" : ""} ready` : "No shields yet",
    road: [0, 1, 2, 3, 4].map((d) => {
      const st = dayState(kid.week[d], d, startDay, clock);
      const isToday = st === "today" && d === clock.day;
      return { letter: "MTWTF"[d], isDone: st === "done", isMissed: st === "missed", isToday, isFuture: !isToday && st !== "done" && st !== "missed" };
    }),
    chestOpen: sm.bonus > 0,
    roadGood: !roadBad,
    roadMsg: sm.partial
      ? "Your first full week starts Monday. Fill every stone to open the chest."
      : roadBad
        ? "The chest is locked this week. Next week is a fresh start."
        : sm.bonus
          ? "Chest open! +200 bonus coins are yours."
          : "Finish every duty each weekday to open the chest.",
    challenge: cp.challenge,
    chHave: cp.have,
    chDone: cp.done,
    chDaysLeft: daysLeft <= 0 ? "Ends tonight" : `${daysLeft} day${daysLeft > 1 ? "s" : ""} left`,
    chReward: kid.stats.shields >= 2 ? "Reward: shield (you have the max of 2)" : "Reward: 1 streak shield",
    badges,
    badgeCount: badges.filter((b) => b.tier > 0).length,
    nextGoal: nextGoal ?? "Every badge is gold. Legend!",
    prizes: prizeViews,
  };
}

export function walletView(
  kid: KidData,
  startDay: number,
  clock: Clock,
  walletDay: number | null,
  paid: boolean,
  payOpenTime: boolean
) {
  const sm = summary(kid.week, startDay, clock);
  const selDay = walletDay ?? clock.day;
  const requested = !!kid.withdrawal;
  // Carried-over unpaid balances are collectible any time; this week's
  // earnings join them once they unlock (Sunday 8pm) — see readyToCollect().
  const ready = readyToCollect(kid.stats, sm.total, paid, payOpenTime);

  const bars = [0, 1, 2, 3, 4, 5, 6].map((d) => {
    const c = dayCoins(kid.week[d], d);
    const max = 150;
    const future = d > clock.day;
    const before = d < startDay && c === 0;
    return {
      label: SHORT_DAYS[d],
      value: future || before ? "" : String(c),
      h: Math.max(0, Math.min(100, Math.round((c / max) * 100))),
      fill: c >= max ? "#1F7A4D" : "#F5B301",
      selected: d === selDay,
    };
  });

  const dayRows = (
    selDay < 5
      ? TASKS.map((t) => [t.key, t.title, 50] as [TaskKey, string, number])
      : ([
          ["study", "2 hours of study", 100],
          ["eve", "In bed by 10pm", 50],
        ] as [TaskKey, string, number][])
  ).map(
    ([key, title, pts]) => {
      const st = status(kid.week[selDay], selDay, key, startDay, clock);
      const labelMap: Record<string, [string, string]> = {
        done: ["+" + pts, "#1F7A4D"],
        missed: ["Missed", "#B3362A"],
        waiting: ["Waiting for check", "#5A6275"],
        now: ["Open now", "#1E2A44"],
        late: ["Open (late)", "#B3362A"],
        locked: ["Not yet", "#5A6275"],
        skip: ["Before you started", "#5A6275"],
      };
      const [defaultLabel, color] = labelMap[st];
      const recVal = (kid.week[selDay] as WeekdayRecord)[key as keyof WeekdayRecord];
      const label = st === "missed" && recVal === "not" ? "Not clear" : defaultLabel;
      return { title, label, color };
    }
  );

  return {
    ready: naira(ready),
    // lifetimeEarned/lifetimeWithdrawn are folded/settled totals from past
    // weeks; the current (not-yet-folded) week's running total is added on
    // top so the figures are accurate as of right now.
    earned: naira(kid.stats.lifetimeEarned + sm.total),
    withdrawn: naira(kid.stats.lifetimeWithdrawn),
    locked: !paid && ready === 0,
    open: !paid && ready > 0 && !requested,
    requested: !paid && ready > 0 && requested,
    paid,
    bars,
    weekTotal: naira(sm.total),
    dayTitle: DAYS[selDay] + (selDay === clock.day ? " · today" : ""),
    dayCoinsLabel: selDay > clock.day ? "" : naira(dayCoins(kid.week[selDay], selDay)),
    dayRows,
    bonusLabel: sm.bonus ? "+200 earned" : sm.partial ? "Starts Monday" : sm.fail >= 0 ? "Missed this week" : `${sm.streak} of 5 days`,
    bonusBg: sm.bonus ? "#1F7A4D" : sm.fail >= 0 && !sm.partial ? "#FBE6E2" : "#F1EADB",
    bonusColor: sm.bonus ? "#FFFFFF" : sm.fail >= 0 && !sm.partial ? "#B3362A" : "#1E2A44",
    history: kid.history.map((h) => ({ ...h, amountLabel: naira(h.amount) })),
  };
}

// ── Grown-up corner ─────────────────────────────────────────────────────

export type PendingCheck = {
  kidId: string;
  kidName: string;
  kidColor: string;
  kidInitial: string;
  day: number;
  task: "study" | "weekend_study";
  when: string;
  coins: number;
  status: "finished" | "clear" | "not";
};

/** Every reviewed-or-reviewable study explanation in the current week, most recent day first. */
export function parentChecksView(kids: KidData[]): PendingCheck[] {
  const checks: PendingCheck[] = [];
  for (const kid of kids) {
    for (let d = 0; d <= 6; d++) {
      const rec = kid.week[d] as WeekdayRecord | WeekendRecord;
      const val = rec.study;
      if (!val) continue;
      checks.push({
        kidId: kid.id,
        kidName: kid.name,
        kidColor: kid.color,
        kidInitial: initialOf(kid.name),
        day: d,
        task: d >= 5 ? "weekend_study" : "study",
        when: `${DAYS[d]} study · finished ${fmtTime(rec.studyAt ?? 0)}`,
        coins: d >= 5 ? 100 : 50,
        status: val,
      });
    }
  }
  checks.sort((a, b) => b.day - a.day);
  return checks;
}

export function prizesDueView(kids: KidData[], prizes: PrizeData[], startDay: number, clock: Clock) {
  const due: { kidId: string; kidName: string; kidColor: string; kidInitial: string; prizeId: string; text: string; days: number }[] = [];
  for (const kid of kids) {
    const ls = liveStreak(kid.week, kid.stats, startDay, clock);
    for (const p of prizes) {
      if (ls.best >= p.days && !kid.prizesGiven.includes(p.id)) {
        due.push({ kidId: kid.id, kidName: kid.name, kidColor: kid.color, kidInitial: initialOf(kid.name), prizeId: p.id, text: p.text, days: p.days });
      }
    }
  }
  return due;
}

const FIX_TASK_STATUS_LABEL: Record<string, string> = {
  skip: "Before you started",
  done: "Done",
  missed: "Missed",
  waiting: "Waiting for check",
  now: "Open now",
  late: "Open (late)",
  locked: "Not open yet",
};

export function fixRowsView(kids: KidData[], startDay: number, clock: Clock) {
  const isWeekend = clock.day >= 5;
  const keys: [TaskKey, string][] = isWeekend
    ? [
        ["study", "2 hours of study"],
        ["eve", "In bed by 10pm"],
      ]
    : TASKS.map((t) => [t.key, t.title]);
  const rows: { kidId: string; kidColor: string; kidInitial: string; label: string; statusLabel: string; actLabel: string; task: TaskKey; on: boolean }[] = [];
  for (const kid of kids) {
    const rec = kid.week[clock.day] as WeekdayRecord;
    for (const [key, label] of keys) {
      const st = status(rec, clock.day, key, startDay, clock);
      const isStudy = key === "study";
      const on = isStudy ? rec.study === "clear" : rec[key as "rest" | "eve"] === "done";
      rows.push({
        kidId: kid.id,
        kidColor: kid.color,
        kidInitial: initialOf(kid.name),
        label,
        statusLabel: FIX_TASK_STATUS_LABEL[st] ?? st,
        actLabel: isStudy ? (on ? "Mark not clear" : "Mark clear") : on ? "Untick" : "Tick",
        task: key,
        on,
      });
    }
  }
  return rows;
}

export function payoutView(kids: KidData[], startDay: number, clock: Clock, paid: boolean, payOpenTime: boolean) {
  let totalReady = 0;
  const rows = kids.map((kid) => {
    const sm = summary(kid.week, startDay, clock);
    const ready = readyToCollect(kid.stats, sm.total, paid, payOpenTime);
    totalReady += ready;
    const suffix = paid ? " paid" : kid.withdrawal ? " · asked" : kid.stats.carryUnpaid > 0 ? " · includes carried balance" : " so far";
    return { name: kid.name, amountLabel: naira(ready) + suffix };
  });
  return { rows, total: naira(totalReady), totalAmount: totalReady };
}

/** Re-exported for convenience so screens don't need two imports for common bits. */
export { weekCounts };
