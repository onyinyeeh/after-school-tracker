"use client";

import { initialOf } from "@/lib/view-model";

const TABS = [
  { id: "today", label: "Today" },
  { id: "streak", label: "Streak" },
  { id: "wallet", label: "Wallet" },
] as const;

export function KidHeader({
  name,
  color,
  tab,
  onSwitch,
  onTab,
}: {
  name: string;
  color: string;
  tab: string;
  onSwitch: () => void;
  onTab: (tab: "today" | "streak" | "wallet") => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-4">
        <button type="button" onClick={onSwitch} className="flex min-h-11 items-center gap-1 border-none bg-transparent text-[15px] font-extrabold">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1E2A44" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          Switch
        </button>
        <div className="flex items-center gap-2 rounded-full border-[1.5px] border-line bg-card py-1 pl-1 pr-3">
          <div
            className="flex h-[30px] w-[30px] items-center justify-center rounded-full font-heading font-semibold text-white"
            style={{ background: color }}
          >
            {initialOf(name)}
          </div>
          <div className="text-sm font-extrabold">{name}</div>
        </div>
      </div>
      <div className="grid flex-1 grid-cols-3 gap-1.5 rounded-[20px] border-[1.5px] border-line bg-card p-1.5" style={{ flexBasis: 320, maxWidth: 460 }}>
        {TABS.map((t) =>
          t.id === tab ? (
            <button key={t.id} type="button" aria-current="page" className="min-h-12 rounded-[14px] border-none bg-ink text-[15px] font-extrabold text-paper">
              {t.label}
            </button>
          ) : (
            <button
              key={t.id}
              type="button"
              onClick={() => onTab(t.id)}
              className="min-h-12 rounded-[14px] border-none bg-transparent text-[15px] font-extrabold hover:bg-sand"
            >
              {t.label}
            </button>
          )
        )}
      </div>
    </div>
  );
}
