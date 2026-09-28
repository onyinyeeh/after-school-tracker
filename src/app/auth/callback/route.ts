import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

/** Magic-link redirect target — exchanges the emailed code for a session cookie. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL("/", request.url));
}
