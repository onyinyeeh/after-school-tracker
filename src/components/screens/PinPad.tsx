"use client";

import { useEffect } from "react";
import { Delete, Lock } from "lucide-react";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

export function PinPad({
  title,
  sub,
  entry,
  error,
  isDefaultPin,
  onDigit,
  onDelete,
  onCancel,
}: {
  title: string;
  sub: string;
  entry: string;
  error: string;
  isDefaultPin: boolean;
  onDigit: (d: string) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        onDigit(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        onDelete();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onDigit, onDelete]);

  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-1 flex-col items-center gap-[22px] px-7 pb-9 pt-6">
      <div className="flex w-full">
        <button
          type="button"
          onClick={onCancel}
          className="flex min-h-11 items-center gap-1 border-none bg-transparent text-[15px] font-extrabold"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1E2A44" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          Back
        </button>
      </div>

      <div className="mt-9 flex h-16 w-16 items-center justify-center rounded-full bg-ink">
        <Lock size={28} color="#FFF7E8" strokeWidth={2.2} />
      </div>

      <div className="flex flex-col items-center gap-1.5">
        <h1 className="font-heading text-[30px] font-semibold">{title}</h1>
        <div className="text-[15px] font-bold text-muted">{sub}</div>
      </div>

      <div className="flex gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={
              i < entry.length
                ? "h-[18px] w-[18px] rounded-full bg-ink"
                : "h-[18px] w-[18px] rounded-full border-[2.5px] border-ink box-border"
            }
          />
        ))}
      </div>

      <div className="min-h-5 text-sm font-extrabold text-red">{error}</div>

      <div className="grid grid-cols-3 gap-x-[22px] gap-y-3.5">
        {KEYS.map((key, i) =>
          key === "" ? (
            <div key={i} className="h-[76px] w-[76px]" />
          ) : key === "del" ? (
            <button
              key={i}
              type="button"
              aria-label="Delete"
              onClick={onDelete}
              className="flex h-[76px] w-[76px] items-center justify-center rounded-full border-none bg-transparent"
            >
              <Delete size={30} color="#1E2A44" strokeWidth={2.2} />
            </button>
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => onDigit(key)}
              className="h-[76px] w-[76px] rounded-full border-2 border-ink bg-card font-heading text-[30px] font-semibold shadow-hard active:translate-y-[3px] active:shadow-hard-sm"
            >
              {key}
            </button>
          )
        )}
      </div>

      {isDefaultPin && (
        <div className="mt-auto text-center text-[13px] font-bold text-muted">
          You can also type the PIN on your keyboard. First time? It&apos;s 1234. Change it once you&apos;re in.
        </div>
      )}
    </div>
  );
}
