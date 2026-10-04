import { describe, expect, it } from "vitest";
import {
  badgeProgress,
  badgeTier,
  blankWeek,
  challengeForWeek,
  dayCoins,
  dayState,
  foldKidStats,
  levelForCoins,
  liveStreak,
  prizeUnlocked,
  readyToCollect,
  settlePayment,
  status,
  summary,
  weekCounts,
  zeroStats,
  type WeekState,
  type Clock,
} from "./rules";

function full(studyAt = 1150): WeekState[number] {
  return { rest: "done", restAt: 1000, study: "clear", studyAt, eve: "done" };
}

function fullWeek(days: number[]): WeekState {
  const w = blankWeek();
  for (const d of days) w[d] = full();
  return w;
}

describe("status() weekday window edges", () => {
  const startDay = 0;

  it("is locked right before the study window opens (17:59)", () => {
    const rec = blankWeek()[0];
    expect(status(rec, 0, "study", startDay, { day: 0, min: 1079 })).toBe("locked");
  });

  it("is now exactly when the study window opens (18:00)", () => {
    const rec = blankWeek()[0];
    expect(status(rec, 0, "study", startDay, { day: 0, min: 1080 })).toBe("now");
  });

  it("is still now one minute before close (19:59)", () => {
    const rec = blankWeek()[0];
    expect(status(rec, 0, "study", startDay, { day: 0, min: 1199 })).toBe("now");
  });

  it("goes late (not locked out) once its own window closes (20:00)", () => {
    const rec = blankWeek()[0];
    expect(status(rec, 0, "study", startDay, { day: 0, min: 1200 })).toBe("late");
  });

  it("stays late right up to the shared 10:10pm deadline (22:09)", () => {
    const rec = blankWeek()[0];
    expect(status(rec, 0, "study", startDay, { day: 0, min: 1329 })).toBe("late");
  });

  it("is finally missed at the shared 10:10pm deadline (22:10), regardless of the task", () => {
    const rec = blankWeek()[0];
    expect(status(rec, 0, "rest", startDay, { day: 0, min: 1330 })).toBe("missed");
    expect(status(rec, 0, "study", startDay, { day: 0, min: 1330 })).toBe("missed");
    expect(status(rec, 0, "eve", startDay, { day: 0, min: 1330 })).toBe("missed");
  });

  it("a recorded value always wins over the clock", () => {
    const rec = { ...blankWeek()[0], study: "clear" as const };
    expect(status(rec, 0, "study", startDay, { day: 0, min: 0 })).toBe("done");
  });
});

describe("dayCoins()", () => {
  it("weekday: 50 per completed task, up to 150", () => {
    expect(dayCoins(full(), 0)).toBe(150);
    expect(dayCoins(blankWeek()[0], 0)).toBe(0);
    expect(dayCoins({ rest: "done", restAt: 1000, study: null, studyAt: null, eve: null }, 0)).toBe(50);
  });

  it("weekend: 100 only if study is clear, else 0 (partial progress doesn't count)", () => {
    expect(dayCoins({ secs: 3600, study: null, studyAt: null }, 5)).toBe(0);
    expect(dayCoins({ secs: 7200, study: "clear", studyAt: 1150 }, 5)).toBe(100);
    expect(dayCoins({ secs: 7200, study: "not", studyAt: 1150 }, 5)).toBe(0);
  });
});

describe("summary() streak/bonus/partial logic", () => {
  it("awards the 200 bonus only when all 5 weekdays are done in a full (non-partial) week", () => {
    const week = fullWeek([0, 1, 2, 3, 4]);
    const clock: Clock = { day: 5, min: 0 };
    const sm = summary(week, 0, clock);
    expect(sm.streak).toBe(5);
    expect(sm.bonus).toBe(200);
    expect(sm.partial).toBe(false);
  });

  it("ends the streak at the first missed weekday and records which day failed", () => {
    const week = fullWeek([0, 1]);
    week[2] = { rest: "not", restAt: null, study: null, studyAt: null, eve: null } as never;
    // simulate Wednesday resolved as missed by advancing the clock past close with nothing ticked
    const clock: Clock = { day: 3, min: 0 };
    const sm = summary(week, 0, clock);
    expect(sm.streak).toBe(2);
    expect(sm.fail).toBe(2);
    expect(sm.bonus).toBe(0);
  });

  it("never awards the bonus in a partial first week even if every day since start is done", () => {
    const week = fullWeek([2, 3, 4]);
    const clock: Clock = { day: 5, min: 0 };
    const sm = summary(week, 2, clock);
    expect(sm.partial).toBe(true);
    expect(sm.streak).toBe(3);
    expect(sm.bonus).toBe(0);
  });
});

describe("liveStreak() shield consumption", () => {
  it("consumes a shield on a missed weekday instead of resetting the streak", () => {
    const week = blankWeek();
    week[0] = full();
    // Tuesday (week[1]) is left blank — with clock past it, status() resolves it to "missed".
    week[2] = full();
    const clock: Clock = { day: 3, min: 0 };
    const stats = { ...zeroStats(), shields: 1 };
    const ls = liveStreak(week, stats, 0, clock);
    expect(ls.used).toBe(1);
    expect(ls.shieldsLeft).toBe(0);
    expect(ls.cur).toBe(2); // Monday + Wednesday count; Tuesday's miss was shielded, not broken
  });

  it("resets the streak to 0 on a miss when no shields remain", () => {
    const week = blankWeek();
    week[0] = full();
    week[2] = full();
    const clock: Clock = { day: 3, min: 0 };
    const stats = { ...zeroStats(), shields: 0 };
    const ls = liveStreak(week, stats, 0, clock);
    expect(ls.used).toBe(0);
    expect(ls.cur).toBe(1); // reset at Tuesday, then Wednesday's done starts a fresh streak of 1
  });

  it("best-ever streak is never lost, even after a later miss", () => {
    const week = blankWeek();
    week[0] = full();
    week[1] = full();
    week[2] = full();
    const clock: Clock = { day: 4, min: 0 };
    const ls = liveStreak(week, zeroStats(), 0, clock);
    expect(ls.best).toBe(3);
    expect(ls.cur).toBe(0);
  });
});

describe("foldKidStats() weekly rollover", () => {
  it("carries best-ever streak forward across weeks even after the streak resets", () => {
    const week1 = fullWeek([0, 1, 2, 3, 4]); // full week, streak of 5
    const afterWeek1 = foldKidStats(zeroStats(), week1, "2026-09-14", 0, true);
    expect(afterWeek1.best).toBe(5);
    expect(afterWeek1.carry).toBe(5);

    // Week 2: Monday is left blank (never ticked) — folded at end-of-week it resolves to "missed".
    const week2 = blankWeek();
    const afterWeek2 = foldKidStats({ ...afterWeek1, shields: 0 }, week2, "2026-09-21", 0, true);
    expect(afterWeek2.carry).toBe(0);
    expect(afterWeek2.best).toBe(5); // best-ever is preserved
  });

  it("adds every week's earnings to lifetimeEarned regardless of payment status", () => {
    const week1 = fullWeek([0, 1, 2, 3, 4]); // 5 full weekdays + 200 bonus = 950
    const paid = foldKidStats(zeroStats(), week1, "2026-09-14", 0, true);
    const unpaid = foldKidStats(zeroStats(), week1, "2026-09-14", 0, false);
    expect(paid.lifetimeEarned).toBe(950);
    expect(unpaid.lifetimeEarned).toBe(950);
  });

  it("carries a week's earnings into carryUnpaid when it closes without being paid, instead of losing them", () => {
    const week1 = fullWeek([0, 1, 2, 3, 4]); // 950 total
    const afterUnpaidWeek = foldKidStats(zeroStats(), week1, "2026-09-14", 0, false);
    expect(afterUnpaidWeek.carryUnpaid).toBe(950);

    // A second unpaid week keeps accumulating rather than overwriting.
    const week2 = fullWeek([0, 1, 2, 3, 4]);
    const afterTwoUnpaidWeeks = foldKidStats(afterUnpaidWeek, week2, "2026-09-21", 0, false);
    expect(afterTwoUnpaidWeeks.carryUnpaid).toBe(1900);
  });

  it("does not add to carryUnpaid when the week was paid before folding", () => {
    const week1 = fullWeek([0, 1, 2, 3, 4]);
    const afterPaidWeek = foldKidStats(zeroStats(), week1, "2026-09-14", 0, true);
    expect(afterPaidWeek.carryUnpaid).toBe(0);
  });
});

describe("readyToCollect() and settlePayment()", () => {
  it("is 0 with no carry and the current week not yet unlocked (before Sunday 8pm)", () => {
    const stats = zeroStats();
    expect(readyToCollect(stats, 500, false, false)).toBe(0);
  });

  it("includes the current week's total once it's unlocked", () => {
    const stats = zeroStats();
    expect(readyToCollect(stats, 500, false, true)).toBe(500);
  });

  it("makes a carried-over balance collectible immediately, even before the current week unlocks", () => {
    const stats = { ...zeroStats(), carryUnpaid: 950 };
    expect(readyToCollect(stats, 500, false, false)).toBe(950);
  });

  it("adds carry and the unlocked current week together", () => {
    const stats = { ...zeroStats(), carryUnpaid: 950 };
    expect(readyToCollect(stats, 500, false, true)).toBe(1450);
  });

  it("settlePayment clears the carried balance and adds the paid amount to lifetimeWithdrawn", () => {
    const stats = { ...zeroStats(), carryUnpaid: 950, lifetimeWithdrawn: 1150 };
    const next = settlePayment(stats, 950);
    expect(next.carryUnpaid).toBe(0);
    expect(next.lifetimeWithdrawn).toBe(2100);
  });
});

describe("badgeTier() and badgeProgress()", () => {
  const badge = { id: "clear" as const, name: "Clear thinker", desc: "", tiers: [5, 20, 50] as [number, number, number], icon: "book" as const };

  it("is Locked below the first threshold", () => {
    expect(badgeTier(4, badge.tiers)).toBe(0);
  });

  it("is exactly Bronze at the first threshold", () => {
    expect(badgeTier(5, badge.tiers)).toBe(1);
  });

  it("is Silver at the second threshold, Gold at the third", () => {
    expect(badgeTier(20, badge.tiers)).toBe(2);
    expect(badgeTier(50, badge.tiers)).toBe(3);
  });

  it("reports maxed once Gold is reached", () => {
    const p = badgeProgress(badge, { streak: 0, clear: 50, early: 0, bed: 0, perfect: 0, weekend: 0 });
    expect(p.maxed).toBe(true);
    expect(p.pct).toBe(100);
  });
});

describe("levelForCoins() thresholds", () => {
  it("starts at Starter with 0 coins", () => {
    expect(levelForCoins(0).name).toBe("Starter");
    expect(levelForCoins(0).level).toBe(1);
  });

  it("is exactly Reader at 1500", () => {
    expect(levelForCoins(1500).name).toBe("Reader");
  });

  it("is Legend (maxed) at the top threshold and beyond", () => {
    expect(levelForCoins(15000).name).toBe("Legend");
    expect(levelForCoins(15000).maxed).toBe(true);
    expect(levelForCoins(999999).name).toBe("Legend");
  });
});

describe("prizeUnlocked()", () => {
  it("unlocks once best-ever streak reaches the prize's day count, and stays unlocked", () => {
    const prize = { days: 20, text: "Choose a treat" };
    expect(prizeUnlocked(prize, 19)).toBe(false);
    expect(prizeUnlocked(prize, 20)).toBe(true);
    // best-ever never decreases, so a later reset doesn't re-lock it
    expect(prizeUnlocked(prize, 20)).toBe(true);
  });
});

describe("challengeForWeek() rotation", () => {
  it("rotates deterministically week over week", () => {
    const weeks = ["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05"];
    const ids = weeks.map((w) => challengeForWeek(w).id);
    // 4 challenges rotating weekly means the 5th week repeats the 1st
    expect(ids[0]).toBe(ids[4]);
    expect(new Set(ids.slice(0, 4)).size).toBe(4);
  });
});

describe("weekCounts()", () => {
  it("counts early rest completions (before 5pm / 1020min) on weekdays only", () => {
    const week = blankWeek();
    week[0] = { rest: "done", restAt: 1019, study: null, studyAt: null, eve: null };
    week[1] = { rest: "done", restAt: 1020, study: null, studyAt: null, eve: null };
    expect(weekCounts(week).early).toBe(1);
  });

  it("requires both weekend days clear for the weekend flag", () => {
    const week = blankWeek();
    week[5] = { secs: 7200, study: "clear", studyAt: 1100 };
    expect(weekCounts(week).weekend).toBe(0);
    week[6] = { secs: 7200, study: "clear", studyAt: 1100 };
    expect(weekCounts(week).weekend).toBe(1);
  });
});

describe("dayState()", () => {
  it("is done only when all three weekday tasks are done", () => {
    const clock: Clock = { day: 0, min: 1300 };
    expect(dayState(full(), 0, 0, clock)).toBe("done");
  });

  it("is missed if any task is missed, even if others are done", () => {
    const rec = { rest: "done" as const, restAt: 1000, study: "not" as const, studyAt: 1150, eve: null };
    const clock: Clock = { day: 0, min: 1300 };
    expect(dayState(rec, 0, 0, clock)).toBe("missed");
  });
});
