"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  changePin,
  editKid,
  finishWeekendStudy,
  fixTick,
  lockGrownUp,
  markExplanation,
  markPrizeGiven,
  markWeekPaid,
  requestWithdraw,
  saveWeekendStudySeconds,
  tickTask,
  undoExplanationCheck,
  undoStudy,
  upsertPrize,
  verifyPin,
} from "@/lib/actions/tracker";
import { currentClock } from "@/lib/clock";
import { dateForDay } from "@/lib/view-model";
import { readyToCollect, summary, type Clock, type TaskKey } from "@/lib/rules";
import type { TrackerInitialData } from "@/lib/tracker-types";
import { PickScreen } from "@/components/screens/PickScreen";
import { PinPad } from "@/components/screens/PinPad";
import { KidToday } from "@/components/screens/KidToday";
import { StreakTab } from "@/components/screens/StreakTab";
import { WalletTab } from "@/components/screens/WalletTab";
import { CheckScreen } from "@/components/screens/CheckScreen";
import { ParentCorner } from "@/components/screens/ParentCorner";
import { DAYS, MONTHS } from "@/lib/calendar";

type Screen = "pick" | "kid" | "pin" | "check" | "parent";
type Tab = "today" | "streak" | "wallet";
type PinReturn = "parent" | "check";

export function TrackerApp({ data }: { data: TrackerInitialData }) {
  const [screen, setScreen] = useState<Screen>("pick");
  const [kidId, setKidId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("today");

  const [pinEntry, setPinEntry] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinMode, setPinMode] = useState<"enter" | "new">("enter");
  const [pinReturn, setPinReturn] = useState<PinReturn>("parent");
  const [checkFor, setCheckFor] = useState<{ kidId: string; day: number } | null>(null);

  const [toast, setToast] = useState("");
  const [kidToast, setKidToast] = useState("");
  const [walletDay, setWalletDay] = useState<number | null>(null);
  const [withdrawConfirm, setWithdrawConfirm] = useState(false);

  // Tracks in-flight Server Actions so tap targets can show instant feedback
  // (disabled + dimmed) instead of feeling dead while the request — and the
  // page-data revalidation that follows it — round-trips to Supabase.
  const [actionPending, startAction] = useTransition();

  const [clock, setClock] = useState<Clock>(data.clock);
  const [weekendTimer, setWeekendTimer] = useState<{ kidId: string; secs: number; running: boolean } | null>(null);
  const persistTick = useRef(0);

  useEffect(() => {
    const iv = setInterval(() => setClock(currentClock(data.timezone)), 20_000);
    return () => clearInterval(iv);
  }, [data.timezone]);

  useEffect(() => {
    if (!weekendTimer?.running) return;
    const iv = setInterval(() => {
      setWeekendTimer((w) => {
        if (!w) return w;
        const secs = Math.min(7200, w.secs + 1);
        persistTick.current++;
        if (persistTick.current % 15 === 0 || secs >= 7200) {
          void saveWeekendStudySeconds(w.kidId, dateForDay(data.week.weekStart, clock.day), secs);
        }
        return { ...w, secs };
      });
    }, 1000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekendTimer?.running]);

  const kid = data.kids.find((k) => k.id === kidId) ?? null;

  const clockLong = `${DAYS[clock.day]}, ${new Date().getDate()} ${MONTHS[new Date().getMonth()]} · ${fmtNow(clock.min)}`;

  const cheer = useCallback((msg: string) => {
    setKidToast(msg);
    setTimeout(() => setKidToast(""), 2600);
  }, []);

  function goPick() {
    setScreen("pick");
    setWithdrawConfirm(false);
  }

  function openParent() {
    setPinEntry("");
    setPinError("");
    setPinMode("enter");
    setPinReturn("parent");
    setCheckFor(null);
    setScreen("pin");
  }

  function openExplain() {
    if (!kid) return;
    setPinEntry("");
    setPinError("");
    setPinMode("enter");
    setPinReturn("check");
    setCheckFor({ kidId: kid.id, day: clock.day });
    setScreen("pin");
  }

  async function onPinDigit(d: string) {
    if (pinEntry.length >= 4) return;
    const entry = pinEntry + d;
    setPinEntry(entry);
    setPinError("");
    if (entry.length === 4) {
      setTimeout(async () => {
        if (pinMode === "new") {
          await changePin(entry);
          setPinEntry("");
          setPinMode("enter");
          setScreen("parent");
          setToast("PIN changed. Keep it secret!");
        } else {
          const res = await verifyPin(entry);
          if (res.ok) {
            setPinEntry("");
            setScreen(pinReturn === "check" && checkFor ? "check" : "parent");
          } else {
            setPinEntry("");
            setPinError("Wrong PIN. Try again.");
          }
        }
      }, 160);
    }
  }

  function onPinDelete() {
    setPinEntry((e) => e.slice(0, -1));
    setPinError("");
  }

  function pinCancel() {
    setPinEntry("");
    setPinError("");
    if (pinMode === "new") {
      setPinMode("enter");
      setScreen("parent");
    } else if (pinReturn === "check") {
      setScreen("kid");
    } else {
      setScreen("pick");
    }
  }

  // ── Kid task actions ───────────────────────────────────────────────

  function handleTick(task: TaskKey) {
    if (!kid) return;
    const date = dateForDay(data.week.weekStart, clock.day);
    startAction(async () => {
      await tickTask(kid.id, date, task, clock.min);
      cheer(task === "study" ? "Nice! Now explain it" : "+50 coins!");
    });
  }

  function handleUndoStudy() {
    if (!kid) return;
    const date = dateForDay(data.week.weekStart, clock.day);
    startAction(async () => {
      await undoStudy(kid.id, date);
    });
  }

  function startWeekendTimer() {
    if (!kid) return;
    const rec = kid.week[clock.day] as { secs: number };
    setWeekendTimer((w) => (w?.kidId === kid.id ? { ...w, running: true } : { kidId: kid.id, secs: rec.secs, running: true }));
  }

  function pauseWeekendTimer() {
    if (!kid) return;
    setWeekendTimer((w) => (w ? { ...w, running: false } : w));
    const secs = weekendTimer?.secs;
    if (secs != null) void saveWeekendStudySeconds(kid.id, dateForDay(data.week.weekStart, clock.day), secs);
  }

  function finishWeekend() {
    if (!kid) return;
    const secs = weekendTimer?.secs ?? (kid.week[clock.day] as { secs: number }).secs;
    setWeekendTimer((w) => (w ? { ...w, running: false } : w));
    startAction(async () => {
      await finishWeekendStudy(kid.id, dateForDay(data.week.weekStart, clock.day), secs, clock.min);
      cheer("2 hours! Now explain it");
    });
  }

  // ── PIN-gated check flow ──────────────────────────────────────────

  async function checkClear() {
    if (!checkFor) return;
    const task = checkFor.day >= 5 ? "weekend_study" : "study";
    await markExplanation(checkFor.kidId, dateForDay(data.week.weekStart, checkFor.day), task, true);
  }
  async function checkNotClear() {
    if (!checkFor) return;
    const task = checkFor.day >= 5 ? "weekend_study" : "study";
    await markExplanation(checkFor.kidId, dateForDay(data.week.weekStart, checkFor.day), task, false);
  }
  async function checkReset() {
    if (!checkFor) return;
    const task = checkFor.day >= 5 ? "weekend_study" : "study";
    await undoExplanationCheck(checkFor.kidId, dateForDay(data.week.weekStart, checkFor.day), task);
  }
  function checkBack() {
    setScreen("kid");
    setTab("today");
    setCheckFor(null);
  }

  // ── Wallet ─────────────────────────────────────────────────────────

  async function handleRequestWithdraw() {
    if (!kid) return;
    const sm = summary(kid.week, data.week.startDay, clock);
    const amount = readyToCollect(kid.stats, sm.total, paid, payOpenTime);
    setWithdrawConfirm(false);
    await requestWithdraw(kid.id, data.week.id, amount);
  }

  // ── Parent corner ──────────────────────────────────────────────────

  async function handleMarkClear(kId: string, day: number, task: "study" | "weekend_study") {
    await markExplanation(kId, dateForDay(data.week.weekStart, day), task, true);
  }
  async function handleMarkNotClear(kId: string, day: number, task: "study" | "weekend_study") {
    await markExplanation(kId, dateForDay(data.week.weekStart, day), task, false);
  }
  async function handleUndoCheck(kId: string, day: number, task: "study" | "weekend_study") {
    await undoExplanationCheck(kId, dateForDay(data.week.weekStart, day), task);
  }
  async function handleGivePrize(kId: string, prizeId: string) {
    await markPrizeGiven(kId, prizeId);
    const k = data.kids.find((x) => x.id === kId);
    setToast(`Gave ${k?.name ?? "kid"} their prize`);
  }
  async function handleMarkPaid() {
    await markWeekPaid(data.week.id);
    setToast(`Paid ${data.kids.map((k) => k.name).join(" and ")}`);
  }
  async function handleFixTick(kId: string, task: TaskKey, on: boolean) {
    const date = dateForDay(data.week.weekStart, clock.day);
    if (task === "study") {
      await fixTick(kId, date, task, on ? "not" : "clear", clock.min);
    } else {
      await fixTick(kId, date, task, on ? null : "done", on ? null : clock.min);
    }
  }
  function handleChangePinRequest() {
    setPinEntry("");
    setPinError("");
    setPinMode("new");
    setScreen("pin");
  }
  async function handleEditKid(kId: string, patch: { name?: string; grade?: string }) {
    await editKid(kId, patch);
  }
  async function handleUpsertPrize(prizeId: string | null, days: number, text: string, sort: number) {
    await upsertPrize(prizeId, days, text, sort);
  }

  async function handleLockExit() {
    await lockGrownUp();
    goPick();
  }

  const paid = !!data.week.paidAt;
  const payOpenTime = clock.day === 6 && clock.min >= 1200;
  const checkForRec = checkFor ? data.kids.find((k) => k.id === checkFor.kidId) : null;
  const checkStudyStatus = checkForRec ? (checkForRec.week[checkFor!.day] as { study: "finished" | "clear" | "not" | null }).study : null;
  const checkStudyAt = checkForRec ? (checkForRec.week[checkFor!.day] as { studyAt: number | null }).studyAt : null;
  const pendingBadgeCount = data.kids.reduce((a, k) => a + weekPendingCount(k), 0);
  const liveSecs = kid ? (weekendTimer?.kidId === kid.id ? weekendTimer.secs : (kid.week[clock.day] as { secs: number }).secs) : 0;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1120px] flex-col bg-paper" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      {screen === "pick" && (
        <PickScreen
          kids={data.kids}
          startDay={data.week.startDay}
          clock={clock}
          paid={paid}
          clockLong={clockLong}
          pendingCount={pendingBadgeCount}
          onPickKid={(id) => {
            setKidId(id);
            setTab("today");
            setScreen("kid");
          }}
          onOpenParent={openParent}
        />
      )}

      {screen === "kid" && kid && tab === "today" && (
        <KidToday
          kid={kid}
          startDay={data.week.startDay}
          clock={clock}
          paid={paid}
          kidToast={kidToast}
          pending={actionPending}
          liveWeekendSecs={liveSecs}
          weekendRunning={weekendTimer?.kidId === kid.id && weekendTimer.running}
          onGoPick={goPick}
          onTab={setTab}
          onTickTask={handleTick}
          onExplain={openExplain}
          onUndoStudy={handleUndoStudy}
          onToggleWeekendTimer={() => (weekendTimer?.kidId === kid.id && weekendTimer.running ? pauseWeekendTimer() : startWeekendTimer())}
          onFinishWeekend={finishWeekend}
        />
      )}

      {screen === "kid" && kid && tab === "streak" && (
        <StreakTab
          kid={kid}
          weekStartIso={data.week.weekStart}
          startDay={data.week.startDay}
          clock={clock}
          prizes={data.prizes}
          withdrawnTotal={kid.history.reduce((a, h) => a + h.amount, 0)}
          paid={paid}
          onGoPick={goPick}
          onTab={setTab}
        />
      )}

      {screen === "kid" && kid && tab === "wallet" && (
        <WalletTab
          kid={kid}
          weekStartIso={data.week.weekStart}
          startDay={data.week.startDay}
          clock={clock}
          paid={paid}
          payOpenTime={payOpenTime}
          walletDay={walletDay}
          withdrawConfirm={withdrawConfirm}
          onGoPick={goPick}
          onTab={setTab}
          onPickDay={setWalletDay}
          onStartWithdraw={() => setWithdrawConfirm(true)}
          onCancelWithdraw={() => setWithdrawConfirm(false)}
          onRequestWithdraw={handleRequestWithdraw}
        />
      )}

      {screen === "pin" && (
        <PinPad
          title={pinMode === "new" ? "Choose a new PIN" : pinReturn === "check" ? "Grown-up check" : "Grown-ups only"}
          sub={pinMode === "new" ? "Pick 4 digits the kids won't guess" : pinReturn === "check" ? "Hand the phone to your grown-up" : "Enter your 4-digit PIN"}
          entry={pinEntry}
          error={pinError}
          isDefaultPin={data.pinIsDefault && pinMode !== "new"}
          onDigit={onPinDigit}
          onDelete={onPinDelete}
          onCancel={pinCancel}
        />
      )}

      {screen === "check" && checkFor && checkForRec && (
        <CheckScreen
          kid={checkForRec}
          day={checkFor.day}
          studyAt={checkStudyAt}
          coins={checkFor.day >= 5 ? 100 : 50}
          status={checkStudyStatus}
          onCancel={checkBack}
          onClear={checkClear}
          onNotClear={checkNotClear}
          onReset={checkReset}
          onBack={checkBack}
        />
      )}

      {screen === "parent" && (
        <ParentCorner
          kids={data.kids}
          prizes={data.prizes}
          startDay={data.week.startDay}
          clock={clock}
          paid={paid}
          payOpenTime={payOpenTime}
          toast={toast}
          onGoPick={handleLockExit}
          onMarkClear={handleMarkClear}
          onMarkNotClear={handleMarkNotClear}
          onUndoCheck={handleUndoCheck}
          onGivePrize={handleGivePrize}
          onMarkPaid={handleMarkPaid}
          onFixTick={handleFixTick}
          onChangePin={handleChangePinRequest}
          onEditKid={handleEditKid}
          onUpsertPrize={handleUpsertPrize}
        />
      )}
    </div>
  );
}

function fmtNow(min: number) {
  let h = Math.floor(min / 60);
  const m = min % 60;
  const ap = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")}${ap}`;
}

function weekPendingCount(kid: TrackerInitialData["kids"][number]): number {
  return kid.week.filter((r) => (r as { study: string | null }).study === "finished").length;
}
