"use client";

import { useState, useTransition } from "react";
import { isKidPaid, withdrawalLogView } from "@/lib/view-model";
import { naira } from "@/lib/format";
import { readyToCollect, summary, type Clock } from "@/lib/rules";
import type { KidData } from "@/lib/tracker-types";

export function WithdrawalScreen({
  kids,
  startDay,
  clock,
  paid,
  payOpenTime,
  toast,
  onBack,
  onConfirm,
}: {
  kids: KidData[];
  startDay: number;
  clock: Clock;
  paid: boolean;
  payOpenTime: boolean;
  toast: string;
  onBack: () => void;
  onConfirm: (kidId: string, kidInitials: string, parentInitials: string) => Promise<void>;
}) {
  const [parentInitials, setParentInitials] = useState("");
  const [kidInitials, setKidInitials] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function confirm(kidId: string) {
    setError("");
    startTransition(async () => {
      try {
        await onConfirm(kidId, kidInitials[kidId] ?? "", parentInitials);
        setKidInitials((m) => ({ ...m, [kidId]: "" }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not confirm. Try again.");
      }
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-4 px-6 pb-10 pt-6">
      <button type="button" onClick={onBack} className="min-h-11 self-start border-none bg-transparent px-1 text-[15px] font-extrabold underline">
        ← Grown-up corner
      </button>
      <h1 className="font-heading text-[32px] font-semibold">Withdrawals</h1>
      <div className="text-sm font-bold text-muted">
        This week&apos;s coins open Sunday 8:00pm and stay open until 11:59pm. Hand over the cash, then you and the child each sign with initials.
      </div>
      {toast && <div className="rounded-2xl bg-green-soft p-3.5 font-extrabold text-green">{toast}</div>}
      {error && <div className="rounded-2xl bg-red-soft p-3.5 font-extrabold text-red">{error}</div>}

      <label className="flex flex-col gap-1.5 rounded-[20px] border-2 border-ink bg-card p-4">
        <span className="text-[15px] font-extrabold">Your initials (grown-up)</span>
        <input
          type="text"
          value={parentInitials}
          maxLength={4}
          autoCapitalize="characters"
          onChange={(e) => setParentInitials(e.target.value.toUpperCase())}
          placeholder="e.g. OA"
          className="box-border min-h-12 rounded-xl border-2 border-ink bg-paper px-3 text-lg font-extrabold tracking-widest"
        />
      </label>

      <div className="grid items-start gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))" }}>
        {kids.map((kid) => {
          const kidPaid = isKidPaid(kid, paid);
          const sm = summary(kid.week, startDay, clock);
          const ready = readyToCollect(kid.stats, sm.total, kidPaid, payOpenTime);
          const log = withdrawalLogView(kid);
          const kidSign = kidInitials[kid.id] ?? "";
          const canConfirm = !pending && ready > 0 && kidSign.trim() !== "" && parentInitials.trim() !== "";
          return (
            <div key={kid.id} className="flex min-w-0 flex-col gap-3 rounded-[22px] border-2 border-ink bg-card p-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full font-heading font-semibold text-white" style={{ background: kid.color }}>
                  {kid.name.charAt(0).toUpperCase()}
                </div>
                <div className="grow text-[17px] font-extrabold">{kid.name}</div>
                <div className="font-heading text-2xl font-semibold">{naira(ready)}</div>
              </div>

              {ready > 0 && (
                <>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[13px] font-bold text-muted">{kid.name}&apos;s initials</span>
                    <input
                      type="text"
                      value={kidSign}
                      maxLength={4}
                      autoCapitalize="characters"
                      onChange={(e) => setKidInitials((m) => ({ ...m, [kid.id]: e.target.value.toUpperCase() }))}
                      className="box-border min-h-12 rounded-xl border-2 border-ink bg-paper px-3 text-lg font-extrabold tracking-widest"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={!canConfirm}
                    onClick={() => confirm(kid.id)}
                    className="min-h-[50px] rounded-2xl border-none bg-ink text-base font-extrabold text-paper disabled:opacity-40"
                  >
                    Confirm withdrawal {naira(ready)}
                  </button>
                </>
              )}
              {ready === 0 && kidPaid && (
                <div className="rounded-2xl bg-green-soft p-3 text-center text-[15px] font-extrabold text-green">Withdrawn this week ✓</div>
              )}
              {ready === 0 && !kidPaid && (
                <div className="rounded-2xl border-2 border-dashed border-line p-3 text-center text-[15px] font-extrabold text-muted">
                  {payOpenTime ? "Nothing to withdraw" : "Opens Sunday 8:00pm"}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <div className="text-[13px] font-extrabold text-muted">History</div>
                {log.length === 0 && <div className="text-[13px] font-bold text-muted">No withdrawals yet.</div>}
                {log.map((w) => (
                  <div key={w.id} className="flex items-center justify-between gap-2 rounded-xl bg-note px-3 py-2 text-sm font-bold">
                    <div className="flex flex-col">
                      <span>{w.whenLabel}</span>
                      <span className="text-xs text-muted">{w.signedLabel}</span>
                    </div>
                    <span className="font-extrabold">{w.amountLabel}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
