import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "gu_unlock";
const TTL_MS = 5 * 60 * 1000; // 5 minutes, per README "short unlock then auto-lock"

function secret(): string {
  const s = process.env.PIN_SESSION_SECRET;
  if (!s) throw new Error("PIN_SESSION_SECRET is not set.");
  return s;
}

function sign(familyId: string, expiresAt: number): string {
  const payload = `${familyId}.${expiresAt}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

/**
 * Grants a short-lived, server-signed "grown-up unlocked" proof after a
 * successful `bcrypt.compare` against the family's PIN hash. This cookie —
 * not any client-side "unlocked" UI state — is what every grown-up Server
 * Action re-checks before mutating.
 */
export async function grantPinUnlock(familyId: string) {
  const expiresAt = Date.now() + TTL_MS;
  const store = await cookies();
  store.set(COOKIE, sign(familyId, expiresAt), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function revokePinUnlock() {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function hasPinUnlock(familyId: string): Promise<boolean> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return false;

  const parts = raw.split(".");
  if (parts.length !== 3) return false;
  const [fid, expiresAtStr, sig] = parts;
  const expiresAt = Number(expiresAtStr);
  if (fid !== familyId || !Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  const expected = createHmac("sha256", secret()).update(`${fid}.${expiresAtStr}`).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
