import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildWeekState } from "@/lib/tracker-data";
import { addDays, iso, mondayOf, parseDay, SHORT_DAYS } from "@/lib/calendar";
import { foldKidStats, summary, zeroStats } from "@/lib/rules";

/**
 * Weekly rollover: for every week that has ended and hasn't been folded
 * yet, folds each kid's stats into `kid_stats` and writes a `week_history`
 * row. Idempotent via `weeks.folded_at`. Scheduled Monday 00:05 (see
 * vercel.json); also safe to call lazily/manually — it only touches weeks
 * strictly before the current week that aren't folded yet.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const currentWeekStart = mondayOf(new Date());

  const { data: weeks, error } = await supabase
    .from("weeks")
    .select("id, family_id, week_start, start_day, paid_at")
    .is("folded_at", null)
    .lt("week_start", currentWeekStart);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let kidWeeksFolded = 0;

  for (const week of weeks ?? []) {
    const { data: kids } = await supabase.from("kids").select("id").eq("family_id", week.family_id);

    for (const kid of kids ?? []) {
      const { data: tasks } = await supabase
        .from("day_tasks")
        .select("kid_id, date, task, status, done_at_min, study_secs")
        .eq("kid_id", kid.id)
        .gte("date", week.week_start)
        .lte("date", iso(addDays(parseDay(week.week_start), 6)));

      const weekState = buildWeekState(week.week_start, tasks ?? [], kid.id);

      const { data: statsRow } = await supabase.from("kid_stats").select("*").eq("kid_id", kid.id).maybeSingle();
      const prevStats = statsRow
        ? {
            early: statsRow.early,
            clear: statsRow.clear,
            bed: statsRow.bed,
            perfect: statsRow.perfect,
            weekend: statsRow.weekend,
            best: statsRow.best_streak,
            carry: statsRow.carry_streak,
            shields: statsRow.shields,
            challenges: statsRow.challenges_won,
            lifetimeEarned: statsRow.lifetime_earned,
            lifetimeWithdrawn: statsRow.lifetime_withdrawn,
            carryUnpaid: statsRow.carry_unpaid,
          }
        : zeroStats();

      const weekWasPaid = !!week.paid_at;
      const next = foldKidStats(prevStats, weekState, week.week_start, week.start_day, weekWasPaid);

      await supabase.from("kid_stats").upsert({
        kid_id: kid.id,
        early: next.early,
        clear: next.clear,
        bed: next.bed,
        perfect: next.perfect,
        weekend: next.weekend,
        best_streak: next.best,
        carry_streak: next.carry,
        shields: next.shields,
        challenges_won: next.challenges,
        lifetime_earned: next.lifetimeEarned,
        lifetime_withdrawn: next.lifetimeWithdrawn,
        carry_unpaid: next.carryUnpaid,
        updated_at: new Date().toISOString(),
      });

      const sm = summary(weekState, week.start_day, { day: 7, min: 0 });
      const paidLabel = weekWasPaid
        ? `Paid ${new Date(week.paid_at!).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" })}`
        : "Not marked paid — carried to next payout";
      await supabase.from("week_history").insert({
        kid_id: kid.id,
        week_start: week.week_start,
        amount: sm.total,
        bonus: sm.bonus > 0,
        note: sm.bonus
          ? "Full streak · +200 bonus"
          : sm.fail >= 0
            ? `${SHORT_DAYS[sm.fail]} missed · no bonus`
            : sm.partial
              ? "First week"
              : "No streak bonus",
        paid_label: paidLabel,
      });

      kidWeeksFolded++;
    }

    await supabase.from("weeks").update({ folded_at: new Date().toISOString() }).eq("id", week.id);
  }

  return NextResponse.json({ ok: true, weeksFolded: weeks?.length ?? 0, kidWeeksFolded });
}
