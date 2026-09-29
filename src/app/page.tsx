import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getKids, getOrCreateCurrentWeek, getOrCreateFamily } from "@/lib/family";
import {
  buildWeekState,
  getKidStats,
  getPrizes,
  getPrizesGiven,
  getWeekHistory,
  getWeekTasks,
  getWithdrawalsForWeek,
} from "@/lib/tracker-data";
import { weekLabel } from "@/lib/calendar";
import { currentClock } from "@/lib/clock";
import { TrackerApp } from "@/components/TrackerApp";
import type { TrackerInitialData } from "@/lib/tracker-types";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const family = await getOrCreateFamily(user.id);
  // getKids and getOrCreateCurrentWeek both only depend on family.id, not on
  // each other — running them in parallel saves a full network round-trip
  // to Supabase on every app open.
  const [kids, week] = await Promise.all([getKids(family.id), getOrCreateCurrentWeek(family.id)]);

  const kidIds = kids.map((k) => k.id);
  const [tasks, stats, prizes, prizesGiven, withdrawals, history, pinIsDefault] = await Promise.all([
    getWeekTasks(kidIds, week.week_start),
    getKidStats(kidIds),
    getPrizes(family.id),
    getPrizesGiven(kidIds),
    getWithdrawalsForWeek(week.id),
    getWeekHistory(kidIds),
    bcrypt.compare("1234", family.pin_hash),
  ]);

  const data: TrackerInitialData = {
    familyId: family.id,
    timezone: family.timezone,
    pinIsDefault,
    week: { id: week.id, weekStart: week.week_start, startDay: week.start_day, paidAt: week.paid_at },
    weekRange: weekLabel(week.week_start),
    clock: currentClock(family.timezone),
    kids: kids.map((k) => ({
      id: k.id,
      name: k.name,
      grade: k.grade,
      color: k.color,
      week: buildWeekState(week.week_start, tasks, k.id),
      stats: stats[k.id],
      prizesGiven: prizesGiven[k.id] ?? [],
      withdrawal: (() => {
        const w = withdrawals.find((w) => w.kid_id === k.id);
        return w ? { id: w.id, amount: w.amount, paidAt: w.paid_at } : null;
      })(),
      history: (history[k.id] ?? []).map((h) => ({
        id: h.id,
        weekStart: h.week_start,
        amount: h.amount,
        bonus: h.bonus,
        note: h.note,
        paidLabel: h.paid_label,
      })),
    })),
    prizes: prizes.map((p) => ({ id: p.id, days: p.days, text: p.text, sort: p.sort })),
  };

  return <TrackerApp data={data} />;
}
