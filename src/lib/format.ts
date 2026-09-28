/** Minutes-since-midnight -> "4:00am" / "8:30pm". */
export function fmtTime(minutes: number): string {
  let h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const ap = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return h + ":" + String(m).padStart(2, "0") + ap;
}

/** "4:00 – 6:00" style window label (no am/pm on the open end). */
export function fmtWindowRange(openMin: number, closeMin: number): string {
  return fmtTime(openMin).replace(/[ap]m/, "") + " – " + fmtTime(closeMin);
}

export function naira(amount: number): string {
  return "₦" + amount.toLocaleString("en-US");
}

/** Minutes -> "1 hr 30 min" / "45 min" / "2 hr". */
export function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const r = minutes % 60;
  return ((h ? h + " hr " : "") + (r || !h ? r + " min" : "")).trim();
}
