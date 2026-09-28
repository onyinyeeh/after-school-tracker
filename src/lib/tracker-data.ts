import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addDays, iso, parseDay } from "@/lib/calendar";
import { blankWeek, zeroStats, type KidStats, type WeekState, type WeekdayRecord, type WeekendRecord } from "@/lib/rules";

export type DayTaskRow = {
  kid_id: string;
  date: string;
  task: "rest" | "study" | "eve" | "weekend_study";
  status: "done" | "finished" | "clear" | "not" | null;
  done_at_min: number | null;
  study_secs: number;
};

export async function getWeekTasks(kidIds: string[], weekStart: string): Promise<DayTaskRow[]> {
  if (kidIds.length === 0) return [];
  const supabase = await createClient();
  const end = iso(addDays(parseDay(weekStart), 6));
  const { data, error } = await supabase
    .from("day_tasks")
    .select("kid_id, date, task, status, done_at_min, study_secs")
    .in("kid_id", kidIds)
    .gte("date", weekStart)
    .lte("date", end);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Reshapes one kid's flat `day_tasks` rows for the week into the `WeekState` array the rules engine expects. */
export function buildWeekState(weekStart: string, tasks: DayTaskRow[], kidId: string): WeekState {
  const week = blankWeek();
  const start = parseDay(weekStart);
  for (const t of tasks) {
    if (t.kid_id !== kidId) continue;
    const day = Math.round((parseDay(t.date).getTime() - start.getTime()) / 86_400_000);
    if (day < 0 || day > 6) continue;
    if (day < 5) {
      const rec = week[day] as WeekdayRecord;
      if (t.task === "rest") {
        rec.rest = t.status === "done" ? "done" : null;
        rec.restAt = t.done_at_min;
      } else if (t.task === "study") {
        rec.study = (t.status as WeekdayRecord["study"]) ?? null;
        rec.studyAt = t.done_at_min;
      } else if (t.task === "eve") {
        rec.eve = t.status === "done" ? "done" : null;
      }
    } else if (t.task === "weekend_study") {
      const rec = week[day] as WeekendRecord;
      rec.study = (t.status as WeekendRecord["study"]) ?? null;
      rec.studyAt = t.done_at_min;
      rec.secs = t.study_secs;
    }
  }
  return week;
}

export async function getKidStats(kidIds: string[]): Promise<Record<string, KidStats>> {
  const out: Record<string, KidStats> = {};
  for (const id of kidIds) out[id] = zeroStats();
  if (kidIds.length === 0) return out;

  const supabase = await createClient();
  const { data, error } = await supabase.from("kid_stats").select("*").in("kid_id", kidIds);
  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    out[row.kid_id] = {
      early: row.early,
      clear: row.clear,
      bed: row.bed,
      perfect: row.perfect,
      weekend: row.weekend,
      best: row.best_streak,
      carry: row.carry_streak,
      shields: row.shields,
      challenges: row.challenges_won,
    };
  }
  return out;
}

export type PrizeRow = { id: string; days: number; text: string; sort: number };
export type WithdrawalRow = { id: string; kid_id: string; week_id: string; amount: number; paid_at: string | null };
export type WeekHistoryRow = {
  id: string;
  kid_id: string;
  week_start: string;
  amount: number;
  bonus: boolean;
  note: string;
  paid_label: string;
};

export async function getPrizes(familyId: string): Promise<PrizeRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prizes")
    .select("id, days, text, sort")
    .eq("family_id", familyId)
    .order("sort", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getPrizesGiven(kidIds: string[]): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  for (const id of kidIds) out[id] = [];
  if (kidIds.length === 0) return out;
  const supabase = await createClient();
  const { data, error } = await supabase.from("prizes_given").select("kid_id, prize_id").in("kid_id", kidIds);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) out[row.kid_id]?.push(row.prize_id);
  return out;
}

export async function getWithdrawalsForWeek(weekId: string): Promise<WithdrawalRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("withdrawals")
    .select("id, kid_id, week_id, amount, paid_at")
    .eq("week_id", weekId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getWeekHistory(kidIds: string[], limit = 8): Promise<Record<string, WeekHistoryRow[]>> {
  const out: Record<string, WeekHistoryRow[]> = {};
  for (const id of kidIds) out[id] = [];
  if (kidIds.length === 0) return out;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("week_history")
    .select("id, kid_id, week_start, amount, bonus, note, paid_label")
    .in("kid_id", kidIds)
    .order("week_start", { ascending: false })
    .limit(limit * kidIds.length);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) out[row.kid_id]?.push(row);
  return out;
}
