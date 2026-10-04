"use client";

import { Check, X, Clock as ClockIcon, Hourglass } from "lucide-react";
import { KidHeader } from "./KidHeader";
import { statsCardView, weekdayTasksView, weekendBedtimeView, weekendRingView, weekendTilesView } from "@/lib/view-model";
import { DAYS } from "@/lib/calendar";
import type { KidData } from "@/lib/tracker-types";
import type { Clock, TaskKey } from "@/lib/rules";

export function KidToday({
  kid,
  startDay,
  clock,
  paid,
  kidToast,
  pending,
  liveWeekendSecs,
  weekendRunning,
  onGoPick,
  onTab,
  onTickTask,
  onExplain,
  onUndoStudy,
  onToggleWeekendTimer,
  onFinishWeekend,
}: {
  kid: KidData;
  startDay: number;
  clock: Clock;
  paid: boolean;
  kidToast: string;
  pending: boolean;
  liveWeekendSecs: number;
  weekendRunning: boolean;
  onGoPick: () => void;
  onTab: (tab: "today" | "streak" | "wallet") => void;
  onTickTask: (task: TaskKey) => void;
  onExplain: () => void;
  onUndoStudy: () => void;
  onToggleWeekendTimer: () => void;
  onFinishWeekend: () => void;
}) {
  const isWeekend = clock.day >= 5;
  const stats = statsCardView(kid, startDay, clock, paid);
  const daySub = daySubLabel(clock);

  return (
    <div className="flex flex-1 flex-col gap-[18px] px-6 pb-10 pt-6">
      <KidHeader name={kid.name} color={kid.color} tab="today" onSwitch={onGoPick} onTab={onTab} />

      {kidToast && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border-2 border-ink bg-gold px-4 py-3 font-heading text-xl font-semibold">
          {kidToast}
        </div>
      )}

      <div className="grid items-start gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 400px), 1fr))" }}>
        <div className="flex min-w-0 flex-col gap-3.5">
          <div className="flex flex-col gap-0.5">
            <h1 className="font-heading text-[32px] font-semibold">{DAYS[clock.day]}</h1>
            <div className="text-base font-bold text-muted">{isWeekend ? "Weekend study day · study any time, in bed by 10pm" : daySub}</div>
          </div>

          {!isWeekend && (
            <div className="flex flex-col gap-3.5 rounded-[22px] bg-ink p-[18px] text-paper">
              <div className="grid grid-cols-3 gap-2">
                <StatCell label="Today" value={`${stats.todayCoins}`} suffix=" / 150" gold />
                <StatCell label="This week" value={stats.total} gold />
                <StatCell label="Streak" value={`${stats.streak}`} suffix=" of 5" />
              </div>
              <div className="flex gap-1.5">
                {stats.bars.map((b, i) => (
                  <div key={i} className="h-2 grow rounded" style={{ background: b.color }} />
                ))}
              </div>
              <div className="text-[13px] font-bold text-soft">{stats.streakLine}</div>
            </div>
          )}

          {isWeekend && (
            <WeekendRing
              kid={kid}
              startDay={startDay}
              clock={clock}
              liveSecs={liveWeekendSecs}
              running={weekendRunning}
              pending={pending}
              onToggle={onToggleWeekendTimer}
              onFinish={onFinishWeekend}
            />
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-3.5">
          {!isWeekend ? (
            <>
              <div className="flex items-center gap-2.5 px-1 text-sm font-bold text-muted">
                <ClockIcon size={18} color="#5A6275" strokeWidth={2.2} />
                4:30pm · Be home from school
              </div>
              <TaskList kid={kid} startDay={startDay} clock={clock} pending={pending} onTick={onTickTask} onExplain={onExplain} onUndoStudy={onUndoStudy} />
            </>
          ) : (
            <>
              <WeekendBedtime kid={kid} startDay={startDay} clock={clock} pending={pending} onTick={onTickTask} />
              <WeekendTiles kid={kid} startDay={startDay} clock={clock} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function daySubLabel(clock: Clock): string {
  const label = `It's ${fmtNow(clock.min)}. `;
  if (clock.min < 990) return "School first. Home by 4:30pm.";
  if (clock.min < 1080) return label + "Home time.";
  if (clock.min < 1200) return label + "Study time.";
  if (clock.min < 1320) return label + "Dinner and bed.";
  return "It's late. Lights out!";
}

function fmtNow(min: number) {
  let h = Math.floor(min / 60);
  const m = min % 60;
  const ap = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")}${ap}`;
}

function StatCell({ label, value, suffix, gold }: { label: string; value: string; suffix?: string; gold?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-[13px] font-bold text-soft">{label}</div>
      <div className={`font-heading text-2xl font-semibold ${gold ? "text-gold" : ""}`}>
        {value}
        {suffix && <span className="text-[15px] text-soft">{suffix}</span>}
      </div>
    </div>
  );
}

function TaskList({
  kid,
  startDay,
  clock,
  pending,
  onTick,
  onExplain,
  onUndoStudy,
}: {
  kid: KidData;
  startDay: number;
  clock: Clock;
  pending: boolean;
  onTick: (task: TaskKey) => void;
  onExplain: () => void;
  onUndoStudy: () => void;
}) {
  const tasks = weekdayTasksView(kid, startDay, clock);
  return (
    <>
      {tasks.map((t) => {
        if (t.status === "done") {
          return (
            <div key={t.key} className="flex items-center gap-3.5 rounded-[20px] border-2 border-green bg-green-soft p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green">
                <Check size={22} color="#FFFFFF" strokeWidth={3} />
              </div>
              <div className="flex min-w-0 grow flex-col">
                <div className="text-[13px] font-bold text-green">
                  {t.range} · {t.note}
                </div>
                <div className="text-lg font-extrabold">{t.title}</div>
              </div>
              <div className="font-heading text-xl font-semibold text-green">+50</div>
            </div>
          );
        }
        if (t.status === "missed") {
          return (
            <div key={t.key} className="flex items-center gap-3.5 rounded-[20px] border-2 border-red bg-red-soft p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-red bg-card">
                <X size={18} color="#B3362A" strokeWidth={3} />
              </div>
              <div className="flex min-w-0 grow flex-col">
                <div className="text-[13px] font-bold text-red">
                  {t.range} · {t.note}
                </div>
                <div className="text-lg font-extrabold">{t.title}</div>
              </div>
              <div className="font-heading text-xl font-semibold text-red">0</div>
            </div>
          );
        }
        if (t.status === "now" || t.status === "late") {
          return (
            <div key={t.key} className="flex flex-col gap-3.5 rounded-[22px] border-[2.5px] border-ink bg-card p-[18px] shadow-hard">
              <div className="flex items-center justify-between">
                <div className="text-[13px] font-bold text-muted">{t.range}</div>
                {t.isLate ? (
                  <div className="rounded-full bg-red-soft px-2.5 py-1 text-xs font-extrabold tracking-wide text-red">LATE · +50</div>
                ) : (
                  <div className="rounded-full bg-gold px-2.5 py-1 text-xs font-extrabold tracking-wide">NOW · +50</div>
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="font-heading text-2xl font-semibold">{t.title}</div>
                <div className="text-sm font-bold text-muted">{t.isLate ? t.note : t.sub}</div>
              </div>
              {t.hasProgress && (
                <div className="flex flex-col gap-1.5">
                  <div className="h-3 overflow-hidden rounded-full bg-sand">
                    <div className="h-3 bg-gold" style={{ width: `${t.pct}%` }} />
                  </div>
                  <div className="text-[13px] font-bold text-muted">{t.progressLabel}</div>
                </div>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={() => onTick(t.key)}
                className="min-h-[52px] rounded-2xl border-none bg-ink text-[17px] font-extrabold text-paper active:translate-y-0.5 disabled:opacity-60"
              >
                {t.actLabel}
              </button>
            </div>
          );
        }
        if (t.status === "waiting") {
          return (
            <div key={t.key} className="flex flex-col gap-3 rounded-[22px] border-[2.5px] border-ink bg-card p-[18px]">
              <div className="flex flex-col gap-0.5">
                <div className="text-[13px] font-bold text-muted">
                  {t.range} · {t.note}
                </div>
                <div className="font-heading text-[22px] font-semibold">{t.title}</div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-gold-soft p-3.5">
                <Hourglass size={24} color="#1E2A44" strokeWidth={2.2} />
                <div className="flex grow flex-col">
                  <div className="text-[15px] font-extrabold">Now explain what you read</div>
                  <div className="text-[13px] font-bold text-muted">+50 coins once it&apos;s marked clear</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={onExplain} className="min-h-[52px] grow rounded-2xl border-none bg-ink text-base font-extrabold text-paper active:translate-y-0.5">
                  Get a grown-up to check
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={onUndoStudy}
                  className="min-h-[52px] border-none bg-transparent px-3 text-sm font-extrabold underline disabled:opacity-60"
                >
                  Undo
                </button>
              </div>
            </div>
          );
        }
        return (
          <div key={t.key} className="flex items-center gap-3.5 rounded-[20px] bg-sand p-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-line">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5A6275" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
            </div>
            <div className="flex min-w-0 grow flex-col">
              <div className="text-[13px] font-bold text-muted">{t.range}</div>
              <div className="text-[17px] font-extrabold">{t.title}</div>
            </div>
            <div className="whitespace-nowrap text-[13px] font-bold text-muted">{t.note}</div>
          </div>
        );
      })}
    </>
  );
}

function WeekendRing({
  kid,
  startDay,
  clock,
  liveSecs,
  running,
  pending,
  onToggle,
  onFinish,
}: {
  kid: KidData;
  startDay: number;
  clock: Clock;
  liveSecs: number;
  running: boolean;
  pending: boolean;
  onToggle: () => void;
  onFinish: () => void;
}) {
  const view = weekendRingView(kid, clock.day, startDay, clock, liveSecs);
  if (view.status === "done" || view.status === "missed") {
    const done = view.status === "done";
    return (
      <div className={`flex items-center gap-3.5 rounded-[20px] border-2 p-4 ${done ? "border-green bg-green-soft" : "border-red bg-red-soft"}`}>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${done ? "bg-green" : "border-2 border-red bg-card"}`}>
          {done ? <Check size={22} color="#FFFFFF" strokeWidth={3} /> : <X size={18} color="#B3362A" strokeWidth={3} />}
        </div>
        <div className="flex grow flex-col">
          <div className={`text-[13px] font-bold ${done ? "text-green" : "text-red"}`}>{done ? "Explained clearly" : "Not clear this time"}</div>
          <div className="text-lg font-extrabold">2 hours of study</div>
        </div>
        <div className={`font-heading text-xl font-semibold ${done ? "text-green" : "text-red"}`}>{done ? "+100" : "0"}</div>
      </div>
    );
  }
  if (view.status === "waiting") {
    return (
      <div className="flex flex-col gap-3 rounded-[22px] border-[2.5px] border-ink bg-card p-[18px]">
        <div className="font-heading text-[22px] font-semibold">2 hours done</div>
        <div className="flex items-center gap-3 rounded-2xl bg-gold-soft p-3.5">
          <Hourglass size={24} color="#1E2A44" strokeWidth={2.2} />
          <div className="flex grow flex-col">
            <div className="text-[15px] font-extrabold">Now explain what you read</div>
            <div className="text-[13px] font-bold text-muted">+100 coins once it&apos;s marked clear</div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-3.5 rounded-[24px] border-[2.5px] border-ink bg-card px-5 py-6 shadow-hard">
      <div className="flex w-full items-center justify-between">
        <div className="text-lg font-extrabold">Study for 2 hours</div>
        <div className="rounded-full bg-gold-soft px-2.5 py-1 font-heading text-base font-semibold">+100</div>
      </div>
      <div className="flex h-[190px] w-[190px] items-center justify-center rounded-full" style={{ background: `conic-gradient(#F5B301 0 ${view.ringPct}%, #F1EADB ${view.ringPct}% 100%)` }}>
        <div className="flex h-[150px] w-[150px] flex-col items-center justify-center rounded-full bg-card">
          <div className="font-heading text-[44px] font-semibold leading-none">{view.clockLabel}</div>
          <div className="text-sm font-bold text-muted">of 2:00 hours</div>
        </div>
      </div>
      <div className="grid w-full grid-cols-2 gap-2.5">
        <button type="button" onClick={onToggle} className="min-h-[52px] rounded-2xl border-2 border-ink bg-card text-base font-extrabold">
          {running ? "Pause" : view.mins ? "Resume" : "Start"}
        </button>
        {view.canFinish ? (
          <button
            type="button"
            disabled={pending}
            onClick={onFinish}
            className="min-h-[52px] rounded-2xl border-none bg-ink text-base font-extrabold text-paper disabled:opacity-60"
          >
            I&apos;m done
          </button>
        ) : (
          <button type="button" disabled className="min-h-[52px] rounded-2xl border-none bg-line text-base font-extrabold text-muted">
            Done at 2:00
          </button>
        )}
      </div>
      <div className="text-center text-sm font-bold text-muted">When you hit 2 hours, explain what you read. A clear explanation earns the 100 coins.</div>
    </div>
  );
}

function WeekendBedtime({
  kid,
  startDay,
  clock,
  pending,
  onTick,
}: {
  kid: KidData;
  startDay: number;
  clock: Clock;
  pending: boolean;
  onTick: (task: TaskKey) => void;
}) {
  const t = weekendBedtimeView(kid, startDay, clock);

  if (t.status === "done") {
    return (
      <div className="flex items-center gap-3.5 rounded-[20px] border-2 border-green bg-green-soft p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green">
          <Check size={22} color="#FFFFFF" strokeWidth={3} />
        </div>
        <div className="flex min-w-0 grow flex-col">
          <div className="text-[13px] font-bold text-green">
            {t.range} · {t.note}
          </div>
          <div className="text-lg font-extrabold">{t.title}</div>
        </div>
        <div className="font-heading text-xl font-semibold text-green">+50</div>
      </div>
    );
  }
  if (t.status === "missed") {
    return (
      <div className="flex items-center gap-3.5 rounded-[20px] border-2 border-red bg-red-soft p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-red bg-card">
          <X size={18} color="#B3362A" strokeWidth={3} />
        </div>
        <div className="flex min-w-0 grow flex-col">
          <div className="text-[13px] font-bold text-red">
            {t.range} · {t.note}
          </div>
          <div className="text-lg font-extrabold">{t.title}</div>
        </div>
        <div className="font-heading text-xl font-semibold text-red">0</div>
      </div>
    );
  }
  if (t.status === "now" || t.status === "late") {
    return (
      <div className="flex items-center gap-3.5 rounded-[20px] border-[2.5px] border-ink bg-card p-4">
        <div className="flex min-w-0 grow flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <div className="text-[13px] font-bold text-muted">{t.range}</div>
            {t.isLate ? (
              <div className="rounded-full bg-red-soft px-2 py-0.5 text-xs font-extrabold text-red">LATE</div>
            ) : (
              <div className="rounded-full bg-gold px-2 py-0.5 text-xs font-extrabold">+50</div>
            )}
          </div>
          <div className="text-lg font-extrabold">{t.title}</div>
          {t.isLate && <div className="text-xs font-bold text-muted">{t.note}</div>}
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => onTick("eve")}
          className="min-h-11 whitespace-nowrap rounded-2xl border-none bg-ink px-4 text-sm font-extrabold text-paper disabled:opacity-60"
        >
          {t.actLabel}
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3.5 rounded-[20px] bg-sand p-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-line">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5A6275" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
      </div>
      <div className="flex min-w-0 grow flex-col">
        <div className="text-[13px] font-bold text-muted">{t.range}</div>
        <div className="text-[17px] font-extrabold">{t.title}</div>
      </div>
      <div className="whitespace-nowrap text-[13px] font-bold text-muted">{t.note}</div>
    </div>
  );
}

function WeekendTiles({ kid, startDay, clock }: { kid: KidData; startDay: number; clock: Clock }) {
  const tiles = weekendTilesView(kid, startDay, clock);
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {tiles.map((tile, i) => (
        <div key={i} className="flex flex-col gap-1 rounded-[18px] p-3.5" style={{ background: tile.bg }}>
          <div className="text-[13px] font-bold text-muted">{tile.day}</div>
          <div className="font-extrabold">{tile.label}</div>
        </div>
      ))}
    </div>
  );
}
