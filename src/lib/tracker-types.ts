import type { Clock, KidStats, Prize, WeekState } from "@/lib/rules";

export type KidData = {
  id: string;
  name: string;
  grade: string;
  color: string;
  week: WeekState;
  stats: KidStats;
  prizesGiven: string[];
  withdrawal: { id: string; amount: number; paidAt: string | null } | null;
  history: { id: string; weekStart: string; amount: number; bonus: boolean; note: string; paidLabel: string }[];
};

export type PrizeData = Prize & { id: string; sort: number };

export type TrackerInitialData = {
  familyId: string;
  timezone: string;
  pinIsDefault: boolean;
  week: { id: string; weekStart: string; startDay: number; paidAt: string | null };
  weekRange: string;
  clock: Clock;
  kids: KidData[];
  prizes: PrizeData[];
};
