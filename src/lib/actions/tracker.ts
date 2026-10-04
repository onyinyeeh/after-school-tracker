"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getKids, getOrCreateFamily } from "@/lib/family";
import { buildWeekState, getKidStats, getWeekTasks } from "@/lib/tracker-data";
import { grantPinUnlock, hasPinUnlock, revokePinUnlock } from "@/lib/pin-session";
import { currentClock } from "@/lib/clock";
import { readyToCollect, settlePayment, summary, type TaskKey } from "@/lib/rules";

async function requireFamily() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  const family = await getOrCreateFamily(user.id);
  return { supabase, family };
}

async function requirePinUnlocked(familyId: string) {
  if (!(await hasPinUnlock(familyId))) {
    throw new Error("Grown-up PIN required.");
  }
}

// ── Kid-facing actions (no PIN) ────────────────────────────────────────

export async function tickTask(kidId: string, date: string, task: TaskKey, doneAtMin: number) {
  const { supabase } = await requireFamily();
  const status = task === "study" ? "finished" : "done";
  const { error } = await supabase
    .from("day_tasks")
    .upsert({ kid_id: kidId, date, task, status, done_at_min: doneAtMin }, { onConflict: "kid_id,date,task" });
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

export async function undoStudy(kidId: string, date: string, weekend = false) {
  const { supabase } = await requireFamily();
  const task = weekend ? "weekend_study" : "study";
  const { error } = await supabase
    .from("day_tasks")
    .upsert({ kid_id: kidId, date, task, status: null, done_at_min: null }, { onConflict: "kid_id,date,task" });
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

export async function saveWeekendStudySeconds(kidId: string, date: string, secs: number) {
  const { supabase } = await requireFamily();
  const { error } = await supabase
    .from("day_tasks")
    .upsert({ kid_id: kidId, date, task: "weekend_study", study_secs: secs }, { onConflict: "kid_id,date,task" });
  if (error) throw new Error(error.message);
}

export async function finishWeekendStudy(kidId: string, date: string, secs: number, doneAtMin: number) {
  const { supabase } = await requireFamily();
  const { error } = await supabase.from("day_tasks").upsert(
    { kid_id: kidId, date, task: "weekend_study", status: "finished", study_secs: secs, done_at_min: doneAtMin },
    { onConflict: "kid_id,date,task" }
  );
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

export async function requestWithdraw(kidId: string, weekId: string, amount: number) {
  const { supabase } = await requireFamily();
  const { error } = await supabase.from("withdrawals").insert({ kid_id: kidId, week_id: weekId, amount });
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

// ── PIN gate ─────────────────────────────────────────────────────────

export async function verifyPin(pin: string): Promise<{ ok: boolean }> {
  const { family } = await requireFamily();
  const ok = await bcrypt.compare(pin, family.pin_hash);
  if (!ok) return { ok: false };
  await grantPinUnlock(family.id);
  return { ok: true };
}

export async function lockGrownUp() {
  await revokePinUnlock();
  revalidatePath("/");
}

// ── Grown-up actions — every call re-verifies the PIN-unlock cookie ────

export async function markExplanation(kidId: string, date: string, task: "study" | "weekend_study", clear: boolean) {
  const { supabase, family } = await requireFamily();
  await requirePinUnlocked(family.id);
  const { error } = await supabase
    .from("day_tasks")
    .update({ status: clear ? "clear" : "not" })
    .eq("kid_id", kidId)
    .eq("date", date)
    .eq("task", task);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

export async function undoExplanationCheck(kidId: string, date: string, task: "study" | "weekend_study") {
  const { supabase, family } = await requireFamily();
  await requirePinUnlocked(family.id);
  const { error } = await supabase
    .from("day_tasks")
    .update({ status: "finished" })
    .eq("kid_id", kidId)
    .eq("date", date)
    .eq("task", task);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

export async function fixTick(
  kidId: string,
  date: string,
  task: TaskKey,
  status: "done" | "clear" | "not" | null,
  doneAtMin: number | null
) {
  const { supabase, family } = await requireFamily();
  await requirePinUnlocked(family.id);
  const { error } = await supabase
    .from("day_tasks")
    .upsert({ kid_id: kidId, date, task, status, done_at_min: doneAtMin }, { onConflict: "kid_id,date,task" });
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

/**
 * Settles every kid's ready-to-collect balance for this week — any carried
 * forward unpaid amount from past weeks plus this week's earnings, once
 * they've unlocked (Sunday 8pm). The carried balance is always included
 * regardless of day, which is what lets a grown-up catch up on a missed
 * payday without that week's coins having been lost.
 */
export async function markWeekPaid(weekId: string) {
  const { supabase, family } = await requireFamily();
  await requirePinUnlocked(family.id);

  const { data: week, error: weekError } = await supabase
    .from("weeks")
    .select("id, week_start, start_day, paid_at")
    .eq("id", weekId)
    .eq("family_id", family.id)
    .single();
  if (weekError || !week) throw new Error(weekError?.message ?? "Week not found.");

  const kids = await getKids(family.id);
  const kidIds = kids.map((k) => k.id);
  const [tasks, statsByKid] = await Promise.all([getWeekTasks(kidIds, week.week_start), getKidStats(kidIds)]);

  const clock = currentClock(family.timezone);
  const payOpenTime = clock.day === 6 && clock.min >= 1200;
  const paidAt = new Date().toISOString();

  for (const kid of kids) {
    const weekState = buildWeekState(week.week_start, tasks, kid.id);
    const sm = summary(weekState, week.start_day, clock);
    const stats = statsByKid[kid.id];
    const paidAmount = readyToCollect(stats, sm.total, false, payOpenTime);
    if (paidAmount <= 0) continue;

    const next = settlePayment(stats, paidAmount);
    const { error: statsErr } = await supabase
      .from("kid_stats")
      .upsert({ kid_id: kid.id, carry_unpaid: next.carryUnpaid, lifetime_withdrawn: next.lifetimeWithdrawn, updated_at: paidAt });
    if (statsErr) throw new Error(statsErr.message);

    const { error: withdrawErr } = await supabase
      .from("withdrawals")
      .insert({ kid_id: kid.id, week_id: weekId, amount: paidAmount, requested_at: paidAt, paid_at: paidAt });
    if (withdrawErr) throw new Error(withdrawErr.message);
  }

  // Any earlier pending request rows for this week are now settled by the
  // rows above — close them out too so they don't show as "still waiting".
  await supabase.from("withdrawals").update({ paid_at: paidAt }).eq("week_id", weekId).is("paid_at", null);

  const { error } = await supabase.from("weeks").update({ paid_at: paidAt }).eq("id", weekId);
  if (error) throw new Error(error.message);

  revalidatePath("/");
}

export async function changePin(newPin: string) {
  const { supabase, family } = await requireFamily();
  await requirePinUnlocked(family.id);
  const hash = await bcrypt.hash(newPin, 10);
  const { error } = await supabase.from("families").update({ pin_hash: hash }).eq("id", family.id);
  if (error) throw new Error(error.message);
}

export async function editKid(kidId: string, patch: { name?: string; grade?: string }) {
  const { supabase, family } = await requireFamily();
  await requirePinUnlocked(family.id);
  const { error } = await supabase.from("kids").update(patch).eq("id", kidId).eq("family_id", family.id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

export async function upsertPrize(prizeId: string | null, days: number, text: string, sort: number) {
  const { supabase, family } = await requireFamily();
  await requirePinUnlocked(family.id);
  if (prizeId) {
    const { error } = await supabase.from("prizes").update({ days, text }).eq("id", prizeId).eq("family_id", family.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("prizes").insert({ family_id: family.id, days, text, sort });
    if (error) throw new Error(error.message);
  }
  revalidatePath("/");
}

export async function markPrizeGiven(kidId: string, prizeId: string) {
  const { supabase, family } = await requireFamily();
  await requirePinUnlocked(family.id);
  const { error } = await supabase.from("prizes_given").insert({ kid_id: kidId, prize_id: prizeId });
  if (error) throw new Error(error.message);
  revalidatePath("/");
}
