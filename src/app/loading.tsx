/**
 * Shown instantly (via React Suspense) while page.tsx's Server Component
 * awaits Supabase — without this, the app shows a blank white screen for
 * the full duration of that fetch, which reads as "not opening" even when
 * it's actually just loading.
 */
export default function Loading() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-paper">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ink">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F5B301" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </div>
      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-sand">
        <div className="h-full w-1/3 animate-[loading-bar_1.1s_ease-in-out_infinite] rounded-full bg-gold" />
      </div>
      <style>{`
        @keyframes loading-bar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}
