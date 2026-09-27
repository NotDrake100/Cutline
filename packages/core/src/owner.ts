/**
 * DEMO vs owner AI gate.
 *
 * Public / anonymous / judges → Demo. Fixtures and non-billable paths only.
 * Never call Gemini generateContent for that traffic.
 *
 * Owner desk (cookie from CUTLINE_OWNER_KEY, or x-cutline-owner header) → real Gemini.
 * On Vercel, a missing owner session is always Demo even if GEMINI_API_KEY is set.
 * Local `npm run studio` without CUTLINE_OWNER_KEY is treated as owner (Archit's machine).
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";

export const OWNER_COOKIE = "cutline_owner";
export const OWNER_HEADER = "x-cutline-owner";

function envValue(name: string): string {
  return (process.env[name] || "").trim();
}

export function ownerKey(): string {
  return envValue("CUTLINE_OWNER_KEY");
}

export function forceDemo(): boolean {
  return envValue("CUTLINE_FORCE_DEMO") === "1";
}

export const DEMO_COOKIE = "cutline_force_demo";
export const DEMO_HEADER = "x-cutline-demo";

/** Request asked for Demo (?demo=1 cookie or x-cutline-demo: 1). Never Gemini. */
export function requestForcesDemo(req: IncomingMessage): boolean {
  if (forceDemo()) return true;
  const hdr = req.headers[DEMO_HEADER];
  const headerVal = Array.isArray(hdr) ? hdr[0] : hdr;
  if (headerVal && headerVal.trim() === "1") return true;
  const cookie = parseCookies(req.headers.cookie)[DEMO_COOKIE];
  return cookie === "1";
}

export function ownerCookieDigest(key = ownerKey()): string {
  if (!key) return "";
  return createHmac("sha256", key).update("cutline-owner-v1").digest("hex").slice(0, 40);
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function isOwnerRequest(req: IncomingMessage): boolean {
  if (requestForcesDemo(req)) return false;
  const key = ownerKey();
  if (!key) {
    /* Vercel public deploy: no owner key means Demo, even with GEMINI_API_KEY. */
    if (process.env.VERCEL) return false;
    /* Local studio without an owner key is Archit's machine. */
    return true;
  }
  const hdr = req.headers[OWNER_HEADER];
  const headerVal = Array.isArray(hdr) ? hdr[0] : hdr;
  if (headerVal && safeEqual(headerVal.trim(), key)) return true;
  const cookie = parseCookies(req.headers.cookie)[OWNER_COOKIE];
  const digest = ownerCookieDigest(key);
  if (cookie && digest && safeEqual(cookie, digest)) return true;
  return false;
}

export function ownerCookieHeader(https: boolean, clear = false): string {
  const digest = ownerCookieDigest();
  const parts = [
    `${OWNER_COOKIE}=${clear ? "" : digest}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    clear ? "Max-Age=0" : "Max-Age=2592000",
  ];
  if (https) parts.push("Secure");
  return parts.join("; ");
}

const hits = new Map<string, { n: number; reset: number }>();

/** Cheap per-IP cap on AI-shaped routes that somehow arrive without an owner session. */
export function demoAiBlocked(ip: string): boolean {
  const now = Date.now();
  const row = hits.get(ip);
  if (!row || now > row.reset) {
    hits.set(ip, { n: 1, reset: now + 60_000 });
    return false;
  }
  row.n += 1;
  return row.n > 8;
}

export function requestIp(req: IncomingMessage): string {
  const xf = req.headers["x-forwarded-for"];
  const raw = Array.isArray(xf) ? xf[0] : xf;
  if (raw) return raw.split(",")[0]?.trim() || "unknown";
  return req.socket?.remoteAddress || "unknown";
}
