"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { fixRowsView, parentChecksView, payoutView, prizesDueView } from "@/lib/view-model";
import { DAYS } from "@/lib/calendar";
import type { KidData, PrizeData } from "@/lib/tracker-types";
import type { Clock, TaskKey } from "@/lib/rules";

type PanelKey = "fix" | "names" | "prizes" | null;

export function ParentCorner({
  kids,
  prizes,
  startDay,
  clock,
  paid,
  payOpenTime,
  toast,
  onGoPick,
  onMarkClear,
  onMarkNotClear,
  onUndoCheck,
  onGivePrize,
  onMarkPaid,
  onFixTick,
  onChangePin,
  onEditKid,
  onUpsertPrize,
}: {
  kids: KidData[];
  prizes: PrizeData[];
  startDay: number;
  clock: Clock;
  paid: boolean;
  payOpenTime: boolean;
  toast: string;
  onGoPick: () => void;
  onMarkClear: (kidId: string, day: number, task: "study" | "weekend_study") => void;
  onMarkNotClear: (kidId: string, day: number, task: "study" | "weekend_study") => void;
  onUndoCheck: (kidId: string, day: number, task: "study" | "weekend_study") => void;
  onGivePrize: (kidId: string, prizeId: string) => void;
  onMarkPaid: () => void;
  onFixTick: (kidId: string, task: TaskKey, on: boolean) => void;
  onChangePin: () => void;
  onEditKid: (kidId: string, patch: { name?: string; grade?: string }) => void;
  onUpsertPrize: (prizeId: string | null, days: number, text: string, sort: number) => void;
}) {
  const [panel, setPanel] = useState<PanelKey>(null);

  const checks = parentChecksView(kids);
  const pending = checks.filter((c) => c.status === "finished");
  const prizeDue = prizesDueView(kids, prizes, startDay, clock);
  const payout = payoutView(kids, startDay, clock, paid, payOpenTime);
  const fixRows = fixRowsView(kids, startDay, clock);

  return (
    <div className="flex flex-1 flex-col gap-4 px-6 pb-10 pt-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 rounded-full bg-green-soft px-3 py-1.5 text-[13px] font-extrabold text-green">
          <Lock size={16} color="#1F7A4D" strokeWidth={2.4} />
          Unlocked
        </div>
        <button type="button" onClick={onGoPick} className="min-h-11 border-none bg-transparent px-1 text-[15px] font-extrabold underline">
          Lock &amp; exit
        </button>
      </div>

      <h1 className="font-heading text-[32px] font-semibold">Grown-up corner</h1>
      {toast && <div className="rounded-2xl bg-green-soft p-3.5 font-extrabold text-green">{toast}</div>}

      <div className="grid items-start gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 400px), 1fr))" }}>
        <div className="flex min-w-0 flex-col gap-3.5">
          {prizeDue.length > 0 && (
            <div className="flex flex-col gap-2.5 rounded-[22px] border-2 border-ink bg-gold-soft p-4">
              <div className="text-[17px] font-extrabold">Prizes to give</div>
              {prizeDue.map((pd) => (
                <div key={pd.kidId + pd.prizeId} className="flex items-center gap-2.5 rounded-2xl bg-card p-2.5">
                  <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full font-heading font-semibold text-white" style={{ background: pd.kidColor }}>
                    {pd.kidInitial}
                  </div>
                  <div className="flex min-w-0 grow flex-col">
                    <div className="font-extrabold">{pd.text}</div>
                    <div className="text-[13px] font-bold text-muted">
                      {pd.kidName} · {pd.days}-day streak
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onGivePrize(pd.kidId, pd.prizeId)}
                    className="min-h-11 whitespace-nowrap rounded-xl border-none bg-ink px-3.5 text-sm font-extrabold text-paper"
                  >
                    Mark given
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-0.5 px-0.5">
            <div className="text-[17px] font-extrabold">Check explanations</div>
            <div className="text-sm font-bold text-muted">{pending.length ? `${pending.length} waiting for you` : "All caught up"}</div>
          </div>

          {checks.length === 0 && (
            <div className="rounded-[20px] border-2 border-dashed border-line p-4 text-sm font-bold text-muted">
              Nothing to check. When someone taps &quot;I&apos;ve finished studying&quot;, they&apos;ll show up here.
            </div>
          )}

          {checks.map((c) => (
            <div key={c.kidId + c.day} className="flex flex-col gap-3 rounded-[22px] border-2 border-ink bg-card p-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full font-heading font-semibold text-white" style={{ background: c.kidColor }}>
                  {c.kidInitial}
                </div>
                <div className="flex grow flex-col">
                  <div className="font-extrabold">{c.kidName}</div>
                  <div className="text-[13px] font-semibold text-muted">{c.when}</div>
                </div>
              </div>
              <div className="rounded-2xl bg-note p-3 text-sm font-semibold leading-relaxed">
                Ask: What did you read? What was it mostly about? Tell me one new thing you learned.
              </div>
              {c.status === "finished" && (
                <div className="grid grid-cols-2 gap-2.5">
                  <button type="button" onClick={() => onMarkClear(c.kidId, c.day, c.task)} className="min-h-[50px] rounded-2xl border-none bg-green text-[15px] font-extrabold text-white">
                    Clear · +{c.coins}
                  </button>
                  <button type="button" onClick={() => onMarkNotClear(c.kidId, c.day, c.task)} className="min-h-[50px] rounded-2xl border-2 border-red bg-card text-[15px] font-extrabold text-red">
                    Not clear
                  </button>
                </div>
              )}
              {c.status === "clear" && (
                <div className="flex items-center gap-2.5 rounded-2xl bg-green-soft py-1 pl-3 pr-1 font-extrabold text-green">
                  <span className="grow">Marked clear · +{c.coins} coins</span>
                  <button type="button" onClick={() => onUndoCheck(c.kidId, c.day, c.task)} className="min-h-11 border-none bg-transparent px-2.5 font-extrabold text-ink underline">
                    Undo
                  </button>
                </div>
              )}
              {c.status === "not" && (
                <div className="flex items-center gap-2.5 rounded-2xl bg-red-soft py-1 pl-3 pr-1 font-extrabold text-red">
                  <span className="grow">Not clear · 0 coins{c.day < 5 ? ", streak ended" : ""}</span>
                  <button type="button" onClick={() => onUndoCheck(c.kidId, c.day, c.task)} className="min-h-11 border-none bg-transparent px-2.5 font-extrabold text-ink underline">
                    Undo
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex min-w-0 flex-col gap-3.5">
          <div className="flex flex-col gap-2.5 rounded-[22px] bg-ink p-4 text-paper">
            <div className="text-[17px] font-extrabold">Sunday payout</div>
            {payout.rows.map((r, i) => (
              <div key={i} className="flex justify-between gap-2 font-bold">
                <span>{r.name}</span>
                <span>{r.amountLabel}</span>
              </div>
            ))}
            <div className="h-[1.5px] bg-darkline" />
            <div className="flex items-baseline justify-between">
              <span className="font-extrabold">{paid ? "You paid" : "You'll pay"}</span>
              <span className="font-heading text-[26px] font-semibold text-gold">{payout.total}</span>
            </div>
            {!paid && payout.totalAmount === 0 && (
              <button type="button" disabled className="min-h-[50px] rounded-2xl border-2 border-dashed border-grey bg-transparent text-[15px] font-extrabold text-soft">
                {payOpenTime ? "Nothing to pay yet" : "Nothing owed yet · opens Sunday 8pm"}
              </button>
            )}
            {!paid && payout.totalAmount > 0 && (
              <button type="button" onClick={onMarkPaid} className="min-h-[50px] rounded-2xl border-none bg-gold text-base font-extrabold text-ink">
                Mark {payout.total} as paid
              </button>
            )}
            {paid && <div className="flex min-h-[50px] items-center justify-center rounded-2xl border-2 border-darkline text-[15px] font-extrabold">Paid ✓ · new week starts Monday</div>}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setPanel(panel === "fix" ? null : "fix")} className="min-h-[50px] rounded-2xl border-2 border-ink bg-card font-extrabold">
              {panel === "fix" ? "Close" : "Fix a tick"}
            </button>
            <button type="button" onClick={onChangePin} className="min-h-[50px] rounded-2xl border-2 border-ink bg-card font-extrabold">
              Change PIN
            </button>
            <button type="button" onClick={() => setPanel(panel === "names" ? null : "names")} className="min-h-[50px] rounded-2xl border-2 border-ink bg-card font-extrabold">
              {panel === "names" ? "Close" : "Edit names"}
            </button>
            <button type="button" onClick={() => setPanel(panel === "prizes" ? null : "prizes")} className="min-h-[50px] rounded-2xl border-2 border-ink bg-card font-extrabold">
              {panel === "prizes" ? "Close" : "Prizes"}
            </button>
          </div>

          {panel === "prizes" && (
            <div className="flex flex-col gap-3 rounded-[20px] border-[1.5px] border-line bg-card p-4">
              <div className="flex flex-col gap-0.5">
                <div className="text-[15px] font-extrabold">Streak prizes</div>
                <div className="text-[13px] font-semibold text-muted">Real rewards you give when a streak reaches the number of days.</div>
              </div>
              {prizes.map((p) => (
                <div key={p.id} className="grid items-center gap-2" style={{ gridTemplateColumns: "96px 1fr" }}>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      defaultValue={p.days}
                      onBlur={(e) => onUpsertPrize(p.id, Math.max(1, parseInt(e.target.value, 10) || 1), p.text, p.sort)}
                      className="box-border w-[60px] min-h-12 rounded-xl border-2 border-line bg-paper px-2 text-base font-extrabold"
                    />
                    <span className="text-[13px] font-bold text-muted">days</span>
                  </div>
                  <input
                    type="text"
                    defaultValue={p.text}
                    placeholder="Prize"
                    onBlur={(e) => onUpsertPrize(p.id, p.days, e.target.value, p.sort)}
                    className="box-border min-h-12 rounded-xl border-2 border-ink bg-paper px-3 text-base font-extrabold"
                  />
                </div>
              ))}
            </div>
          )}

          {panel === "names" && (
            <div className="flex flex-col gap-3 rounded-[20px] border-[1.5px] border-line bg-card p-4">
              <div className="text-[15px] font-extrabold">Kids</div>
              {kids.map((kid, i) => (
                <div key={kid.id} className="flex flex-col gap-1.5">
                  <div className="text-[13px] font-bold text-muted">{i === 0 ? "First child" : "Second child"}</div>
                  <div className="grid gap-2" style={{ gridTemplateColumns: "2fr 1fr" }}>
                    <input
                      type="text"
                      defaultValue={kid.name}
                      placeholder="Name"
                      onBlur={(e) => onEditKid(kid.id, { name: e.target.value })}
                      className="box-border min-h-12 rounded-xl border-2 border-ink bg-paper px-3 text-base font-extrabold"
                    />
                    <input
                      type="text"
                      defaultValue={kid.grade}
                      placeholder="Class"
                      onBlur={(e) => onEditKid(kid.id, { grade: e.target.value })}
                      className="box-border min-h-12 rounded-xl border-2 border-line bg-paper px-3 text-base font-bold"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {panel === "fix" && (
            <div className="flex flex-col gap-1 rounded-[20px] border-[1.5px] border-line bg-card p-4">
              <div className="pb-1.5 text-[15px] font-extrabold">Fix today&apos;s ticks · {DAYS[clock.day]}</div>
              {fixRows.map((f, i) => (
                <div key={i} className="flex items-center gap-2.5 border-t-[1.5px] border-sand py-1.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-heading text-sm font-semibold text-white" style={{ background: f.kidColor }}>
                    {f.kidInitial}
                  </div>
                  <div className="flex min-w-0 grow flex-col">
                    <div className="text-sm font-extrabold">{f.label}</div>
                    <div className="text-xs font-bold text-muted">{f.statusLabel}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onFixTick(f.kidId, f.task, f.on)}
                    className="min-h-11 whitespace-nowrap rounded-xl border-[1.5px] border-ink bg-paper px-3 text-[13px] font-extrabold"
                  >
                    {f.actLabel}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
