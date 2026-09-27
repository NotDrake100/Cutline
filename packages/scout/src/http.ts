/**
 * Live Scout HTTP adapters — RSS + TinyFish.
 * Never log or print API key values.
 */
import type { SourceHit } from "../../core/src/types";
import { ENV } from "../../core/src/env";
import { tinyfishUrl } from "./scout";

const UA = "CutlineScout/0.1 (+https://cutline.local)";
const TIMEOUT_MS = 5_000;

function outletFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host.split(".")[0] || host;
  } catch {
    return "unknown";
  }
}

function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

function tagText(block: string, names: string[]): string {
  for (const name of names) {
    const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i");
    const m = block.match(re);
    if (!m) continue;
    // Decode CDATA first — stripping tags before CDATA wipe kills titles.
    const decoded = decodeXml(m[1]);
    return decoded.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  return "";
}

function linkFromBlock(block: string): string {
  const atom = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i);
  if (atom?.[1]) return decodeXml(atom[1]);
  const rss = tagText(block, ["link", "guid"]);
  if (rss.startsWith("http")) return rss;
  const bare = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
  if (bare) {
    const v = decodeXml(bare[1].replace(/<[^>]+>/g, "").trim());
    if (v.startsWith("http")) return v;
  }
  return "";
}

/** Simple RSS/Atom parse — titles + links. Skip on failure. */
export async function fetchRss(
  url: string
): Promise<{ title: string; link: string; outlet: string; summary?: string }[]> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": UA,
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
      redirect: "follow",
    });
    clearTimeout(t);
    if (!res.ok) return [];
    const xml = await res.text();
    const blocks = [
      ...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi),
      ...xml.matchAll(/<entry[\s>][\s\S]*?<\/entry>/gi),
    ].map((m) => m[0]);
    const outlet = outletFromUrl(url);
    const out: { title: string; link: string; outlet: string; summary?: string }[] = [];
    for (const block of blocks.slice(0, 40)) {
      const title = tagText(block, ["title"]);
      const link = linkFromBlock(block);
      if (!title || !link || !link.startsWith("http")) continue;
      const summary = tagText(block, ["description", "summary", "content"]) || undefined;
      out.push({ title, link, outlet, summary: summary?.slice(0, 400) });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Fast URL liveness check. Prefer HEAD; treat bot-walls as OK (URL is real).
 * Never invent URLs — only validate ones we already have from RSS/TinyFish.
 */
export async function fetchPageOk(url: string): Promise<boolean> {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  const head = async (): Promise<"ok" | "dead" | "retry"> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    try {
      const res = await fetch(url, {
        method: "HEAD",
        signal: ctrl.signal,
        headers: { "User-Agent": UA, Accept: "*/*" },
        redirect: "follow",
      });
      clearTimeout(timer);
      if (res.status >= 200 && res.status < 400) return "ok";
      if (res.status === 401 || res.status === 403 || res.status === 405) return "ok";
      if (res.status === 404 || res.status === 410) return "dead";
      return "retry";
    } catch {
      clearTimeout(timer);
      return "retry";
    }
  };
  const h = await head();
  if (h === "ok") return true;
  if (h === "dead") return false;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2500);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "text/html,*/*", Range: "bytes=0-512" },
      redirect: "follow",
    });
    clearTimeout(timer);
    try {
      res.body?.cancel();
    } catch {
      /* ignore */
    }
    if (res.status === 404 || res.status === 410) return false;
    return res.status < 500;
  } catch {
    clearTimeout(timer);
    return false;
  }
}

export function hasTinyfishKey(): boolean {
  const v = process.env[ENV.TINYFISH_API_KEY];
  return !!(v && v.trim());
}

/**
 * TinyFish news search — same contract as DCN Mumbai tinyfish_search.py.
 * If no key, return [] (don't crash). Never logs key values.
 */
export async function tinyfishSearch(
  query: string,
  opts?: { location?: string; recencyMinutes?: number }
): Promise<SourceHit[]> {
  if (!hasTinyfishKey() || !query?.trim()) return [];
  const location = opts?.location || "IN";
  const recency = opts?.recencyMinutes ?? 2880;
  const url = tinyfishUrl(query.trim(), location, recency);
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "X-API-Key": process.env[ENV.TINYFISH_API_KEY]!.trim(),
        Accept: "application/json",
        "User-Agent": UA,
      },
    });
    clearTimeout(t);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: Array<{
        title?: string;
        url?: string;
        link?: string;
        snippet?: string;
        publisher?: string;
        site_name?: string;
        date?: string;
      }>;
    };
    const hits: SourceHit[] = [];
    for (const r of data.results || []) {
      const sourceUrl = (r.url || r.link || "").trim();
      if (!sourceUrl.startsWith("http")) continue;
      const title = (r.title || "").trim();
      if (!title) continue;
      hits.push({
        title,
        sourceUrl,
        outlet: (r.publisher || r.site_name || outletFromUrl(sourceUrl)).trim(),
        snippet: r.snippet,
        publishedAt: r.date,
        via: "tinyfish",
      });
    }
    return hits;
  } catch {
    return [];
  }
}

/** Deps bag for scoutBeat. */
export function createScoutDeps(opts?: {
  location?: string;
  recencyMinutes?: number;
  queryOverride?: string;
}) {
  return {
    fetchRss,
    fetchPageOk,
    tinyfishSearch: async (q: string) =>
      tinyfishSearch(opts?.queryOverride || q, {
        location: opts?.location,
        recencyMinutes: opts?.recencyMinutes,
      }),
  };
}
