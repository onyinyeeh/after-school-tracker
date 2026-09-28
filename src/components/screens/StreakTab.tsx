"use client";

import { Check, X, Flame, Shield, Trophy, BookOpen, Sun, Moon, Star, Package, Lock as LockIcon } from "lucide-react";
import { KidHeader } from "./KidHeader";
import { streakView } from "@/lib/view-model";
import type { KidData, PrizeData } from "@/lib/tracker-types";
import type { Clock } from "@/lib/rules";

const BADGE_ICON = { flame: Flame, book: BookOpen, sun: Sun, moon: Moon, trophy: Trophy, star: Star };

export function StreakTab({
  kid,
  weekStartIso,
  startDay,
  clock,
  prizes,
  withdrawnTotal,
  paid,
  onGoPick,
  onTab,
}: {
  kid: KidData;
  weekStartIso: string;
  startDay: number;
  clock: Clock;
  prizes: PrizeData[];
  withdrawnTotal: number;
  paid: boolean;
  onGoPick: () => void;
  onTab: (tab: "today" | "streak" | "wallet") => void;
}) {
  const v = streakView(kid, weekStartIso, startDay, clock, prizes, withdrawnTotal, paid);

  return (
    <div className="flex flex-1 flex-col gap-[18px] px-6 pb-10 pt-6">
      <KidHeader name={kid.name} color={kid.color} tab="streak" onSwitch={onGoPick} onTab={onTab} />
      <h1 className="font-heading text-[32px] font-semibold">Streak</h1>

      <div className="grid items-start gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 400px), 1fr))" }}>
        <div className="flex min-w-0 flex-col gap-3.5">
          <div className="flex flex-col gap-4 rounded-[24px] bg-ink p-5 text-paper">
            <div className="flex items-center justify-between gap-2">
              <div className="rounded-full bg-gold px-3 py-1 text-[13px] font-extrabold text-ink">
                Level {v.level.level} · {v.level.name}
              </div>
              <div className="text-[13px] font-bold text-soft">
                {v.wins} challenge{v.wins === 1 ? "" : "s"} won
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex h-[84px] w-[84px] shrink-0 items-center justify-center rounded-full" style={{ background: v.cur > 0 ? "#F5B301" : "#3A4764" }}>
                <Flame size={46} color="#FFF7E8" strokeWidth={1.6} fill="#FFF7E8" />
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="font-heading text-[46px] font-semibold leading-none">
                  {v.cur}
                  <span className="text-lg text-soft"> day streak</span>
                </div>
                <div className="text-sm font-bold text-soft">
                  Best ever: {v.best} day{v.best === 1 ? "" : "s"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border-[1.5px] border-darkline p-3.5">
              <div className="flex gap-1">
                {[0, 1].map((i) => (
                  <Shield key={i} size={28} color={i < v.shieldsLeft ? "#F5B301" : "#8E97AC"} fill={i < v.shieldsLeft ? "#F5B301" : "none"} strokeWidth={2} />
                ))}
              </div>
              <div className="flex min-w-0 flex-col">
                <div className="text-sm font-extrabold">{v.shieldTitle}</div>
                <div className="text-xs font-bold text-soft">Saves your streak if you miss a day. Win one from the weekly challenge.</div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="h-2.5 overflow-hidden rounded-full bg-darkline">
                <div className="h-2.5 bg-gold" style={{ width: `${v.level.pct}%` }} />
              </div>
              <div className="text-[13px] font-bold text-soft">
                {v.level.maxed ? "Top level reached!" : `${v.level.remainingToNext} more coins to Level ${v.level.level + 1} · ${v.level.nextName}`}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3.5 rounded-[22px] border-[2.5px] border-ink bg-card p-[18px] shadow-hard">
            <div className="flex items-center justify-between">
              <div className="text-[17px] font-extrabold">Road to the bonus</div>
              <div className="rounded-full bg-gold-soft px-2.5 py-1 font-heading text-base font-semibold">+200</div>
            </div>
            <div className="flex items-center">
              {v.road.map((r, i) => (
                <div key={i} className="flex grow items-center">
                  {r.isDone && (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green">
                      <Check size={18} color="#FFFFFF" strokeWidth={3} />
                    </div>
                  )}
                  {r.isMissed && (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-red bg-red-soft">
                      <X size={16} color="#B3362A" strokeWidth={3} />
                    </div>
                  )}
                  {r.isToday && (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[2.5px] border-ink bg-gold-soft text-sm font-extrabold">{r.letter}</div>
                  )}
                  {r.isFuture && (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sand text-sm font-extrabold text-muted">{r.letter}</div>
                  )}
                  <div className="h-1 min-w-1 grow" style={{ background: r.isDone ? "#1F7A4D" : "#E4DAC6" }} />
                </div>
              ))}
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${v.chestOpen ? "border-[2.5px] border-ink bg-gold" : "border-[2.5px] border-dashed border-grey bg-sand"}`}>
                <Package size={v.chestOpen ? 24 : 22} color="#1E2A44" strokeWidth={2.2} />
              </div>
            </div>
            <div className={`text-sm font-bold ${v.roadGood ? "text-green" : "text-red"}`}>{v.roadMsg}</div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3.5">
          <div className="flex flex-col gap-3 rounded-[22px] border-[2.5px] border-ink bg-card p-[18px] shadow-hard">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-extrabold tracking-wide">STREAK PRIZES</div>
              <div className="text-[13px] font-extrabold text-muted">Best streak: {v.best} days</div>
            </div>
            {v.prizes.map((pz) => (
              <div key={pz.id} className="flex items-center gap-3 rounded-2xl p-3" style={{ background: pz.isLocked ? "#F7F1E4" : "#FFF1C7" }}>
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2"
                  style={{ background: pz.isGiven ? "#1F7A4D" : pz.isReady ? "#F5B301" : "#F1EADB", borderColor: pz.isGiven ? "#1F7A4D" : pz.isReady ? "#1E2A44" : "#E4DAC6" }}
                >
                  {pz.isGiven ? (
                    <Check size={20} color="#FFFFFF" strokeWidth={3} />
                  ) : pz.isReady ? (
                    <Trophy size={22} color="#1E2A44" strokeWidth={2.3} />
                  ) : (
                    <LockIcon size={22} color="#8E97AC" strokeWidth={2.3} />
                  )}
                </div>
                <div className="flex min-w-0 grow flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="text-[15px] font-extrabold">{pz.text}</div>
                    <div className="whitespace-nowrap font-heading text-base font-semibold">{pz.days} days</div>
                  </div>
                  {pz.isLocked && (
                    <>
                      <div className="h-2 overflow-hidden rounded-full bg-sand">
                        <div className="h-2 bg-gold" style={{ width: `${pz.pct}%` }} />
                      </div>
                      <div className="text-xs font-bold text-muted">{pz.left}</div>
                    </>
                  )}
                  {pz.isReady && <div className="text-[13px] font-extrabold">Unlocked! Ask your grown-up for it.</div>}
                  {pz.isGiven && <div className="text-[13px] font-extrabold text-green">Won and received</div>}
                </div>
              </div>
            ))}
            <div className="text-xs font-bold text-muted">Prizes use your best streak ever, so a missed day never takes one away.</div>
          </div>

          <div className="flex flex-col gap-3 rounded-[22px] border-[2.5px] border-ink bg-gold-soft p-[18px]">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-extrabold tracking-wide">WEEKLY CHALLENGE</div>
              <div className="text-[13px] font-extrabold text-muted">{v.chDaysLeft}</div>
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="font-heading text-2xl font-semibold">{v.challenge.title}</div>
              <div className="text-sm font-bold text-muted">{v.challenge.desc}</div>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-card">
              <div className="h-3 bg-ink" style={{ width: `${Math.round((v.chHave / v.challenge.target) * 100)}%` }} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="font-heading text-lg font-semibold">
                {v.chHave} / {v.challenge.target}
              </div>
              <div className="flex items-center gap-1.5 text-[13px] font-extrabold">
                <Shield size={16} color="#F5B301" fill="#F5B301" strokeWidth={2} />
                {v.chReward}
              </div>
            </div>
            {v.chDone && <div className="rounded-2xl bg-green py-2.5 text-center font-extrabold text-white">Challenge won! Your shield arrives Monday.</div>}
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between px-1">
              <div className="text-[15px] font-extrabold">Badges</div>
              <div className="text-[13px] font-bold text-muted">{v.badgeCount} of 6 unlocked</div>
            </div>
            <div className="px-1 text-[13px] font-bold text-green">{v.nextGoal}</div>
            <div className="grid grid-cols-2 gap-2.5">
              {v.badges.map((bd) => {
                const Icon = BADGE_ICON[bd.icon];
                return (
                  <div key={bd.id} className="box-border flex flex-col gap-2.5 rounded-[18px] border-2 bg-card p-3.5" style={{ borderColor: bd.tier ? "#1E2A44" : "#E4DAC6" }}>
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: bd.bg }}>
                        <Icon size={22} color={bd.stroke} strokeWidth={2.4} />
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <div className="text-sm font-extrabold leading-tight">{bd.name}</div>
                        <div className="text-xs font-extrabold" style={{ color: bd.tierColor }}>
                          {bd.tierName}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs font-semibold text-muted">{bd.desc}</div>
                    <div className="flex flex-col gap-1">
                      <div className="h-2 overflow-hidden rounded-full bg-sand">
                        <div className="h-2" style={{ width: `${bd.pct}%`, background: bd.tier === 3 ? "#F5B301" : "#1E2A44" }} />
                      </div>
                      <div className="text-xs font-bold text-muted">{bd.maxed ? `${bd.value} · maxed out` : `${bd.value} / ${bd.nextThreshold}`}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-1 text-xs font-bold text-muted">Each badge has Bronze, Silver and Gold. Progress carries over every week.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
