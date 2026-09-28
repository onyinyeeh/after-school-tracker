"use client";

import { Lock } from "lucide-react";
import { KidHeader } from "./KidHeader";
import { walletView } from "@/lib/view-model";
import { weekLabel } from "@/lib/calendar";
import type { KidData } from "@/lib/tracker-types";
import type { Clock } from "@/lib/rules";

export function WalletTab({
  kid,
  weekStartIso,
  startDay,
  clock,
  paid,
  payOpenTime,
  walletDay,
  withdrawConfirm,
  onGoPick,
  onTab,
  onPickDay,
  onStartWithdraw,
  onCancelWithdraw,
  onRequestWithdraw,
}: {
  kid: KidData;
  weekStartIso: string;
  startDay: number;
  clock: Clock;
  paid: boolean;
  payOpenTime: boolean;
  walletDay: number | null;
  withdrawConfirm: boolean;
  onGoPick: () => void;
  onTab: (tab: "today" | "streak" | "wallet") => void;
  onPickDay: (day: number) => void;
  onStartWithdraw: () => void;
  onCancelWithdraw: () => void;
  onRequestWithdraw: () => void;
}) {
  const v = walletView(kid, startDay, clock, walletDay, paid, payOpenTime);
  const confirming = v.open && withdrawConfirm;

  return (
    <div className="flex flex-1 flex-col gap-[18px] px-6 pb-10 pt-6">
      <KidHeader name={kid.name} color={kid.color} tab="wallet" onSwitch={onGoPick} onTab={onTab} />
      <h1 className="font-heading text-[32px] font-semibold">Wallet</h1>

      <div className="grid items-start gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 400px), 1fr))" }}>
        <div className="flex min-w-0 flex-col gap-3.5">
          <div className="flex flex-col gap-3.5 rounded-[24px] border-[2.5px] border-ink bg-gold px-5 py-[22px] shadow-hard">
            <div className="text-[15px] font-extrabold">Ready to collect</div>
            <div className="font-heading text-[56px] font-semibold leading-none">{v.ready}</div>

            {v.locked && (
              <button type="button" disabled className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink bg-gold-softer text-base font-extrabold">
                <Lock size={18} color="#1E2A44" strokeWidth={2.4} />
                Withdraw opens Sunday 8:00pm
              </button>
            )}

            {v.open && !confirming && (
              <button type="button" onClick={onStartWithdraw} className="min-h-[52px] rounded-2xl border-none bg-ink text-[17px] font-extrabold text-paper active:translate-y-0.5">
                Withdraw {v.ready}
              </button>
            )}

            {confirming && (
              <div className="flex flex-col gap-3 rounded-[18px] border-2 border-ink bg-card p-4">
                <div className="flex flex-col gap-0.5">
                  <div className="font-heading text-[22px] font-semibold">Withdraw {v.ready}?</div>
                  <div className="text-sm font-bold text-muted">Your grown-up gets a request and pays you in cash.</div>
                </div>
                <div className="grid gap-2" style={{ gridTemplateColumns: "2fr 1fr" }}>
                  <button type="button" onClick={onRequestWithdraw} className="min-h-[50px] rounded-[14px] border-none bg-ink text-[15px] font-extrabold text-paper">
                    Yes, send request
                  </button>
                  <button type="button" onClick={onCancelWithdraw} className="min-h-[50px] rounded-[14px] border-2 border-ink bg-card text-[15px] font-extrabold">
                    Not yet
                  </button>
                </div>
              </div>
            )}

            {v.requested && (
              <div className="flex min-h-[52px] items-center justify-center rounded-2xl bg-gold-softer px-3 text-center text-[15px] font-extrabold">
                Request sent · waiting for your grown-up to pay
              </div>
            )}
            {v.paid && (
              <div className="flex min-h-[52px] items-center justify-center rounded-2xl bg-gold-softer px-3 text-center text-[15px] font-extrabold">
                Paid! Enjoy it · new week starts Monday
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1 rounded-[18px] border-[1.5px] border-line bg-card p-4">
              <div className="text-[13px] font-bold text-muted">Earned all time</div>
              <div className="font-heading text-[26px] font-semibold">{v.earned}</div>
            </div>
            <div className="flex flex-col gap-1 rounded-[18px] border-[1.5px] border-line bg-card p-4">
              <div className="text-[13px] font-bold text-muted">Withdrawn</div>
              <div className="font-heading text-[26px] font-semibold">{v.withdrawn}</div>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3.5">
          <div className="flex flex-col gap-3.5 rounded-[20px] border-[1.5px] border-line bg-card p-4">
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex flex-col">
                <div className="text-[15px] font-extrabold">This week</div>
                <div className="text-[13px] font-bold text-muted">{weekLabel(weekStartIso)}</div>
              </div>
              <div className="font-heading text-2xl font-semibold">{v.weekTotal}</div>
            </div>
            <div className="grid grid-cols-7 items-end gap-1.5">
              {v.bars.map((b, i) => (
                <button key={i} type="button" onClick={() => onPickDay(i)} className="flex flex-col items-center gap-1.5 border-none bg-transparent">
                  <div className="h-4 text-xs font-extrabold">{b.value}</div>
                  <div className="box-border flex h-[84px] w-full items-end overflow-hidden rounded-[10px] border-2 bg-note" style={{ borderColor: b.selected ? "#1E2A44" : "transparent" }}>
                    <div className="w-full" style={{ height: `${b.h}%`, background: b.fill }} />
                  </div>
                  <div className="text-xs font-extrabold" style={{ color: b.selected ? "#1E2A44" : "#5A6275" }}>
                    {b.label}
                  </div>
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2 rounded-2xl bg-note p-3.5">
              <div className="flex items-baseline justify-between">
                <div className="text-sm font-extrabold">{v.dayTitle}</div>
                <div className="text-sm font-extrabold">{v.dayCoinsLabel}</div>
              </div>
              {v.dayRows.map((r, i) => (
                <div key={i} className="flex justify-between gap-2.5 text-sm font-bold">
                  <span>{r.title}</span>
                  <span style={{ color: r.color }}>{r.label}</span>
                </div>
              ))}
            </div>
            <div className="h-[1.5px] bg-line" />
            <div className="flex items-center justify-between gap-2">
              <div className="text-[15px] font-bold">Streak bonus</div>
              <div className="rounded-full px-2.5 py-[3px] text-sm font-extrabold" style={{ background: v.bonusBg, color: v.bonusColor }}>
                {v.bonusLabel}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="px-1 text-[15px] font-extrabold">History</div>
            {v.history.length === 0 && (
              <div className="rounded-2xl border-2 border-dashed border-line p-3 text-[13px] font-bold text-muted">
                Every Sunday payout gets saved here.
              </div>
            )}
            {v.history.map((h) => (
              <div key={h.id} className="flex items-center gap-3 rounded-2xl border-[1.5px] border-line bg-card p-4">
                <div className="flex grow flex-col">
                  <div className="font-extrabold">{weekLabel(h.weekStart)}</div>
                  <div className={`text-[13px] font-bold ${h.bonus ? "text-green" : "text-red"}`}>{h.note}</div>
                </div>
                <div className="flex flex-col items-end">
                  <div className="font-heading text-xl font-semibold">{h.amountLabel}</div>
                  <div className="text-xs font-bold text-muted">{h.paidLabel}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
