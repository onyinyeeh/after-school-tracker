"use client";

import { X } from "lucide-react";
import { DAYS } from "@/lib/calendar";
import { fmtTime } from "@/lib/format";
import { initialOf } from "@/lib/view-model";
import type { KidData } from "@/lib/tracker-types";

const QUESTIONS = ["What did you read?", "What was it mostly about?", "Tell me one new thing you learned."];

export function CheckScreen({
  kid,
  day,
  studyAt,
  coins,
  status,
  onCancel,
  onClear,
  onNotClear,
  onReset,
  onBack,
}: {
  kid: KidData;
  day: number;
  studyAt: number | null;
  coins: number;
  status: "finished" | "clear" | "not" | null;
  onCancel: () => void;
  onClear: () => void;
  onNotClear: () => void;
  onReset: () => void;
  onBack: () => void;
}) {
  const pending = status === "finished" || !status;
  const isClear = status === "clear";
  const isNot = status === "not";

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col gap-4 px-5 pb-7 pt-6">
      <div className="flex items-center justify-between">
        <div className="rounded-full bg-green-soft px-3 py-1.5 text-[13px] font-extrabold text-green">Grown-up check</div>
        <button type="button" onClick={onCancel} className="min-h-11 border-none bg-transparent px-1 text-[15px] font-extrabold underline">
          Cancel
        </button>
      </div>

      {pending && (
        <div className="flex flex-1 flex-col">
          <div className="flex flex-col items-center gap-2 pt-2 text-center">
            <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full font-heading text-[32px] font-semibold text-white" style={{ background: kid.color }}>
              {initialOf(kid.name)}
            </div>
            <h1 className="font-heading text-[28px] font-semibold">{kid.name}&apos;s explanation</h1>
            <div className="text-[15px] font-bold text-muted">
              {DAYS[day]} study · finished {fmtTime(studyAt ?? 0)}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-[22px] border-2 border-ink bg-card p-[18px]">
            <div className="text-[15px] font-extrabold">Ask {kid.name}:</div>
            {QUESTIONS.map((q, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-gold-soft font-heading font-semibold">{i + 1}</div>
                <div className="text-base font-bold">{q}</div>
              </div>
            ))}
          </div>

          <div className="px-2 pt-3.5 text-center text-sm font-bold text-muted">Mark it clear if they can tell you what it was about in their own words.</div>

          <div className="mt-auto grid grid-cols-2 gap-2.5">
            <button type="button" onClick={onClear} className="min-h-14 rounded-2xl border-none bg-green text-base font-extrabold text-white">
              Clear · +{coins}
            </button>
            <button type="button" onClick={onNotClear} className="min-h-14 rounded-2xl border-2 border-red bg-card text-base font-extrabold text-red">
              Not clear
            </button>
          </div>
        </div>
      )}

      {isClear && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3.5 text-center">
          <div className="flex h-[120px] w-[120px] items-center justify-center rounded-full border-[3px] border-ink bg-gold shadow-hard">
            <svg width="60" height="60" viewBox="0 0 24 24" fill="#FFF7E8" stroke="#1E2A44" strokeWidth={1.6} strokeLinejoin="round">
              <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
            </svg>
          </div>
          <div className="font-heading text-[42px] font-semibold leading-none">+{coins} coins!</div>
          <div className="text-base font-bold text-muted">{kid.name} explained it clearly.</div>
          <button type="button" onClick={onBack} className="mt-4 min-h-14 w-full rounded-2xl border-none bg-ink text-[17px] font-extrabold text-paper">
            Back to {kid.name}
          </button>
          <button type="button" onClick={onReset} className="min-h-11 border-none bg-transparent text-sm font-extrabold underline">
            Change answer
          </button>
        </div>
      )}

      {isNot && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3.5 text-center">
          <div className="flex h-[100px] w-[100px] items-center justify-center rounded-full border-[3px] border-red bg-red-soft">
            <X size={40} color="#B3362A" strokeWidth={3} />
          </div>
          <div className="font-heading text-[32px] font-semibold">Not this time</div>
          <div className="px-3 text-base font-bold text-muted">
            {day < 5
              ? "No coins for study today, and this week's streak ends. Try again tomorrow."
              : "No coins for this study session. Try again next time."}
          </div>
          <button type="button" onClick={onBack} className="mt-4 min-h-14 w-full rounded-2xl border-none bg-ink text-[17px] font-extrabold text-paper">
            Back to {kid.name}
          </button>
          <button type="button" onClick={onReset} className="min-h-11 border-none bg-transparent text-sm font-extrabold underline">
            Change answer
          </button>
        </div>
      )}
    </div>
  );
}
