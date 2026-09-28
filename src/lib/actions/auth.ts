"use server";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

export type MagicLinkState = { error?: string; sent?: boolean } | undefined;

export async function sendMagicLink(_prev: MagicLinkState, formData: FormData): Promise<MagicLinkState> {
  const email = String(formData.get("email") || "").trim();
  if (!email) return { error: "Enter your email address." };

  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) return { error: error.message };
  return { sent: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
