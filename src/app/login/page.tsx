"use client";

import { useActionState } from "react";
import { sendMagicLink, type MagicLinkState } from "@/lib/actions/auth";

export default function LoginPage() {
  const [state, action, pending] = useActionState<MagicLinkState, FormData>(sendMagicLink, undefined);

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-6 px-6 py-10">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ink">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFF7E8" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
      </div>

      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="font-heading text-3xl font-semibold">After-School Tracker</h1>
        <p className="text-[15px] font-bold text-muted">Sign in as the family&apos;s grown-up</p>
      </div>

      {state?.sent ? (
        <div className="w-full max-w-sm rounded-2xl border-2 border-ink bg-card p-5 text-center">
          <p className="font-bold">Check your email</p>
          <p className="mt-1 text-sm font-semibold text-muted">
            We sent a sign-in link. Open it on this computer to finish signing in.
          </p>
        </div>
      ) : (
        <form action={action} className="flex w-full max-w-sm flex-col gap-3">
          <input
            type="email"
            name="email"
            required
            placeholder="you@example.com"
            className="min-h-[52px] rounded-2xl border-2 border-line bg-card px-4 text-base font-bold outline-none focus:border-ink"
          />
          {state?.error && <p className="text-sm font-bold text-red">{state.error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="min-h-[52px] rounded-2xl bg-ink text-[17px] font-extrabold text-paper disabled:opacity-60"
          >
            {pending ? "Sending…" : "Send sign-in link"}
          </button>
        </form>
      )}
    </div>
  );
}
