"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getKids, getOrCreateFamily } from "@/lib/family";
import { buildWeekState, getKidStats, getWeekTasks } from "@/lib/tracker-data";
import { grantPinUnlock, hasPinUnlock, revokePinUnlock } from "@/lib/pin-session";
import { currentClock } from "@/lib/clock";
import { isPayWindowOpen, readyToCollect, settlePayment, summary, type TaskKey } from "@/lib/rules";

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
 * Confirms one kid's withdrawal, signed with initials by the kid and the
 * grown-up. Settles that kid's ready-to-collect balance: any carried
 * forward unpaid amount from past weeks plus this week's earnings while the
 * Sunday 8pm-11:59pm window is open. Safe to call twice: a kid who is
 * already paid for the week is left alone.
 */
export async function confirmWithdrawal(kidId: string, weekId: string, kidInitials: string, parentInitials: string) {
  const { supabase, family } = await requireFamily();
  await requirePinUnlocked(family.id);

  const kidSign = kidInitials.trim().toUpperCase().slice(0, 4);
  const parentSign = parentInitials.trim().toUpperCase().slice(0, 4);
  if (!kidSign || !parentSign) throw new Error("Both sets of initials are needed.");

  const { data: week, error: weekError } = await supabase
    .from("weeks")
    .select("id, week_start, start_day")
    .eq("id", weekId)
    .eq("family_id", family.id)
    .single();
  if (weekError || !week) throw new Error(weekError?.message ?? "Week not found.");

  const kids = await getKids(family.id);
  if (!kids.some((k) => k.id === kidId)) throw new Error("Kid not found.");

  const { data: existing, error: existingErr } = await supabase
    .from("withdrawals")
    .select("id, paid_at")
    .eq("kid_id", kidId)
    .eq("week_id", weekId);
  if (existingErr) throw new Error(existingErr.message);
  if (existing?.some((w) => w.paid_at)) return;

  const [tasks, statsByKid] = await Promise.all([getWeekTasks([kidId], week.week_start), getKidStats([kidId])]);
  const clock = currentClock(family.timezone);
  const stats = statsByKid[kidId];
  const sm = summary(buildWeekState(week.week_start, tasks, kidId), week.start_day, clock);
  const paidAmount = readyToCollect(stats, sm.total, false, isPayWindowOpen(clock));
  if (paidAmount <= 0) throw new Error("Nothing to withdraw right now.");

  const paidAt = new Date().toISOString();
  const next = settlePayment(stats, paidAmount);
  const { error: statsErr } = await supabase
    .from("kid_stats")
    .upsert({ kid_id: kidId, carry_unpaid: next.carryUnpaid, lifetime_withdrawn: next.lifetimeWithdrawn, updated_at: paidAt });
  if (statsErr) throw new Error(statsErr.message);

  const signed = { amount: paidAmount, paid_at: paidAt, kid_initials: kidSign, parent_initials: parentSign };
  // Close out the kid's pending request for this week if there is one, otherwise record a fresh row.
  const pending = existing?.[0];
  const { error } = pending
    ? await supabase.from("withdrawals").update(signed).eq("id", pending.id)
    : await supabase.from("withdrawals").insert({ kid_id: kidId, week_id: weekId, requested_at: paidAt, ...signed });
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
