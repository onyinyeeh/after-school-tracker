"use client";

import { Check, X, Lock } from "lucide-react";
import { pickCardView } from "@/lib/view-model";
import type { KidData } from "@/lib/tracker-types";
import type { Clock } from "@/lib/rules";

export function PickScreen({
  kids,
  startDay,
  clock,
  paid,
  clockLong,
  pendingCount,
  onPickKid,
  onOpenParent,
}: {
  kids: KidData[];
  startDay: number;
  clock: Clock;
  paid: boolean;
  clockLong: string;
  pendingCount: number;
  onPickKid: (kidId: string) => void;
  onOpenParent: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col gap-6 px-6 pb-8 pt-10">
      <div className="flex flex-col gap-1">
        <div className="text-[15px] font-bold text-muted">{clockLong}</div>
        <h1 className="font-heading text-4xl font-semibold leading-tight">Who&apos;s checking in?</h1>
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))" }}>
        {kids.map((kid) => {
          const view = pickCardView(kid, startDay, clock, paid);
          return (
            <button
              key={kid.id}
              type="button"
              onClick={() => onPickKid(kid.id)}
              className="flex w-full flex-col gap-4 rounded-[24px] border-2 border-ink bg-card p-5 text-left shadow-hard active:translate-y-[3px] active:shadow-hard-sm"
            >
              <div className="flex w-full items-center gap-3.5">
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full font-heading text-[26px] font-semibold text-white"
                  style={{ background: view.color }}
                >
                  {view.initial}
                </div>
                <div className="flex min-w-0 grow flex-col">
                  <div className="font-heading text-[22px] font-semibold">{view.name}</div>
                  <div className="text-sm font-bold text-muted">{view.grade}</div>
                </div>
                <div className="rounded-full bg-gold-soft px-3 py-1.5 font-heading text-[17px] font-semibold">{view.total}</div>
              </div>
              <div className="flex gap-2">
                {view.dots.map((dot, i) => (
                  <div key={i}>
                    {dot.isDone && (
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-green">
                        <Check size={20} color="#FFFFFF" strokeWidth={3} />
                      </div>
                    )}
                    {dot.isMissed && (
                      <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-red bg-red-soft">
                        <X size={18} color="#B3362A" strokeWidth={3} />
                      </div>
                    )}
                    {dot.isToday && (
                      <div className="flex h-11 w-11 items-center justify-center rounded-full border-[2.5px] border-dashed border-ink text-[15px] font-extrabold">
                        {dot.letter}
                      </div>
                    )}
                    {dot.isFuture && (
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-sand text-[15px] font-extrabold text-muted">
                        {dot.letter}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className={`text-sm font-bold ${view.msgGood ? "text-green" : "text-red"}`}>{view.msg}</div>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onOpenParent}
        className="mt-auto flex min-h-[52px] w-full max-w-[420px] items-center gap-3 self-start rounded-[18px] border-2 border-dashed border-muted bg-transparent px-4 py-3 text-left"
      >
        <Lock size={22} color="#1E2A44" strokeWidth={2.2} />
        <div className="grow text-base font-extrabold">Grown-up corner</div>
        {pendingCount > 0 ? (
          <div className="rounded-full bg-gold px-2.5 py-[3px] text-[13px] font-extrabold">{pendingCount} to check</div>
        ) : (
          <div className="text-sm font-bold text-muted">PIN needed</div>
        )}
      </button>
    </div>
  );
}
