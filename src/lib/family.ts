import "server-only";
import bcrypt from "bcryptjs";
import { createClient } from "@/lib/supabase/server";
import { mondayOf } from "@/lib/calendar";

export type FamilyRow = { id: string; pin_hash: string; timezone: string };
export type KidRow = { id: string; name: string; grade: string; color: string; sort: number };
export type WeekRow = { id: string; week_start: string; start_day: number; paid_at: string | null };

const DEFAULT_KIDS = [
  { name: "Muna", grade: "Primary 5", color: "#A3326A", sort: 0 },
  { name: "Ozi", grade: "JSS 2", color: "#1F6FA8", sort: 1 },
];

/** Fetches the signed-in parent's family, creating it (and default kids) on first sign-in. */
export async function getOrCreateFamily(userId: string): Promise<FamilyRow> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("families")
    .select("id, pin_hash, timezone")
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (existing) return existing;

  const pinHash = await bcrypt.hash("1234", 10);
  const { data: created, error } = await supabase
    .from("families")
    .insert({ owner_user_id: userId, pin_hash: pinHash })
    .select("id, pin_hash, timezone")
    .single();

  if (error || !created) throw new Error(error?.message ?? "Failed to create family");

  await supabase.from("kids").insert(DEFAULT_KIDS.map((k) => ({ ...k, family_id: created.id })));

  return created;
}

export async function getKids(familyId: string): Promise<KidRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kids")
    .select("id, name, grade, color, sort")
    .eq("family_id", familyId)
    .order("sort", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Fetches (or creates) the family's current ISO week, computing a partial `start_day` only for a brand-new family. */
export async function getOrCreateCurrentWeek(familyId: string): Promise<WeekRow> {
  const supabase = await createClient();
  const weekStart = mondayOf(new Date());

  const { data: existing } = await supabase
    .from("weeks")
    .select("id, week_start, start_day, paid_at")
    .eq("family_id", familyId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (existing) return existing;

  const { count } = await supabase
    .from("weeks")
    .select("id", { count: "exact", head: true })
    .eq("family_id", familyId);
  const startDay = !count ? (new Date().getDay() + 6) % 7 : 0;

  const { data: created, error } = await supabase
    .from("weeks")
    .insert({ family_id: familyId, week_start: weekStart, start_day: startDay })
    .select("id, week_start, start_day, paid_at")
    .single();

  if (error || !created) throw new Error(error?.message ?? "Failed to create week");
  return created;
}
